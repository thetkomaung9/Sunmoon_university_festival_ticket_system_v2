import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CalendarDays, ShieldCheck, ShoppingBag, Tag } from "lucide-react";
import { Link } from "wouter";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  REFUNDED: "bg-slate-200 text-slate-700",
  EXPIRED: "bg-secondary text-foreground/60",
};

export default function AdminOverview() {
  const { data: events } = trpc.catalog.adminListEvents.useQuery();
  const { data: categories } = trpc.catalog.adminListCategories.useQuery();
  const { data: orders } = trpc.orders.adminListOrders.useQuery();

  const paidOrders = (orders ?? []).filter(order => order.status === "PAID");
  const revenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const ticketsSold = paidOrders.reduce(
    (sum, order) => sum + order.quantity,
    0
  );
  const recentOrders = (orders ?? []).slice(0, 6);

  return (
    <AdminLayout
      title="Overview"
      subtitle="Ticket sales, event activity, and operational shortcuts"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric
          label="Events"
          value={events?.length ?? 0}
          icon={CalendarDays}
          href="/admin/events"
        />
        <Metric
          label="Categories"
          value={categories?.length ?? 0}
          icon={Tag}
          href="/admin/categories"
        />
        <Metric
          label="Tickets sold"
          value={ticketsSold}
          icon={ShieldCheck}
          href="/admin/reports"
        />
        <Metric
          label="Revenue"
          value={`₩ ${revenue.toLocaleString()}`}
          icon={ShoppingBag}
          href="/admin/orders"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-lg border border-border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-[var(--sunmoon-navy)]">
                Recent orders
              </h2>
              <p className="text-xs text-foreground/60">
                Latest buyer activity
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="bg-white">
              <Link href="/admin/orders">View all</Link>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wider text-foreground/60">
                <tr>
                  <th className="px-4 py-3 text-left">Buyer</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.map(order => (
                  <tr key={order.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.buyerName}</div>
                      <div className="text-xs text-foreground/60">
                        {order.buyerEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {order.event?.title ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ₩ {order.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          STATUS_STYLE[order.status] ?? "bg-secondary"
                        )}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-foreground/50"
                    >
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="font-serif text-lg font-bold text-[var(--sunmoon-navy)]">
            Quick actions
          </h2>
          <div className="mt-4 space-y-2">
            <Button
              asChild
              className="w-full justify-start bg-[var(--sunmoon-navy)]"
            >
              <Link href="/admin/events">
                <CalendarDays className="h-4 w-4" /> Manage events
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start bg-white"
            >
              <Link href="/admin/categories">
                <Tag className="h-4 w-4" /> Manage categories
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start bg-white"
            >
              <Link href="/scanner">
                <ShieldCheck className="h-4 w-4" /> Open scanner
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: typeof CalendarDays;
  href: string;
}) {
  return (
    <Link href={href}>
      <article className="rounded-lg border border-border bg-white p-5 hover:border-[var(--sunmoon-navy)]/40 transition">
        <div className="flex items-center justify-between gap-3">
          <div className="h-10 w-10 rounded-md bg-[var(--sunmoon-navy)] text-white flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-xs uppercase tracking-wider text-foreground/50">
            Open
          </span>
        </div>
        <div className="mt-5 text-xs uppercase tracking-wider text-foreground/60">
          {label}
        </div>
        <div className="mt-1 font-serif text-3xl font-bold text-[var(--sunmoon-navy)]">
          {value}
        </div>
      </article>
    </Link>
  );
}
