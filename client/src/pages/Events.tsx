import { EventCard } from "@/components/EventCard";
import SiteLayout from "@/components/SiteLayout";
import { demoCategories, demoEvents } from "@/lib/demoCatalog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import { useMemo } from "react";
import { Link, useRoute } from "wouter";

export default function EventsPage() {
  const [matchCategory, paramsCategory] = useRoute<{ slug: string }>(
    "/categories/:slug"
  );
  const slug = matchCategory ? paramsCategory?.slug : undefined;
  const queryInput = useMemo(
    () => (slug ? { categorySlug: slug } : undefined),
    [slug]
  );
  const { data: events, isLoading } =
    trpc.catalog.listEvents.useQuery(queryInput);
  const { data: categories } = trpc.catalog.listCategories.useQuery();

  const displayCategories = categories?.length ? categories : demoCategories;
  const displayEvents = events?.length
    ? events
    : demoEvents.filter(event => !slug || event.category.slug === slug);
  const activeCategory = slug
    ? displayCategories.find(c => c.slug === slug)
    : null;

  return (
    <SiteLayout>
      <div className="border-b border-border bg-secondary/40">
        <div className="container py-12 md:py-16">
          <nav className="text-xs text-foreground/60 mb-3">
            <Link href="/" className="hover:text-[var(--sunmoon-navy)]">
              Home
            </Link>
            <span className="mx-2">/</span>
            {slug ? (
              <>
                <Link
                  href="/categories"
                  className="hover:text-[var(--sunmoon-navy)]"
                >
                  Categories
                </Link>
                <span className="mx-2">/</span>
                <span className="text-[var(--sunmoon-navy)]">
                  {activeCategory?.nameEn ?? slug}
                </span>
              </>
            ) : (
              <span className="text-[var(--sunmoon-navy)]">Events</span>
            )}
          </nav>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[var(--sunmoon-navy)]">
            {activeCategory ? activeCategory.nameEn : "All Events"}
          </h1>
          <p className="font-mm text-base text-foreground/60 mt-2">
            {activeCategory ? activeCategory.nameMm : "ပွဲတော် အားလုံး"}
          </p>
          {activeCategory?.description && (
            <p className="mt-4 max-w-2xl text-sm text-foreground/70 leading-relaxed">
              {activeCategory.description}
            </p>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="border-b border-border bg-white">
        <div className="container py-4 flex items-center gap-2 overflow-x-auto">
          <Link href="/events">
            <span
              className={cn(
                "inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold transition",
                !slug
                  ? "bg-[var(--sunmoon-navy)] text-white"
                  : "bg-secondary text-foreground/70 hover:bg-secondary/80"
              )}
            >
              All
            </span>
          </Link>
          {displayCategories.map(c => (
            <Link key={c.id} href={`/categories/${c.slug}`}>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition",
                  slug === c.slug
                    ? "bg-[var(--sunmoon-navy)] text-white"
                    : "bg-secondary text-foreground/70 hover:bg-secondary/80"
                )}
              >
                {c.nameEn}
                <span className="font-mm font-normal opacity-70">
                  · {c.nameMm}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="container py-12">
        {isLoading && !events ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="aspect-[3/4] rounded-lg bg-secondary animate-pulse"
              />
            ))}
          </div>
        ) : displayEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-16 text-center">
            <Calendar className="h-10 w-10 mx-auto text-foreground/30" />
            <p className="mt-3 text-foreground/60">
              No events in this category yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayEvents.map(evt => (
              <EventCard
                key={evt.id}
                slug={evt.slug}
                title={evt.title}
                titleMm={evt.titleMm}
                posterUrl={evt.posterUrl}
                startsAt={evt.startsAt}
                venue={evt.venue}
                category={evt.category}
              />
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
