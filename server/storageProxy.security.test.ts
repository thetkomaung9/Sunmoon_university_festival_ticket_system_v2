import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import {
  canAccessStorageKey,
  classifyStorageKey,
} from "./_core/storageProxy";

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

  it("allows QR files to guests by possession of the generated URL", async () => {
    await expect(
      canAccessStorageKey("qr-tickets/FT-2026-000001_deadbeef.png", null)
    ).resolves.toBe(true);
    await expect(
      canAccessStorageKey("qr-tickets/FT-2026-000001_deadbeef.png", user(1))
    ).resolves.toBe(true);
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
