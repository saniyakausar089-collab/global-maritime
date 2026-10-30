import { VesselDetailModal } from "@/components/VesselDetailModal";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Search, Filter, Compass, Ship, Anchor } from "lucide-react";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Global Maritime Port Monitor" },
      {
        name: "description",
        content: "Live AIS-based port congestion monitoring and moving vessel tracking dashboard.",
      },
      { property: "og:title", content: "Overview — Global Maritime Port Monitor" },
      {
        property: "og:description",
        content: "Live AIS-based port congestion monitoring and moving vessel tracking dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

type SortKey = "name" | "congestion_index";

function Overview() {
  const q = useQuery(portsQuery());
  const navigate = useNavigate();
  const live = useLiveVessels();

  // If live relay connected but initial SSR query captured fallback data, auto-refetch live metrics
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

  // Only show the red demo banner if the live connection truly failed after retries
  const showFallbackBanner = live.status === "offline" && q.data?.source === "fallback";

  return (
    <div className="space-y-6">
      {/* Top Header & Refresh Control */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Port Congestion</h1>
          <p className="text-sm text-muted-foreground">
            Live AIS transponder feed tracking moving and anchored commercial vessels across 6
            global ports.
          </p>
        </div>
        <RefreshControl updatedAt={q.data?.fetchedAt} />
      </div>

      {/* Render Cold-Start notification */}
      {live.status === "waking_up" && (
        <div className="flex items-center gap-3 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-700 dark:text-sky-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
          </span>
          <p className="font-medium">
            {live.statusMessage} — Render free web services spin up in 30–50s. Please stand by.
          </p>
        </div>
      )}

      {/* Fallback Banner (only when connection genuinely failed after retries) */}
      {showFallbackBanner && (
        <FallbackBanner error={q.data?.error || "Relay backend unreachable"} />
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Ports monitored" value={q.isLoading ? null : String(ports.length)} />
        <Stat
          label="Busiest port"
          value={
            q.isLoading
              ? null
              : busiest
                ? `${busiest.name} (${busiest.congestion_index!.toFixed(2)})`
                : "—"
          }
        />
        <Stat label="Ports above 1.2" value={q.isLoading ? null : String(congested)} accent />
        <Stat
          label="Live Vessels Tracked"
          value={live.status === "probing" ? null : String(live.totalCount)}
        />
      </div>

      {/* Live Map Card */}
      <Card className="p-3 space-y-3">
        {/* Map Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={live.search}
              onChange={(e) => live.setSearch(e.target.value)}
              placeholder="Search ship name or MMSI..."
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"
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
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-muted-foreground hidden lg:inline mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Type:
            </span>
            {(["all", "cargo", "tanker", "passenger", "other"] as const).map((t) => (
              <button
                key={t}
                onClick={() => live.setTypeFilter(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                  live.typeFilter === t
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-secondary text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Port filters & Reset view button */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={resetWorldView}
              className={`rounded-md border px-2.5 py-1 font-medium transition flex items-center gap-1 ${
                live.selectedPortId === "all"
                  ? "bg-secondary text-foreground border-border"
                  : "hover:bg-secondary text-muted-foreground"
              }`}
            >
              <Compass className="h-3.5 w-3.5" /> All Ports
            </button>
            {ports.map((p) => {
              const isSelected = live.selectedPortId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPort(p)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Leaflet Live Map Component with Canvas Renderer */}
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

        {/* Colorful Legend bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#10b981] shadow-sm shadow-[#10b981]/50" /> Cargo
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#f59e0b] shadow-sm shadow-[#f59e0b]/50" /> Tanker
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#ec4899] shadow-sm shadow-[#ec4899]/50" /> Passenger
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#8b5cf6] shadow-sm shadow-[#8b5cf6]/50" /> Fast (&gt;14 kn)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#06b6d4] shadow-sm shadow-[#06b6d4]/50" /> Tug / Special
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-[#64748b] border border-white/60" /> Anchored (&lt;0.5 kn)
            </span>
          </div>
          <div>
            Showing <span className="font-bold text-foreground">{live.filteredCount}</span> of{" "}
            <span className="font-bold text-foreground">{live.totalCount}</span> live vessels
          </div>
        </div>
      </Card>

      {/* Ports Table */}
      <Card className="overflow-x-auto p-0">
        {q.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : !ports.length ? (
          <div className="p-4">
            <Empty text="Waiting for port telemetry..." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">
                  <button onClick={() => toggle("name")} className="flex items-center gap-1">
                    Port <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-2">
                  <button
                    onClick={() => toggle("congestion_index")}
                    className="flex items-center gap-1"
                  >
                    Congestion index <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => handleSelectPort(p)}
                  className="cursor-pointer border-t hover:bg-secondary transition-colors"
                >
                  <td className="px-4 py-2 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Anchor className="h-3.5 w-3.5 text-accent" /> {p.name}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {p.congestion_index != null ? p.congestion_index.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge ci={p.congestion_index} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ to: "/ports/$id", params: { id: p.id } });
                      }}
                      className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-secondary text-foreground"
                    >
                      Port Details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Vessel Details & Gemini AI Assistant */}
      <VesselDetailModal
        vessel={live.selectedVessel}
        onClose={() => live.setSelectedVessel(null)}
      />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {value == null ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className={`mt-1 text-2xl font-semibold ${accent ? "text-accent" : ""}`}>{value}</p>
      )}
    </Card>
  );
}
