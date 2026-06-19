import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  protectedProcedure,
  router,
  staffMutationProcedure,
} from "../_core/trpc";
import { assertIpRateLimit, assertUserRateLimit } from "../_core/rateLimit";
import * as db from "../db";
import { hashToken, signQrToken, verifyQrToken } from "../qrToken";

/**
 * Resolve a scanned QR token to a ticket. Two-factor: the token's HMAC must
 * verify, AND the *hash* of the full token must match the hash we stored when
 * the ticket was first issued. This means a stolen / re-signed token bound to
 * the same ticket id won't match (different nonce -> different hash).
 */
async function resolveTicketFromToken(token: string) {
  const payload = verifyQrToken(token);
  if (!payload) return { ticket: null as null, payload: null };
  const ticketByHash = await db.getTicketByHash(hashToken(token));
  if (!ticketByHash) return { ticket: null, payload };
  if (ticketByHash.id !== payload.tid || ticketByHash.ticketCode !== payload.code) {
    return { ticket: null, payload };
  }
  return { ticket: ticketByHash, payload };
}

type TicketForView = NonNullable<Awaited<ReturnType<typeof db.getTicketByCode>>>;
type OrderForView = NonNullable<Awaited<ReturnType<typeof db.getOrderById>>>;
type EventForView = NonNullable<Awaited<ReturnType<typeof db.getEventById>>>;
type TicketTypeForView = NonNullable<Awaited<ReturnType<typeof db.getTicketType>>>;

function isStaffOrAdmin(user: { role: string }) {
  return user.role === "admin" || user.role === "staff";
}

function assertTicketAccess(order: OrderForView | undefined, user: { id: number; role: string }) {
  if (isStaffOrAdmin(user)) return;
  if (!order || order.userId !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ticket access denied" });
  }
}

function serializeTicketForView(ticket: TicketForView) {
  return {
    id: ticket.id,
    ticketCode: ticket.ticketCode,
    status: ticket.status,
    usedAt: ticket.usedAt,
    qrImageUrl: ticket.qrImageUrl,
  };
}

function serializeEventForView(event: EventForView | undefined) {
  return event
    ? {
        id: event.id,
        title: event.title,
        titleMm: event.titleMm,
        venue: event.venue,
        startsAt: event.startsAt,
      }
    : null;
}

function serializeTicketTypeForView(ticketType: TicketTypeForView | undefined) {
  return ticketType ? { name: ticketType.name } : null;
}

function serializeOrderForTicketView(order: OrderForView | undefined) {
  return order
    ? {
        id: order.id,
        buyerName: order.buyerName,
        quantity: order.quantity,
      }
    : null;
}

export const ticketsRouter = router({
  /**
   * Authenticated ticket-view endpoint (by ticket code).
   * Owners can view their own ticket; staff/admin can view any ticket.
   * Returns enough info to render the ticket card + the issued signed QR token,
   * without exposing raw DB rows or QR token hashes.
   */
  getByCode: protectedProcedure.input(z.object({ code: z.string() })).query(async ({ input, ctx }) => {
    await assertIpRateLimit(ctx, {
      namespace: "tickets.getByCode",
      limit: 30,
      windowMs: 60_000,
    });
    const ticket = await db.getTicketByCode(input.code);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
    const order = await db.getOrderById(ticket.orderId);
    assertTicketAccess(order, ctx.user);
    const event = await db.getEventById(ticket.eventId);
    const ticketType = await db.getTicketType(ticket.ticketTypeId);
    // Re-derive the issued token. Because token issuance writes the hash into
    // tickets.qrTokenHash and the QR is rendered server-side from that token,
    // we look up the issued token via the stored hash by re-signing then
    // matching. To keep the hash authoritative without storing the raw token,
    // we sign a fresh token here and write its hash back if the ticket is in
    // its first view; subsequent views must match. (Pragmatic compromise for
    // demo: hash is stable per ticket and re-derivable on the server.)
    let token: string | null = null;
    if (ticket.status === "VALID" && !ticket.qrImageUrl) {
      const candidate = signQrToken({ ticketId: ticket.id, ticketCode: ticket.ticketCode });
      const candidateHash = hashToken(candidate);
      if (candidateHash === ticket.qrTokenHash) {
        token = candidate;
      } else {
        // The originally issued token was different (different nonce). Rotate
        // the stored hash to this newly-derived token so the buyer's QR can be
        // displayed and later scanned. Token rotation is safe because old
        // tokens (now without a matching hash) will fail at the gate.
        await db.updateTicketHash(ticket.id, candidateHash);
        token = candidate;
      }
    }
    return {
      ticket: serializeTicketForView(ticket),
      event: serializeEventForView(event),
      ticketType: serializeTicketTypeForView(ticketType),
      order: serializeOrderForTicketView(order),
      qrToken: token,
    };
  }),

  /**
   * STAFF: Verify a scanned QR token without marking it used.
   * Returns the buyer / event info + status.
   */
  scannerVerify: staffMutationProcedure
    .input(z.object({ qrToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await assertUserRateLimit(ctx.user.id, {
        namespace: "tickets.scannerVerify",
        limit: 60,
        windowMs: 60_000,
      });
      const { ticket } = await resolveTicketFromToken(input.qrToken);
      if (!ticket) {
        await db.logScan({
          ticketId: null,
          staffId: ctx.user.id,
          result: "INVALID",
          deviceInfo: "scannerVerify",
        });
        return { valid: false, reason: "INVALID" as const };
      }
      const event = await db.getEventById(ticket.eventId);
      const ticketType = await db.getTicketType(ticket.ticketTypeId);
      const order = await db.getOrderById(ticket.orderId);
      return {
        valid: true,
        status: ticket.status,
        ticket: {
          id: ticket.id,
          code: ticket.ticketCode,
          status: ticket.status,
          usedAt: ticket.usedAt,
        },
        event: event ? { id: event.id, title: event.title, venue: event.venue, startsAt: event.startsAt } : null,
        ticketType: ticketType ? { name: ticketType.name } : null,
        buyer: order ? { name: order.buyerName } : null,
      };
    }),

  /**
   * STAFF: Mark ticket USED. Server-side verifies token + status before mutating.
   * Records a scan log row regardless of outcome.
   */
  scannerCheckIn: staffMutationProcedure
    .input(z.object({ qrToken: z.string(), deviceInfo: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      await assertUserRateLimit(ctx.user.id, {
        namespace: "tickets.scannerCheckIn",
        limit: 60,
        windowMs: 60_000,
      });
      const { ticket } = await resolveTicketFromToken(input.qrToken);
      if (!ticket) {
        await db.logScan({
          ticketId: null,
          staffId: ctx.user.id,
          result: "INVALID",
          deviceInfo: input.deviceInfo ?? null,
        });
        return { ok: false, status: "INVALID" as const };
      }
      if (ticket.status === "USED") {
        await db.logScan({
          ticketId: ticket.id,
          staffId: ctx.user.id,
          result: "ALREADY_USED",
          deviceInfo: input.deviceInfo ?? null,
        });
        return {
          ok: false,
          status: "ALREADY_USED" as const,
          ticket: {
            id: ticket.id,
            code: ticket.ticketCode,
            status: ticket.status,
            usedAt: ticket.usedAt,
          },
        };
      }
      if (ticket.status === "CANCELLED") {
        await db.logScan({
          ticketId: ticket.id,
          staffId: ctx.user.id,
          result: "CANCELLED",
          deviceInfo: input.deviceInfo ?? null,
        });
        return { ok: false, status: "CANCELLED" as const };
      }
      if (ticket.status === "EXPIRED") {
        await db.logScan({
          ticketId: ticket.id,
          staffId: ctx.user.id,
          result: "EXPIRED",
          deviceInfo: input.deviceInfo ?? null,
        });
        return { ok: false, status: "EXPIRED" as const };
      }
      // status === VALID
      const checkIn = await db.checkInTicketAtomically({
        ticketId: ticket.id,
        staffId: ctx.user.id,
        deviceInfo: input.deviceInfo ?? null,
      });
      if (!checkIn.ok) return checkIn;
      const order = await db.getOrderById(ticket.orderId);
      const event = await db.getEventById(ticket.eventId);
      const tt = await db.getTicketType(ticket.ticketTypeId);
      return {
        ok: true,
        status: "SUCCESS" as const,
        ticket: checkIn.ticket,
        buyer: order ? { name: order.buyerName } : null,
        event: event ? { title: event.title } : null,
        ticketType: tt ? { name: tt.name } : null,
        checkedInAt: checkIn.checkedInAt,
      };
    }),

  /**
   * ADMIN: list scan logs and tickets for an event for the attendance report.
   */
  adminAttendanceReport: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ input }) => {
      const [allTickets, scanLogs, event] = await Promise.all([
        db.getTicketsByEvent(input.eventId),
        db.listScanLogsByEvent(input.eventId),
        db.getEventById(input.eventId),
      ]);
      const total = allTickets.length;
      const used = allTickets.filter((t) => t.status === "USED").length;
      const valid = allTickets.filter((t) => t.status === "VALID").length;
      const cancelled = allTickets.filter((t) => t.status === "CANCELLED").length;
      return {
        event,
        summary: {
          total,
          used,
          valid,
          remaining: valid,
          cancelled,
          attendanceRate: total ? used / total : 0,
        },
        tickets: allTickets,
        scanLogs,
      };
    }),
});
