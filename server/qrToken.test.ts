import { describe, expect, it } from "vitest";
import { hashToken, signQrToken, verifyQrToken } from "./qrToken";

describe("qrToken", () => {
  it("signs and verifies a round-trip token", () => {
    const token = signQrToken({ ticketId: 42, ticketCode: "TCK-2026-1-ABCDEF" });
    const payload = verifyQrToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.tid).toBe(42);
    expect(payload?.code).toBe("TCK-2026-1-ABCDEF");
    expect(typeof payload?.iat).toBe("number");
    expect(typeof payload?.n).toBe("string");
  });

  it("rejects a token whose payload was tampered", () => {
    const token = signQrToken({ ticketId: 1, ticketCode: "TCK-A" });
    const [, sig] = token.split(".");
    // Use a *different* payload but the original signature.
    const tamperedPayload = Buffer.from(
      JSON.stringify({ tid: 999, code: "TCK-A", n: "deadbeef", iat: Date.now() })
    )
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const tampered = `${tamperedPayload}.${sig}`;
    expect(verifyQrToken(tampered)).toBeNull();
  });

  it("rejects a token whose signature was modified", () => {
    const token = signQrToken({ ticketId: 1, ticketCode: "TCK-A" });
    const broken = token.slice(0, -2) + "xx";
    expect(verifyQrToken(broken)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyQrToken("notatoken")).toBeNull();
    expect(verifyQrToken("")).toBeNull();
    expect(verifyQrToken("aa.bb.cc")).toBeNull();
  });

  it("hashToken is deterministic for the same token", () => {
    const t = signQrToken({ ticketId: 5, ticketCode: "TCK-X" });
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it("hashToken differs for different tokens", () => {
    const a = signQrToken({ ticketId: 5, ticketCode: "TCK-X" });
    const b = signQrToken({ ticketId: 5, ticketCode: "TCK-X" });
    // The nonce inside the payload differs, so the signed strings differ, so the hashes differ.
    expect(hashToken(a)).not.toBe(hashToken(b));
  });
});
