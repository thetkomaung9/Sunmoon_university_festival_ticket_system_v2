import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  Loader2,
  MapPin,
  Printer,
  ShieldCheck,
  Ticket as TicketIcon,
  XCircle,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef } from "react";
import { useRoute } from "wouter";

const STATUS_STYLE: Record<string, { wrap: string; pill: string; icon: React.ComponentType<{ className?: string }> }> = {
  VALID: {
    wrap: "border-emerald-300 bg-emerald-50/50",
    pill: "bg-emerald-600 text-white",
    icon: ShieldCheck,
  },
  USED: {
    wrap: "border-slate-300 bg-slate-50",
    pill: "bg-slate-600 text-white",
    icon: CheckCircle2,
  },
  CANCELLED: {
    wrap: "border-rose-300 bg-rose-50/50",
    pill: "bg-rose-600 text-white",
    icon: XCircle,
  },
  EXPIRED: {
    wrap: "border-amber-300 bg-amber-50/50",
    pill: "bg-amber-600 text-white",
    icon: AlertTriangle,
  },
};

const STATUS_MM: Record<string, string> = {
  VALID: "အသုံးပြုနိုင်",
  USED: "သုံးပြီး",
  CANCELLED: "ပယ်ဖျက်ပြီး",
  EXPIRED: "သက်တမ်းကုန်",
};

export default function TicketViewPage() {
  const [, params] = useRoute<{ code: string }>("/ticket/:code");
  const code = params?.code ?? "";
  const buyerEmail =
    typeof window === "undefined"
      ? undefined
      : new URLSearchParams(window.location.search).get("email") ?? undefined;
  const { data, isLoading } = trpc.tickets.getByCode.useQuery(
    { code, buyerEmail },
    { enabled: !!code }
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current && data?.qrToken) {
      QRCode.toCanvas(canvasRef.current, data.qrToken, {
        width: 280,
        margin: 1,
        errorCorrectionLevel: "H",
        color: { dark: "#0B2B5C", light: "#FFFFFF" },
      }).catch(() => {});
    }
  }, [data?.qrToken]);

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
        <div className="container py-20 text-center text-foreground/60">
          Ticket not found. Use the ticket lookup page with your buyer email.
        </div>
      </SiteLayout>
    );
  }

  const { ticket, event, ticketType, order, qrToken } = data;
  const style = STATUS_STYLE[ticket.status] ?? STATUS_STYLE.VALID;
  const StatusIcon = style.icon;
  const startsAt = event ? new Date(event.startsAt) : null;

  async function handleDownloadTicket() {
    const qrMarkup = qrToken
      ? `<img alt="QR code" src="${await QRCode.toDataURL(qrToken, {
          width: 420,
          margin: 1,
          errorCorrectionLevel: "H",
          color: { dark: "#0B2B5C", light: "#FFFFFF" },
        })}" />`
      : ticket.qrImageUrl
        ? `<img alt="QR code" src="${ticket.qrImageUrl}" />`
        : `<div class="missing">QR unavailable</div>`;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${ticket.ticketCode}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #10233f; background: #f6f7fb; }
    .ticket { width: 520px; margin: 32px auto; background: white; border: 2px solid #0b2b5c; border-radius: 14px; overflow: hidden; }
    .head { padding: 22px 26px; background: #0b2b5c; color: white; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 18px; font-weight: 700; }
    .status { font-size: 12px; border: 1px solid rgba(255,255,255,.4); border-radius: 999px; padding: 6px 10px; }
    .body { padding: 26px; }
    h1 { margin: 0 0 6px; font-size: 26px; }
    .muted { color: #64748b; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 22px 0; }
    .label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
    .value { margin-top: 4px; font-weight: 700; }
    .qr { text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 24px; }
    .qr img { width: 320px; height: 320px; object-fit: contain; }
    .code { margin-top: 12px; font-family: monospace; font-size: 16px; font-weight: 700; }
    .missing { padding: 80px 0; color: #9ca3af; border: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="head">
      <div class="brand">Sunmoon University Myanmar Team</div>
      <div class="status">${ticket.status}</div>
    </div>
    <div class="body">
      <h1>${event?.title ?? "Event Ticket"}</h1>
      <div class="muted">Official Event Ticket</div>
      <div class="grid">
        <div><div class="label">Holder</div><div class="value">${order?.buyerName ?? "-"}</div></div>
        <div><div class="label">Ticket Type</div><div class="value">${ticketType?.name ?? "-"}</div></div>
        <div><div class="label">Date</div><div class="value">${startsAt ? startsAt.toLocaleString() : "-"}</div></div>
        <div><div class="label">Venue</div><div class="value">${event?.venue ?? "-"}</div></div>
      </div>
      <div class="qr">
        ${qrMarkup}
        <div class="code">${ticket.ticketCode}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ticket.ticketCode}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <SiteLayout>
      <div className="container py-10 max-w-2xl">
        <div
          className={cn(
            "rounded-2xl border-2 bg-white overflow-hidden shadow-[0_8px_40px_-16px_rgba(11,43,92,0.25)]",
            style.wrap
          )}
        >
          {/* Header strip */}
          <div className="bg-[var(--sunmoon-navy)] text-white px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10 border border-[var(--sunmoon-gold)]/40 flex items-center justify-center font-serif font-bold text-[var(--sunmoon-gold)]">
                SM
              </div>
              <div>
                <div className="font-serif text-base font-bold">Sunmoon Myanmar Team</div>
                <div className="text-[10px] font-mm text-white/60 uppercase tracking-widest">
                  Official Event Ticket
                </div>
              </div>
            </div>
            <div className={cn("px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5", style.pill)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {ticket.status}
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="font-mm text-xs text-[var(--sunmoon-blue)]">{STATUS_MM[ticket.status]}</div>
            <h1 className="mt-1 font-serif text-2xl md:text-3xl font-bold text-[var(--sunmoon-navy)]">
              {event?.title}
            </h1>
            {event?.titleMm && (
              <p className="font-mm text-sm text-foreground/60">{event.titleMm}</p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              {startsAt && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-foreground/50">Date</div>
                  <div className="mt-0.5 font-medium inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[var(--sunmoon-blue)]" />
                    {startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div className="text-xs text-foreground/60">
                    {startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-foreground/50">Venue</div>
                <div className="mt-0.5 font-medium inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[var(--sunmoon-blue)]" />
                  <span className="line-clamp-1">{event?.venue}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-foreground/50">Type</div>
                <div className="mt-0.5 font-medium inline-flex items-center gap-1.5">
                  <TicketIcon className="h-3.5 w-3.5 text-[var(--sunmoon-blue)]" />
                  {ticketType?.name}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-foreground/50">Holder</div>
                <div className="mt-0.5 font-medium">{order?.buyerName ?? "—"}</div>
              </div>
            </div>

            <div className="my-6 relative h-px bg-border">
              <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-secondary border-r border-b border-border" />
              <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-secondary border-l border-b border-border" />
            </div>

            {/* QR Section */}
            <div className="flex flex-col items-center text-center">
              {ticket.status === "VALID" && (qrToken || ticket.qrImageUrl) ? (
                <>
                  <div className="rounded-lg border-2 border-[var(--sunmoon-navy)]/15 p-3 bg-white">
                    {ticket.qrImageUrl ? (
                      <img
                        src={ticket.qrImageUrl}
                        alt={`QR code for ticket ${ticket.ticketCode}`}
                        className="h-[280px] w-[280px]"
                      />
                    ) : (
                      <canvas ref={canvasRef} />
                    )}
                  </div>
                  <div className="mt-3 font-mono text-sm font-bold text-[var(--sunmoon-navy)]">
                    {ticket.ticketCode}
                  </div>
                  <p className="mt-1 text-[11px] text-foreground/50 max-w-xs">
                    Show this QR at the gate. Staff will scan it once — afterward this ticket
                    becomes <strong>USED</strong>.
                  </p>
                </>
              ) : (
                <div className="py-8">
                  <StatusIcon className={cn("h-12 w-12 mx-auto", style.pill.includes("emerald") ? "text-emerald-600" : style.pill.includes("rose") ? "text-rose-600" : style.pill.includes("amber") ? "text-amber-600" : "text-slate-500")} />
                  <div className="mt-3 font-serif text-lg font-bold text-foreground">
                    This ticket is {ticket.status}.
                  </div>
                  <div className="font-mono text-xs text-foreground/60 mt-2">{ticket.ticketCode}</div>
                  {ticket.usedAt && (
                    <div className="mt-2 text-xs text-foreground/60">
                      Checked in {new Date(ticket.usedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="bg-white"
              >
                <Printer className="h-4 w-4" /> Print ticket
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadTicket}
                className="bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]"
              >
                <Download className="h-4 w-4" /> Download ticket
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
