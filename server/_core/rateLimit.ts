import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";

type RateLimitInput = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getClientIp(ctx: Pick<TrpcContext, "req">) {
  const forwardedFor = getHeaderValue(ctx.req.headers["x-forwarded-for"]);
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  const realIp = getHeaderValue(ctx.req.headers["x-real-ip"]);
  if (realIp) return realIp.trim();
  return ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown";
}

export function assertRateLimit(input: RateLimitInput) {
  const now = Date.now();
  const bucketKey = `${input.namespace}:${input.key}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + input.windowMs });
    return;
  }

  if (bucket.count >= input.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000)
    );
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again later.",
      cause: { retryAfterSeconds },
    });
  }

  bucket.count += 1;
}

export function assertIpRateLimit(
  ctx: Pick<TrpcContext, "req">,
  input: Omit<RateLimitInput, "key">
) {
  assertRateLimit({ ...input, key: getClientIp(ctx) });
}

export function assertUserRateLimit(
  userId: number,
  input: Omit<RateLimitInput, "key">
) {
  assertRateLimit({ ...input, key: String(userId) });
}

export function resetRateLimitsForTest() {
  buckets.clear();
}
