import { EventCard } from "@/components/EventCard";
import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Calendar, ScanLine, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { Link } from "wouter";

const HERO_IMG = "/categories/lanterns_f8e4aa28.jpg";

export default function Home() {
  const { data: events } = trpc.catalog.listEvents.useQuery();
  const { data: categories } = trpc.catalog.listCategories.useQuery();

  const upcoming = (events ?? []).slice(0, 6);

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={HERO_IMG} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--sunmoon-navy-deep)]/95 via-[var(--sunmoon-navy)]/85 to-[var(--sunmoon-navy)]/40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,200,87,0.18),transparent_55%)]" />
        </div>

        <div className="container py-20 md:py-32 lg:py-36">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--sunmoon-gold)]/40 bg-white/5 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-[var(--sunmoon-gold)]">
              <Sparkles className="h-3.5 w-3.5" />
              Official Ticketing Portal · ဆန်းမွန် မြန်မာအသင်း
            </div>
            <h1 className="mt-5 font-serif text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05]">
              Where Myanmar Culture
              <span className="block text-[var(--sunmoon-gold)]">Lights Up the Campus.</span>
            </h1>
            <p className="mt-6 max-w-xl font-mm text-lg text-white/85 leading-relaxed">
              ဆန်းမွန်တက္ကသိုလ် မြန်မာအသင်း၏ တရားဝင် ပွဲတော်လက်မှတ်ဝယ်ယူရာ စင်တာ။
            </p>
            <p className="max-w-xl text-base text-white/70 leading-relaxed mt-2">
              From Thadingyut Festival of Lights to Thingyan New Year — book your tickets, scan
              your QR at the gate, and join the celebration.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-[var(--sunmoon-gold)] text-[var(--sunmoon-navy-deep)] hover:bg-[var(--sunmoon-gold)]/90 shadow-lg shadow-[var(--sunmoon-gold)]/20"
              >
                <Link href="/events">
                  <Ticket className="h-5 w-5" /> Browse Events
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-white/10 backdrop-blur border-white/30 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/categories">
                  Explore Festivals <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* University strip */}
        <div className="border-t border-white/10 bg-[var(--sunmoon-navy-deep)]/60 backdrop-blur-sm">
          <div className="container py-5 grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { en: "Est. 1972", mm: "တည်ထောင်" },
              { en: "Asan, ROK", mm: "ကိုရီးယား" },
              { en: "Bilingual EN / မြန်မာ", mm: "နှစ်ဘာသာ" },
              { en: "QR Verified Tickets", mm: "လက်မှတ်အာမခံ" },
            ].map((stat, i) => (
              <div key={i} className="text-center md:text-left">
                <div className="text-sm font-semibold text-white">{stat.en}</div>
                <div className="text-xs font-mm text-white/50">{stat.mm}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories showcase */}
      <section className="py-20">
        <div className="container">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sunmoon-blue)]">
                Festival Categories
              </div>
              <h2 className="mt-2 font-serif text-3xl md:text-4xl font-bold text-[var(--sunmoon-navy)]">
                Celebrate every season.
              </h2>
              <p className="font-mm text-sm text-foreground/60 mt-1">
                ပွဲတော်တိုင်း · အချိန်တိုင်း
              </p>
            </div>
            <Link
              href="/categories"
              className="text-sm font-semibold text-[var(--sunmoon-blue)] hover:text-[var(--sunmoon-navy)] inline-flex items-center gap-1.5"
            >
              All categories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(categories ?? []).map((cat, idx) => (
              <Link key={cat.id} href={`/categories/${cat.slug}`}>
                <article className="group relative h-72 overflow-hidden rounded-lg border border-border bg-card">
                  {cat.posterUrl ? (
                    <img
                      src={cat.posterUrl}
                      alt={cat.nameEn}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--sunmoon-navy)] to-[var(--sunmoon-blue)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                  <div className="absolute top-4 left-4 h-8 w-8 rounded-full bg-[var(--sunmoon-gold)] text-[var(--sunmoon-navy-deep)] flex items-center justify-center text-xs font-bold">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <div className="font-mm text-sm text-[var(--sunmoon-gold)]">{cat.nameMm}</div>
                    <h3 className="mt-1 font-serif text-2xl font-bold text-white">
                      {cat.nameEn}
                    </h3>
                    {cat.description && (
                      <p className="mt-1.5 text-xs text-white/70 line-clamp-2">{cat.description}</p>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming events */}
      <section className="py-16 bg-secondary/40">
        <div className="container">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sunmoon-blue)]">
                Upcoming Events
              </div>
              <h2 className="mt-2 font-serif text-3xl md:text-4xl font-bold text-[var(--sunmoon-navy)]">
                Reserve your seat tonight.
              </h2>
              <p className="font-mm text-sm text-foreground/60 mt-1">
                လက်ရှိ ရရှိနိုင်သော ပွဲတော်များ
              </p>
            </div>
            <Link
              href="/events"
              className="text-sm font-semibold text-[var(--sunmoon-blue)] hover:text-[var(--sunmoon-navy)] inline-flex items-center gap-1.5"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-white p-16 text-center">
              <Calendar className="h-10 w-10 mx-auto text-foreground/30" />
              <p className="mt-3 text-foreground/60">No upcoming events at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {upcoming.map((evt) => (
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
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sunmoon-blue)]">
              How it works
            </div>
            <h2 className="mt-2 font-serif text-3xl md:text-4xl font-bold text-[var(--sunmoon-navy)]">
              Three steps to the gate.
            </h2>
            <p className="font-mm text-sm text-foreground/60 mt-2">
              အဆင့်သုံးဆင့်ဖြင့် ပွဲဝင်ပါ။
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: Ticket,
                step: "01",
                title: "Choose & Pay",
                titleMm: "ရွေးပြီး ငွေပေး",
                copy: "Pick an event, choose Regular / VIP / Early Bird / Student ticket, and pay securely. Your order stays pending until our backend verifies the payment.",
              },
              {
                icon: ShieldCheck,
                step: "02",
                title: "Verified QR Issued",
                titleMm: "QR လက်မှတ် ထုတ်ပေး",
                copy: "Once the payment webhook is verified server-side, a cryptographically signed QR ticket is automatically generated and sent to you.",
              },
              {
                icon: ScanLine,
                step: "03",
                title: "Scan at the Gate",
                titleMm: "ပွဲဝင်ရာ၌ စကင်",
                copy: "Show your QR on phone or print. Staff scan once — server marks it USED and records the scan log. Easy, fast, fraud-proof.",
              },
            ].map(({ icon: Icon, ...item }) => (
              <article
                key={item.step}
                className="relative rounded-lg border border-border bg-card p-6 hover:border-[var(--sunmoon-navy)]/30 transition"
              >
                <div className="absolute -top-3 right-5 font-serif text-xs font-bold tracking-widest text-[var(--sunmoon-gold)] bg-white px-2">
                  STEP {item.step}
                </div>
                <div className="h-12 w-12 rounded-md bg-[var(--sunmoon-navy)] text-white flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-serif text-xl font-bold text-[var(--sunmoon-navy)]">
                  {item.title}
                </h3>
                <div className="font-mm text-sm text-[var(--sunmoon-blue)] mt-0.5">
                  {item.titleMm}
                </div>
                <p className="mt-3 text-sm text-foreground/70 leading-relaxed">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
