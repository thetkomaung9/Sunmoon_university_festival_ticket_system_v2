import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";

export default function AdminEventDetail() {
  const [, params] = useRoute<{ id: string }>("/admin/events/:id");
  const eventId = Number(params?.id);

  const utils = trpc.useUtils();
  const { data: events } = trpc.catalog.adminListEvents.useQuery();
  const { data: tts } = trpc.catalog.adminListTicketTypes.useQuery({ eventId }, { enabled: !!eventId });
  const create = trpc.catalog.adminCreateTicketType.useMutation({
    onSuccess: () => utils.catalog.adminListTicketTypes.invalidate({ eventId }),
  });
  const update = trpc.catalog.adminUpdateTicketType.useMutation({
    onSuccess: () => utils.catalog.adminListTicketTypes.invalidate({ eventId }),
  });

  const event = events?.find((e) => e.id === eventId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    name: "Regular" | "VIP" | "Early Bird" | "Student";
    price: number;
    stock: number;
    maxPerUser: number;
  }>({ name: "Regular", price: 10000, stock: 100, maxPerUser: 4 });

  async function handleCreate() {
    try {
      await create.mutateAsync({ eventId, ...form });
      toast.success("Ticket type added");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function updateStock(id: number, stock: number) {
    try {
      await update.mutateAsync({ id, stock });
      toast.success("Stock updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminLayout
      title={event ? event.title : "Event"}
      subtitle={event ? `Manage ticket types for ${event.title}` : ""}
    >
      <Button asChild variant="outline" size="sm" className="bg-white mb-4">
        <Link href="/admin/events">
          <ArrowLeft className="h-3.5 w-3.5" /> All events
        </Link>
      </Button>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl font-bold text-[var(--sunmoon-navy)]">Ticket Types</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]">
              <Plus className="h-4 w-4" /> New Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Ticket Type</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Select
                  value={form.name}
                  onValueChange={(v) => setForm({ ...form, name: v as typeof form.name })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="Early Bird">Early Bird</SelectItem>
                    <SelectItem value="Student">Student</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (KRW)</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Stock</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Max per order</Label>
                <Input
                  type="number"
                  value={form.maxPerUser}
                  onChange={(e) => setForm({ ...form, maxPerUser: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="bg-white" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={create.isPending} className="bg-[var(--sunmoon-navy)]">
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-foreground/60">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Sold</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(tts ?? []).map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-semibold">{t.name}</td>
                <td className="px-4 py-3 text-right">₩ {t.price.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{t.soldCount}</td>
                <td className="px-4 py-3 text-right">
                  <Input
                    type="number"
                    defaultValue={t.stock}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== t.stock) updateStock(t.id, v);
                    }}
                    className="h-8 w-24 ml-auto text-right"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      t.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : t.status === "SOLD_OUT"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-secondary text-foreground/60"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
            {(tts ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-foreground/50 py-8">
                  No ticket types defined. Add one to start selling.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
