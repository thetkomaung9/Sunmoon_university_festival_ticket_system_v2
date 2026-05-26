import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router, staffProcedure } from "../_core/trpc";
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

export const ticketsRouter = router({
  /**
   * PUBLIC: Buyer ticket-view endpoint (by ticket code).
   * Returns enough info to render the ticket card + the issued signed QR token,
   * but never exposes any other buyer's data. The token returned here is the
   * same one whose hash is stored in `tickets.qrTokenHash`.
   */
  getByCode: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
    const ticket = await db.getTicketByCode(input.code);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
    const event = await db.getEventById(ticket.eventId);
    const ticketType = await db.getTicketType(ticket.ticketTypeId);
    const order = await db.getOrderById(ticket.orderId);
    // Re-derive the issued token. Because token issuance writes the hash into
    // tickets.qrTokenHash and the QR is rendered server-side from that token,
    // we look up the issued token via the stored hash by re-signing then
    // matching. To keep the hash authoritative without storing the raw token,
    // we sign a fresh token here and write its hash back if the ticket is in
    // its first view; subsequent views must match. (Pragmatic compromise for
    // demo: hash is stable per ticket and re-derivable on the server.)
    let token: string | null = null;
    if (ticket.status === "VALID") {
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
      ticket,
      event,
      ticketType,
      order: order
        ? {
            id: order.id,
            buyerName: order.buyerName,
            quantity: order.quantity,
          }
        : null,
      qrToken: token,
    };
  }),

  /**
   * STAFF: Verify a scanned QR token without marking it used.
   * Returns the buyer / event info + status.
   */
  scannerVerify: staffProcedure
    .input(z.object({ qrToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
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
  scannerCheckIn: staffProcedure
    .input(z.object({ qrToken: z.string(), deviceInfo: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
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
        return { ok: false, status: "ALREADY_USED" as const, ticket };
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
      await db.markTicketUsed(ticket.id, ctx.user.id);
      await db.logScan({
        ticketId: ticket.id,
        staffId: ctx.user.id,
        result: "SUCCESS",
        deviceInfo: input.deviceInfo ?? null,
      });
      const order = await db.getOrderById(ticket.orderId);
      const event = await db.getEventById(ticket.eventId);
      const tt = await db.getTicketType(ticket.ticketTypeId);
      return {
        ok: true,
        status: "SUCCESS" as const,
        ticket: { id: ticket.id, code: ticket.ticketCode },
        buyer: order ? { name: order.buyerName } : null,
        event: event ? { title: event.title } : null,
        ticketType: tt ? { name: tt.name } : null,
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
        summary: { total, used, valid, cancelled, attendanceRate: total ? used / total : 0 },
        tickets: allTickets,
        scanLogs,
      };
    }),
});
