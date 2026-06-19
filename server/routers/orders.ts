import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import * as db from "../db";
import { hashToken, signQrToken } from "../qrToken";
import { storagePut } from "../storage";

function genMerchantUid(): string {
  const ts = Date.now();
  const rand = randomBytes(4).toString("hex");
  return `smu_${ts}_${rand}`;
}

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function parseReceiptDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl
  );
  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Receipt must be a jpg, jpeg, png, or webp image.",
    });
  }
  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > RECEIPT_MAX_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Receipt image must be 10MB or smaller.",
    });
  }
  return { buffer, contentType, extension: RECEIPT_TYPES[contentType] };
}

function assertReceiptFileName(fileName: string | undefined) {
  if (!fileName) return;
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext || !["jpg", "jpeg", "png", "webp"].includes(ext)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Receipt file type must be jpg, jpeg, png, or webp.",
    });
  }
}

function parseTicketSequence(ticketCode: string | undefined, year: number) {
  if (!ticketCode) return 0;
  const match = new RegExp(`^FT-${year}-(\\d{6})$`).exec(ticketCode);
  return match ? Number(match[1]) : 0;
}

async function nextTicketCodes(quantity: number) {
  const year = new Date().getFullYear();
  const latest = await db.getLatestTicketCodeForYear(year);
  const start = parseTicketSequence(latest, year) + 1;
  return Array.from(
    { length: quantity },
    (_, index) => `FT-${year}-${String(start + index).padStart(6, "0")}`
  );
}

async function createQrImage(ticketCode: string, signedToken: string) {
  const dataUrl = await QRCode.toDataURL(signedToken, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#0B2B5C", light: "#FFFFFF" },
  });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  return storagePut(`qr-tickets/${ticketCode}.png`, buffer, "image/png");
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Event not available",
        });
      }
      const now = Date.now();
      if (now < event.saleStartsAt || now > event.saleEndsAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ticket sale window is closed",
        });
      }
      const tt = await db.getTicketType(input.ticketTypeId);
      if (!tt || tt.eventId !== event.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid ticket type",
        });
      }
      if (tt.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This ticket type is unavailable",
        });
      }
      if (tt.soldCount + input.quantity > tt.stock) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Not enough tickets remaining",
        });
      }
      if (input.quantity > tt.maxPerUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You can buy up to ${tt.maxPerUser} of this ticket per order`,
        });
      }
      const totalAmount = tt.price * input.quantity;
      const merchantUid = genMerchantUid();
      let orderId: number;
      try {
        orderId = await db.createPendingOrderWithReservation({
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
      } catch (err) {
        if (
          err instanceof Error &&
          err.message === "Not enough tickets remaining"
        ) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
        throw err;
      }
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
      if (!order)
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      const event = await db.getEventById(order.eventId);
      const tt = await db.getTicketType(order.ticketTypeId);
      const issuedTickets =
        order.status === "PAID" ? await db.getTicketsByOrder(order.id) : [];
      const latestProof = await db.getLatestPaymentProofByOrder(order.id);
      return {
        order,
        event,
        ticketType: tt,
        tickets: issuedTickets,
        latestProof: latestProof ?? null,
      };
    }),

  uploadPaymentProof: publicProcedure
    .input(
      z.object({
        merchantUid: z.string(),
        receiptImageDataUrl: z.string(),
        fileName: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertReceiptFileName(input.fileName);
      const { buffer, contentType, extension } = parseReceiptDataUrl(
        input.receiptImageDataUrl
      );
      const order = await db.getOrderByMerchantUid(input.merchantUid);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Order is ${order.status}; receipt upload is not available.`,
        });
      }

      const upload = await storagePut(
        `payment-proofs/${order.merchantUid}.${extension}`,
        buffer,
        contentType
      );
      const paymentKey = `bank_${order.merchantUid}`;
      await db.createPayment({
        orderId: order.id,
        provider: "bank_transfer",
        paymentKey,
        amount: order.totalAmount,
        currency: "KRW",
        status: "PENDING_VERIFICATION",
        rawPayload: {
          receiptImageUrl: upload.url,
          fileName: input.fileName ?? null,
        },
      });
      const payment = await db.getPaymentByKey(paymentKey);
      const proofId = await db.createPaymentProof({
        orderId: order.id,
        paymentId: payment?.id ?? null,
        uploadedByUserId: ctx.user?.id ?? null,
        receiptImageUrl: upload.url,
        status: "PENDING",
      });
      await db.setOrderStatus(order.id, "PENDING_PAYMENT_VERIFICATION");
      await db.logPayment({
        orderId: order.id,
        provider: "bank_transfer",
        eventType: "payment_proof.uploaded",
        payload: { proofId, receiptImageUrl: upload.url },
        verified: "true",
      });
      return {
        ok: true,
        proofId,
        status: "PENDING_PAYMENT_VERIFICATION" as const,
      };
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
        return {
          ok: true,
          alreadyPaid: true,
          tickets: tickets.map(t => t.ticketCode),
        };
      }
      if (order.status !== "PENDING") {
        await db.logPayment({
          orderId: order.id,
          provider: "mock",
          eventType: "webhook.invalid_state",
          payload: { input, currentStatus: order.status },
          verified: "false",
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Order is ${order.status}, cannot mark paid`,
        });
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Amount mismatch",
        });
      }

      // Mark paid + issue tickets atomically (best-effort given MySQL).
      const paymentKey =
        input.paymentKey ?? `mock_${randomBytes(6).toString("hex")}`;
      await db.markOrderPaid(order.id, paymentKey);
      await db.createPayment({
        orderId: order.id,
        provider: "mock",
        paymentKey,
        amount: order.totalAmount,
        currency: "KRW",
        status: "SUCCEEDED",
        rawPayload: { input },
        paidAt: new Date(),
      });

      const issued: { code: string; token: string }[] = [];
      const ticketCodes = await nextTicketCodes(order.quantity);
      for (const ticketCode of ticketCodes) {
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

      return { ok: true, alreadyPaid: false, tickets: issued.map(t => t.code) };
    }),

  // ── Admin order management
  adminListOrders: adminProcedure.query(async () => {
    const [allOrders, allEvents] = await Promise.all([
      db.listOrders(),
      db.listAllEvents(),
    ]);
    const eventMap = new Map(allEvents.map(e => [e.id, e]));
    return allOrders.map(o => ({
      ...o,
      event: eventMap.get(o.eventId) ?? null,
    }));
  }),

  adminListPaymentProofs: adminProcedure.query(async () => {
    const proofs = await db.listPendingPaymentProofs();
    const rows = await Promise.all(
      proofs.map(async proof => {
        const order = await db.getOrderById(proof.orderId);
        const [event, ticketType] = order
          ? await Promise.all([
              db.getEventById(order.eventId),
              db.getTicketType(order.ticketTypeId),
            ])
          : [undefined, undefined];
        return {
          proof,
          order: order ?? null,
          event: event ?? null,
          ticketType: ticketType ?? null,
        };
      })
    );
    return rows;
  }),

  adminApprovePaymentProof: adminProcedure
    .input(z.object({ proofId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const proof = await db.getPaymentProofById(input.proofId);
      if (!proof) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Proof not found" });
      }
      if (proof.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Proof is already ${proof.status}.`,
        });
      }
      const order = await db.getOrderById(proof.orderId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.status === "PAID") {
        const tickets = await db.getTicketsByOrder(order.id);
        await db.setPaymentProofApproved(proof.id, ctx.user.id);
        return {
          ok: true,
          alreadyPaid: true,
          tickets: tickets.map(ticket => ticket.ticketCode),
        };
      }
      if (order.status !== "PENDING_PAYMENT_VERIFICATION") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Order is ${order.status}; approval is not available.`,
        });
      }

      const payment = proof.paymentId
        ? undefined
        : await db.getPaymentByKey(`bank_${order.merchantUid}`);
      const paymentId = proof.paymentId ?? payment?.id;
      if (paymentId) {
        await db.setPaymentStatus(paymentId, "PAID", new Date());
      }
      await db.markOrderPaid(order.id, `bank_${order.merchantUid}`);

      const ticketCodes = await nextTicketCodes(order.quantity);
      const issued: string[] = [];
      for (const ticketCode of ticketCodes) {
        const placeholderHash = randomBytes(16).toString("hex");
        const ticketId = await db.createTicket({
          orderId: order.id,
          eventId: order.eventId,
          ticketTypeId: order.ticketTypeId,
          ticketCode,
          qrTokenHash: placeholderHash,
          status: "VALID",
        });
        const signedToken = signQrToken({ ticketId, ticketCode });
        const qrTokenHash = hashToken(signedToken);
        const qrImage = await createQrImage(ticketCode, signedToken);
        await db.updateTicketQr(ticketId, {
          qrTokenHash,
          qrImageUrl: qrImage.url,
        });
        issued.push(ticketCode);
      }
      await db.setPaymentProofApproved(proof.id, ctx.user.id);
      await db.logPayment({
        orderId: order.id,
        provider: "bank_transfer",
        eventType: "payment_proof.approved",
        payload: { proofId: proof.id, ticketsIssued: issued.length },
        verified: "true",
      });
      void notifyOwner({
        title: `Payment proof approved for order #${order.id}`,
        content: `${order.buyerName} (${order.buyerEmail}) was approved for ${issued.length} ticket(s): ${issued.join(", ")}.`,
      }).catch(() => {});
      return { ok: true, alreadyPaid: false, tickets: issued };
    }),

  adminRejectPaymentProof: adminProcedure
    .input(
      z.object({
        proofId: z.number(),
        reason: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const proof = await db.getPaymentProofById(input.proofId);
      if (!proof) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Proof not found" });
      }
      if (proof.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Proof is already ${proof.status}.`,
        });
      }
      const order = await db.getOrderById(proof.orderId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (proof.paymentId) {
        await db.setPaymentStatus(proof.paymentId, "REJECTED", null);
      } else {
        const payment = await db.getPaymentByKey(`bank_${order.merchantUid}`);
        if (payment) await db.setPaymentStatus(payment.id, "REJECTED", null);
      }
      await db.setPaymentProofRejected(proof.id, {
        reviewedByUserId: ctx.user.id,
        rejectionReason: input.reason.trim(),
      });
      await db.setOrderStatus(order.id, "PENDING");
      await db.logPayment({
        orderId: order.id,
        provider: "bank_transfer",
        eventType: "payment_proof.rejected",
        payload: { proofId: proof.id, reason: input.reason.trim() },
        verified: "false",
      });
      void notifyOwner({
        title: `Payment proof rejected for order #${order.id}`,
        content: `${order.buyerName} (${order.buyerEmail}) needs to upload a new receipt. Reason: ${input.reason.trim()}`,
      }).catch(() => {});
      return { ok: true, status: "REJECTED" as const };
    }),

  adminCancelOrder: adminProcedure
    .input(
      z.object({ orderId: z.number(), refund: z.boolean().default(false) })
    )
    .mutation(async ({ input }) => {
      const order = await db.getOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const newStatus = input.refund ? "REFUNDED" : "CANCELLED";
      await db.setOrderStatus(input.orderId, newStatus);
      if (order.status === "PENDING") {
        await db.releaseSoldCount(order.ticketTypeId, order.quantity);
      }
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order is not in PAID state",
        });
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
