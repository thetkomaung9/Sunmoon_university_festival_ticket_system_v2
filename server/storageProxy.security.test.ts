import { afterEach, describe, expect, it, vi } from "vitest";
import type { Order, Ticket, User } from "../drizzle/schema";
import {
  canAccessStorageKey,
  classifyStorageKey,
} from "./_core/storageProxy";
import * as db from "./db";

const now = new Date("2026-06-20T10:00:00.000Z");

function user(id: number, role: User["role"] = "user"): User {
  return {
    id,
    openId: `user-${id}`,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    loginMethod: "password",
    passwordHash: null,
    role,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

const ticket: Ticket = {
  id: 601,
  orderId: 101,
  eventId: 201,
  ticketTypeId: 301,
  ticketCode: "FT-2026-000001",
  qrTokenHash: "private-token-hash",
  qrImageUrl: "/manus-storage/qr-tickets/FT-2026-000001_deadbeef.png",
  status: "VALID",
  issuedAt: now,
  usedAt: null,
  usedByUserId: null,
};

function order(ownerId: number): Order {
  return {
    id: 101,
    merchantUid: "smu_1234_abcd",
    eventId: 201,
    ticketTypeId: 301,
    userId: ownerId,
    buyerName: "Buyer Name",
    buyerEmail: "buyer@example.com",
    buyerPhone: null,
    quantity: 1,
    totalAmount: 25000,
    status: "PAID",
    paymentProvider: "bank_transfer",
    paymentKey: "bank_smu_1234_abcd",
    createdAt: now,
    paidAt: now,
    cancelledAt: null,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storage proxy authorization", () => {
  it("classifies sensitive storage keys", () => {
    expect(
      classifyStorageKey("payment-proofs/smu_1234_abcd_deadbeef.png")
    ).toEqual({ kind: "paymentProof", merchantUid: "smu_1234_abcd" });
    expect(
      classifyStorageKey("qr-tickets/FT-2026-000001_deadbeef.png")
    ).toEqual({ kind: "qrTicket", ticketCode: "FT-2026-000001" });
    expect(classifyStorageKey("categories/poster.png")).toEqual({
      kind: "public",
    });
  });

  it("allows only admins to access payment proof files", async () => {
    await expect(
      canAccessStorageKey(
        "payment-proofs/smu_1234_abcd_deadbeef.png",
        user(1)
      )
    ).resolves.toBe(false);
    await expect(
      canAccessStorageKey(
        "payment-proofs/smu_1234_abcd_deadbeef.png",
        user(99, "admin")
      )
    ).resolves.toBe(true);
  });

  it("allows QR files to the ticket owner and staff/admin roles", async () => {
    vi.spyOn(db, "getTicketByCode").mockResolvedValue(ticket);
    vi.spyOn(db, "getOrderById").mockResolvedValue(order(1));

    await expect(
      canAccessStorageKey("qr-tickets/FT-2026-000001_deadbeef.png", user(1))
    ).resolves.toBe(true);
    await expect(
      canAccessStorageKey("qr-tickets/FT-2026-000001_deadbeef.png", user(2))
    ).resolves.toBe(false);
    await expect(
      canAccessStorageKey(
        "qr-tickets/FT-2026-000001_deadbeef.png",
        user(50, "staff")
      )
    ).resolves.toBe(true);
    await expect(
      canAccessStorageKey(
        "qr-tickets/FT-2026-000001_deadbeef.png",
        user(99, "admin")
      )
    ).resolves.toBe(true);
  });
});
