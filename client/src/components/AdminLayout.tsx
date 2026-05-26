import { useAuth } from "@/_core/hooks/useAuth";
import { SunmoonLogo } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Lock,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  Tag,
} from "lucide-react";
import { Link, useLocation } from "wouter";

const NAV = [
  { href: "/admin", icon: BarChart3, label: "Overview" },
  { href: "/admin/events", icon: CalendarDays, label: "Events" },
  { href: "/admin/categories", icon: Tag, label: "Categories" },
  { href: "/admin/orders", icon: ShoppingBag, label: "Orders" },
  { href: "/admin/reports", icon: ShieldCheck, label: "Attendance" },
];

export default function AdminLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const [location] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground/50">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="rounded-lg border border-border bg-card p-8 text-center max-w-md">
          <Lock className="h-10 w-10 mx-auto text-[var(--sunmoon-navy)]" />
          <h1 className="mt-4 font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
            Admin sign-in required
          </h1>
          <Button asChild className="mt-5 w-full bg-[var(--sunmoon-navy)]">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="rounded-lg border border-border bg-card p-8 text-center max-w-md">
          <AlertTriangle className="h-10 w-10 mx-auto text-amber-600" />
          <h1 className="mt-4 font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
            Access denied
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            Your account ({user?.email}) does not have admin permissions.
          </p>
          <Button asChild variant="outline" className="mt-5 bg-white">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/40 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[var(--sunmoon-navy)] text-white sticky top-0 h-screen">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-white/10 border border-[var(--sunmoon-gold)]/40 flex items-center justify-center font-serif font-bold text-[var(--sunmoon-gold)]">
              SM
            </div>
            <div>
              <div className="font-serif text-sm font-bold">Admin Console</div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                SMU Myanmar
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(item => {
            const active =
              location === item.href ||
              (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition",
                  active
                    ? "bg-white/10 text-white font-semibold"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="h-px bg-white/10 my-3" />
          <Link
            href="/scanner"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            <ScanLine className="h-4 w-4" />
            Scanner
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
        </nav>
        <div className="p-4 border-t border-white/10 text-xs text-white/50">
          <div className="font-medium text-white/80 truncate">
            {user.name ?? user.email}
          </div>
          <div className="text-white/40 truncate">{user.email}</div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--sunmoon-gold)]">
            ADMIN
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden bg-[var(--sunmoon-navy)] text-white p-4">
          <SunmoonLogo />
          <nav className="mt-3 flex gap-2 overflow-x-auto">
            {NAV.map(item => {
              const active =
                location === item.href ||
                (item.href !== "/admin" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap",
                    active
                      ? "bg-white text-[var(--sunmoon-navy)]"
                      : "bg-white/10 text-white/80"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <header className="border-b border-border bg-white">
          <div className="px-6 lg:px-10 py-6">
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-[var(--sunmoon-navy)]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-foreground/60">{subtitle}</p>
            )}
          </div>
        </header>

        <div className="p-6 lg:p-10">{children}</div>
      </div>
    </div>
  );
}
