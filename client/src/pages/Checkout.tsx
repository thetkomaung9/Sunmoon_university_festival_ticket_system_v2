import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";

/**
 * Simulated checkout: in real Stripe deployment, this page would redirect to
 * Stripe Checkout. Here it shows the order, lets the buyer click "Confirm
 * payment" which posts to the *backend* webhook endpoint (server verifies the
 * amount + merchantUid before issuing tickets).
 */
export default function CheckoutPage() {
  const [, params] = useRoute<{ merchantUid: string }>("/checkout/:merchantUid");
  const [, navigate] = useLocation();
  const merchantUid = params?.merchantUid ?? "";
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.orders.getByMerchantUid.useQuery(
    { merchantUid },
    { enabled: !!merchantUid, refetchInterval: (q) => (q.state.data?.order.status === "PAID" ? false : 2000) }
  );
  const webhook = trpc.orders.paymentWebhook.useMutation();
  const [tampered, setTampered] = useState(false);

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
    return (
      <SiteLayout>
        <div className="container py-20 text-center text-foreground/60">Order not found.</div>
      </SiteLayout>
    );
  }
  const { order, event, ticketType, tickets } = data;

  if (order.status === "PAID") {
    return (
      <SiteLayout>
        <div className="container py-12 max-w-2xl">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="mt-5 font-serif text-3xl font-bold text-[var(--sunmoon-navy)]">
              Payment received
            </h1>
            <p className="font-mm text-sm text-foreground/60">ငွေပေးချေမှု အောင်မြင်</p>
            <p className="mt-3 text-sm text-foreground/70">
              Your QR ticket{tickets.length > 1 ? "s have" : " has"} been issued. A confirmation
              has been sent to <strong>{order.buyerEmail}</strong>.
            </p>

            <div className="mt-6 space-y-2">
              {tickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/ticket/${t.ticketCode}`}
                  className="block rounded-md border border-border p-4 text-left hover:border-[var(--sunmoon-navy)] transition"
                >
                  <div className="text-[10px] uppercase tracking-wider text-foreground/50">
                    Ticket code
                  </div>
                  <div className="font-mono font-bold text-[var(--sunmoon-navy)]">{t.ticketCode}</div>
                  <div className="mt-1 text-xs text-[var(--sunmoon-blue)] font-semibold">
                    Open ticket →
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  async function handlePay() {
    try {
      // Server compares against authoritative DB amount; tampered amount triggers BAD_REQUEST.
      const paidAmount = tampered ? order.totalAmount + 1 : order.totalAmount;
      const result = await webhook.mutateAsync({
        merchantUid: order.merchantUid,
        paidAmount,
      });
      if (result.ok) {
        toast.success("Payment verified — tickets issued.");
        await utils.orders.getByMerchantUid.invalidate({ merchantUid: order.merchantUid });
        if (result.tickets[0]) navigate(`/ticket/${result.tickets[0]}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    }
  }

  return (
    <SiteLayout>
      <div className="container py-12 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-[var(--sunmoon-navy)]">
            Complete your payment
          </h1>
          <p className="font-mm text-sm text-foreground/60 mt-1">ငွေပေးချေပြီးပါ</p>

          <div className="mt-6 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sunmoon-navy)]">
              <CreditCard className="h-4 w-4" /> Payment Gateway (Sandbox)
            </div>
            <p className="mt-2 text-xs text-foreground/60 leading-relaxed">
              In production, you would be redirected to Stripe Checkout to enter card details. For
              demo purposes, click <strong>Confirm payment</strong> below to simulate a successful
              charge — the backend will verify the amount and signature before issuing tickets.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between rounded-md bg-secondary p-4">
                <div>
                  <div className="text-xs text-foreground/60">Amount to charge</div>
                  <div className="font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
                    ₩ {order.totalAmount.toLocaleString()}
                  </div>
                </div>
                <Lock className="h-5 w-5 text-[var(--sunmoon-blue)]" />
              </div>

              <label className="flex items-start gap-2 text-xs text-foreground/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tampered}
                  onChange={(e) => setTampered(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <strong>Demo:</strong> simulate amount-tampering attack (server should reject
                  this). Off by default.
                </span>
              </label>
            </div>

            <Button
              onClick={handlePay}
              disabled={webhook.isPending}
              className="mt-5 w-full h-11 bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]"
            >
              {webhook.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Confirm payment · ₩{" "}
                  {order.totalAmount.toLocaleString()}
                </>
              )}
            </Button>
            <p className="mt-3 text-[11px] text-foreground/50 inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Server-side verification before any ticket is
              issued.
            </p>
          </div>
        </div>

        <aside className="lg:col-span-2 lg:sticky lg:top-24 h-fit">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-serif text-lg font-bold text-[var(--sunmoon-navy)]">
              Order summary
            </h2>
            <p className="font-mm text-xs text-foreground/60">အော်ဒါ အကျဉ်း</p>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs text-foreground/50">Event</div>
                <div className="font-semibold">{event?.title}</div>
                {event?.titleMm && (
                  <div className="font-mm text-xs text-foreground/60">{event.titleMm}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-foreground/50">Ticket</div>
                <div>
                  {ticketType?.name} × {order.quantity}
                </div>
              </div>
              <div>
                <div className="text-xs text-foreground/50">Buyer</div>
                <div>{order.buyerName}</div>
                <div className="text-xs text-foreground/60">{order.buyerEmail}</div>
              </div>
              <div>
                <div className="text-xs text-foreground/50">Order ID</div>
                <div className="font-mono text-xs text-foreground/80">{order.merchantUid}</div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-border flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-foreground/60">Total</span>
              <span className="font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
                ₩ {order.totalAmount.toLocaleString()}
              </span>
            </div>

            <div className="mt-4 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              <strong>PENDING</strong> — this order will be marked PAID only after the backend
              verifies the payment webhook.
            </div>
          </div>
        </aside>
      </div>
    </SiteLayout>
  );
}
