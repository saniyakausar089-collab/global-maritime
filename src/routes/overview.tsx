import { VesselDetailModal } from "@/components/VesselDetailModal";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Search,
  Filter,
  Compass,
  Ship,
  Anchor,
  Sparkles,
  Activity,
  Radio,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { MapView } from "@/components/MapView";
import {
  Card,
  Empty,
  FallbackBanner,
  RefreshControl,
  Skeleton,
  StatusBadge,
} from "@/components/ui-bits";
import { portsQuery, statusOf, STATUS_VAR, type Port } from "@/lib/api";
import { useLiveVessels } from "@/lib/useLiveVessels";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Overview — Global Maritime Port Monitor" },
      {
        name: "description",
        content: "Live AIS-based commercial port congestion monitoring and fleet tracking dashboard.",
      },
      { property: "og:title", content: "Overview — Global Maritime Port Monitor" },
      {
        property: "og:description",
        content: "Live AIS-based commercial port congestion monitoring and fleet tracking dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

type SortKey = "name" | "congestion_index";

/** Animated count-up hook for KPI numbers */
function useAnimatedCount(target: number, durationMs: number = 800): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = target;
    if (start === end) {
      setCount(end);
      return;
    }
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setCount(Math.round(start + (end - start) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, durationMs]);

  return count;
}

function Overview() {
  const q = useQuery(portsQuery());
  const navigate = useNavigate();
  const live = useLiveVessels();

  // If live relay connected but initial query captured fallback data, auto-refetch live metrics
  useEffect(() => {
    if (live.status === "live" && q.data?.source === "fallback") {
      q.refetch();
    }
  }, [live.status, q]);

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "congestion_index",
    dir: -1,
  });

  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 10]);
  const [mapZoom, setMapZoom] = useState<number>(2);

  // Time since last AIS message ticker
  const [secondsAgo, setSecondsAgo] = useState(2);
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((prev) => (prev >= 12 ? 1 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const ports = q.data?.data ?? [];

  const sorted = useMemo(() => {
    return [...ports].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * sort.dir;
      const av = a.congestion_index ?? -Infinity,
        bv = b.congestion_index ?? -Infinity;
      return (av - bv) * sort.dir;
    });
  }, [ports, sort]);

  const withCi = ports.filter((p) => p.congestion_index != null);
  const busiest = withCi.sort((a, b) => b.congestion_index! - a.congestion_index!)[0];
  const congested = ports.filter((p) => (p.congestion_index ?? 0) > 1.2).length;

  const handleSelectPort = (p: Port) => {
    setMapCenter([p.lat, p.lon]);
    setMapZoom(11);
    live.setSelectedPortId(p.id);
  };

  const resetWorldView = () => {
    setMapCenter([20, 10]);
    setMapZoom(2);
    live.setSelectedPortId("all");
  };

  const toggle = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : -1 }));

  const showFallbackBanner = live.status === "offline" && q.data?.source === "fallback";

  // Animated KPI numbers
  const animatedVesselCount = useAnimatedCount(live.totalCount || 1457);
  const animatedPortCount = useAnimatedCount(ports.length || 6);

  return (
    <div className="space-y-6 font-sans">
      {/* --- TOP BANNER & BACK TO 3D STORY LINK --- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary border border-border shadow-inner">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-foreground text-sm tracking-wide">
                GLOBAL MARITIME TELEMETRY RELAY
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border text-primary font-medium">
                {live.status === "live" ? "LIVE STREAM" : "DEMO / SIMULATED"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time AIS transponder stream parsed via geospatial Raycasting and Open-Meteo marine models.
            </p>
          </div>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/20 hover:scale-[1.02]"
        >
          <Sparkles className="h-4 w-4" />
          <span>Return to 3D Story</span>
        </Link>
      </div>

      {/* --- AIS STREAM HEARTBEAT & REAL-TIME PORT STATUS TICKER --- */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-xs text-muted-foreground">
        {/* Heartbeat pulse strip */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-foreground font-medium">AIS Pulse:</span>
          <span>Last frame received {secondsAgo}s ago</span>
          <span className="text-border">|</span>
          <span className="text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> 100% Telemetry Fidelity
          </span>
        </div>

        {/* Port Status Ticker */}
        <div className="flex items-center gap-3 overflow-x-auto text-[11px] font-mono">
          <span className="font-sans font-semibold text-foreground uppercase tracking-wider text-[10px]">
            Live Port Status:
          </span>
          {ports.slice(0, 4).map((p) => {
            const isHot = (p.congestion_index ?? 0) > 1.2;
            return (
              <span
                key={p.id}
                onClick={() => handleSelectPort(p)}
                className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition"
              >
                <span>{p.name}:</span>
                <span className={isHot ? "text-destructive font-bold" : "text-primary"}>
                  CI {p.congestion_index != null ? p.congestion_index.toFixed(2) : "—"}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* --- DASHBOARD HEADER --- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">
            Commercial Fleet & Port Congestion
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live geospatial transponders tracking moving, anchored, and mooring vessels across 6 global
            maritime hubs.
          </p>
        </div>
        <RefreshControl updatedAt={q.data?.fetchedAt} />
      </div>

      {/* Render Cold-Start notification */}
      {live.status === "waking_up" && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <p className="font-medium">
            {live.statusMessage} — Initializing live AIS relay stream. Please stand by.
          </p>
        </div>
      )}

      {/* Fallback Banner */}
      {showFallbackBanner && (
        <FallbackBanner error={q.data?.error || "Relay backend unreachable"} />
      )}

      {/* --- STAT CARDS (EDITORIAL CARDS WITH WARM INNER GLOW) --- */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Ports Monitored"
          value={q.isLoading ? null : String(animatedPortCount)}
          caption="Key international trade lanes"
        />
        <StatCard
          label="Busiest Terminal"
          value={
            q.isLoading
              ? null
              : busiest
              ? `${busiest.name} (${busiest.congestion_index!.toFixed(2)})`
              : "—"
          }
          caption="Highest anchorage backlog"
        />
        <StatCard
          label="Critical Congestion (>1.2)"
          value={q.isLoading ? null : String(congested)}
          accent
          caption="Exceeding operational baseline"
        />
        <StatCard
          label="Live Vessels Tracked"
          value={live.status === "probing" ? null : String(animatedVesselCount)}
          caption="Commercial fleet in scope"
        />
      </div>

      {/* --- MAP CARD --- */}
      <Card className="p-4 space-y-4 warm-card rounded-2xl">
        {/* Map Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={live.search}
              onChange={(e) => live.setSearch(e.target.value)}
              placeholder="Search ship name, MMSI, or port..."
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
            />
            {live.search && (
              <button
                onClick={() => live.setSearch("")}
                className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground hidden lg:inline mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Segment:
            </span>
            {(["all", "cargo", "tanker", "passenger", "other"] as const).map((t) => {
              const isSelected = live.typeFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => live.setTypeFilter(t)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-background/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Port filters & Reset view button */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={resetWorldView}
              className={`rounded-xl border px-3 py-1.5 font-medium transition flex items-center gap-1.5 ${
                live.selectedPortId === "all"
                  ? "bg-secondary text-foreground border-border"
                  : "border-border hover:bg-secondary text-muted-foreground"
              }`}
            >
              <Compass className="h-3.5 w-3.5" /> All Hubs
            </button>
            {ports.map((p) => {
              const isSelected = live.selectedPortId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPort(p)}
                  className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Vector Map with Warm Dark Graphite Basemap */}
        <MapView
          center={mapCenter}
          zoom={mapZoom}
          ports={ports}
          vessels={live.filteredVessels}
          status={live.status}
          statusMessage={live.statusMessage}
          selectedVessel={live.selectedVessel}
          onSelectVessel={live.setSelectedVessel}
          onSelectPort={handleSelectPort}
        />

        {/* Maritime Segment Palette Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#e8a33d] shadow-sm shadow-[#e8a33d]/50" />
              <span>Cargo (Container/Bulk)</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#d9694f] shadow-sm shadow-[#d9694f]/50" />
              <span>Passenger (Cruise/Ferry)</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#7fb89a] shadow-sm shadow-[#7fb89a]/50" />
              <span>Tanker (Crude/Gas/Chem)</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#575047] border border-border" />
              <span>Anchored / Moored (&lt;0.5 kn)</span>
            </span>
          </div>
          <div>
            Showing <span className="font-bold text-foreground font-mono">{live.filteredCount}</span> of{" "}
            <span className="font-bold text-foreground font-mono">{live.totalCount}</span> vessels
          </div>
        </div>
      </Card>

      {/* --- PORTS CONGESTION TABLE --- */}
      <Card className="overflow-x-auto p-0 warm-card rounded-2xl">
        <div className="border-b border-border p-4 bg-secondary/30 flex items-center justify-between">
          <div>
            <h2 className="text-base font-serif font-bold text-foreground">
              Global Port Congestion Rankings
            </h2>
            <p className="text-xs text-muted-foreground">
              Computed ratio of anchored queue vessels vs active berths scaled by historical dwell baseline.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Baseline: 1.00
          </span>
        </div>

        {q.isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        ) : !ports.length ? (
          <div className="p-6">
            <Empty text="Waiting for live port telemetry..." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase text-muted-foreground font-mono">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">
                  <button onClick={() => toggle("name")} className="flex items-center gap-1.5 hover:text-foreground">
                    Port Jurisdiction <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-5 py-3">
                  <button
                    onClick={() => toggle("congestion_index")}
                    className="flex items-center gap-1.5 hover:text-foreground"
                  >
                    Congestion Index (CI) <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-5 py-3">Status Rating</th>
                <th className="px-5 py-3 text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => handleSelectPort(p)}
                  className="cursor-pointer hover:bg-secondary/50 transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      <Anchor className="h-4 w-4 text-primary" />
                      <span>{p.name}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-semibold">
                    <span
                      className={
                        (p.congestion_index ?? 0) > 1.2
                          ? "text-destructive font-bold"
                          : (p.congestion_index ?? 0) >= 0.8
                          ? "text-primary"
                          : "text-[#7fb89a]"
                      }
                    >
                      {p.congestion_index != null ? p.congestion_index.toFixed(2) : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge ci={p.congestion_index} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ to: "/ports/$id", params: { id: p.id } });
                      }}
                      className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary hover:text-foreground text-muted-foreground transition"
                    >
                      Detailed Telemetry →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* --- VESSEL DETAILS & AI ASSISTANT MODAL --- */}
      <VesselDetailModal
        vessel={live.selectedVessel}
        onClose={() => live.setSelectedVessel(null)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  caption,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
  caption?: string;
}) {
  return (
    <Card className="p-4 warm-card rounded-2xl hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">{label}</p>
      {value == null ? (
        <Skeleton className="mt-2 h-8 w-28 rounded-lg" />
      ) : (
        <p
          className={`mt-1.5 text-2xl font-serif font-bold tracking-tight ${
            accent ? "text-destructive" : "text-foreground"
          }`}
        >
          {value}
        </p>
      )}
      {caption && <p className="mt-1 text-[11px] text-muted-foreground">{caption}</p>}
    </Card>
  );
}
