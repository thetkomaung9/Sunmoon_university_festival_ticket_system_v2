import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  Event,
  Order,
  PaymentProof,
  Ticket,
  TicketType,
  User,
} from "../drizzle/schema";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./_core/csrf";
import * as db from "./db";
import * as storage from "./storage";

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
    quantity: 2,
    totalAmount: 50000,
    status: "PENDING_PAYMENT_VERIFICATION",
    paymentProvider: "bank_transfer",
    paymentKey: "secret-payment-key",
    createdAt: now,
    paidAt: null,
    cancelledAt: null,
  };
}

const event: Event = {
  id: 201,
  categoryId: 1,
  slug: "festival-night",
  title: "Festival Night",
  titleMm: null,
  description: null,
  venue: "Main Hall",
  posterUrl: null,
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
  soldCount: 2,
  maxPerUser: 5,
  status: "ACTIVE",
  createdAt: now,
};

const proof: PaymentProof = {
  id: 401,
  orderId: 101,
  paymentId: 501,
  uploadedByUserId: 1,
  receiptImageUrl: "https://storage.example.com/private-receipt.png",
  status: "PENDING",
  rejectionReason: null,
  reviewedByUserId: null,
  reviewedAt: null,
  createdAt: now,
};

const ticket: Ticket = {
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("orders ownership access control", () => {
  it("requires authentication for getByMerchantUid", async () => {
    const caller = appRouter.createCaller(context(null));

    await expect(
      caller.orders.getByMerchantUid({ merchantUid: "smu_test_order" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects non-owner users for getByMerchantUid", async () => {
    vi.spyOn(db, "getOrderByMerchantUid").mockResolvedValue(order(1));
    const caller = appRouter.createCaller(context(user(2)));

    await expect(
      caller.orders.getByMerchantUid({ merchantUid: "smu_test_order" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a sanitized owner order without receipt URLs or internal fields", async () => {
    vi.spyOn(db, "getOrderByMerchantUid").mockResolvedValue({
      ...order(1),
      status: "PAID",
    });
    vi.spyOn(db, "getEventById").mockResolvedValue(event);
    vi.spyOn(db, "getTicketType").mockResolvedValue(ticketType);
    vi.spyOn(db, "getTicketsByOrder").mockResolvedValue([ticket]);
    vi.spyOn(db, "getLatestPaymentProofByOrder").mockResolvedValue(proof);
    const caller = appRouter.createCaller(context(user(1)));

    const result = await caller.orders.getByMerchantUid({
      merchantUid: "smu_test_order",
    });

    expect(result.order).toMatchObject({
      merchantUid: "smu_test_order",
      buyerName: "Buyer Name",
      buyerEmail: "buyer@example.com",
    });
    expect(result.order).not.toHaveProperty("buyerPhone");
    expect(result.order).not.toHaveProperty("paymentKey");
    expect(result.latestProof).not.toHaveProperty("receiptImageUrl");
    expect(result.tickets[0]).toMatchObject({
      id: 601,
      ticketCode: "FT-2026-000001",
      status: "VALID",
    });
    expect(result.tickets[0]).not.toHaveProperty("qrTokenHash");
  });

  it("allows admins to view any order and see receipt URLs", async () => {
    vi.spyOn(db, "getOrderByMerchantUid").mockResolvedValue(order(1));
    vi.spyOn(db, "getEventById").mockResolvedValue(event);
    vi.spyOn(db, "getTicketType").mockResolvedValue(ticketType);
    vi.spyOn(db, "getTicketsByOrder").mockResolvedValue([]);
    vi.spyOn(db, "getLatestPaymentProofByOrder").mockResolvedValue(proof);
    const caller = appRouter.createCaller(context(user(99, "admin")));

    const result = await caller.orders.getByMerchantUid({
      merchantUid: "smu_test_order",
    });

    expect(result.latestProof).toMatchObject({
      id: 401,
      receiptImageUrl: "https://storage.example.com/private-receipt.png",
    });
  });

  it("rejects payment proof uploads from non-owners before storing the receipt", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_URL", "https://festival.example.com");
    vi.spyOn(db, "getOrderByMerchantUid").mockResolvedValue({
      ...order(1),
      status: "PENDING",
    });
    const storageSpy = vi.spyOn(storage, "storagePut");
    const caller = appRouter.createCaller(context(user(2)));

    await expect(
      caller.orders.uploadPaymentProof({
        merchantUid: "smu_test_order",
        receiptImageDataUrl: "data:image/png;base64,aGVsbG8=",
        fileName: "receipt.png",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("allows the authenticated owner to upload a payment proof", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_URL", "https://festival.example.com");
    vi.spyOn(db, "getOrderByMerchantUid").mockResolvedValue({
      ...order(1),
      status: "PENDING",
    });
    vi.spyOn(storage, "storagePut").mockResolvedValue({
      url: "https://storage.example.com/private-receipt.png",
    });
    vi.spyOn(db, "createPayment").mockResolvedValue(undefined);
    vi.spyOn(db, "getPaymentByKey").mockResolvedValue({
      id: 501,
      orderId: 101,
      provider: "bank_transfer",
      paymentKey: "bank_smu_test_order",
      amount: 50000,
      currency: "KRW",
      status: "PENDING_VERIFICATION",
      rawPayload: null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    });
    vi.spyOn(db, "createPaymentProof").mockResolvedValue(401);
    vi.spyOn(db, "setOrderStatus").mockResolvedValue(undefined);
    vi.spyOn(db, "logPayment").mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context(user(1)));

    const result = await caller.orders.uploadPaymentProof({
      merchantUid: "smu_test_order",
      receiptImageDataUrl: "data:image/png;base64,aGVsbG8=",
      fileName: "receipt.png",
    });

    expect(result).toEqual({
      ok: true,
      proofId: 401,
      status: "PENDING_PAYMENT_VERIFICATION",
    });
    expect(db.createPaymentProof).toHaveBeenCalledWith(
      expect.objectContaining({ uploadedByUserId: 1 })
    );
  });

  it("disables the mock payment webhook in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const getOrderSpy = vi.spyOn(db, "getOrderByMerchantUid");
    const caller = appRouter.createCaller(context(null));

    await expect(
      caller.orders.paymentWebhook({
        merchantUid: "smu_test_order",
        paidAmount: 50000,
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getOrderSpy).not.toHaveBeenCalled();
  });
});
