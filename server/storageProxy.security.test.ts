import { unlink } from "node:fs/promises";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import {
  canAccessStorageKey,
  classifyStorageKey,
  registerStorageProxy,
} from "./_core/storageProxy";
import { sdk } from "./_core/sdk";
import { getLocalStoragePath, storagePut } from "./storage";

const now = new Date("2026-06-20T10:00:00.000Z");
const cleanupFiles: string[] = [];

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
  vi.unstubAllEnvs();
  cleanupFiles.splice(0).forEach(filePath => {
    void unlink(filePath).catch(() => undefined);
  });
});

async function fetchStoragePath(path: string) {
  const app = express();
  registerStorageProxy(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind to a TCP port");
    }
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    server.close();
  }
}

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

  it("serves local QR files in production when Forge is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");

    const upload = await storagePut(
      "qr-tickets/FT-2026-999999.png",
      Buffer.from("qr-image"),
      "image/png"
    );
    cleanupFiles.push(getLocalStoragePath(upload.key));

    const response = await fetchStoragePath(upload.url);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    await expect(response.text()).resolves.toBe("qr-image");
  });

  it("serves local payment proof files to admins in production when Forge is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue(user(99, "admin"));

    const upload = await storagePut(
      "payment-proofs/smu_test_order.png",
      Buffer.from("receipt-image"),
      "image/png"
    );
    cleanupFiles.push(getLocalStoragePath(upload.key));

    const response = await fetchStoragePath(upload.url);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    await expect(response.text()).resolves.toBe("receipt-image");
  });
});
