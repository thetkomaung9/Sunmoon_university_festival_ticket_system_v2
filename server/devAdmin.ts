import type { User } from "../drizzle/schema";

export const DEV_ADMIN_OPEN_ID = "dev:admin";

export function isDevAdminEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL;
}

export function getDevAdminCredentials() {
  return {
    email: (
      process.env.DEV_ADMIN_EMAIL || "thetkomaung1996@sunmoon.ac.kr"
    ).toLowerCase(),
    password: process.env.DEV_ADMIN_PASSWORD || "sunmoon-admin-2026",
  };
}

export function isDevAdminLogin(email: string, password: string): boolean {
  if (!isDevAdminEnabled()) return false;
  const credentials = getDevAdminCredentials();
  return (
    email.trim().toLowerCase() === credentials.email &&
    password === credentials.password
  );
}

export function createDevAdminUser(): User {
  const now = new Date();
  const { email } = getDevAdminCredentials();

  return {
    id: -100,
    openId: DEV_ADMIN_OPEN_ID,
    name: "Development Admin",
    email,
    loginMethod: "password",
    passwordHash: null,
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}
