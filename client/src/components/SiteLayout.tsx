import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  LogOut,
  Menu,
  ScanLine,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const NAV = [
  { href: "/", labelEn: "Home", labelMm: "ပင်မ" },
  { href: "/categories", labelEn: "Categories", labelMm: "အမျိုးအစား" },
  { href: "/events", labelEn: "Events", labelMm: "ပွဲများ" },
  { href: "/about", labelEn: "About", labelMm: "အကြောင်း" },
];

export function SunmoonLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative h-10 w-10 shrink-0">
        <div className="absolute inset-0 rounded-full bg-[var(--sunmoon-navy)]" />
        <div className="absolute inset-[3px] rounded-full border border-[var(--sunmoon-gold)]/40 flex items-center justify-center">
          <span className="font-serif text-base font-bold text-[var(--sunmoon-gold)]">
            SM
          </span>
        </div>
      </div>
      <div className="leading-tight">
        <div className="font-serif text-[15px] font-bold tracking-tight text-[var(--sunmoon-navy)]">
          Sunmoon University
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--sunmoon-blue)]">
          Myanmar Team
        </div>
      </div>
    </div>
  );
}

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff" || isAdmin;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar (academic style) */}
      <div className="hidden md:block bg-[var(--sunmoon-navy)] text-white/80 text-xs">
        <div className="container flex items-center justify-between h-8">
          <div className="flex items-center gap-4 font-mm">
            <span>ဆန်းမွန်တက္ကသိုလ် မြန်မာအသင်း</span>
            <span className="text-white/30">·</span>
            <span>Asan Campus, Republic of Korea</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://lily.sunmoon.ac.kr"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition"
            >
              SUNMOON Portal
            </a>
            <span className="text-white/30">|</span>
            <span>EN / မြန်မာ</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <SunmoonLogo />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map(item => {
              const active =
                location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium transition rounded-md",
                    active
                      ? "text-[var(--sunmoon-navy)]"
                      : "text-foreground/70 hover:text-[var(--sunmoon-navy)]"
                  )}
                >
                  <span className="block">{item.labelEn}</span>
                  <span className="hidden xl:block text-[10px] font-mm text-foreground/50">
                    {item.labelMm}
                  </span>
                  {active && (
                    <span className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 h-[3px] w-12 rounded-full bg-[var(--sunmoon-gold)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="bg-white">
              <Link href="/tickets/lookup">
                <Ticket className="h-4 w-4" />
                Find Tickets
              </Link>
            </Button>
            {isStaff && (
              <Button asChild variant="outline" size="sm" className="bg-white">
                <Link href="/scanner">
                  <ScanLine className="h-4 w-4" />
                  Scanner
                </Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="bg-white">
                <Link href="/admin">
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </Link>
              </Button>
            )}
            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="text-foreground/70"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                className="bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]"
              >
                <Link href="/signin">
                  <GraduationCap className="h-4 w-4" />
                  Admin sign in
                </Link>
              </Button>
            )}
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen(v => !v)}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--sunmoon-navy)] hover:bg-secondary transition"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="lg:hidden border-t border-border bg-white">
            <div className="container py-3 flex flex-col gap-1">
              {NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-medium hover:bg-secondary"
                >
                  {item.labelEn}
                  <span className="ml-2 text-xs font-mm text-foreground/50">
                    {item.labelMm}
                  </span>
                </Link>
              ))}
              <div className="h-px bg-border my-2" />
              <Link
                href="/tickets/lookup"
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm font-medium hover:bg-secondary flex items-center gap-2"
              >
                <Ticket className="h-4 w-4" /> Find Tickets
              </Link>
              {isStaff && (
                <Link
                  href="/scanner"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-medium hover:bg-secondary flex items-center gap-2"
                >
                  <ScanLine className="h-4 w-4" /> Scanner
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-medium hover:bg-secondary flex items-center gap-2"
                >
                  <ShieldCheck className="h-4 w-4" /> Admin Dashboard
                </Link>
              )}
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="px-3 py-2.5 rounded-md text-sm font-medium text-left hover:bg-secondary flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <Link
                  href="/signin"
                  className="px-3 py-2.5 rounded-md text-sm font-medium bg-[var(--sunmoon-navy)] text-white flex items-center gap-2"
                >
                  <GraduationCap className="h-4 w-4" /> Admin sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 bg-[var(--sunmoon-navy)] text-white/80">
        <div className="container py-12 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-serif font-bold text-[var(--sunmoon-gold)]">
                SM
              </div>
              <div>
                <div className="font-serif text-base font-bold text-white">
                  Sunmoon University
                </div>
                <div className="text-xs font-mm text-white/60">
                  Myanmar Team · မြန်မာအသင်း
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm text-white/60 leading-relaxed">
              The official event ticketing portal of the Sunmoon University
              Myanmar Team. We celebrate Myanmar culture on Korean soil through
              Thadingyut, Thingyan, and cultural showcases throughout the
              academic year.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Navigate</h4>
            <ul className="space-y-2 text-sm text-white/60">
              {NAV.map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:text-white transition"
                  >
                    {item.labelEn}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/scanner"
                  className="hover:text-white transition flex items-center gap-1.5"
                >
                  <Ticket className="h-3.5 w-3.5" /> Staff scanner
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li>Sunmoon University, Asan</li>
              <li>Chungcheongnam-do, ROK</li>
              <li>myanmar.team@sunmoon.ac.kr</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-white/40">
            <span>
              © {new Date().getFullYear()} Sunmoon University Myanmar Team. All
              rights reserved.
            </span>
            <span>Built for ဆန်းမွန် မြန်မာအသင်း · Asan Campus</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
