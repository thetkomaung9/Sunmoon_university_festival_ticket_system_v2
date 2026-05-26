import { cn } from "@/lib/utils";
import { Calendar, MapPin } from "lucide-react";
import { Link } from "wouter";

export interface EventCardProps {
  slug: string;
  title: string;
  titleMm?: string | null;
  posterUrl?: string | null;
  startsAt: number;
  venue: string;
  category?: { nameEn: string; nameMm: string } | null;
  priceFrom?: number | null;
  className?: string;
}

export function EventCard({
  slug,
  title,
  titleMm,
  posterUrl,
  startsAt,
  venue,
  category,
  priceFrom,
  className,
}: EventCardProps) {
  const date = new Date(startsAt);
  return (
    <Link href={`/events/${slug}`}>
      <article
        className={cn(
          "group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:border-[var(--sunmoon-navy)]/30 hover:shadow-[0_8px_32px_-12px_rgba(11,43,92,0.25)]",
          className
        )}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--sunmoon-navy)] to-[var(--sunmoon-blue)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {category && (
            <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-white/95 text-[var(--sunmoon-navy)] text-[11px] font-semibold uppercase tracking-wider">
              {category.nameEn}
            </span>
          )}
          <div className="absolute bottom-3 left-3 right-3">
            <div className="text-white">
              <div className="font-serif text-lg font-semibold leading-tight line-clamp-2">
                {title}
              </div>
              {titleMm && (
                <div className="font-mm text-sm text-white/80 mt-0.5 line-clamp-1">
                  {titleMm}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-foreground/70">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--sunmoon-blue)]" />
            <span>
              {date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {" · "}
              {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/70">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--sunmoon-blue)]" />
            <span className="line-clamp-1">{venue}</span>
          </div>
          <div className="mt-auto pt-3 flex items-center justify-between border-t border-border/60">
            <div className="text-xs text-foreground/50">
              {priceFrom != null ? "Tickets from" : "Tickets available"}
            </div>
            <div className="font-serif text-base font-bold text-[var(--sunmoon-navy)]">
              {priceFrom != null ? `₩ ${priceFrom.toLocaleString()}` : "—"}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
