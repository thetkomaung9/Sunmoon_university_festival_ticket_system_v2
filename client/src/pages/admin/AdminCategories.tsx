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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminCategories() {
  const utils = trpc.useUtils();
  const { data: categories } = trpc.catalog.adminListCategories.useQuery();
  const create = trpc.catalog.adminCreateCategory.useMutation({
    onSuccess: () => {
      utils.catalog.adminListCategories.invalidate();
      utils.catalog.listCategories.invalidate();
    },
  });
  const update = trpc.catalog.adminUpdateCategory.useMutation({
    onSuccess: () => {
      utils.catalog.adminListCategories.invalidate();
      utils.catalog.listCategories.invalidate();
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nameEn: "",
    nameMm: "",
    slug: "",
    description: "",
    posterUrl: "",
    sortOrder: 0,
  });

  async function handleCreate() {
    if (!form.nameEn || !form.nameMm || !form.slug) {
      toast.error("Name and slug are required");
      return;
    }
    try {
      await create.mutateAsync({
        nameEn: form.nameEn,
        nameMm: form.nameMm,
        slug: form.slug,
        description: form.description || undefined,
        posterUrl: form.posterUrl || undefined,
        sortOrder: form.sortOrder,
      });
      toast.success("Category created");
      setOpen(false);
      setForm({ nameEn: "", nameMm: "", slug: "", description: "", posterUrl: "", sortOrder: 0 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function toggleStatus(id: number, current: "ACTIVE" | "HIDDEN") {
    try {
      await update.mutateAsync({ id, status: current === "ACTIVE" ? "HIDDEN" : "ACTIVE" });
      toast.success("Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminLayout title="Categories" subtitle="Festival categories displayed on the public site">
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]">
              <Plus className="h-4 w-4" /> New Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>English Name</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="Cultural Night"
                />
              </div>
              <div>
                <Label>Myanmar Name (မြန်မာ)</Label>
                <Input
                  value={form.nameMm}
                  onChange={(e) => setForm({ ...form, nameMm: e.target.value })}
                  placeholder="ယဉ်ကျေးမှု ည"
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  placeholder="cultural-night"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>Poster URL</Label>
                <Input
                  value={form.posterUrl}
                  onChange={(e) => setForm({ ...form, posterUrl: e.target.value })}
                  placeholder="/manus-storage/..."
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
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
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-center">Sort</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(categories ?? []).map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold">{c.nameEn}</div>
                  <div className="text-xs font-mm text-foreground/60">{c.nameMm}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground/70">{c.slug}</td>
                <td className="px-4 py-3 text-center">{c.sortOrder}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      c.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-secondary text-foreground/60"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white"
                    onClick={() => toggleStatus(c.id, c.status)}
                  >
                    {c.status === "ACTIVE" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {c.status === "ACTIVE" ? "Hide" : "Show"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
