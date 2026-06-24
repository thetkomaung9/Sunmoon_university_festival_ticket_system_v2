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

type UpstashResponse<T> = {
  result?: T;
  error?: string;
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

function rateLimitError(): never {
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests. Please try again later.",
  });
}

function unavailableError(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Rate limiting is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
  });
}

function bucketKey(input: RateLimitInput) {
  return `rate-limit:${input.namespace}:${input.key}`;
}

function isLoopbackKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1"
  );
}

function assertMemoryRateLimit(input: RateLimitInput) {
  const now = Date.now();
  const key = bucketKey(input);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + input.windowMs });
    return;
  }

  if (bucket.count >= input.limit) rateLimitError();
  bucket.count += 1;
}

async function upstashCommand<T>(command: unknown[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    unavailableError();
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) unavailableError();
  const body = (await response.json()) as UpstashResponse<T>;
  if (body.error) unavailableError();
  return body.result as T;
}

async function assertRedisRateLimit(input: RateLimitInput) {
  const key = bucketKey(input);
  const count = Number(await upstashCommand<number>(["INCR", key]));
  if (count === 1) {
    await upstashCommand<"OK" | number>(["PEXPIRE", key, input.windowMs]);
  }
  if (count > input.limit) rateLimitError();
}

export async function assertRateLimit(input: RateLimitInput) {
  if (process.env.NODE_ENV === "production") {
    if (
      (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) &&
      isLoopbackKey(input.key)
    ) {
      assertMemoryRateLimit(input);
      return;
    }
    await assertRedisRateLimit(input);
    return;
  }
  assertMemoryRateLimit(input);
}

export async function assertIpRateLimit(
  ctx: Pick<TrpcContext, "req">,
  input: Omit<RateLimitInput, "key">
) {
  await assertRateLimit({ ...input, key: getClientIp(ctx) });
}

export async function assertUserRateLimit(
  userId: number,
  input: Omit<RateLimitInput, "key">
) {
  await assertRateLimit({ ...input, key: String(userId) });
}

export function resetRateLimitsForTest() {
  buckets.clear();
}
