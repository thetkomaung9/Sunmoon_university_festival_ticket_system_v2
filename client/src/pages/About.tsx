import SiteLayout from "@/components/SiteLayout";
import { GraduationCap, Heart, Users } from "lucide-react";

export default function AboutPage() {
  return (
    <SiteLayout>
      <section className="border-b border-border bg-secondary/40">
        <div className="container py-16 md:py-20">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sunmoon-blue)]">
            About
          </div>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl font-bold text-[var(--sunmoon-navy)]">
            Sunmoon University Myanmar Team
          </h1>
          <p className="mt-2 font-mm text-lg text-foreground/70">ဆန်းမွန်တက္ကသိုလ် မြန်မာအသင်း</p>
        </div>
      </section>

      <section className="container py-14 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6 text-foreground/80 leading-relaxed">
          <p>
            The <strong>Sunmoon University Myanmar Team (SMU Myanmar Team)</strong> is the official
            student-led organization representing Myanmar (Burmese) students at Sunmoon University,
            Asan, Republic of Korea. We host cultural festivals, academic events, and community
            gatherings throughout the year — from <em>Thadingyut</em> Festival of Lights to{" "}
            <em>Thingyan</em> Water Festival, and the annual Myanmar Night showcase.
          </p>
          <p>
            This portal is the official ticketing system used by the team to manage event sales,
            verify entry at the gate via QR codes, and keep our community organized. Every order
            goes through a secure server-side payment verification before tickets are issued.
          </p>
          <p>
            We welcome students, faculty, families, and friends of Myanmar culture to join our
            celebrations.
          </p>
        </div>
        <aside className="space-y-3">
          {[
            { icon: GraduationCap, title: "Academic", copy: "Run by Myanmar students enrolled at Sunmoon University Asan Campus." },
            { icon: Heart, title: "Cultural", copy: "Preserving and celebrating Myanmar traditions on Korean soil." },
            { icon: Users, title: "Community", copy: "Open to all students, faculty, and friends of Myanmar." },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-5">
              <div className="h-10 w-10 rounded-md bg-[var(--sunmoon-navy)] text-white flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-serif text-lg font-bold text-[var(--sunmoon-navy)]">{title}</h3>
              <p className="mt-1.5 text-sm text-foreground/70">{copy}</p>
            </div>
          ))}
        </aside>
      </section>
    </SiteLayout>
  );
}
