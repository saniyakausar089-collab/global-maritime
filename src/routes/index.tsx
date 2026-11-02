import { VesselDetailModal } from "@/components/VesselDetailModal";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Search,
  Filter,
  Compass,
  Ship,
  Anchor,
  Info,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  X,
  Gauge,
  Activity,
  Layers,
} from "lucide-react";
import { MapView } from "@/components/MapView";
import {
  Card,
  Empty,
  FallbackBanner,
  Skeleton,
  StatusBadge,
} from "@/components/ui-bits";
import { portsQuery, statusOf, STATUS_VAR, type Port } from "@/lib/api";
import { useLiveVessels, type LiveVessel } from "@/lib/useLiveVessels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Global Maritime Port Monitor" },
      {
        name: "description",
        content: "Enterprise AIS vessel tracking and global port congestion analytics dashboard.",
      },
      { property: "og:title", content: "Overview — Global Maritime Port Monitor" },
      {
        property: "og:description",
        content: "Enterprise AIS vessel tracking and global port congestion analytics dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

type TableSortKey = "name" | "mmsi" | "sog" | "type" | "portName";

const PORT_FLAGS: Record<string, string> = {
  rotterdam: "🇳🇱",
  singapore: "🇸🇬",
  shanghai: "🇨🇳",
  "los-angeles": "🇺🇸",
  hamburg: "🇩🇪",
  santos: "🇧🇷",
};

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

  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 10]);
  const [mapZoom, setMapZoom] = useState<number>(2);

  // Vessel Activity Table State
  const [tableSort, setTableSort] = useState<{ key: TableSortKey; dir: 1 | -1 }>({
    key: "sog",
    dir: -1,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  const ports = q.data?.data ?? [];

  const withCi = ports.filter((p) => p.congestion_index != null);
  const busiest = withCi.length
    ? [...withCi].sort((a, b) => b.congestion_index! - a.congestion_index!)[0]
    : null;
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

  // Sort filtered vessels for the activity table
  const sortedTableVessels = useMemo(() => {
    const list = [...live.filteredVessels];
    return list.sort((a, b) => {
      if (tableSort.key === "name") {
        return (a.name || "").localeCompare(b.name || "") * tableSort.dir;
      }
      if (tableSort.key === "mmsi") {
        return (a.id - b.id) * tableSort.dir;
      }
      if (tableSort.key === "sog") {
        return ((a.sog || 0) - (b.sog || 0)) * tableSort.dir;
      }
      if (tableSort.key === "type") {
        return (a.shipTypeLabel || "").localeCompare(b.shipTypeLabel || "") * tableSort.dir;
      }
      if (tableSort.key === "portName") {
        return (a.portName || "ZZZ").localeCompare(b.portName || "ZZZ") * tableSort.dir;
      }
      return 0;
    });
  }, [live.filteredVessels, tableSort]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [live.search, live.typeFilter, live.statusFilter, live.selectedPortId]);

  const totalPages = Math.max(1, Math.ceil(sortedTableVessels.length / pageSize));
  const paginatedVessels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTableVessels.slice(start, start + pageSize);
  }, [sortedTableVessels, currentPage]);

  const toggleSort = (key: TableSortKey) => {
    setTableSort((s) => ({
      key,
      dir: s.key === key ? (-s.dir as 1 | -1) : -1,
    }));
  };

  const showFallbackBanner = live.status === "offline" && q.data?.source === "fallback";

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Maritime Fleet & Port Congestion Monitor
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time AIS transponder feeds, anchorage density scoring, and dead-reckoned vessel intelligence.
          </p>
        </div>
      </div>

      {/* Render Cold-Start notification */}
      {live.status === "waking_up" && (
        <div className="flex items-center gap-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3 text-xs sm:text-sm text-cyan-800 dark:text-cyan-200">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
          </span>
          <p className="font-medium">
            {live.statusMessage} — Render free tier instances spin up in ~30–50s. Telemetry will resume automatically.
          </p>
        </div>
      )}

      {/* Fallback Banner */}
      {showFallbackBanner && (
        <FallbackBanner error={q.data?.error || "Relay backend unreachable"} />
      )}

      {/* 2. Redesigned KPI Summary Section (4 Responsive Cards) */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card A: Ports Monitored */}
        <KpiCard
          label="Ports Monitored"
          value={q.isLoading ? null : String(ports.length || 6)}
          context="Global commercial hub corridors"
          tooltip="Tracks 6 international maritime gateways: Rotterdam, Singapore, Shanghai, Los Angeles, Hamburg, and Santos."
        />

        {/* Card B: Busiest Port */}
        <KpiCard
          label="Busiest Port"
          value={
            q.isLoading
              ? null
              : busiest
                ? `${busiest.name}`
                : "—"
          }
          subValue={
            busiest && busiest.congestion_index != null
              ? `CI ${busiest.congestion_index.toFixed(2)}`
              : undefined
          }
          flag={busiest ? PORT_FLAGS[busiest.id] : undefined}
          context="Highest ratio of slow/waiting vessels within 25km"
          tooltip="Port with the highest Congestion Index (CI). Represents the proportion of vessels moving under 0.5 knots in approach anchorages."
        />

        {/* Card C: Ports Above Threshold (1.2) */}
        <KpiCard
          label="Ports Above Threshold"
          value={q.isLoading ? null : String(congested)}
          subValue="Threshold: 1.2"
          context="Ports experiencing severe anchorage queuing"
          accent={congested > 0}
          tooltip="Ports exceeding the 1.2 Congestion Index threshold. Scores above 1.2 indicate substantial waiting times before berth assignment."
        />

        {/* Card D: Live Vessels Tracked */}
        <KpiCard
          label="Live Vessels Tracked"
          value={live.status === "probing" ? null : live.totalCount.toLocaleString()}
          context="Active commercial AIS transponders"
          tooltip="Total commercial vessels (Cargo, Tanker, Passenger, Tug, Workboats) with active AIS position broadcasts processed in the last 15 minutes."
        />
      </div>

      {/* 3. Primary Vessel Search & Filters Toolbar (Above Map) */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Unified Search Input (Name, MMSI, IMO) */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={live.search}
              onChange={(e) => live.setSearch(e.target.value)}
              placeholder="Search by vessel name, MMSI, or IMO..."
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-xs font-medium outline-none transition focus:border-ring focus:ring-1 focus:ring-ring text-foreground"
            />
            {live.search && (
              <button
                onClick={() => live.setSearch("")}
                className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline">
              Category:
            </span>
            {(["all", "cargo", "tanker", "passenger", "other"] as const).map((t) => (
              <button
                key={t}
                onClick={() => live.setTypeFilter(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                  live.typeFilter === t
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Navigational Status Filter (Moving vs Anchored) */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5 text-xs">
            <button
              onClick={() => live.setStatusFilter("all")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                live.statusFilter === "all"
                  ? "bg-secondary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => live.setStatusFilter("moving")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition flex items-center gap-1 ${
                live.statusFilter === "moving"
                  ? "bg-secondary text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Moving
            </button>
            <button
              onClick={() => live.setStatusFilter("anchored")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition flex items-center gap-1 ${
                live.statusFilter === "anchored"
                  ? "bg-secondary text-slate-600 dark:text-slate-300 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Anchored
            </button>
          </div>
        </div>

        {/* Monitored Port Corridors Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-medium text-muted-foreground mr-1">
              Port Approach:
            </span>
            <button
              onClick={resetWorldView}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition flex items-center gap-1 ${
                live.selectedPortId === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <Compass className="h-3 w-3" /> All Ports
            </button>
            {ports.map((p) => {
              const isSelected = live.selectedPortId === p.id;
              const flag = PORT_FLAGS[p.id] || "⚓";
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPort(p)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition flex items-center gap-1 ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{flag}</span>
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Filter Counter & Clear All */}
          <div className="flex items-center gap-2 ml-auto text-xs">
            <span className="text-muted-foreground">
              Matching: <strong className="text-foreground">{live.filteredCount.toLocaleString()}</strong> of {live.totalCount.toLocaleString()} vessels
            </span>
            {live.activeFilterCount > 0 && (
              <button
                onClick={live.clearAllFilters}
                className="flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:text-rose-600 hover:underline"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Vessel Map Centerpiece */}
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

      {/* 5. Vessel Activity Table (Sortable, Searchable, Responsive) */}
      <Card className="overflow-hidden p-0 border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Vessel Activity Telemetry</h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
              {live.filteredCount} vessels
            </span>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="flex h-7 w-7 items-center justify-center rounded border border-border bg-background text-foreground hover:bg-secondary disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="flex h-7 w-7 items-center justify-center rounded border border-border bg-background text-foreground hover:bg-secondary disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Table Body */}
        {sortedTableVessels.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No vessels match your active search and filter criteria.</p>
            {live.activeFilterCount > 0 && (
              <button
                onClick={live.clearAllFilters}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/20 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">
                    <button
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Vessel Name <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5">
                    <button
                      onClick={() => toggleSort("mmsi")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      MMSI <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5">
                    <button
                      onClick={() => toggleSort("type")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Type <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5">
                    <button
                      onClick={() => toggleSort("portName")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Approach / Proximity <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5">
                    <button
                      onClick={() => toggleSort("sog")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Speed <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5">Course</th>
                  <th className="px-4 py-2.5">Nav Status</th>
                  <th className="px-4 py-2.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedVessels.map((v) => {
                  const isSelected = live.selectedVessel?.id === v.id;
                  const isMoving = (v.sog || 0) > 0.5;

                  return (
                    <tr
                      key={v.id}
                      onClick={() => live.setSelectedVessel(v)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-secondary/80 font-medium"
                          : "hover:bg-secondary/40"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <Ship className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate max-w-[180px]">{v.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{v.mmsi || v.id}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block rounded px-2 py-0.5 text-[10px] font-medium bg-secondary text-secondary-foreground">
                          {v.shipTypeLabel || "Commercial"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {v.portName ? (
                          <span className="font-medium text-foreground">
                            {v.portName} ({v.distanceToPortKm} km)
                          </span>
                        ) : (
                          <span className="text-muted-foreground/70">Ocean Passage</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-medium">
                        {Number(v.sog || 0).toFixed(1)} kn
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {Math.round(v.cog || 0)}°
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            isMoving
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isMoving ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                            }`}
                          />
                          {isMoving ? "Under Way" : "Anchored"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            live.setSelectedVessel(v);
                          }}
                          className="rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-secondary"
                        >
                          Intel →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 6. Monitored Ports Summary Overview Grid */}
      <Card className="p-4 border border-border bg-card">
        <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <Anchor className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Monitored Approach Corridors</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Congestion Index (CI): Ratio of vessels moving &lt;0.5 kn within 25km radius
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ports.map((p) => {
            const flag = PORT_FLAGS[p.id] || "⚓";
            const ci = p.congestion_index;
            const status = statusOf(ci);

            return (
              <div
                key={p.id}
                onClick={() => handleSelectPort(p)}
                className="group cursor-pointer rounded-lg border border-border bg-background p-3 hover:border-primary/50 hover:bg-secondary/30 transition shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{flag}</span>
                    <span className="font-bold text-xs text-foreground group-hover:text-primary transition">
                      {p.name}
                    </span>
                  </div>
                  <StatusBadge ci={ci} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Coordinates: {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate({ to: "/ports/$id", params: { id: p.id } });
                    }}
                    className="font-medium text-primary hover:underline flex items-center gap-0.5"
                  >
                    Details <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Vessel Details & Gemini AI Assistant Modal / Drawer */}
      <VesselDetailModal
        vessel={live.selectedVessel}
        onClose={() => live.setSelectedVessel(null)}
      />
    </div>
  );
}

// Polished Enterprise KPI Card Component
function KpiCard({
  label,
  value,
  subValue,
  flag,
  context,
  tooltip,
  accent,
}: {
  label: string;
  value: string | null;
  subValue?: string;
  flag?: string;
  context: string;
  tooltip: string;
  accent?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border border-border bg-card p-3.5 shadow-xs transition hover:border-border/80">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="group relative cursor-help">
          <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-foreground" />
          <div className="pointer-events-none absolute right-0 top-5 z-50 hidden w-56 rounded-md border border-border bg-popover p-2 text-[11px] text-popover-foreground shadow-lg group-hover:block">
            {tooltip}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        {value == null ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className="flex items-center gap-2">
            {flag && <span className="text-xl">{flag}</span>}
            <span
              className={`text-2xl font-bold tracking-tight ${
                accent ? "text-rose-500" : "text-foreground"
              }`}
            >
              {value}
            </span>
          </div>
        )}
        {subValue && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
            {subValue}
          </span>
        )}
      </div>

      <p className="mt-1 text-[11px] text-muted-foreground truncate">{context}</p>
    </Card>
  );
}
