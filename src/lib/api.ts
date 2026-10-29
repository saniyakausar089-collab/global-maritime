import { queryOptions } from "@tanstack/react-query";

/** Single place to configure the FastAPI backend. */
export const API_BASE_URL = "https://YOUR-API-URL";
export const REFRESH_MS = 60_000;

export type Port = { id: string; name: string; lat: number; lon: number; congestion_index: number | null };
export type Vessel = { mmsi: number; ship_name: string; lat: number; lon: number; sog: number; stationary: boolean };
export type HistoryPoint = { hour: string; stationary: number };

export type Sourced<T> = { data: T; source: "live" | "fallback"; error?: string; fetchedAt: number };

async function getJson<T>(path: string, fallback: () => T): Promise<Sourced<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { data: (await res.json()) as T, source: "live", fetchedAt: Date.now() };
  } catch (e) {
    return {
      data: fallback(),
      source: "fallback",
      error: e instanceof Error ? e.message : "Network error",
      fetchedAt: Date.now(),
    };
  }
}

// ---- Clearly labelled FALLBACK demo data (only used when the API is unreachable) ----
const FALLBACK_PORTS: Port[] = [
  { id: "rotterdam", name: "Rotterdam", lat: 51.92, lon: 4.17, congestion_index: 1.4 },
  { id: "singapore", name: "Singapore", lat: 1.26, lon: 103.84, congestion_index: 1.05 },
  { id: "shanghai", name: "Shanghai", lat: 31.23, lon: 121.8, congestion_index: 1.31 },
  { id: "los-angeles", name: "Los Angeles", lat: 33.73, lon: -118.26, congestion_index: 0.72 },
  { id: "hamburg", name: "Hamburg", lat: 53.54, lon: 9.97, congestion_index: 0.94 },
  { id: "santos", name: "Santos", lat: -23.98, lon: -46.3, congestion_index: null },
];
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}
function hash(id: string) {
  return [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
}
function fallbackVessels(id: string): Vessel[] {
  const p = FALLBACK_PORTS.find((x) => x.id === id) ?? FALLBACK_PORTS[0];
  const r = seeded(hash(id));
  return Array.from({ length: 24 }, (_, i) => {
    const stationary = r() > 0.45;
    return {
      mmsi: 200000000 + Math.floor(r() * 99999999),
      ship_name: `DEMO VESSEL ${i + 1}`,
      lat: p.lat + (r() - 0.5) * 0.25,
      lon: p.lon + (r() - 0.5) * 0.35,
      sog: stationary ? +(r() * 0.4).toFixed(1) : +(1 + r() * 14).toFixed(1),
      stationary,
    };
  });
}
function fallbackHistory(id: string): HistoryPoint[] {
  const r = seeded(hash(id) + 7);
  const base = 8 + (hash(id) % 10);
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return Array.from({ length: 48 }, (_, i) => {
    const d = new Date(now.getTime() - (47 - i) * 3600_000);
    return {
      hour: d.toISOString().slice(0, 19).replace("T", " "),
      stationary: Math.max(0, Math.round(base + Math.sin(i / 4) * 4 + (r() - 0.5) * 5 + i * 0.08)),
    };
  });
}

export const portsQuery = () =>
  queryOptions({
    queryKey: ["ports"],
    queryFn: () => getJson<Port[]>("/ports", () => FALLBACK_PORTS),
    refetchInterval: REFRESH_MS,
  });
export const vesselsQuery = (id: string) =>
  queryOptions({
    queryKey: ["vessels", id],
    queryFn: () => getJson<Vessel[]>(`/ports/${encodeURIComponent(id)}/vessels`, () => fallbackVessels(id)),
    refetchInterval: REFRESH_MS,
  });
export const historyQuery = (id: string) =>
  queryOptions({
    queryKey: ["history", id],
    queryFn: () => getJson<HistoryPoint[]>(`/ports/${encodeURIComponent(id)}/history`, () => fallbackHistory(id)),
    refetchInterval: REFRESH_MS,
  });

// ---- Helpers ----
export type Status = "normal" | "busy" | "congested" | "unknown";
export function statusOf(ci: number | null | undefined): Status {
  if (ci == null) return "unknown";
  if (ci < 0.8) return "normal";
  if (ci <= 1.2) return "busy";
  return "congested";
}
export const STATUS_LABEL: Record<Status, string> = {
  normal: "Normal",
  busy: "Busy",
  congested: "Congested",
  unknown: "Not enough data",
};
export const STATUS_VAR: Record<Status, string> = {
  normal: "var(--status-ok)",
  busy: "var(--status-busy)",
  congested: "var(--status-hot)",
  unknown: "var(--status-none)",
};

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
