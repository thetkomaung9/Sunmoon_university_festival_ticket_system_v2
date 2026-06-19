import { timingSafeEqual, randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";
import { getSessionCookieOptions } from "./cookies";

export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

function isLocalOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function getAllowedOrigins() {
  return [
    process.env.FRONTEND_URL ?? "",
    ...(process.env.CORS_ORIGINS ?? "").split(","),
  ]
    .map(origin => normalizeOrigin(origin))
    .filter(Boolean);
}

function getHeader(req: Request, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getCsrfCookie(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  return cookies[CSRF_COOKIE_NAME];
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createCsrfToken() {
  return randomBytes(32).toString("base64url");
}

export function assertCsrfSafe(ctx: Pick<TrpcContext, "req">) {
  const origin = getHeader(ctx.req, "origin");
  const normalizedOrigin = origin ? normalizeOrigin(origin) : "";
  const allowedOrigins = getAllowedOrigins();
  const isProduction = process.env.NODE_ENV === "production";

  if (!normalizedOrigin) {
    if (isProduction) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Missing request origin.",
      });
    }
  } else if (
    !allowedOrigins.includes(normalizedOrigin) &&
    !(process.env.NODE_ENV !== "production" && isLocalOrigin(normalizedOrigin))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Invalid request origin.",
    });
  }

  const cookieToken = getCsrfCookie(ctx.req);
  const headerToken = getHeader(ctx.req, CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Missing CSRF token.",
    });
  }

  if (!timingSafeStringEqual(cookieToken, headerToken)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Invalid CSRF token.",
    });
  }
}

export function setCsrfCookie(req: Request, res: Response, token: string) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    httpOnly: false,
    maxAge: 24 * 60 * 60 * 1000,
  });
}

export function registerCsrfRoute(app: Express) {
  app.get("/api/csrf-token", (req, res) => {
    const token = createCsrfToken();
    setCsrfCookie(req, res, token);
    res.json({ token });
  });
}
