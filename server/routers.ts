import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import type { TrpcContext } from "./_core/context";
import { assertIpRateLimit } from "./_core/rateLimit";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { ENV, isSessionSecretError } from "./_core/env";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { DEV_ADMIN_OPEN_ID, isDevAdminLogin } from "./devAdmin";
import { hashPassword, verifyPassword } from "./passwordAuth";
import { catalogRouter } from "./routers/catalog";
import { ordersRouter } from "./routers/orders";
import { ticketsRouter } from "./routers/tickets";

async function createAuthSessionToken(
  openId: string,
  options: { name?: string } = {}
): Promise<string> {
  try {
    return await sdk.createSessionToken(openId, options);
  } catch (error) {
    if (isSessionSecretError(error)) {
      console.error(
        "[Auth] Cannot create session token because JWT_SECRET is missing or invalid."
      );
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Authentication is temporarily unavailable because the server session secret is not configured.",
      });
    }

    throw error;
  }
}

function setAuthSessionCookie(
  ctx: Pick<TrpcContext, "req" | "res">,
  sessionToken: string,
  openId: string
) {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  console.info("[Auth] Setting session cookie", {
    openId,
    cookieName: COOKIE_NAME,
    maxAge: ONE_YEAR_MS,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
    domain: cookieOptions.domain,
  });
  ctx.res.cookie(COOKIE_NAME, sessionToken, {
    ...cookieOptions,
    maxAge: ONE_YEAR_MS,
  });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    signup: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(120),
          email: z.string().email().max(320),
          password: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertIpRateLimit(ctx, {
          namespace: "auth.login",
          limit: 10,
          windowMs: 60_000,
        });
        const email = input.email.trim().toLowerCase();
        const database = await db.getDb();
        if (!database) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Database is not configured. Set DATABASE_URL to enable sign up.",
          });
        }
        const existing = await db.getUserByEmail(email);
        if (existing?.passwordHash) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account already exists for this email.",
          });
        }

        const openId = `email:${email}`;
        const role =
          ENV.ownerOpenId === email || ENV.ownerOpenId === openId
            ? "admin"
            : "user";
        await db.upsertUser({
          openId,
          name: input.name.trim(),
          email,
          loginMethod: "password",
          passwordHash: hashPassword(input.password),
          role,
          lastSignedIn: new Date(),
        });

        const sessionToken = await createAuthSessionToken(openId, {
          name: input.name.trim(),
        });
        setAuthSessionCookie(ctx, sessionToken, openId);

        return { success: true };
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
          password: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const database = await db.getDb();
        if (!database) {
          if (isDevAdminLogin(email, input.password)) {
            const sessionToken = await createAuthSessionToken(
              DEV_ADMIN_OPEN_ID,
              {
                name: "Development Admin",
              }
            );
            setAuthSessionCookie(ctx, sessionToken, DEV_ADMIN_OPEN_ID);

            return { success: true };
          }

          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Database is not configured. Use the local development admin account or set DATABASE_URL to enable sign in.",
          });
        }
        const user = await db.getUserByEmail(email);
        if (!user || !verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password.",
          });
        }

        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });
        const sessionToken = await createAuthSessionToken(user.openId, {
          name: user.name ?? "",
        });
        setAuthSessionCookie(ctx, sessionToken, user.openId);

        return { success: true };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalog: catalogRouter,
  orders: ordersRouter,
  tickets: ticketsRouter,
});

export type AppRouter = typeof appRouter;
