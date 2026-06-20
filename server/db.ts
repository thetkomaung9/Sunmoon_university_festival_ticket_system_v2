import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  attendance,
  eventCategories,
  events,
  InsertAttendance,
  InsertEvent,
  InsertEventCategory,
  InsertOrder,
  InsertPayment,
  InsertPaymentProof,
  InsertPaymentLog,
  InsertScanLog,
  InsertTicket,
  InsertTicketType,
  InsertUser,
  orders,
  payments,
  paymentProofs,
  paymentLogs,
  scanLogs,
  ticketTypes,
  tickets,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { createMysqlPoolOptions } from "./_core/mysqlConfig";

let _db: MySql2Database<Record<string, unknown>> | null = null;
let _pool: mysql.Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = mysql.createPool(createMysqlPoolOptions(process.env.DATABASE_URL));
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

// ─────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) {
    values.lastSignedIn = new Date();
  }
  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return result[0];
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function setUserRole(
  userId: number,
  role: "user" | "staff" | "admin"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────

export async function listActiveCategories() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(eventCategories)
    .where(eq(eventCategories.status, "ACTIVE"))
    .orderBy(eventCategories.sortOrder);
}

export async function listAllCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventCategories).orderBy(eventCategories.sortOrder);
}

export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(eventCategories)
    .where(eq(eventCategories.slug, slug))
    .limit(1);
  return r[0];
}

export async function createCategory(input: InsertEventCategory) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(eventCategories).values(input);
  return Number((result as unknown as { insertId: number }).insertId);
}

export async function updateCategory(
  id: number,
  patch: Partial<InsertEventCategory>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(eventCategories).set(patch).where(eq(eventCategories.id, id));
}

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────

export async function listPublishedEvents(categoryId?: number) {
  const db = await getDb();
  if (!db) return [];
  const where = categoryId
    ? and(eq(events.status, "PUBLISHED"), eq(events.categoryId, categoryId))
    : eq(events.status, "PUBLISHED");
  return db.select().from(events).where(where).orderBy(events.startsAt);
}

export async function listAllEvents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(events).orderBy(desc(events.startsAt));
}

export async function getEventBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  return r[0];
}

export async function getEventById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return r[0];
}

export async function createEvent(input: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(events).values(input);
  return Number((result as unknown as { insertId: number }).insertId);
}

export async function updateEvent(id: number, patch: Partial<InsertEvent>) {
  const db = await getDb();
  if (!db) return;
  await db.update(events).set(patch).where(eq(events.id, id));
}

// ─────────────────────────────────────────────
// Ticket types
// ─────────────────────────────────────────────

export async function listTicketTypesByEvent(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.eventId, eventId))
    .orderBy(ticketTypes.price);
}

export async function getTicketType(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.id, id))
    .limit(1);
  return r[0];
}

export async function createTicketType(input: InsertTicketType) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(ticketTypes).values(input);
  return Number((result as unknown as { insertId: number }).insertId);
}

export async function updateTicketType(
  id: number,
  patch: Partial<InsertTicketType>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(ticketTypes).set(patch).where(eq(ticketTypes.id, id));
}

export async function incrementSoldCount(ticketTypeId: number, by: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(ticketTypes)
    .set({ soldCount: sql`${ticketTypes.soldCount} + ${by}` })
    .where(eq(ticketTypes.id, ticketTypeId));
}

export async function releaseSoldCount(ticketTypeId: number, by: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(ticketTypes)
    .set({ soldCount: sql`GREATEST(${ticketTypes.soldCount} - ${by}, 0)` })
    .where(eq(ticketTypes.id, ticketTypeId));
}

// ─────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────

export async function createOrder(input: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(orders).values(input);
  return Number((result as unknown as { insertId: number }).insertId);
}

export async function createPendingOrderWithReservation(input: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (!input.ticketTypeId || !input.quantity) {
    throw new Error("ticketTypeId and quantity are required");
  }

  return db.transaction(async tx => {
    const ticketTypeRows = await tx
      .select({
        id: ticketTypes.id,
        stock: ticketTypes.stock,
        soldCount: ticketTypes.soldCount,
        status: ticketTypes.status,
      })
      .from(ticketTypes)
      .where(eq(ticketTypes.id, input.ticketTypeId))
      .limit(1);
    console.info("[TicketReservationDebug] before reserve", {
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      quantity: input.quantity,
      stock: ticketTypeRows[0]?.stock ?? null,
      soldCount: ticketTypeRows[0]?.soldCount ?? null,
      remaining: ticketTypeRows[0]
        ? ticketTypeRows[0].stock - ticketTypeRows[0].soldCount
        : null,
      status: ticketTypeRows[0]?.status ?? null,
    });

    const reserveResult = await tx
      .update(ticketTypes)
      .set({ soldCount: sql`${ticketTypes.soldCount} + ${input.quantity}` })
      .where(
        and(
          eq(ticketTypes.id, input.ticketTypeId),
          eq(ticketTypes.status, "ACTIVE"),
          sql`${ticketTypes.soldCount} + ${input.quantity} <= ${ticketTypes.stock}`
        )
      );
    const affected = affectedRows(reserveResult);
    console.info("[TicketReservationDebug] reserve result", {
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      quantity: input.quantity,
      affectedRows: affected,
      resultShape: Array.isArray(reserveResult) ? "mysql2-tuple" : typeof reserveResult,
    });
    if (affected === 0) {
      throw new Error("Not enough tickets remaining");
    }

    const result = await tx.insert(orders).values(input);
    return Number((result as unknown as { insertId: number }).insertId);
  });
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return r[0];
}

export async function getOrderByMerchantUid(merchantUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(orders)
    .where(eq(orders.merchantUid, merchantUid))
    .limit(1);
  return r[0];
}

export async function markOrderPaid(orderId: number, paymentKey: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(orders)
    .set({ status: "PAID", paymentKey, paidAt: new Date() })
    .where(eq(orders.id, orderId));
}

export async function createPayment(input: InsertPayment) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(payments)
    .values(input)
    .onDuplicateKeyUpdate({
      set: {
        amount: input.amount,
        status: input.status,
        rawPayload: input.rawPayload,
        paidAt: input.paidAt,
      },
    });
}

export async function getPaymentByKey(paymentKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentKey, paymentKey))
    .limit(1);
  return r[0];
}

export async function setPaymentStatus(
  paymentId: number,
  status:
    | "PENDING"
    | "PENDING_VERIFICATION"
    | "PAID"
    | "REJECTED"
    | "SUCCEEDED"
    | "FAILED"
    | "REFUNDED"
    | "CANCELLED",
  paidAt?: Date | null
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(payments)
    .set({ status, paidAt })
    .where(eq(payments.id, paymentId));
}

export async function setOrderStatus(
  orderId: number,
  status:
    | "PENDING"
    | "PENDING_PAYMENT_VERIFICATION"
    | "PAID"
    | "CANCELLED"
    | "REFUNDED"
    | "EXPIRED"
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(orders)
    .set({
      status,
      cancelledAt:
        status === "CANCELLED" || status === "REFUNDED"
          ? new Date()
          : undefined,
      paidAt: status === "PAID" ? new Date() : undefined,
    })
    .where(eq(orders.id, orderId));
}

export async function listOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function listOrdersByEvent(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(eq(orders.eventId, eventId))
    .orderBy(desc(orders.createdAt));
}

// ─────────────────────────────────────────────
// Tickets
// ─────────────────────────────────────────────

export async function createTicket(input: InsertTicket) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(tickets).values(input);
  return Number((result as unknown as { insertId: number }).insertId);
}

export async function getTicketByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(tickets)
    .where(eq(tickets.ticketCode, code))
    .limit(1);
  return r[0];
}

export async function getTicketByHash(hash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(tickets)
    .where(eq(tickets.qrTokenHash, hash))
    .limit(1);
  return r[0];
}

export async function getTicketsByOrder(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tickets).where(eq(tickets.orderId, orderId));
}

export async function getTicketsByEvent(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tickets)
    .where(eq(tickets.eventId, eventId))
    .orderBy(desc(tickets.issuedAt));
}

export async function markTicketUsed(ticketId: number, staffUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(tickets)
    .set({ status: "USED", usedAt: new Date(), usedByUserId: staffUserId })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, "VALID")));
}

export async function setTicketStatus(
  ticketId: number,
  status: "CANCELLED" | "EXPIRED" | "VALID"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(tickets).set({ status }).where(eq(tickets.id, ticketId));
}

export async function updateTicketHash(ticketId: number, qrTokenHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(tickets).set({ qrTokenHash }).where(eq(tickets.id, ticketId));
}

export async function updateTicketQr(
  ticketId: number,
  input: { qrTokenHash: string; qrImageUrl: string }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(tickets)
    .set({ qrTokenHash: input.qrTokenHash, qrImageUrl: input.qrImageUrl })
    .where(eq(tickets.id, ticketId));
}

export async function getLatestTicketCodeForYear(year: number) {
  const db = await getDb();
  if (!db) return undefined;
  const prefix = `FT-${year}-`;
  const r = await db
    .select({ ticketCode: tickets.ticketCode })
    .from(tickets)
    .where(sql`${tickets.ticketCode} LIKE ${`${prefix}%`}`)
    .orderBy(desc(tickets.ticketCode))
    .limit(1);
  return r[0]?.ticketCode;
}

function parseTicketSequence(ticketCode: string | undefined, year: number) {
  if (!ticketCode) return 0;
  const match = new RegExp(`^FT-${year}-(\\d{6})$`).exec(ticketCode);
  return match ? Number(match[1]) : 0;
}

function affectedRows(result: unknown) {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: number })?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: number }).affectedRows ?? 0);
}

export async function approvePaymentProofAndIssueTickets(input: {
  proofId: number;
  reviewedByUserId: number;
  createTicketQr: (
    ticketId: number,
    ticketCode: string
  ) => Promise<{ qrTokenHash: string; qrImageUrl: string }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  return db.transaction(async tx => {
    const proofRows = await tx
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.id, input.proofId))
      .limit(1);
    const proof = proofRows[0];
    if (!proof) throw new Error("Proof not found");
    if (proof.status !== "PENDING") {
      throw new Error(`Proof is already ${proof.status}.`);
    }

    const orderRows = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, proof.orderId))
      .limit(1);
    const order = orderRows[0];
    if (!order) throw new Error("Order not found");

    if (order.status === "PAID") {
      const existingTickets = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.orderId, order.id));
      await tx
        .update(paymentProofs)
        .set({
          status: "APPROVED",
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(),
          rejectionReason: null,
        })
        .where(eq(paymentProofs.id, proof.id));
      return {
        alreadyPaid: true,
        tickets: existingTickets.map(ticket => ticket.ticketCode),
      };
    }

    if (order.status !== "PENDING_PAYMENT_VERIFICATION") {
      throw new Error(`Order is ${order.status}; approval is not available.`);
    }

    const paymentRows = proof.paymentId
      ? await tx
          .select()
          .from(payments)
          .where(eq(payments.id, proof.paymentId))
          .limit(1)
      : await tx
          .select()
          .from(payments)
          .where(eq(payments.paymentKey, `bank_${order.merchantUid}`))
          .limit(1);
    const payment = paymentRows[0];
    if (!payment) throw new Error("Payment record not found");
    if (payment.orderId !== order.id) {
      throw new Error("Payment does not belong to this order");
    }
    if (payment.amount !== order.totalAmount) {
      throw new Error("Payment amount does not match order total");
    }
    if (payment.status !== "PENDING_VERIFICATION") {
      throw new Error(`Payment is ${payment.status}; approval is not available.`);
    }

    await tx
      .update(payments)
      .set({ status: "PAID", paidAt: new Date() })
      .where(eq(payments.id, payment.id));
    await tx
      .update(orders)
      .set({
        status: "PAID",
        paymentKey: `bank_${order.merchantUid}`,
        paidAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    const year = new Date().getFullYear();
    const prefix = `FT-${year}-`;
    const latestRows = await tx
      .select({ ticketCode: tickets.ticketCode })
      .from(tickets)
      .where(sql`${tickets.ticketCode} LIKE ${`${prefix}%`}`)
      .orderBy(desc(tickets.ticketCode))
      .limit(1);
    const start = parseTicketSequence(latestRows[0]?.ticketCode, year) + 1;
    const issued: string[] = [];

    for (let index = 0; index < order.quantity; index += 1) {
      const ticketCode = `FT-${year}-${String(start + index).padStart(6, "0")}`;
      const ticketResult = await tx.insert(tickets).values({
        orderId: order.id,
        eventId: order.eventId,
        ticketTypeId: order.ticketTypeId,
        ticketCode,
        qrTokenHash: `pending:${ticketCode}`,
        status: "VALID",
      });
      const ticketId = Number(
        (ticketResult as unknown as { insertId: number }).insertId
      );
      const qr = await input.createTicketQr(ticketId, ticketCode);
      await tx
        .update(tickets)
        .set({ qrTokenHash: qr.qrTokenHash, qrImageUrl: qr.qrImageUrl })
        .where(eq(tickets.id, ticketId));
      issued.push(ticketCode);
    }

    await tx
      .update(paymentProofs)
      .set({
        status: "APPROVED",
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(),
        rejectionReason: null,
      })
      .where(eq(paymentProofs.id, proof.id));
    await tx.insert(paymentLogs).values({
      orderId: order.id,
      provider: "bank_transfer",
      eventType: "payment_proof.approved",
      payload: { proofId: proof.id, ticketsIssued: issued.length },
      verified: "true",
    });

    return { alreadyPaid: false, tickets: issued };
  });
}

// ─────────────────────────────────────────────
// Payment proofs
// ─────────────────────────────────────────────

export async function createPaymentProof(input: InsertPaymentProof) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(paymentProofs).values(input);
  return Number((result as unknown as { insertId: number }).insertId);
}

export async function getPaymentProofById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(paymentProofs)
    .where(eq(paymentProofs.id, id))
    .limit(1);
  return r[0];
}

export async function listPendingPaymentProofs() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(paymentProofs)
    .where(eq(paymentProofs.status, "PENDING"))
    .orderBy(desc(paymentProofs.createdAt));
}

export async function getLatestPaymentProofByOrder(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db
    .select()
    .from(paymentProofs)
    .where(eq(paymentProofs.orderId, orderId))
    .orderBy(desc(paymentProofs.createdAt))
    .limit(1);
  return r[0];
}

export async function setPaymentProofApproved(
  proofId: number,
  reviewedByUserId: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(paymentProofs)
    .set({
      status: "APPROVED",
      reviewedByUserId,
      reviewedAt: new Date(),
      rejectionReason: null,
    })
    .where(eq(paymentProofs.id, proofId));
}

export async function setPaymentProofRejected(
  proofId: number,
  input: { reviewedByUserId: number; rejectionReason: string }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(paymentProofs)
    .set({
      status: "REJECTED",
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(),
      rejectionReason: input.rejectionReason,
    })
    .where(eq(paymentProofs.id, proofId));
}

// ─────────────────────────────────────────────
// Payment logs
// ─────────────────────────────────────────────

export async function logPayment(input: InsertPaymentLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(paymentLogs).values(input);
}

// ─────────────────────────────────────────────
// Attendance
// ─────────────────────────────────────────────

export async function recordAttendance(input: InsertAttendance) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(attendance)
    .values(input)
    .onDuplicateKeyUpdate({
      set: {
        staffId: input.staffId,
        scanLogId: input.scanLogId,
        status: "CHECKED_IN",
        deviceInfo: input.deviceInfo,
      },
    });
}

export async function checkInTicketAtomically(input: {
  ticketId: number;
  staffId: number;
  deviceInfo?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  return db.transaction(async tx => {
    const ticketRows = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, input.ticketId))
      .limit(1);
    const ticket = ticketRows[0];
    if (!ticket) throw new Error("Ticket not found");

    const logTerminalScan = async (
      result: "ALREADY_USED" | "CANCELLED" | "EXPIRED"
    ) => {
      await tx.insert(scanLogs).values({
        ticketId: ticket.id,
        staffId: input.staffId,
        result,
        deviceInfo: input.deviceInfo ?? null,
      });
      return {
        ok: false as const,
        status: result,
        ticket: {
          id: ticket.id,
          code: ticket.ticketCode,
          status: ticket.status,
          usedAt: ticket.usedAt,
        },
      };
    };

    if (ticket.status === "USED") return logTerminalScan("ALREADY_USED");
    if (ticket.status === "CANCELLED") return logTerminalScan("CANCELLED");
    if (ticket.status === "EXPIRED") return logTerminalScan("EXPIRED");

    const checkedInAt = new Date();
    const updateResult = await tx
      .update(tickets)
      .set({
        status: "USED",
        usedAt: checkedInAt,
        usedByUserId: input.staffId,
      })
      .where(and(eq(tickets.id, ticket.id), eq(tickets.status, "VALID")));

    if (affectedRows(updateResult) !== 1) {
      const freshRows = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticket.id))
        .limit(1);
      const freshTicket = freshRows[0] ?? ticket;
      await tx.insert(scanLogs).values({
        ticketId: ticket.id,
        staffId: input.staffId,
        result: "ALREADY_USED",
        deviceInfo: input.deviceInfo ?? null,
      });
      return {
        ok: false as const,
        status: "ALREADY_USED" as const,
        ticket: {
          id: freshTicket.id,
          code: freshTicket.ticketCode,
          status: freshTicket.status,
          usedAt: freshTicket.usedAt,
        },
      };
    }

    const scanResult = await tx.insert(scanLogs).values({
      ticketId: ticket.id,
      staffId: input.staffId,
      result: "SUCCESS",
      deviceInfo: input.deviceInfo ?? null,
    });
    const scanLogId = Number(
      (scanResult as unknown as { insertId: number }).insertId
    );
    await tx.insert(attendance).values({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      orderId: ticket.orderId,
      staffId: input.staffId,
      scanLogId,
      status: "CHECKED_IN",
      deviceInfo: input.deviceInfo ?? null,
      checkedInAt,
    });

    return {
      ok: true as const,
      status: "SUCCESS" as const,
      ticket: { id: ticket.id, code: ticket.ticketCode },
      checkedInAt,
    };
  });
}

// ─────────────────────────────────────────────
// Scan logs
// ─────────────────────────────────────────────

export async function logScan(input: InsertScanLog) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(scanLogs).values(input);
  return Number((result as unknown as { insertId: number }).insertId);
}

export async function listScanLogsByEvent(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  // Join tickets to filter by event
  const rows = await db
    .select({
      id: scanLogs.id,
      ticketId: scanLogs.ticketId,
      staffId: scanLogs.staffId,
      result: scanLogs.result,
      createdAt: scanLogs.createdAt,
      deviceInfo: scanLogs.deviceInfo,
      ticketCode: tickets.ticketCode,
      ticketStatus: tickets.status,
      ticketEventId: tickets.eventId,
    })
    .from(scanLogs)
    .leftJoin(tickets, eq(tickets.id, scanLogs.ticketId))
    .where(eq(tickets.eventId, eventId))
    .orderBy(desc(scanLogs.createdAt));
  return rows;
}

export async function listAllScanLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanLogs).orderBy(desc(scanLogs.createdAt));
}
