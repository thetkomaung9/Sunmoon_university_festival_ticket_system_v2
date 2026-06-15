import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { DEV_ADMIN_OPEN_ID, isDevAdminLogin } from "./devAdmin";
import { hashPassword, verifyPassword } from "./passwordAuth";
import { catalogRouter } from "./routers/catalog";
import { ordersRouter } from "./routers/orders";
import { ticketsRouter } from "./routers/tickets";

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

        const sessionToken = await sdk.createSessionToken(openId, {
          name: input.name.trim(),
        });
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 1000 * 60 * 60 * 24 * 365,
        });

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
            const sessionToken = await sdk.createSessionToken(
              DEV_ADMIN_OPEN_ID,
              {
                name: "Development Admin",
              }
            );
            ctx.res.cookie(COOKIE_NAME, sessionToken, {
              ...getSessionCookieOptions(ctx.req),
              maxAge: 1000 * 60 * 60 * 24 * 365,
            });

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
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name ?? "",
        });
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 1000 * 60 * 60 * 24 * 365,
        });

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
