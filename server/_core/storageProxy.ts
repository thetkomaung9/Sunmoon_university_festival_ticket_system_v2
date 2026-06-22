import type { Express } from "express";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getLocalStoragePath } from "../storage";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getForgeBaseUrl(): string | null {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return null;
  try {
    return new URL(ENV.forgeApiUrl).toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

type StorageAccess =
  | { kind: "public" }
  | { kind: "paymentProof"; merchantUid: string }
  | { kind: "qrTicket"; ticketCode: string };

function stripHashSuffix(value: string) {
  return value.replace(/_[a-f0-9]{8}$/i, "");
}

export function classifyStorageKey(key: string): StorageAccess {
  const paymentProof = /^payment-proofs\/(.+)\.(jpg|jpeg|png|webp)$/i.exec(
    key
  );
  if (paymentProof?.[1]) {
    return { kind: "paymentProof", merchantUid: stripHashSuffix(paymentProof[1]) };
  }

  const qrTicket = /^qr-tickets\/(.+)\.png$/i.exec(key);
  if (qrTicket?.[1]) {
    return { kind: "qrTicket", ticketCode: stripHashSuffix(qrTicket[1]) };
  }

  return { kind: "public" };
}

function isStaffOrAdmin(user: User) {
  return user.role === "admin" || user.role === "staff";
}

export async function canAccessStorageKey(
  key: string,
  user: User | null
): Promise<boolean> {
  const access = classifyStorageKey(key);
  if (access.kind === "public") return true;
  if (!user) return false;

  if (access.kind === "paymentProof") {
    return user.role === "admin";
  }

  if (access.kind === "qrTicket") return true;

  return false;
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    const forgeBaseUrl = getForgeBaseUrl();
    if (!forgeBaseUrl && ENV.isProduction) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      const allowed = await canAccessStorageKey(key, user);
      if (!allowed) {
        res.status(user ? 403 : 401).send("Storage access denied");
        return;
      }

      if (!forgeBaseUrl) {
        const filePath = getLocalStoragePath(key);
        await access(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType =
          ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".webp"
                ? "image/webp"
                : "application/octet-stream";
        res.set("Cache-Control", "no-store");
        res.type(contentType);
        createReadStream(filePath).pipe(res);
        return;
      }

      const forgeUrl = new URL("v1/storage/presign/get", `${forgeBaseUrl}/`);
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(
          `[StorageProxy] forge error: ${forgeResp.status} ${body}`
        );
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
