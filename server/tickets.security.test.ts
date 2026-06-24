import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event, Order, Ticket, TicketType, User } from "../drizzle/schema";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./_core/csrf";
import type { TrpcContext } from "./_core/context";
import {
  assertRateLimit,
  resetRateLimitsForTest,
} from "./_core/rateLimit";
import * as db from "./db";
import { appRouter } from "./routers";

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

function context(currentUser: User | null): TrpcContext {
  return {
    user: currentUser,
    req: {
      ip: "203.0.113.10",
      protocol: "https",
      headers: {
        origin: "https://festival.example.com",
        cookie: `${CSRF_COOKIE_NAME}=csrf-token`,
        [CSRF_HEADER_NAME]: "csrf-token",
      },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function ticket(): Ticket {
  return {
    id: 601,
    orderId: 101,
    eventId: 201,
    ticketTypeId: 301,
    ticketCode: "FT-2026-000001",
    qrTokenHash: "private-token-hash",
    qrImageUrl: "https://storage.example.com/qr.png",
    status: "VALID",
    issuedAt: now,
    usedAt: null,
    usedByUserId: null,
  };
}

function order(ownerId: number): Order {
  return {
    id: 101,
    merchantUid: "smu_test_order",
    eventId: 201,
    ticketTypeId: 301,
    userId: ownerId,
    buyerName: "Buyer Name",
    buyerEmail: "buyer@example.com",
    buyerPhone: "010-1234-5678",
    quantity: 1,
    totalAmount: 25000,
    status: "PAID",
    paymentProvider: "bank_transfer",
    paymentKey: "secret-payment-key",
    createdAt: now,
    paidAt: now,
    cancelledAt: null,
  };
}

const event: Event = {
  id: 201,
  categoryId: 1,
  slug: "festival-night",
  title: "Festival Night",
  titleMm: "ပွဲတော်ည",
  description: "Private event description",
  venue: "Main Hall",
  posterUrl: "https://storage.example.com/poster.png",
  startsAt: 1781892000000,
  endsAt: 1781906400000,
  saleStartsAt: 1781287200000,
  saleEndsAt: 1781888400000,
  status: "PUBLISHED",
  createdAt: now,
  updatedAt: now,
};

const ticketType: TicketType = {
  id: 301,
  eventId: 201,
  name: "Regular",
  price: 25000,
  stock: 100,
  soldCount: 1,
  maxPerUser: 5,
  status: "ACTIVE",
  createdAt: now,
};

function mockTicketLookup(ownerId = 1) {
  vi.spyOn(db, "getTicketByCode").mockResolvedValue(ticket());
  vi.spyOn(db, "getOrderById").mockResolvedValue(order(ownerId));
  vi.spyOn(db, "getEventById").mockResolvedValue(event);
  vi.spyOn(db, "getTicketType").mockResolvedValue(ticketType);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetRateLimitsForTest();
});

describe("tickets.getByCode access control", () => {
  it("requires matching buyer email for guest ticket lookup", async () => {
    mockTicketLookup(1);
    const caller = appRouter.createCaller(context(null));

    await expect(
      caller.tickets.getByCode({ code: "FT-2026-000001" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects wrong buyer email", async () => {
    mockTicketLookup(1);
    const caller = appRouter.createCaller(context(null));

    await expect(
      caller.tickets.getByCode({
        code: "FT-2026-000001",
        buyerEmail: "other@example.com",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows matching buyer email and returns only ticket-view fields", async () => {
    mockTicketLookup(1);
    const caller = appRouter.createCaller(context(null));

    const result = await caller.tickets.getByCode({
      code: "FT-2026-000001",
      buyerEmail: "buyer@example.com",
    });

    expect(result.ticket).toEqual({
      id: 601,
      ticketCode: "FT-2026-000001",
      status: "VALID",
      usedAt: null,
      qrImageUrl: "https://storage.example.com/qr.png",
    });
    expect(result.ticket).not.toHaveProperty("qrTokenHash");
    expect(result.event).toEqual({
      id: 201,
      title: "Festival Night",
      titleMm: "ပွဲတော်ည",
      venue: "Main Hall",
      startsAt: 1781892000000,
    });
    expect(result.event).not.toHaveProperty("description");
    expect(result.ticketType).toEqual({ name: "Regular" });
    expect(result.order).toEqual({
      id: 101,
      buyerName: "Buyer Name",
      quantity: 1,
    });
    expect(result.order).not.toHaveProperty("buyerEmail");
    expect(result.order).not.toHaveProperty("buyerPhone");
  });

  it("allows staff users to view any ticket", async () => {
    mockTicketLookup(1);
    const caller = appRouter.createCaller(context(user(50, "staff")));

    const result = await caller.tickets.getByCode({ code: "FT-2026-000001" });

    expect(result.ticket.ticketCode).toBe("FT-2026-000001");
  });

  it("allows admin users to view any ticket", async () => {
    mockTicketLookup(1);
    const caller = appRouter.createCaller(context(user(99, "admin")));

    const result = await caller.tickets.getByCode({ code: "FT-2026-000001" });

    expect(result.ticket.ticketCode).toBe("FT-2026-000001");
  });

  it("looks up issued tickets by buyer email", async () => {
    vi.spyOn(db, "listTicketsByBuyerEmail").mockResolvedValue([
      {
        ticket: ticket(),
        order: order(1),
        event,
        ticketType,
      },
    ]);
    const caller = appRouter.createCaller(context(null));

    const result = await caller.tickets.lookupByBuyerEmail({
      buyerEmail: "buyer@example.com",
    });

    expect(result).toHaveLength(1);
    expect(result[0].ticket.ticketCode).toBe("FT-2026-000001");
    expect(result[0].order?.buyerName).toBe("Buyer Name");
  });
});

describe("rate limiting", () => {
  it("rejects requests after the configured development limit", async () => {
    await assertRateLimit({
      namespace: "test.lookup",
      key: "203.0.113.10",
      limit: 2,
      windowMs: 60_000,
    });
    await assertRateLimit({
      namespace: "test.lookup",
      key: "203.0.113.10",
      limit: 2,
      windowMs: 60_000,
    });

    await expect(
      assertRateLimit({
        namespace: "test.lookup",
        key: "203.0.113.10",
        limit: 2,
        windowMs: 60_000,
      })
    ).rejects.toThrow("Too many requests. Please try again later.");
  });

  it("fails closed in production when Redis rate limiting is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await expect(
      assertRateLimit({
        namespace: "test.lookup",
        key: "203.0.113.10",
        limit: 2,
        windowMs: 60_000,
      })
    ).rejects.toThrow("Rate limiting is not configured");
  });

  it("uses the memory limiter for local production previews without Redis", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await assertRateLimit({
      namespace: "test.lookup",
      key: "::1",
      limit: 2,
      windowMs: 60_000,
    });
    await assertRateLimit({
      namespace: "test.lookup",
      key: "::1",
      limit: 2,
      windowMs: 60_000,
    });

    await expect(
      assertRateLimit({
        namespace: "test.lookup",
        key: "::1",
        limit: 2,
        windowMs: 60_000,
      })
    ).rejects.toThrow("Too many requests. Please try again later.");
  });

  it("uses Upstash Redis in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: "OK" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await assertRateLimit({
      namespace: "test.lookup",
      key: "203.0.113.10",
      limit: 2,
      windowMs: 60_000,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://redis.example.com",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
        }),
      })
    );
  });
});
