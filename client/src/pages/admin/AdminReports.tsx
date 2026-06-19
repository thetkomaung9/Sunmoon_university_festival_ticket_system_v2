import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Download, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const RESULT_STYLE: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-700",
  ALREADY_USED: "bg-amber-100 text-amber-700",
  INVALID: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  EXPIRED: "bg-secondary text-foreground/60",
};

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  const { data: events } = trpc.catalog.adminListEvents.useQuery();
  const [eventId, setEventId] = useState<number | null>(null);

  useEffect(() => {
    if (events && events.length > 0 && eventId == null) setEventId(events[0].id);
  }, [events, eventId]);

  const { data: report } = trpc.tickets.adminAttendanceReport.useQuery(
    { eventId: eventId ?? 0 },
    { enabled: !!eventId, refetchInterval: 5000 }
  );

  function exportTickets() {
    if (!report) return;
    const rows: (string | number)[][] = [
      ["Ticket Code", "Status", "Issued At", "Used At"],
      ...report.tickets.map((t) => [
        t.ticketCode,
        t.status,
        new Date(t.issuedAt).toISOString(),
        t.usedAt ? new Date(t.usedAt).toISOString() : "",
      ]),
    ];
    downloadCsv(`attendance-${report.event?.slug ?? eventId}.csv`, rows);
  }

  return (
    <AdminLayout title="Attendance" subtitle="Real-time check-in tracking and CSV export">
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <Select
          value={eventId ? String(eventId) : ""}
          onValueChange={(v) => setEventId(Number(v))}
        >
          <SelectTrigger className="w-72 bg-white">
            <SelectValue placeholder="Select event" />
          </SelectTrigger>
          <SelectContent>
            {(events ?? []).map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportTickets} disabled={!report} className="bg-white">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {report ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Total tickets" value={report.summary.total} />
            <Stat label="Checked in" value={report.summary.used} accent />
            <Stat label="Remaining tickets" value={report.summary.remaining} />
            <Stat
              label="Attendance percentage"
              value={`${(report.summary.attendanceRate * 100).toFixed(1)}%`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-lg border border-border bg-white">
              <h2 className="px-5 py-4 font-serif text-lg font-bold text-[var(--sunmoon-navy)] border-b border-border">
                Tickets ({report.tickets.length})
              </h2>
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-xs uppercase tracking-wider text-foreground/60 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Code</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                      <th className="px-4 py-2.5 text-right">Used at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.tickets.map((t) => (
                      <tr key={t.id}>
                        <td className="px-4 py-2 font-mono text-xs">{t.ticketCode}</td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              t.status === "VALID"
                                ? "bg-emerald-100 text-emerald-700"
                                : t.status === "USED"
                                ? "bg-slate-200 text-slate-700"
                                : "bg-rose-100 text-rose-700"
                            )}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-foreground/60">
                          {t.usedAt ? new Date(t.usedAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-white">
              <h2 className="px-5 py-4 font-serif text-lg font-bold text-[var(--sunmoon-navy)] border-b border-border flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--sunmoon-blue)]" />
                Recent Scans ({report.scanLogs.length})
              </h2>
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-xs uppercase tracking-wider text-foreground/60 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Time</th>
                      <th className="px-4 py-2.5 text-left">Ticket</th>
                      <th className="px-4 py-2.5 text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.scanLogs.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-2 text-xs text-foreground/70">
                          {new Date(s.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{s.ticketCode ?? "—"}</td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              RESULT_STYLE[s.result]
                            )}
                          >
                            {s.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {report.scanLogs.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-foreground/50 text-sm">
                          No scans recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="text-center text-foreground/50 py-20">Loading…</div>
      )}
    </AdminLayout>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-5",
        accent ? "border-[var(--sunmoon-navy)] bg-[var(--sunmoon-navy)] text-white" : "border-border bg-white"
      )}
    >
      <div
        className={cn(
          "text-xs uppercase tracking-wider",
          accent ? "text-white/70" : "text-foreground/60"
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-serif text-3xl font-bold",
          accent ? "text-[var(--sunmoon-gold)]" : "text-[var(--sunmoon-navy)]"
        )}
      >
        {value}
      </div>
    </div>
  );
}
