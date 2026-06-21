import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, Upload } from "lucide-react";
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
  console.log("merchantUid from route", merchantUid);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.orders.getByMerchantUid.useQuery(
    { merchantUid },
    { enabled: !!merchantUid, refetchInterval: (q) => (q.state.data?.order.status === "PAID" ? false : 2000) }
  );
  const uploadProof = trpc.orders.uploadPaymentProof.useMutation();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptDataUrl, setReceiptDataUrl] = useState("");

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
  const { order, event, ticketType, tickets, latestProof } = data;

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

  function handleReceiptChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setReceiptFile(null);
    setReceiptDataUrl("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Receipt must be jpg, jpeg, png, or webp.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Receipt image must be 10MB or smaller.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptFile(file);
      setReceiptDataUrl(String(reader.result ?? ""));
    };
    reader.onerror = () => toast.error("Could not read receipt image.");
    reader.readAsDataURL(file);
  }

  async function handleUploadProof() {
    if (!receiptFile || !receiptDataUrl) {
      toast.error("Please choose a receipt image first.");
      return;
    }
    try {
      const result = await uploadProof.mutateAsync({
        merchantUid: order.merchantUid,
        receiptImageDataUrl: receiptDataUrl,
        fileName: receiptFile.name,
      });
      if (result.ok) {
        toast.success("Receipt uploaded for admin review.");
        await utils.orders.getByMerchantUid.invalidate({ merchantUid: order.merchantUid });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Receipt upload failed");
    }
  }

  if (order.status === "PENDING_PAYMENT_VERIFICATION") {
    return (
      <SiteLayout>
        <div className="container py-12 max-w-2xl">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-amber-50 border-2 border-amber-500 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="mt-5 font-serif text-3xl font-bold text-[var(--sunmoon-navy)]">
              Receipt under review
            </h1>
            <p className="font-mm text-sm text-foreground/60">ငွေလွှဲဖြတ်ပိုင်း စစ်ဆေးနေပါသည်</p>
            <p className="mt-3 text-sm text-foreground/70">
              Your payment proof has been uploaded. Admin approval is required before QR tickets
              are issued.
            </p>
            {latestProof?.receiptImageUrl && (
              <a
                href={latestProof.receiptImageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex text-sm font-semibold text-[var(--sunmoon-blue)] hover:text-[var(--sunmoon-navy)]"
              >
                View uploaded receipt
              </a>
            )}
          </div>
        </div>
      </SiteLayout>
    );
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
              Transfer the total amount to the festival bank account, then upload your receipt.
              Admin approval is required before QR tickets are issued.
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

              <label className="block rounded-md border border-dashed border-border bg-white p-4 cursor-pointer hover:border-[var(--sunmoon-blue)] transition">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sunmoon-navy)]">
                  <Upload className="h-4 w-4" /> Upload bank transfer receipt
                </div>
                <div className="mt-1 text-xs text-foreground/60">
                  jpg, jpeg, png, or webp. Maximum 10MB.
                </div>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleReceiptChange}
                  className="sr-only"
                />
                {receiptFile && (
                  <div className="mt-2 text-xs font-medium text-[var(--sunmoon-blue)]">
                    {receiptFile.name}
                  </div>
                )}
              </label>

              {latestProof?.status === "REJECTED" && (
                <div className="flex items-start gap-2 rounded-md bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Receipt rejected: {latestProof.rejectionReason ?? "Please upload a clearer receipt."}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleUploadProof}
              disabled={uploadProof.isPending || !receiptFile}
              className="mt-5 w-full h-11 bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]"
            >
              {uploadProof.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Submit receipt · ₩{" "}
                  {order.totalAmount.toLocaleString()}
                </>
              )}
            </Button>
            <p className="mt-3 text-[11px] text-foreground/50 inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Admin approval is required before any ticket is
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
              <strong>{order.status}</strong> — this order will be marked PAID only after admin
              approves your receipt.
            </div>
          </div>
        </aside>
      </div>
    </SiteLayout>
  );
}
