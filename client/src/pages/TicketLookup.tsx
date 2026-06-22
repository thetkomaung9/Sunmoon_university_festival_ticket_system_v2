import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Download,
  Loader2,
  Mail,
  MapPin,
  QrCode,
  Search,
  Ticket,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const STATUS_STYLE: Record<string, string> = {
  VALID: "bg-emerald-100 text-emerald-700",
  USED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  EXPIRED: "bg-amber-100 text-amber-700",
};

export default function TicketLookupPage() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const lookup = trpc.tickets.lookupByBuyerEmail.useQuery(
    { buyerEmail: submittedEmail || "buyer@example.com" },
    { enabled: Boolean(submittedEmail), retry: false }
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter the buyer email used at checkout.");
      return;
    }
    setSubmittedEmail(trimmed);
  }

  const tickets = lookup.data ?? [];

  return (
    <SiteLayout>
      <div className="container py-10">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sunmoon-blue)]">
          <Ticket className="h-4 w-4" /> Ticket Lookup
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold text-[var(--sunmoon-navy)]">
          Find your QR tickets
        </h1>
        <p className="font-mm text-sm text-foreground/60 mt-1">
          ဝယ်ယူထားသော အီးမေးလ်ဖြင့် လက်မှတ်ရှာရန်
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-lg border border-border bg-card p-5 max-w-xl"
        >
          <Label htmlFor="lookup-email" className="text-xs uppercase tracking-wider">
            Buyer email
          </Label>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input
                id="lookup-email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="pl-9"
              />
            </div>
            <Button
              type="submit"
              disabled={lookup.isFetching}
              className="bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]"
            >
              {lookup.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>
        </form>

        {lookup.isError && (
          <div className="mt-5 max-w-xl rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {lookup.error.message}
          </div>
        )}

        {submittedEmail && !lookup.isFetching && tickets.length === 0 && !lookup.isError && (
          <div className="mt-8 rounded-lg border border-border bg-card p-10 text-center">
            <QrCode className="h-10 w-10 mx-auto text-foreground/35" />
            <h2 className="mt-4 font-serif text-xl font-bold text-[var(--sunmoon-navy)]">
              No issued tickets found
            </h2>
            <p className="mt-2 text-sm text-foreground/60">
              Tickets appear here after admin payment approval. Check the email spelling or wait for verification.
            </p>
          </div>
        )}

        {tickets.length > 0 && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
            {tickets.map(({ ticket, event, ticketType, order }) => {
              const startsAt = event ? new Date(event.startsAt) : null;
              return (
                <div
                  key={ticket.id}
                  className="rounded-lg border border-border bg-card p-5 grid grid-cols-[112px_1fr] gap-4"
                >
                  <div className="rounded-md border border-border bg-white p-2 h-28 w-28 flex items-center justify-center">
                    {ticket.qrImageUrl ? (
                      <img
                        src={ticket.qrImageUrl}
                        alt={`QR code for ${ticket.ticketCode}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <QrCode className="h-10 w-10 text-foreground/35" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-serif text-lg font-bold text-[var(--sunmoon-navy)] truncate">
                          {event?.title ?? "Event"}
                        </h2>
                        <div className="mt-1 font-mono text-xs font-semibold text-foreground/70">
                          {ticket.ticketCode}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          STATUS_STYLE[ticket.status] ?? "bg-secondary text-foreground/60"
                        )}
                      >
                        {ticket.status}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-foreground/65">
                      <div className="flex items-center gap-1.5">
                        <Ticket className="h-3.5 w-3.5 text-[var(--sunmoon-blue)]" />
                        {ticketType?.name ?? "Ticket"} · {order?.buyerName ?? "Holder"}
                      </div>
                      {startsAt && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[var(--sunmoon-blue)]" />
                          {startsAt.toLocaleString()}
                        </div>
                      )}
                      {event?.venue && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[var(--sunmoon-blue)]" />
                          <span className="truncate">{event.venue}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" className="bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]">
                        <Link href={`/ticket/${ticket.ticketCode}?email=${encodeURIComponent(submittedEmail)}`}>
                          <QrCode className="h-4 w-4" /> Open QR
                        </Link>
                      </Button>
                      {ticket.qrImageUrl && (
                        <Button asChild size="sm" variant="outline" className="bg-white">
                          <a href={ticket.qrImageUrl} download>
                            <Download className="h-4 w-4" /> Download QR
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
