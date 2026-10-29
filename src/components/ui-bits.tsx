import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { STATUS_LABEL, STATUS_VAR, statusOf } from "@/lib/api";

export function StatusBadge({ ci, showIndex = true }: { ci: number | null; showIndex?: boolean }) {
  const s = statusOf(ci);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ borderColor: STATUS_VAR[s], color: STATUS_VAR[s] }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_VAR[s] }} />
      {showIndex && ci != null && <span className="font-mono">{ci.toFixed(2)}</span>}
      {STATUS_LABEL[s]}
    </span>
  );
}

export function FallbackBanner({ error }: { error?: string | undefined }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div>
        <p className="font-medium text-destructive">API unreachable — showing DEMO fallback data</p>
        <p className="text-muted-foreground">
          Could not reach the backend ({error ?? "unknown error"}). Figures below are illustrative, not real.
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
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>Last updated: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—"} · auto every 60s</span>
      <button
        onClick={() => qc.invalidateQueries()}
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 font-medium text-foreground hover:bg-secondary"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} /> Refresh
      </button>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card p-4 text-card-foreground shadow-sm ${className}`}>{children}</div>;
}
