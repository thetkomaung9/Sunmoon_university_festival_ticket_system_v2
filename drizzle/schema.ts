import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  bigint,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Roles: user (buyer), staff (gate scanner), admin (full management).
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("password_hash", { length: 191 }),
  role: mysqlEnum("role", ["user", "staff", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Event categories (e.g., Thadingyut Festival, Thingyan Festival).
 * Carries bilingual name fields (Myanmar + English).
 */
export const eventCategories = mysqlTable("event_categories", {
  id: int("id").autoincrement().primaryKey(),
  nameMm: varchar("name_mm", { length: 191 }).notNull(),
  nameEn: varchar("name_en", { length: 191 }).notNull(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  description: text("description"),
  posterUrl: text("poster_url"),
  status: mysqlEnum("status", ["ACTIVE", "HIDDEN"]).default("ACTIVE").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type EventCategory = typeof eventCategories.$inferSelect;
export type InsertEventCategory = typeof eventCategories.$inferInsert;

/**
 * Events organized under categories.
 * starts_at / ends_at / sale_*_at are stored as Unix ms (bigint) to keep timezone-agnostic.
 */
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("category_id").notNull(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  title: varchar("title", { length: 191 }).notNull(),
  titleMm: varchar("title_mm", { length: 191 }),
  description: text("description"),
  venue: varchar("venue", { length: 191 }).notNull(),
  posterUrl: text("poster_url"),
  startsAt: bigint("starts_at", { mode: "number" }).notNull(),
  endsAt: bigint("ends_at", { mode: "number" }).notNull(),
  saleStartsAt: bigint("sale_starts_at", { mode: "number" }).notNull(),
  saleEndsAt: bigint("sale_ends_at", { mode: "number" }).notNull(),
  status: mysqlEnum("status", ["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"])
    .default("PUBLISHED")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * Ticket types attached to an event.
 * `name` enum matches: Regular, VIP, Early Bird, Student.
 * `price` is integer in KRW (minor unit not needed for KRW since smallest unit is 1 won).
 */
export const ticketTypes = mysqlTable("ticket_types", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("event_id").notNull(),
  name: mysqlEnum("name", [
    "Regular",
    "VIP",
    "Early Bird",
    "Student",
  ]).notNull(),
  price: int("price").notNull(),
  stock: int("stock").notNull(),
  soldCount: int("sold_count").default(0).notNull(),
  maxPerUser: int("max_per_user").default(5).notNull(),
  status: mysqlEnum("status", ["ACTIVE", "SOLD_OUT", "HIDDEN"])
    .default("ACTIVE")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TicketType = typeof ticketTypes.$inferSelect;
export type InsertTicketType = typeof ticketTypes.$inferInsert;

/**
 * Buyer orders. Status flow: PENDING -> PAID -> (optionally) REFUNDED/CANCELLED.
 * EXPIRED can be set when sale ends without payment.
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  merchantUid: varchar("merchant_uid", { length: 64 }).notNull().unique(),
  eventId: int("event_id").notNull(),
  ticketTypeId: int("ticket_type_id").notNull(),
  userId: int("user_id"),
  buyerName: varchar("buyer_name", { length: 191 }).notNull(),
  buyerEmail: varchar("buyer_email", { length: 320 }).notNull(),
  buyerPhone: varchar("buyer_phone", { length: 64 }),
  quantity: int("quantity").default(1).notNull(),
  totalAmount: int("total_amount").notNull(),
  status: mysqlEnum("status", [
    "PENDING",
    "PENDING_PAYMENT_VERIFICATION",
    "PAID",
    "CANCELLED",
    "REFUNDED",
    "EXPIRED",
  ])
    .default("PENDING")
    .notNull(),
  paymentProvider: varchar("payment_provider", { length: 64 }),
  paymentKey: varchar("payment_key", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Payment records for provider transactions.
 * payment_logs keeps raw webhook audit events; payments is the order ledger.
 */
export const payments = mysqlTable(
  "payments",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id").notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    paymentKey: varchar("payment_key", { length: 191 }).notNull(),
    amount: int("amount").notNull(),
    currency: varchar("currency", { length: 16 }).default("KRW").notNull(),
    status: mysqlEnum("status", [
      "PENDING",
      "PENDING_VERIFICATION",
      "PAID",
      "REJECTED",
      "SUCCEEDED",
      "FAILED",
      "REFUNDED",
      "CANCELLED",
    ])
      .default("PENDING")
      .notNull(),
    rawPayload: json("raw_payload"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    paymentKeyIdx: uniqueIndex("payments_payment_key_unique").on(
      table.paymentKey
    ),
  })
);

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Bank transfer receipt uploads awaiting admin review.
 */
export const paymentProofs = mysqlTable("payment_proofs", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  paymentId: int("payment_id"),
  uploadedByUserId: int("uploaded_by_user_id"),
  receiptImageUrl: text("receipt_image_url").notNull(),
  status: mysqlEnum("status", ["PENDING", "APPROVED", "REJECTED"])
    .default("PENDING")
    .notNull(),
  rejectionReason: text("rejection_reason"),
  reviewedByUserId: int("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PaymentProof = typeof paymentProofs.$inferSelect;
export type InsertPaymentProof = typeof paymentProofs.$inferInsert;

/**
 * Issued tickets — generated only after a verified payment.
 * `ticketCode` is the user-visible code (e.g., TCK-2026-000123).
 * `qrTokenHash` stores hash of the signed QR token (no raw secret in DB).
 */
export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  eventId: int("event_id").notNull(),
  ticketTypeId: int("ticket_type_id").notNull(),
  ticketCode: varchar("ticket_code", { length: 64 }).notNull().unique(),
  qrTokenHash: varchar("qr_token_hash", { length: 128 }).notNull().unique(),
  qrImageUrl: text("qr_image_url"),
  status: mysqlEnum("status", ["VALID", "USED", "CANCELLED", "EXPIRED"])
    .default("VALID")
    .notNull(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
  usedByUserId: int("used_by_user_id"),
});

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;

/**
 * Webhook payloads for audit (verified or not).
 */
export const paymentLogs = mysqlTable("payment_logs", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id"),
  provider: varchar("provider", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  payload: json("payload"),
  verified: mysqlEnum("verified", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PaymentLog = typeof paymentLogs.$inferSelect;
export type InsertPaymentLog = typeof paymentLogs.$inferInsert;

/**
 * Successful check-ins. scan_logs stores every scan attempt; attendance stores
 * the attendee list with one accepted check-in per ticket.
 */
export const attendance = mysqlTable(
  "attendance",
  {
    id: int("id").autoincrement().primaryKey(),
    ticketId: int("ticket_id").notNull(),
    eventId: int("event_id").notNull(),
    orderId: int("order_id").notNull(),
    staffId: int("staff_id").notNull(),
    scanLogId: int("scan_log_id"),
    status: mysqlEnum("status", ["CHECKED_IN", "REVOKED"])
      .default("CHECKED_IN")
      .notNull(),
    deviceInfo: text("device_info"),
    checkedInAt: timestamp("checked_in_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => ({
    ticketIdx: uniqueIndex("attendance_ticket_id_unique").on(table.ticketId),
  })
);

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

/**
 * Scan logs - one row per scan attempt at the gate.
 */
export const scanLogs = mysqlTable("scan_logs", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticket_id"),
  staffId: int("staff_id"),
  result: mysqlEnum("result", [
    "SUCCESS",
    "ALREADY_USED",
    "INVALID",
    "CANCELLED",
    "EXPIRED",
  ]).notNull(),
  deviceInfo: text("device_info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ScanLog = typeof scanLogs.$inferSelect;
export type InsertScanLog = typeof scanLogs.$inferInsert;
