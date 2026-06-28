import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  QrCode,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { Link, useRoute } from "wouter";

const ORDER_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PENDING_PAYMENT_VERIFICATION: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
  REFUNDED: "bg-slate-200 text-slate-700",
  EXPIRED: "bg-secondary text-foreground/60",
};

const PROOF_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

export default function TicketStatusPage() {
  const [, params] = useRoute<{ merchantUid: string }>(
    "/ticket-status/:merchantUid"
  );
  const merchantUid = params?.merchantUid ?? "";
  const { data, isLoading, isError, error } =
    trpc.orders.getByMerchantUid.useQuery(
      { merchantUid },
      {
        enabled: Boolean(merchantUid),
        refetchInterval: q =>
          q.state.data?.order.status === "PAID" ? false : 5000,
      }
    );

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="container py-20 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--sunmoon-navy)]" />
        </div>
      </SiteLayout>
    );
  }

  if (isError || !data) {
    return (
      <SiteLayout>
        <div className="container py-20 max-w-xl">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto text-rose-600" />
            <h1 className="mt-4 font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
              Order not found
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              {error?.message ?? "Check the order status link and try again."}
            </p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const { order, event, ticketType, tickets, latestProof } = data;
  const proofStatus =
    order.status === "PAID" ? "APPROVED" : latestProof?.status ?? "NOT_UPLOADED";

  return (
    <SiteLayout>
      <div className="container py-10 max-w-4xl">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sunmoon-blue)]">
          <Ticket className="h-4 w-4" /> Ticket Status
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold text-[var(--sunmoon-navy)]">
          Order status
        </h1>
        <p className="mt-1 font-mono text-xs text-foreground/60">
          {order.merchantUid}
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sunmoon-navy)]">
              <Clock3 className="h-4 w-4" /> Order
            </div>
            <span
              className={cn(
                "mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                ORDER_STATUS_STYLE[order.status] ?? "bg-secondary"
              )}
            >
              {order.status}
            </span>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sunmoon-navy)]">
              <ShieldCheck className="h-4 w-4" /> Payment Verification
            </div>
            <span
              className={cn(
                "mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                proofStatus === "NOT_UPLOADED"
                  ? "bg-secondary text-foreground/60"
                  : PROOF_STATUS_STYLE[proofStatus] ?? "bg-secondary"
              )}
            >
              {proofStatus}
            </span>
            {latestProof?.status === "REJECTED" && (
              <p className="mt-3 text-xs text-rose-800">
                {latestProof.rejectionReason ??
                  "Receipt rejected. Upload a clearer payment screenshot from checkout."}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sunmoon-navy)]">
              <QrCode className="h-4 w-4" /> QR Ticket
            </div>
            <span
              className={cn(
                "mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                tickets.length > 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-secondary text-foreground/60"
              )}
            >
              {tickets.length > 0 ? "ISSUED" : "WAITING"}
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <h2 className="font-serif text-lg font-bold text-[var(--sunmoon-navy)]">
            Order details
          </h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-foreground/50">Event</div>
              <div className="font-semibold">{event?.title ?? "Event"}</div>
            </div>
            <div>
              <div className="text-xs text-foreground/50">Ticket</div>
              <div>
                {ticketType?.name ?? "Ticket"} x {order.quantity}
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground/50">Buyer</div>
              <div>{order.buyerName}</div>
              <div className="text-xs text-foreground/60">{order.buyerEmail}</div>
            </div>
            <div>
              <div className="text-xs text-foreground/50">Total</div>
              <div className="font-serif text-xl font-bold text-[var(--sunmoon-navy)]">
                ₩ {order.totalAmount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="mt-6 rounded-lg border border-border bg-white p-8 text-center">
            <Clock3 className="h-10 w-10 mx-auto text-foreground/35" />
            <h2 className="mt-4 font-serif text-xl font-bold text-[var(--sunmoon-navy)]">
              Waiting for admin approval
            </h2>
            <p className="mt-2 text-sm text-foreground/60">
              QR tickets appear here after the payment screenshot is approved.
            </p>
            {order.status === "PENDING" && (
              <Button asChild className="mt-5 bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]">
                <Link href={`/checkout/${order.merchantUid}`}>
                  Upload payment screenshot
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {tickets.map(ticket => (
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
                  <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Approved
                  </div>
                  <div className="mt-2 font-mono text-sm font-bold text-[var(--sunmoon-navy)]">
                    {ticket.ticketCode}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" className="bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]">
                      <Link
                        href={`/ticket/${ticket.ticketCode}?email=${encodeURIComponent(
                          order.buyerEmail
                        )}`}
                      >
                        <QrCode className="h-4 w-4" /> Open QR
                      </Link>
                    </Button>
                    {ticket.qrImageUrl && (
                      <Button asChild size="sm" variant="outline" className="bg-white">
                        <a href={ticket.qrImageUrl} download>
                          <Download className="h-4 w-4" /> Download
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
