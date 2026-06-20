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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Settings } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const TT_NAMES = ["Regular", "VIP", "Early Bird", "Student"] as const;

function fmtDate(ms: number) {
  const date = new Date(ms);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toMs(value: string) {
  return new Date(value).getTime();
}

export default function AdminEvents() {
  const utils = trpc.useUtils();
  const { data: events } = trpc.catalog.adminListEvents.useQuery();
  const { data: categories } = trpc.catalog.adminListCategories.useQuery();
  const createEvt = trpc.catalog.adminCreateEvent.useMutation({
    onSuccess: () => utils.catalog.adminListEvents.invalidate(),
  });
  const updateEvt = trpc.catalog.adminUpdateEvent.useMutation({
    onSuccess: () => utils.catalog.adminListEvents.invalidate(),
  });

  const [open, setOpen] = useState(false);
  const [scheduleOpenFor, setScheduleOpenFor] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    startsAt: "",
    endsAt: "",
    saleStartsAt: "",
    saleEndsAt: "",
  });
  const [form, setForm] = useState({
    categoryId: "",
    slug: "",
    title: "",
    titleMm: "",
    description: "",
    venue: "",
    posterUrl: "",
    startsAt: fmtDate(Date.now() + 7 * 86400000),
    endsAt: fmtDate(Date.now() + 7 * 86400000 + 3 * 3600000),
    saleStartsAt: fmtDate(Date.now()),
    saleEndsAt: fmtDate(Date.now() + 7 * 86400000 - 3600000),
  });

  async function handleCreate() {
    try {
      await createEvt.mutateAsync({
        categoryId: Number(form.categoryId),
        slug: form.slug,
        title: form.title,
        titleMm: form.titleMm || undefined,
        description: form.description || undefined,
        venue: form.venue,
        posterUrl: form.posterUrl || undefined,
        startsAt: toMs(form.startsAt),
        endsAt: toMs(form.endsAt),
        saleStartsAt: toMs(form.saleStartsAt),
        saleEndsAt: toMs(form.saleEndsAt),
        status: "PUBLISHED",
      });
      toast.success("Event created");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function setStatus(id: number, status: "PUBLISHED" | "DRAFT" | "CLOSED" | "CANCELLED") {
    try {
      await updateEvt.mutateAsync({ id, status });
      toast.success("Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  function openScheduleEditor(event: {
    id: number;
    startsAt: number;
    endsAt: number;
    saleStartsAt: number;
    saleEndsAt: number;
  }) {
    setScheduleOpenFor(event.id);
    setScheduleForm({
      startsAt: fmtDate(event.startsAt),
      endsAt: fmtDate(event.endsAt),
      saleStartsAt: fmtDate(event.saleStartsAt),
      saleEndsAt: fmtDate(event.saleEndsAt),
    });
  }

  async function saveSchedule() {
    if (!scheduleOpenFor) return;
    try {
      await updateEvt.mutateAsync({
        id: scheduleOpenFor,
        startsAt: toMs(scheduleForm.startsAt),
        endsAt: toMs(scheduleForm.endsAt),
        saleStartsAt: toMs(scheduleForm.saleStartsAt),
        saleEndsAt: toMs(scheduleForm.saleEndsAt),
      });
      toast.success("Schedule updated");
      setScheduleOpenFor(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminLayout title="Events" subtitle="Create and manage all SMU Myanmar Team events">
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]">
              <Plus className="h-4 w-4" /> New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  />
                </div>
              </div>
              <div>
                <Label>Title (English)</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Title (မြန်မာ)</Label>
                <Input value={form.titleMm} onChange={(e) => setForm({ ...form, titleMm: e.target.value })} />
              </div>
              <div>
                <Label>Venue</Label>
                <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div>
                <Label>Poster URL</Label>
                <Input value={form.posterUrl} onChange={(e) => setForm({ ...form, posterUrl: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Starts at</Label>
                  <Input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Ends at</Label>
                  <Input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Sale starts</Label>
                  <Input
                    type="datetime-local"
                    value={form.saleStartsAt}
                    onChange={(e) => setForm({ ...form, saleStartsAt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Sale ends</Label>
                  <Input
                    type="datetime-local"
                    value={form.saleEndsAt}
                    onChange={(e) => setForm({ ...form, saleEndsAt: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="bg-white" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createEvt.isPending} className="bg-[var(--sunmoon-navy)]">
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
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(events ?? []).map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold line-clamp-1">{e.title}</div>
                  <div className="text-xs text-foreground/60 line-clamp-1">{e.venue}</div>
                </td>
                <td className="px-4 py-3 text-xs text-foreground/70">{e.category?.nameEn ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {new Date(e.startsAt).toLocaleDateString()} ·{" "}
                  {new Date(e.startsAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3 text-center">
                  <Select value={e.status} onValueChange={(v) => setStatus(e.id, v as never)}>
                    <SelectTrigger className="h-8 text-xs bg-white w-32 mx-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">DRAFT</SelectItem>
                      <SelectItem value="PUBLISHED">PUBLISHED</SelectItem>
                      <SelectItem value="CLOSED">CLOSED</SelectItem>
                      <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  <Dialog
                    open={scheduleOpenFor === e.id}
                    onOpenChange={(next) => {
                      if (next) openScheduleEditor(e);
                      else setScheduleOpenFor(null);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white"
                        onClick={() => openScheduleEditor(e)}
                      >
                        Schedule
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Edit Schedule</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Starts at</Label>
                          <Input
                            type="datetime-local"
                            value={scheduleForm.startsAt}
                            onChange={(event) =>
                              setScheduleForm({
                                ...scheduleForm,
                                startsAt: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Ends at</Label>
                          <Input
                            type="datetime-local"
                            value={scheduleForm.endsAt}
                            onChange={(event) =>
                              setScheduleForm({
                                ...scheduleForm,
                                endsAt: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Sale starts</Label>
                          <Input
                            type="datetime-local"
                            value={scheduleForm.saleStartsAt}
                            onChange={(event) =>
                              setScheduleForm({
                                ...scheduleForm,
                                saleStartsAt: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Sale ends</Label>
                          <Input
                            type="datetime-local"
                            value={scheduleForm.saleEndsAt}
                            onChange={(event) =>
                              setScheduleForm({
                                ...scheduleForm,
                                saleEndsAt: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          className="bg-white"
                          onClick={() => setScheduleOpenFor(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={saveSchedule}
                          disabled={updateEvt.isPending}
                          className="bg-[var(--sunmoon-navy)]"
                        >
                          Save
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button asChild variant="outline" size="sm" className="bg-white">
                    <Link href={`/admin/events/${e.id}`}>
                      <Settings className="h-3.5 w-3.5" />
                      Tickets
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="bg-white">
                    <a href={`/events/${e.slug}`} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] text-foreground/50">
        Available ticket type names: <strong>{TT_NAMES.join(", ")}</strong>
      </div>
    </AdminLayout>
  );
}
