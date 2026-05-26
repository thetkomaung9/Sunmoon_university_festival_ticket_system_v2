import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import * as db from "../db";
import { hashToken, signQrToken } from "../qrToken";

function genMerchantUid(): string {
  const ts = Date.now();
  const rand = randomBytes(4).toString("hex");
  return `smu_${ts}_${rand}`;
}

function genTicketCode(eventId: number): string {
  const rand = randomBytes(3).toString("hex").toUpperCase();
  const yyyy = new Date().getFullYear();
  return `TCK-${yyyy}-${eventId}-${rand}`;
}

export const ordersRouter = router({
  /**
   * PUBLIC: Create a pending order.
   * Backend computes total from authoritative ticket_types.price (never trust client price).
   */
  createPending: publicProcedure
    .input(
      z.object({
        eventId: z.number(),
        ticketTypeId: z.number(),
        quantity: z.number().min(1).max(10),
        buyerName: z.string().min(1).max(120),
        buyerEmail: z.string().email().max(320),
        buyerPhone: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const event = await db.getEventById(input.eventId);
      if (!event || event.status !== "PUBLISHED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Event not available" });
      }
      const now = Date.now();
      if (now < event.saleStartsAt || now > event.saleEndsAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket sale window is closed" });
      }
      const tt = await db.getTicketType(input.ticketTypeId);
      if (!tt || tt.eventId !== event.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid ticket type" });
      }
      if (tt.status !== "ACTIVE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This ticket type is unavailable" });
      }
      if (tt.soldCount + input.quantity > tt.stock) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough tickets remaining" });
      }
      if (input.quantity > tt.maxPerUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You can buy up to ${tt.maxPerUser} of this ticket per order`,
        });
      }
      const totalAmount = tt.price * input.quantity;
      const merchantUid = genMerchantUid();
      const orderId = await db.createOrder({
        merchantUid,
        eventId: event.id,
        ticketTypeId: tt.id,
        userId: ctx.user?.id,
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        buyerPhone: input.buyerPhone ?? null,
        quantity: input.quantity,
        totalAmount,
        status: "PENDING",
        paymentProvider: "mock",
      });
      return { orderId, merchantUid, totalAmount };
    }),

  /**
   * PUBLIC: Read order summary by merchantUid (for the checkout page).
   * Returns minimal info — no auth required since the merchantUid acts as a capability.
   */
  getByMerchantUid: publicProcedure
    .input(z.object({ merchantUid: z.string() }))
    .query(async ({ input }) => {
      const order = await db.getOrderByMerchantUid(input.merchantUid);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      const event = await db.getEventById(order.eventId);
      const tt = await db.getTicketType(order.ticketTypeId);
      const issuedTickets = order.status === "PAID" ? await db.getTicketsByOrder(order.id) : [];
      return { order, event, ticketType: tt, tickets: issuedTickets };
    }),

  /**
   * PUBLIC (rate-limited in production): simulate the payment provider webhook.
   *
   * In real Stripe deployment, this endpoint would be a raw Express POST handler
   * verifying the Stripe-Signature header against the webhook secret. Here we
   * mimic the verified-webhook contract: server-side validation of order +
   * amount, then status PAID + ticket issuance.
   *
   * The frontend never sets PAID status; it only triggers this endpoint after
   * the (mock) checkout completes.
   */
  paymentWebhook: publicProcedure
    .input(
      z.object({
        merchantUid: z.string(),
        // The "PG" reports back the amount it charged. We compare to our own.
        paidAmount: z.number(),
        paymentKey: z.string().optional(),
        // Simulated provider signature — in real Stripe, stripe.webhooks.constructEvent
        // would have already validated this before reaching the handler.
        providerSignature: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const order = await db.getOrderByMerchantUid(input.merchantUid);
      if (!order) {
        await db.logPayment({
          orderId: null,
          provider: "mock",
          eventType: "webhook.unknown_order",
          payload: { input },
          verified: "false",
        });
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      // Idempotency: if already PAID, return existing tickets.
      if (order.status === "PAID") {
        const tickets = await db.getTicketsByOrder(order.id);
        return { ok: true, alreadyPaid: true, tickets: tickets.map((t) => t.ticketCode) };
      }
      if (order.status !== "PENDING") {
        await db.logPayment({
          orderId: order.id,
          provider: "mock",
          eventType: "webhook.invalid_state",
          payload: { input, currentStatus: order.status },
          verified: "false",
        });
        throw new TRPCError({ code: "BAD_REQUEST", message: `Order is ${order.status}, cannot mark paid` });
      }
      // Server-side amount comparison — never trust the frontend.
      if (input.paidAmount !== order.totalAmount) {
        await db.logPayment({
          orderId: order.id,
          provider: "mock",
          eventType: "webhook.amount_mismatch",
          payload: { input, expected: order.totalAmount },
          verified: "false",
        });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Amount mismatch" });
      }

      // Mark paid + issue tickets atomically (best-effort given MySQL).
      const paymentKey = input.paymentKey ?? `mock_${randomBytes(6).toString("hex")}`;
      await db.markOrderPaid(order.id, paymentKey);
      await db.incrementSoldCount(order.ticketTypeId, order.quantity);

      const issued: { code: string; token: string }[] = [];
      for (let i = 0; i < order.quantity; i++) {
        const ticketCode = genTicketCode(order.eventId);
        // Insert with a placeholder hash, sign token bound to ticketId, then update hash.
        const tempToken = randomBytes(16).toString("hex");
        const ticketId = await db.createTicket({
          orderId: order.id,
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
          ticketCode,
          qrTokenHash: tempToken,
          status: "VALID",
        });
        const signedToken = signQrToken({ ticketId, ticketCode });
        const tokenHash = hashToken(signedToken);
        await db.updateTicketHash(ticketId, tokenHash);
        issued.push({ code: ticketCode, token: signedToken });
      }

      await db.logPayment({
        orderId: order.id,
        provider: "mock",
        eventType: "webhook.payment_succeeded",
        payload: { input, ticketsIssued: issued.length },
        verified: "true",
      });

      // Owner notification (fire-and-forget).
      void notifyOwner({
        title: `New paid order #${order.id}`,
        content: `${order.buyerName} (${order.buyerEmail}) paid ${order.totalAmount.toLocaleString()} KRW for ${order.quantity} ticket(s).`,
      }).catch(() => {});

      return { ok: true, alreadyPaid: false, tickets: issued.map((t) => t.code) };
    }),

  // ── Admin order management
  adminListOrders: adminProcedure.query(async () => {
    const [allOrders, allEvents] = await Promise.all([db.listOrders(), db.listAllEvents()]);
    const eventMap = new Map(allEvents.map((e) => [e.id, e]));
    return allOrders.map((o) => ({
      ...o,
      event: eventMap.get(o.eventId) ?? null,
    }));
  }),

  adminCancelOrder: adminProcedure
    .input(z.object({ orderId: z.number(), refund: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const order = await db.getOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const newStatus = input.refund ? "REFUNDED" : "CANCELLED";
      await db.setOrderStatus(input.orderId, newStatus);
      // Cancel all tickets
      const tickets = await db.getTicketsByOrder(input.orderId);
      for (const t of tickets) {
        if (t.status === "VALID") {
          await db.setTicketStatus(t.id, "CANCELLED");
        }
      }
      void notifyOwner({
        title: `Order #${order.id} ${newStatus.toLowerCase()}`,
        content: `Order for ${order.buyerName} (${order.buyerEmail}) has been ${newStatus.toLowerCase()}.`,
      }).catch(() => {});
      return { ok: true, status: newStatus };
    }),

  adminResendTickets: adminProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ input }) => {
      const order = await db.getOrderById(input.orderId);
      if (!order || order.status !== "PAID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not in PAID state" });
      }
      const tickets = await db.getTicketsByOrder(input.orderId);
      // In production this would re-trigger the email helper; here we just notify the owner.
      void notifyOwner({
        title: `Tickets resent for order #${order.id}`,
        content: `Resent ${tickets.length} ticket(s) to ${order.buyerEmail}.`,
      }).catch(() => {});
      return { ok: true, count: tickets.length };
    }),
});
