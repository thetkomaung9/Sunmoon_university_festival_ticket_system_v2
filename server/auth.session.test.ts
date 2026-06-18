import { describe, expect, it, vi, afterEach } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { User } from "../drizzle/schema";
import { createContext, type TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import * as db from "./db";
import { hashPassword } from "./passwordAuth";

type CapturedCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

type CapturedClearCookie = {
  name: string;
  options: Record<string, unknown>;
};

const now = new Date("2026-06-19T00:00:00.000Z");

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? 1,
    openId: overrides.openId ?? "email:user@example.com",
    name: "name" in overrides ? overrides.name! : "Sample User",
    email: "email" in overrides ? overrides.email! : "user@example.com",
    loginMethod:
      "loginMethod" in overrides ? overrides.loginMethod! : "password",
    passwordHash:
      "passwordHash" in overrides
        ? overrides.passwordHash!
        : hashPassword("password123"),
    role: overrides.role ?? "user",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    lastSignedIn: overrides.lastSignedIn ?? now,
  };
}

function createRequest(cookieHeader?: string): TrpcContext["req"] {
  return {
    protocol: "https",
    method: "GET",
    path: "/api/trpc/auth.me",
    headers: {
      "x-forwarded-proto": "https",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  } as TrpcContext["req"];
}

function createCallerContext(cookieHeader?: string): {
  ctx: TrpcContext;
  cookies: CapturedCookie[];
  clearedCookies: CapturedClearCookie[];
} {
  const cookies: CapturedCookie[] = [];
  const clearedCookies: CapturedClearCookie[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: createRequest(cookieHeader),
    res: {
      cookie: (
        name: string,
        value: string,
        options: Record<string, unknown>
      ) => {
        cookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, cookies, clearedCookies };
}

async function createAuthenticatedContext(sessionToken: string) {
  return createContext({
    req: createRequest(`${COOKIE_NAME}=${sessionToken}`),
    res: {} as TrpcContext["res"],
  });
}

function mockUsers(initialUsers: User[] = []) {
  const usersByOpenId = new Map(initialUsers.map(user => [user.openId, user]));

  vi.spyOn(db, "getDb").mockResolvedValue({} as Awaited<
    ReturnType<typeof db.getDb>
  >);
  vi.spyOn(db, "getUserByEmail").mockImplementation(async (email: string) => {
    return Array.from(usersByOpenId.values()).find(
      user => user.email?.toLowerCase() === email.toLowerCase()
    );
  });
  vi.spyOn(db, "getUserByOpenId").mockImplementation(async (openId: string) => {
    return usersByOpenId.get(openId);
  });
  vi.spyOn(db, "upsertUser").mockImplementation(async input => {
    const existing = usersByOpenId.get(input.openId);
    const next: User = {
      ...(existing ?? createUser({ id: usersByOpenId.size + 1 })),
      ...input,
      openId: input.openId,
      name: input.name === undefined ? existing?.name ?? null : input.name,
      email: input.email === undefined ? existing?.email ?? null : input.email,
      loginMethod:
        input.loginMethod === undefined
          ? existing?.loginMethod ?? null
          : input.loginMethod,
      passwordHash:
        input.passwordHash === undefined
          ? existing?.passwordHash ?? null
          : input.passwordHash,
      role: input.role ?? existing?.role ?? "user",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastSignedIn: input.lastSignedIn ?? existing?.lastSignedIn ?? now,
    };
    usersByOpenId.set(next.openId, next);
  });

  return usersByOpenId;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth session lifecycle", () => {
  it("signs up, creates a session cookie, and returns the user from auth.me", async () => {
    mockUsers();
    const { ctx, cookies } = createCallerContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.signup({
        name: "New User",
        email: "new@example.com",
        password: "password123",
      })
    ).resolves.toEqual({ success: true });

    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: COOKIE_NAME,
      options: {
        httpOnly: true,
        path: "/",
        sameSite: "none",
        secure: true,
      },
    });

    const authCtx = await createAuthenticatedContext(cookies[0]!.value);
    const authCaller = appRouter.createCaller(authCtx);
    const me = await authCaller.auth.me();

    expect(me).toMatchObject({
      openId: "email:new@example.com",
      email: "new@example.com",
      name: "New User",
      role: "user",
    });
  });

  it("logs in and preserves auth.me when the stored user name is null", async () => {
    const passwordHash = hashPassword("password123");
    mockUsers([
      createUser({
        openId: "email:noname@example.com",
        email: "noname@example.com",
        name: null,
        passwordHash,
      }),
    ]);
    const { ctx, cookies } = createCallerContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "noname@example.com",
        password: "password123",
      })
    ).resolves.toEqual({ success: true });

    const authCtx = await createAuthenticatedContext(cookies[0]!.value);
    const authCaller = appRouter.createCaller(authCtx);
    const me = await authCaller.auth.me();

    expect(me).toMatchObject({
      openId: "email:noname@example.com",
      email: "noname@example.com",
      name: null,
      role: "user",
    });
  });

  it("clears the session cookie on logout", async () => {
    const { ctx, clearedCookies } = createCallerContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.logout()).resolves.toEqual({ success: true });

    expect(clearedCookies).toEqual([
      expect.objectContaining({
        name: COOKIE_NAME,
        options: expect.objectContaining({
          maxAge: -1,
          httpOnly: true,
          path: "/",
          sameSite: "none",
          secure: true,
        }),
      }),
    ]);
  });

  it("logs in an admin and returns an admin auth.me session", async () => {
    const passwordHash = hashPassword("admin-password");
    mockUsers([
      createUser({
        id: 7,
        openId: "email:admin@example.com",
        email: "admin@example.com",
        name: null,
        passwordHash,
        role: "admin",
      }),
    ]);
    const { ctx, cookies } = createCallerContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "admin@example.com",
        password: "admin-password",
      })
    ).resolves.toEqual({ success: true });

    const authCtx = await createAuthenticatedContext(cookies[0]!.value);
    const authCaller = appRouter.createCaller(authCtx);
    const me = await authCaller.auth.me();

    expect(me).toMatchObject({
      openId: "email:admin@example.com",
      email: "admin@example.com",
      role: "admin",
    });
  });
});
