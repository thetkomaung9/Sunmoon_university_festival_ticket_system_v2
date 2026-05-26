import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Mail, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  REFUNDED: "bg-slate-200 text-slate-700",
  EXPIRED: "bg-secondary text-foreground/60",
};

export default function AdminOrders() {
  const utils = trpc.useUtils();
  const { data: orders } = trpc.orders.adminListOrders.useQuery();
  const cancel = trpc.orders.adminCancelOrder.useMutation({
    onSuccess: () => utils.orders.adminListOrders.invalidate(),
  });
  const resend = trpc.orders.adminResendTickets.useMutation();

  const [filter, setFilter] = useState<"ALL" | "PENDING" | "PAID" | "CANCELLED" | "REFUNDED">("ALL");

  const filtered = (orders ?? []).filter((o) => filter === "ALL" || o.status === filter);

  async function handleCancel(orderId: number, refund: boolean) {
    if (!confirm(`Are you sure you want to ${refund ? "refund" : "cancel"} this order?`)) return;
    try {
      await cancel.mutateAsync({ orderId, refund });
      toast.success(`Order ${refund ? "refunded" : "cancelled"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function handleResend(orderId: number) {
    try {
      await resend.mutateAsync({ orderId });
      toast.success("Tickets resend triggered");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminLayout title="Orders" subtitle="All orders and payment records">
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {["ALL", "PENDING", "PAID", "CANCELLED", "REFUNDED"].map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k as never)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap",
              filter === k
                ? "bg-[var(--sunmoon-navy)] text-white"
                : "bg-secondary text-foreground/70"
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-foreground/60">
            <tr>
              <th className="px-4 py-3 text-left">Order</th>
              <th className="px-4 py-3 text-left">Buyer</th>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3">
                  <div className="font-mono text-[11px] text-foreground/70">{o.merchantUid}</div>
                  <div className="text-[10px] text-foreground/50">
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.buyerName}</div>
                  <div className="text-xs text-foreground/60">{o.buyerEmail}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="line-clamp-1">{o.event?.title ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-right">{o.quantity}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  ₩ {o.totalAmount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      STATUS_STYLE[o.status] ?? "bg-secondary"
                    )}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  {o.status === "PAID" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white"
                        onClick={() => handleResend(o.id)}
                      >
                        <Mail className="h-3.5 w-3.5" /> Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white"
                        onClick={() => handleCancel(o.id, true)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Refund
                      </Button>
                    </>
                  )}
                  {o.status === "PENDING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white"
                      onClick={() => handleCancel(o.id, false)}
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-foreground/50 py-12">
                  No orders match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
