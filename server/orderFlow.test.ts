import { describe, expect, it } from "vitest";
import { hashToken, signQrToken, verifyQrToken } from "./qrToken";

/**
 * Pure-logic tests covering the QR/ticket security model. The DB-bound order
 * flow is exercised in `qrToken.test.ts`; here we focus on the invariants the
 * scanner relies on:
 *   1. A different token signed for the same ticket has a different hash, so
 *      the scanner's hash lookup will fail on an attacker-issued token.
 *   2. A token's payload cannot be swapped without breaking the signature.
 */

describe("scanner security invariants", () => {
  it("two tokens for the same ticket have distinct hashes (nonce isolation)", () => {
    const a = signQrToken({ ticketId: 7, ticketCode: "TCK-7" });
    const b = signQrToken({ ticketId: 7, ticketCode: "TCK-7" });
    expect(a).not.toBe(b);
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("attacker who steals only the hash cannot construct a valid token", () => {
    const issued = signQrToken({ ticketId: 9, ticketCode: "TCK-9" });
    const storedHash = hashToken(issued);
    // Attacker constructs their own token for the same ticket.
    const forged = signQrToken({ ticketId: 9, ticketCode: "TCK-9" });
    expect(verifyQrToken(forged)).not.toBeNull(); // signature alone is valid…
    expect(hashToken(forged)).not.toBe(storedHash); // …but hash mismatch defeats lookup.
  });

  it("payload swap with re-used signature is rejected", () => {
    const issued = signQrToken({ ticketId: 1, ticketCode: "TCK-1" });
    const [, sig] = issued.split(".");
    const swappedPayload = Buffer.from(
      JSON.stringify({ tid: 2, code: "TCK-2", n: "deadbeef", iat: 0 })
    )
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(verifyQrToken(`${swappedPayload}.${sig}`)).toBeNull();
  });
});
