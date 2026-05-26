import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

const eventStatus = z.enum(["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"]);
const categoryStatus = z.enum(["ACTIVE", "HIDDEN"]);
const ticketTypeName = z.enum(["Regular", "VIP", "Early Bird", "Student"]);
const ticketTypeStatus = z.enum(["ACTIVE", "SOLD_OUT", "HIDDEN"]);

async function attachCategories<T extends { categoryId: number }>(events: T[]) {
  const categories = await db.listAllCategories();
  const categoryMap = new Map(categories.map(category => [category.id, category]));
  return events.map(event => ({
    ...event,
    category: categoryMap.get(event.categoryId) ?? null,
  }));
}

export const catalogRouter = router({
  listCategories: publicProcedure.query(() => db.listActiveCategories()),

  listEvents: publicProcedure
    .input(z.object({ categorySlug: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const category = input?.categorySlug
        ? await db.getCategoryBySlug(input.categorySlug)
        : undefined;
      if (input?.categorySlug && !category) return [];
      const events = await db.listPublishedEvents(category?.id);
      return attachCategories(events);
    }),

  getEventBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const event = await db.getEventBySlug(input.slug);
      if (!event || event.status !== "PUBLISHED") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }
      const [category, ticketTypes] = await Promise.all([
        db.getEventById(event.id).then(() => db.listAllCategories()),
        db.listTicketTypesByEvent(event.id),
      ]);
      const categoryMatch =
        category.find(item => item.id === event.categoryId) ?? null;
      return { event, category: categoryMatch, ticketTypes };
    }),

  adminListCategories: adminProcedure.query(() => db.listAllCategories()),

  adminCreateCategory: adminProcedure
    .input(
      z.object({
        nameMm: z.string().min(1).max(191),
        nameEn: z.string().min(1).max(191),
        slug: z.string().min(1).max(191),
        description: z.string().optional(),
        posterUrl: z.string().optional(),
        status: categoryStatus.default("ACTIVE"),
        sortOrder: z.number().int().default(0),
      })
    )
    .mutation(async ({ input }) => ({ id: await db.createCategory(input) })),

  adminUpdateCategory: adminProcedure
    .input(
      z
        .object({
          id: z.number(),
          nameMm: z.string().min(1).max(191).optional(),
          nameEn: z.string().min(1).max(191).optional(),
          slug: z.string().min(1).max(191).optional(),
          description: z.string().optional(),
          posterUrl: z.string().optional(),
          status: categoryStatus.optional(),
          sortOrder: z.number().int().optional(),
        })
        .refine(({ id: _id, ...patch }) => Object.keys(patch).length > 0, {
          message: "At least one field is required",
        })
    )
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await db.updateCategory(id, patch);
      return { ok: true };
    }),

  adminListEvents: adminProcedure.query(async () => {
    const events = await db.listAllEvents();
    return attachCategories(events);
  }),

  adminCreateEvent: adminProcedure
    .input(
      z.object({
        categoryId: z.number(),
        slug: z.string().min(1).max(191),
        title: z.string().min(1).max(191),
        titleMm: z.string().optional(),
        description: z.string().optional(),
        venue: z.string().min(1).max(191),
        posterUrl: z.string().optional(),
        startsAt: z.number(),
        endsAt: z.number(),
        saleStartsAt: z.number(),
        saleEndsAt: z.number(),
        status: eventStatus.default("PUBLISHED"),
      })
    )
    .mutation(async ({ input }) => ({ id: await db.createEvent(input) })),

  adminUpdateEvent: adminProcedure
    .input(
      z
        .object({
          id: z.number(),
          categoryId: z.number().optional(),
          slug: z.string().min(1).max(191).optional(),
          title: z.string().min(1).max(191).optional(),
          titleMm: z.string().optional(),
          description: z.string().optional(),
          venue: z.string().min(1).max(191).optional(),
          posterUrl: z.string().optional(),
          startsAt: z.number().optional(),
          endsAt: z.number().optional(),
          saleStartsAt: z.number().optional(),
          saleEndsAt: z.number().optional(),
          status: eventStatus.optional(),
        })
        .refine(({ id: _id, ...patch }) => Object.keys(patch).length > 0, {
          message: "At least one field is required",
        })
    )
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await db.updateEvent(id, patch);
      return { ok: true };
    }),

  adminListTicketTypes: adminProcedure
    .input(z.object({ eventId: z.number() }))
    .query(({ input }) => db.listTicketTypesByEvent(input.eventId)),

  adminCreateTicketType: adminProcedure
    .input(
      z.object({
        eventId: z.number(),
        name: ticketTypeName,
        price: z.number().int().min(0),
        stock: z.number().int().min(0),
        maxPerUser: z.number().int().min(1).max(10),
        status: ticketTypeStatus.default("ACTIVE"),
      })
    )
    .mutation(async ({ input }) => ({ id: await db.createTicketType(input) })),

  adminUpdateTicketType: adminProcedure
    .input(
      z
        .object({
          id: z.number(),
          name: ticketTypeName.optional(),
          price: z.number().int().min(0).optional(),
          stock: z.number().int().min(0).optional(),
          maxPerUser: z.number().int().min(1).max(10).optional(),
          status: ticketTypeStatus.optional(),
        })
        .refine(({ id: _id, ...patch }) => Object.keys(patch).length > 0, {
          message: "At least one field is required",
        })
    )
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await db.updateTicketType(id, patch);
      return { ok: true };
    }),
});
