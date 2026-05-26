import SiteLayout from "@/components/SiteLayout";
import { demoCategories } from "@/lib/demoCatalog";
import { trpc } from "@/lib/trpc";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function CategoriesPage() {
  const { data: categories, isLoading } =
    trpc.catalog.listCategories.useQuery();
  const displayCategories = categories?.length ? categories : demoCategories;

  return (
    <SiteLayout>
      <div className="border-b border-border bg-secondary/40">
        <div className="container py-12 md:py-16">
          <nav className="text-xs text-foreground/60 mb-3">
            <Link href="/" className="hover:text-[var(--sunmoon-navy)]">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-[var(--sunmoon-navy)]">Categories</span>
          </nav>
          <div className="flex items-end gap-3">
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-[var(--sunmoon-navy)]">
              Festival Categories
            </h1>
          </div>
          <p className="font-mm text-base text-foreground/60 mt-2">
            အမျိုးအစား စာရင်း
          </p>
        </div>
      </div>

      <div className="container py-12">
        {isLoading && !categories ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="aspect-[16/10] rounded-lg bg-secondary animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayCategories.map(cat => (
              <Link key={cat.id} href={`/categories/${cat.slug}`}>
                <article className="group relative aspect-[16/9] overflow-hidden rounded-lg border border-border">
                  {cat.posterUrl ? (
                    <img
                      src={cat.posterUrl}
                      alt={cat.nameEn}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--sunmoon-navy)] to-[var(--sunmoon-blue)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/30" />
                  <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                    <div className="font-mm text-base text-[var(--sunmoon-gold)]">
                      {cat.nameMm}
                    </div>
                    <h2 className="mt-1 font-serif text-3xl md:text-4xl font-bold text-white">
                      {cat.nameEn}
                    </h2>
                    {cat.description && (
                      <p className="mt-3 max-w-md text-sm text-white/75 line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                    <span className="mt-5 inline-flex w-fit items-center gap-2 px-4 py-2 rounded-md bg-white/95 text-[var(--sunmoon-navy)] text-sm font-semibold">
                      Browse events <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
