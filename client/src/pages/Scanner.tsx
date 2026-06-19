import { useAuth } from "@/_core/hooks/useAuth";
import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clipboard,
  Loader2,
  Lock,
  ScanLine,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type ScanResult =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "verified";
      status: "VALID" | "USED" | "CANCELLED" | "EXPIRED";
      buyer?: string;
      eventTitle?: string;
      ticketCode?: string;
      ticketType?: string;
      usedAt?: Date | null;
    }
  | { kind: "invalid"; message: string }
  | {
      kind: "checked_in";
      buyer?: string;
      eventTitle?: string;
      ticketCode?: string;
      ticketType?: string;
      checkedInAt?: Date | string;
    }
  | { kind: "rejected"; reason: string; ticketCode?: string };

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorLike;

export default function ScannerPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [token, setToken] = useState("");
  const [result, setResult] = useState<ScanResult>({ kind: "idle" });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanLockedRef = useRef(false);

  const verify = trpc.tickets.scannerVerify.useMutation();
  const checkIn = trpc.tickets.scannerCheckIn.useMutation();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  if (loading) {
    return (
      <SiteLayout>
        <div className="container py-20 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--sunmoon-navy)]" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <SiteLayout>
        <div className="container py-20 max-w-md">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Lock className="h-10 w-10 mx-auto text-[var(--sunmoon-navy)]" />
            <h1 className="mt-4 font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
              Staff sign-in required
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              The scanner page is restricted to staff and admin accounts.
            </p>
            <Button
              asChild
              className="mt-5 w-full bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]"
            >
              <Link href="/signin">Sign in</Link>
            </Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (user?.role !== "staff" && user?.role !== "admin") {
    return (
      <SiteLayout>
        <div className="container py-20 max-w-md">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto text-amber-600" />
            <h1 className="mt-4 font-serif text-2xl font-bold text-[var(--sunmoon-navy)]">
              Access denied
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Your account ({user?.email ?? "—"}) is signed in but does not have
              staff permissions. Please contact an admin to upgrade your role.
            </p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  async function handleVerify() {
    if (!token.trim()) return;
    setResult({ kind: "loading" });
    try {
      const r = await verify.mutateAsync({ qrToken: token.trim() });
      if (!r.valid || !r.status) {
        setResult({
          kind: "invalid",
          message: "Invalid or unrecognized QR token.",
        });
        return;
      }
      setResult({
        kind: "verified",
        status: r.status,
        buyer: r.buyer?.name,
        eventTitle: r.event?.title,
        ticketCode: r.ticket?.code,
        ticketType: r.ticketType?.name,
        usedAt: r.ticket?.usedAt ?? null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    }
  }

  async function handleCheckIn(scannedToken = token.trim()) {
    if (!scannedToken.trim()) return;
    setResult({ kind: "loading" });
    try {
      const r = await checkIn.mutateAsync({
        qrToken: scannedToken.trim(),
        deviceInfo: navigator.userAgent,
      });
      if (r.status === "SUCCESS") {
        setResult({
          kind: "checked_in",
          buyer: r.buyer?.name,
          eventTitle: r.event?.title,
          ticketCode: r.ticket?.code,
          ticketType: r.ticketType?.name,
          checkedInAt: r.checkedInAt,
        });
        toast.success("Ticket marked as USED.");
      } else {
        setResult({ kind: "rejected", reason: r.status });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    }
  }

  function stopCamera() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    scanLockedRef.current = false;
    setCameraActive(false);
  }

  async function decodeVideoFrame(detector: BarcodeDetectorLike | null) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return "";
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return "";

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";
    ctx.drawImage(video, 0, 0, width, height);

    if (detector) {
      const codes = await detector.detect(canvas).catch(() => []);
      return codes[0]?.rawValue ?? "";
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, width, height);
    return code?.data ?? "";
  }

  async function startCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      const BarcodeDetectorCtor = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
      ).BarcodeDetector;
      const detector = BarcodeDetectorCtor
        ? new BarcodeDetectorCtor({ formats: ["qr_code"] })
        : null;

      const scanFrame = async () => {
        if (!streamRef.current) return;
        if (!scanLockedRef.current) {
          const scanned = await decodeVideoFrame(detector);
          if (scanned) {
            scanLockedRef.current = true;
            setToken(scanned);
            stopCamera();
            await handleCheckIn(scanned);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      };
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (error) {
      setCameraError(
        error instanceof Error ? error.message : "Could not open camera."
      );
      stopCamera();
    }
  }

  function handlePaste() {
    navigator.clipboard
      .readText()
      .then(t => setToken(t))
      .catch(() => {});
  }

  function reset() {
    setToken("");
    setResult({ kind: "idle" });
    inputRef.current?.focus();
  }

  return (
    <SiteLayout>
      <div className="container py-10 max-w-xl">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sunmoon-blue)] inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Staff Scanner
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold text-[var(--sunmoon-navy)]">
          Scan tickets at the gate
        </h1>
        <p className="font-mm text-sm text-foreground/60 mt-1">
          ပွဲဝင်ရာ၌ စကင်စစ်ဆေး
        </p>

        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-5 rounded-md overflow-hidden bg-secondary">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                "w-full aspect-video object-cover bg-black",
                !cameraActive && "hidden"
              )}
            />
            {!cameraActive && (
              <div className="aspect-video flex items-center justify-center text-center px-6 text-sm text-foreground/60">
                Camera scanner is ready. Start camera to scan a QR ticket.
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={startCamera}
              disabled={cameraActive || verify.isPending || checkIn.isPending}
              className="bg-white h-11"
            >
              <Camera className="h-4 w-4" /> Start camera
            </Button>
            <Button
              variant="outline"
              onClick={stopCamera}
              disabled={!cameraActive}
              className="bg-white h-11"
            >
              <CameraOff className="h-4 w-4" /> Stop
            </Button>
          </div>
          {cameraError && (
            <div className="mb-5 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-900">
              {cameraError}
            </div>
          )}

          <label className="text-xs uppercase tracking-wider text-foreground/60">
            Paste or scan QR token
          </label>
          <div className="mt-2 flex gap-2">
            <input
              ref={inputRef}
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleVerify();
              }}
              placeholder="eyJ0aWQiOjEsImNvZGUi…"
              className="flex-1 rounded-md border border-border bg-white px-3 py-2.5 font-mono text-xs focus:border-[var(--sunmoon-navy)] focus:outline-none"
              autoComplete="off"
              autoFocus
            />
            <Button
              variant="outline"
              onClick={handlePaste}
              className="bg-white"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={!token.trim() || verify.isPending || checkIn.isPending}
              className="bg-white h-11"
            >
              {verify.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
              Verify
            </Button>
            <Button
              onClick={handleCheckIn}
              disabled={!token.trim() || verify.isPending || checkIn.isPending}
              className="h-11 bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]"
            >
              {checkIn.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Check-in
            </Button>
          </div>
        </div>

        {/* Result panel */}
        <ResultCard result={result} onReset={reset} />

        <p className="mt-8 text-xs text-foreground/50 leading-relaxed">
          Tip: keyboard or hardware QR scanners that emit the token followed by
          Enter will automatically run <strong>Verify</strong>. Use{" "}
          <strong>Check-in</strong> only when the guest is at the gate — it
          marks the ticket as <strong>USED</strong> and writes a scan log entry.
        </p>
      </div>
    </SiteLayout>
  );
}

function ResultCard({
  result,
  onReset,
}: {
  result: ScanResult;
  onReset: () => void;
}) {
  if (result.kind === "idle") return null;
  if (result.kind === "loading") {
    return (
      <div className="mt-5 rounded-lg border border-border bg-card p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--sunmoon-navy)]" />
      </div>
    );
  }
  if (result.kind === "invalid") {
    return (
      <ResultShell
        tone="error"
        icon={XCircle}
        title="Invalid token"
        subtitle="မမှန်ကန်"
        onReset={onReset}
      >
        <p className="text-sm text-rose-900">{result.message}</p>
      </ResultShell>
    );
  }
  if (result.kind === "rejected") {
    const map: Record<
      string,
      { title: string; mm: string; tone: "error" | "warning" }
    > = {
      ALREADY_USED: { title: "Already used", mm: "သုံးပြီး", tone: "warning" },
      CANCELLED: {
        title: "Cancelled ticket",
        mm: "ပယ်ဖျက်ပြီး",
        tone: "error",
      },
      EXPIRED: { title: "Expired ticket", mm: "သက်တမ်းကုန်", tone: "warning" },
      INVALID: { title: "Invalid", mm: "မမှန်ကန်", tone: "error" },
    };
    const info = map[result.reason] ?? map.INVALID;
    return (
      <ResultShell
        tone={info.tone}
        icon={info.tone === "error" ? XCircle : AlertTriangle}
        title={info.title}
        subtitle={info.mm}
        onReset={onReset}
      >
        <p className="text-sm">
          Do not let this guest enter without further verification.
        </p>
      </ResultShell>
    );
  }
  if (result.kind === "checked_in") {
    return (
      <ResultShell
        tone="success"
        icon={CheckCircle2}
        title="Welcome!"
        subtitle="ကြိုဆိုပါသည်"
        onReset={onReset}
      >
        <Detail label="Buyer" value={result.buyer ?? "—"} />
        <Detail label="Event" value={result.eventTitle ?? "—"} />
        <Detail label="Type" value={result.ticketType ?? "—"} />
        <Detail label="Code" value={result.ticketCode ?? "—"} mono />
      </ResultShell>
    );
  }
  // verified
  const tone =
    result.status === "VALID"
      ? "success"
      : result.status === "USED"
        ? "warning"
        : "error";
  const icon =
    result.status === "VALID"
      ? ShieldCheck
      : result.status === "USED"
        ? CheckCircle2
        : XCircle;
  return (
    <ResultShell
      tone={tone}
      icon={icon}
      title={`Status: ${result.status}`}
      subtitle="အခြေအနေ"
      onReset={onReset}
    >
      <Detail label="Buyer" value={result.buyer ?? "—"} />
      <Detail label="Event" value={result.eventTitle ?? "—"} />
      <Detail label="Type" value={result.ticketType ?? "—"} />
      <Detail label="Code" value={result.ticketCode ?? "—"} mono />
      {result.usedAt && (
        <Detail
          label="Used at"
          value={new Date(result.usedAt).toLocaleString()}
        />
      )}
      {result.status === "VALID" && (
        <p className="mt-2 text-xs text-emerald-900">
          Ticket is valid. Press <strong>Check-in</strong> to mark it USED.
        </p>
      )}
    </ResultShell>
  );
}

function ResultShell({
  tone,
  icon: Icon,
  title,
  subtitle,
  onReset,
  children,
}: {
  tone: "success" | "warning" | "error";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-5 rounded-lg border-2 p-5",
        tone === "success" && "border-emerald-300 bg-emerald-50",
        tone === "warning" && "border-amber-300 bg-amber-50",
        tone === "error" && "border-rose-300 bg-rose-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0",
            tone === "success" && "bg-emerald-600",
            tone === "warning" && "bg-amber-600",
            tone === "error" && "bg-rose-600"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-serif text-xl font-bold">{title}</div>
          <div className="font-mm text-xs text-foreground/60">{subtitle}</div>
          <div className="mt-3 space-y-1.5">{children}</div>
        </div>
      </div>
      <button
        onClick={onReset}
        className="mt-4 w-full text-xs font-semibold text-[var(--sunmoon-navy)] hover:underline"
      >
        Scan another →
      </button>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs uppercase tracking-wider text-foreground/50">
        {label}
      </span>
      <span
        className={cn("font-medium text-right", mono && "font-mono text-xs")}
      >
        {value}
      </span>
    </div>
  );
}
