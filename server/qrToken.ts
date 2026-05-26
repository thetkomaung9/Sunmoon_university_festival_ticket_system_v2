import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { ENV } from "./_core/env";

/**
 * QR token format: base64url(payload).base64url(signature)
 *   payload = JSON: { tid: ticketId, code: ticketCode, n: nonce, iat: issuedAt }
 *   signature = HMAC-SHA256(payload, JWT_SECRET)
 *
 * The token is the only thing in the QR. Nothing personal is encoded; we only
 * carry an opaque ticket ID + nonce that the server resolves against the DB.
 *
 * To prevent ticket-token tampering or theft from the DB, we additionally store
 * only the *hash* of the full token in `tickets.qr_token_hash`, never the raw
 * signature.
 */

function getSecret(): string {
  // Fall back to a deterministic dev-only secret so tests can run without env.
  return ENV.cookieSecret || process.env.JWT_SECRET || "sunmoon-dev-secret";
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "====".slice(str.length % 4);
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export interface QrTokenPayload {
  tid: number;
  code: string;
  n: string;
  iat: number;
}

export function signQrToken(payload: { ticketId: number; ticketCode: string }): string {
  const body: QrTokenPayload = {
    tid: payload.ticketId,
    code: payload.ticketCode,
    n: randomBytes(8).toString("hex"),
    iat: Date.now(),
  };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(body)));
  const sig = createHmac("sha256", getSecret()).update(payloadB64).digest();
  const sigB64 = b64urlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

export function verifyQrToken(token: string): QrTokenPayload | null {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const expectedSig = createHmac("sha256", getSecret()).update(payloadB64).digest();
    const givenSig = b64urlDecode(sigB64);
    if (givenSig.length !== expectedSig.length) return null;
    if (!timingSafeEqual(givenSig, expectedSig)) return null;
    const payloadJson = b64urlDecode(payloadB64).toString("utf8");
    const body = JSON.parse(payloadJson) as QrTokenPayload;
    if (typeof body.tid !== "number" || typeof body.code !== "string") return null;
    return body;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return createHmac("sha256", getSecret()).update(`hash:${token}`).digest("hex");
}
