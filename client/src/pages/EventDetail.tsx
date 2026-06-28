import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoEvents, demoTicketTypes } from "@/lib/demoCatalog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Tag,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const TT_DESC: Record<string, { en: string; mm: string }> = {
  Regular: { en: "General admission", mm: "ပုံမှန်ဝင်ခွင့်" },
  VIP: { en: "Premium seating · meet & greet", mm: "အထူး ထိုင်ခုံ" },
  "Early Bird": { en: "Discounted advance ticket", mm: "ကြိုတင် လျှော့စျေး" },
  Student: { en: "Valid student ID required", mm: "ကျောင်းသား ID လို" },
};

export default function EventDetailPage() {
  const [, params] = useRoute<{ slug: string }>("/events/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";

  const { data, isLoading } = trpc.catalog.getEventBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );
  const createPending = trpc.orders.createPending.useMutation();

  const [ticketTypeId, setTicketTypeId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [studentId, setStudentId] = useState("");

  useEffect(() => {
    if (data && !ticketTypeId && data.ticketTypes.length > 0) {
      const firstActive =
        data.ticketTypes.find(t => t.status === "ACTIVE") ??
        data.ticketTypes[0];
      setTicketTypeId(firstActive.id);
    }
  }, [data, ticketTypeId]);

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="container py-20 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--sunmoon-navy)]" />
        </div>
      </SiteLayout>
    );
  }
  if (!data) {
    const demoEvent = demoEvents.find(item => item.slug === slug);
    if (!demoEvent) {
      return (
        <SiteLayout>
          <div className="container py-20 text-center text-foreground/60">
            Event not found.
          </div>
        </SiteLayout>
      );
    }
    const eventTicketTypes = demoTicketTypes.filter(
      item => item.eventId === demoEvent.id
    );
    return (
      <EventDetailContent
        event={demoEvent}
        ticketTypes={eventTicketTypes}
        category={demoEvent.category}
      />
    );
  }

  const { event, ticketTypes, category } = data;
  return (
    <EventDetailContent
      event={event}
      ticketTypes={ticketTypes}
      category={category}
    />
  );
}

function EventDetailContent({
  event,
  ticketTypes,
  category,
}: {
  event: any;
  ticketTypes: any[];
  category: any;
}) {
  const createPending = trpc.orders.createPending.useMutation();
  const [, navigate] = useLocation();
  const [ticketTypeId, setTicketTypeId] = useState<number | null>(
    ticketTypes[0]?.id ?? null
  );
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const tt = ticketTypes.find(t => t.id === ticketTypeId);
  const total = (tt?.price ?? 0) * quantity;
  const remaining = tt ? tt.stock - tt.soldCount : 0;
  const startsAt = new Date(event.startsAt);
  const saleClosed =
    Date.now() > event.saleEndsAt || event.status !== "PUBLISHED";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tt) return;
    if (saleClosed) {
      toast.error("Ticket sale window has closed.");
      return;
    }
    try {
      const result = await createPending.mutateAsync({
        eventId: event.id,
        ticketTypeId: tt.id,
        quantity,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        buyerPhone: buyerPhone.trim() || undefined,
        studentId: studentId.trim() || undefined,
      });
      navigate(`/checkout/${result.merchantUid}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create order"
      );
    }
  }

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {event.posterUrl && (
            <img
              src={event.posterUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--sunmoon-navy-deep)]/95 via-[var(--sunmoon-navy)]/85 to-[var(--sunmoon-navy)]/60" />
        </div>
        <div className="container py-14 md:py-20">
          <nav className="text-xs text-white/60 mb-3">
            <span className="hover:text-white">Home</span>
            <span className="mx-2">/</span>
            <span>{category?.nameEn ?? "Events"}</span>
            <span className="mx-2">/</span>
            <span className="text-white">{event.title}</span>
          </nav>
          {category && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--sunmoon-gold)] text-[var(--sunmoon-navy-deep)] text-[11px] font-semibold uppercase tracking-wider">
              {category.nameEn}
            </span>
          )}
          <h1 className="mt-3 font-serif text-3xl md:text-5xl font-bold text-white tracking-tight max-w-3xl">
            {event.title}
          </h1>
          {event.titleMm && (
            <p className="mt-2 font-mm text-lg md:text-xl text-[var(--sunmoon-gold)]">
              {event.titleMm}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-[var(--sunmoon-gold)]" />
              {startsAt.toLocaleString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[var(--sunmoon-gold)]" />
              {event.venue}
            </span>
          </div>
        </div>
      </section>

      <div className="container py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Description */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
              About this event
            </h2>
            <p className="font-mm text-sm text-foreground/60">
              ပွဲတော် အကြောင်း
            </p>
            <p className="mt-4 text-foreground/80 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
              Choose your ticket
            </h2>
            <p className="font-mm text-sm text-foreground/60">လက်မှတ် ရွေးပါ</p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ticketTypes.map(t => {
                const left = t.stock - t.soldCount;
                const sold = left <= 0 || t.status !== "ACTIVE";
                const desc = TT_DESC[t.name] ?? { en: "", mm: "" };
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => !sold && setTicketTypeId(t.id)}
                    disabled={sold}
                    className={cn(
                      "group relative text-left p-5 rounded-lg border-2 transition",
                      ticketTypeId === t.id && !sold
                        ? "border-[var(--sunmoon-navy)] bg-[var(--sunmoon-navy)]/5"
                        : sold
                          ? "border-border bg-secondary/40 opacity-60 cursor-not-allowed"
                          : "border-border bg-white hover:border-[var(--sunmoon-navy)]/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif text-lg font-bold text-[var(--sunmoon-navy)]">
                            {t.name}
                          </span>
                          {ticketTypeId === t.id && !sold && (
                            <CheckCircle2 className="h-4 w-4 text-[var(--sunmoon-blue)]" />
                          )}
                        </div>
                        <p className="text-xs text-foreground/60 mt-0.5">
                          {desc.en}
                        </p>
                        <p className="text-xs font-mm text-foreground/50">
                          {desc.mm}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-serif text-xl font-bold text-[var(--sunmoon-navy)]">
                          ₩ {t.price.toLocaleString()}
                        </div>
                        {sold ? (
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-destructive mt-1">
                            Sold out
                          </div>
                        ) : (
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sunmoon-blue)] mt-1">
                            {left} left
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar form */}
        <aside className="lg:sticky lg:top-24 h-fit">
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-border bg-card p-6 shadow-[0_2px_24px_-12px_rgba(11,43,92,0.18)]"
          >
            <h3 className="font-serif text-xl font-bold text-[var(--sunmoon-navy)]">
              Reserve tickets
            </h3>
            <p className="font-mm text-xs text-foreground/60">
              လက်မှတ် ဝယ်ယူရန်
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <Label
                  htmlFor="qty"
                  className="text-xs uppercase tracking-wider"
                >
                  Quantity
                </Label>
                <div className="mt-1.5 flex items-center gap-2">
                  {[1, 2, 3, 4].map(n => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setQuantity(n)}
                      disabled={!tt || n > Math.min(tt.maxPerUser, remaining)}
                      className={cn(
                        "flex-1 h-10 rounded-md border text-sm font-semibold transition",
                        quantity === n
                          ? "border-[var(--sunmoon-navy)] bg-[var(--sunmoon-navy)] text-white"
                          : "border-border bg-white text-foreground/70 hover:border-[var(--sunmoon-navy)]/40 disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {tt && (
                  <p className="text-[11px] text-foreground/50 mt-1.5 inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> Max {tt.maxPerUser} per order
                  </p>
                )}
              </div>

              <div>
                <Label
                  htmlFor="name"
                  className="text-xs uppercase tracking-wider"
                >
                  Full name
                </Label>
                <Input
                  id="name"
                  value={buyerName}
                  onChange={e => setBuyerName(e.target.value)}
                  required
                  placeholder="Mg Mg"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label
                  htmlFor="email"
                  className="text-xs uppercase tracking-wider"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={buyerEmail}
                  onChange={e => setBuyerEmail(e.target.value)}
                  required
                  placeholder="student@sunmoon.ac.kr"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label
                  htmlFor="phone"
                  className="text-xs uppercase tracking-wider"
                >
                  Phone{" "}
                  <span className="text-foreground/40 normal-case">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="phone"
                  value={buyerPhone}
                  onChange={e => setBuyerPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label
                  htmlFor="student-id"
                  className="text-xs uppercase tracking-wider"
                >
                  Student ID{" "}
                  <span className="text-foreground/40 normal-case">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="student-id"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  placeholder="202600000"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60 inline-flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  {tt?.name ?? "—"} × {quantity}
                </span>
                <span className="font-medium">₩ {total.toLocaleString()}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-foreground/60">
                  Total
                </span>
                <span className="font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
                  ₩ {total.toLocaleString()}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!tt || saleClosed || createPending.isPending}
              className="mt-5 w-full h-11 bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)] text-base"
            >
              {createPending.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saleClosed ? (
                "Sale closed"
              ) : (
                "Continue to payment"
              )}
            </Button>
            <p className="mt-3 text-[11px] text-foreground/50 leading-relaxed">
              Order is created in <strong>PENDING</strong> state. Tickets are
              issued only after an admin approves the payment screenshot.
            </p>
          </form>
        </aside>
      </div>
    </SiteLayout>
  );
}
