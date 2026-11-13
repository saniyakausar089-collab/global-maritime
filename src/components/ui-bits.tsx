import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { STATUS_LABEL, STATUS_VAR, statusOf } from "@/lib/api";
import { useLiveTime, formatUtcClock, formatTimeAgo } from "@/lib/time";

export function LiveClock({
  className = "",
  showLocal = true,
}: {
  className?: string;
  showLocal?: boolean;
}) {
  const now = useLiveTime();

  if (!now) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/40 px-3 py-1 font-mono text-xs text-sidebar-foreground/80 ${className}`}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
        <span className="font-semibold text-emerald-500">LIVE</span>
        <span className="text-muted-foreground">--:--:-- UTC</span>
      </div>
    );
  }

  const utcStr = formatUtcClock(now);
  const localStr = now.toLocaleTimeString();

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/60 px-3 py-1 font-mono text-xs text-sidebar-foreground shadow-xs ${className}`}
      title="Live real-time clock (updates every second automatically, no refresh needed)"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-semibold text-emerald-500">LIVE</span>
      <span className="text-sidebar-border">|</span>
      <span className="font-medium">{utcStr}</span>
      {showLocal && (
        <span className="hidden sm:inline text-sidebar-foreground/60 text-[11px]">
          ({localStr} Local)
        </span>
      )}
    </div>
  );
}

export function StatusBadge({ ci, showIndex = true }: { ci: number | null; showIndex?: boolean }) {
  const s = statusOf(ci);
  const colorMap: Record<string, string> = {
    ok: "#00ffc6",
    watch: "#ffaa00",
    congested: "#ff3b5c",
    unknown: "#94a3b8",
  };
  const color = colorMap[s] || STATUS_VAR[s];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-mono font-semibold backdrop-blur-md"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}15`,
        color: color,
        boxShadow: `0 0 10px ${color}20`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {showIndex && ci != null && <span className="font-mono">{ci.toFixed(2)}</span>}
      {STATUS_LABEL[s]}
    </span>
  );
}

export function FallbackBanner({ reason, error }: { reason?: string | undefined; error?: string | undefined }) {
  const msg = reason || error;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs font-mono text-amber-300 shadow-lg backdrop-blur-xl">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
      <div>
        <p className="font-bold text-white tracking-wider">OFFLINE FALLBACK TELEMETRY ENGAGED</p>
        <p className="text-amber-200/80 text-[11px] mt-0.5">
          Connecting to live AIS stream ({msg || "Syncing with relay..."}). Displaying cached tactical baseline.
        </p>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export function Empty({ text = "Not enough data yet" }: { text?: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function RefreshControl({ updatedAt }: { updatedAt?: number | undefined }) {
  const qc = useQueryClient();
  const fetching = useIsFetching() > 0;
  const now = useLiveTime();

  const liveUtc = formatUtcClock(now);
  const liveLocal = now ? now.toLocaleTimeString() : "--:--:--";
  const timeAgo = formatTimeAgo(updatedAt, now);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
      {/* Live ticking clock */}
      <div
        className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-foreground"
        title="Live ticking time (running continuously in real time, no refresh needed)"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400">LIVE</span>
        <span className="font-medium text-foreground">{liveUtc}</span>
        <span className="hidden lg:inline text-muted-foreground text-[10px]">({liveLocal})</span>
      </div>

      <span className="hidden sm:inline text-muted-foreground/60">·</span>

      {/* Real-time sync tracker */}
      <span title="Data freshness (auto-synchronizes in background)">
        Synced <span className="font-medium text-foreground">{timeAgo}</span> · auto every 60s
      </span>

      {/* Manual refresh / sync trigger */}
      <button
        onClick={() => qc.invalidateQueries()}
        title="Trigger immediate data synchronization"
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 font-medium text-foreground hover:bg-secondary transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin text-primary" : ""}`} />{" "}
        Refresh
      </button>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 text-card-foreground shadow-sm ${className}`}>
      {children}
    </div>
  );
}
