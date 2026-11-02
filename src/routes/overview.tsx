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

export const Route = createFileRoute("/overview")({
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

  // Filtered & sorted vessels for the data table
  const filteredVessels = useMemo(() => {
    return (live.vessels || []).filter((v) => {
      const matchesSearch =
        !live.searchQuery ||
        v.name.toLowerCase().includes(live.searchQuery.toLowerCase()) ||
        v.mmsi.toString().includes(live.searchQuery) ||
        (v.callsign && v.callsign.toLowerCase().includes(live.searchQuery.toLowerCase()));

      const matchesType = live.typeFilter === "all" || v.category === live.typeFilter;
      const matchesPort = !live.selectedPortId || v.portId === live.selectedPortId;

      return matchesSearch && matchesType && matchesPort;
    });
  }, [live.vessels, live.searchQuery, live.typeFilter, live.selectedPortId]);

  const sortedVessels = useMemo(() => {
    return [...filteredVessels].sort((a, b) => {
      let valA: any = a[tableSort.key] ?? "";
      let valB: any = b[tableSort.key] ?? "";

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return -1 * tableSort.dir;
      if (valA > valB) return 1 * tableSort.dir;
      return 0;
    });
  }, [filteredVessels, tableSort]);

  const totalPages = Math.ceil(sortedVessels.length / pageSize) || 1;
  const paginatedVessels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedVessels.slice(start, start + pageSize);
  }, [sortedVessels, currentPage]);

  const toggleSort = (key: TableSortKey) => {
    setTableSort((prev) => ({
      key,
      dir: prev.key === key ? ((prev.dir * -1) as 1 | -1) : 1,
    }));
  };

  return (
    <div className="space-y-6">
      {q.data?.source === "fallback" && (
        <FallbackBanner reason={q.data.fallbackReason} />
      )}

      {/* 4 Upgraded Responsive KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ports Monitored"
          value={q.isLoading ? null : `${ports.length}`}
          context="Global gateway ports"
          tooltip="Total number of major maritime ports currently monitored for vessel congestion and turn-around delay."
        />

        <KpiCard
          label="Busiest Port"
          value={busiest ? busiest.name : q.isLoading ? null : "None"}
          subValue={busiest?.congestion_index != null ? `CI ${busiest.congestion_index.toFixed(2)}` : undefined}
          flag={busiest ? PORT_FLAGS[busiest.id] : undefined}
          context={busiest ? "Highest congestion index" : "No active data"}
          tooltip="Port with the highest ratio of stationary or waiting vessels relative to total active traffic within its 25km radius."
        />

        <KpiCard
          label="Ports Above Threshold"
          value={q.isLoading ? null : `${congested}`}
          subValue={`of ${ports.length}`}
          context="Congestion Index > 1.2"
          accent={congested > 0}
          tooltip="Number of ports operating above the standard congestion threshold of 1.2, indicating potential berthing and anchorage bottlenecks."
        />

        <KpiCard
          label="Live Vessels Tracked"
          value={
            live.totalVesselsCount > 0
              ? live.totalVesselsCount.toLocaleString()
              : q.isLoading
              ? null
              : "0"
          }
          subValue={live.status === "live" ? "REAL AIS" : "DEMO"}
          context={
            live.status === "live"
              ? "Live satellite & terrestrial fixes"
              : "Simulated realistic telemetry"
          }
          tooltip="Total live commercial vessels actively reporting position fixes within monitored port zones and global ocean corridors."
        />
      </div>

      {/* Centerpiece Full-Featured Geospatial Map */}
      <MapView
        center={mapCenter}
        zoom={mapZoom}
        onSelectPort={handleSelectPort}
      />

      {/* Monitored Ports Quick Overview Grid */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
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

      {/* Live Vessel Activity Data Table */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Ship className="h-4 w-4 text-primary" />
              Live Vessel Activity Feed
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inspect active vessel transponders, speed over ground, and operational status across all monitored corridors.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>Showing {sortedVessels.length} vessels</span>
            {live.selectedPortId && (
              <button
                onClick={() => live.setSelectedPortId(null)}
                className="text-xs text-primary hover:underline ml-2"
              >
                Clear port filter
              </button>
            )}
          </div>
        </div>

        {/* Table Search & Category Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by vessel name, MMSI, or callsign..."
              value={live.searchQuery}
              onChange={(e) => {
                live.setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-md border border-input bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground text-[11px] font-mono mr-1">Filter:</span>
            {[
              { id: "all", label: "All Types" },
              { id: "cargo", label: "Cargo" },
              { id: "tanker", label: "Tanker" },
              { id: "tug", label: "Tug" },
              { id: "passenger", label: "Passenger" },
              { id: "fishing", label: "Fishing" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  live.setTypeFilter(cat.id);
                  setCurrentPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  live.typeFilter === cat.id
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Table View */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground border-b border-border">
              <tr>
                <th
                  onClick={() => toggleSort("name")}
                  className="px-3.5 py-2.5 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    Vessel Name
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("mmsi")}
                  className="px-3.5 py-2.5 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    MMSI
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("type")}
                  className="px-3.5 py-2.5 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    Category
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("sog")}
                  className="px-3.5 py-2.5 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    Speed (SOG)
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="px-3.5 py-2.5">Course (COG)</th>
                <th
                  onClick={() => toggleSort("portName")}
                  className="px-3.5 py-2.5 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    Jurisdiction / Port
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="px-3.5 py-2.5">Operational Status</th>
                <th className="px-3.5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-muted-foreground">
              {paginatedVessels.length > 0 ? (
                paginatedVessels.map((v) => {
                  const isStationary = (v.sog ?? 0) < 0.5;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => live.setSelectedVessel(v)}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-3.5 py-2 font-semibold text-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span>{v.flag || "🚢"}</span>
                          <span>{v.name}</span>
                        </span>
                      </td>
                      <td className="px-3.5 py-2">{v.mmsi}</td>
                      <td className="px-3.5 py-2 capitalize font-sans">{v.category}</td>
                      <td className="px-3.5 py-2 font-bold text-foreground">
                        {v.sog != null ? `${v.sog.toFixed(1)} kn` : "—"}
                      </td>
                      <td className="px-3.5 py-2">
                        {v.cog != null ? `${Math.round(v.cog)}°` : "—"}
                      </td>
                      <td className="px-3.5 py-2 whitespace-nowrap">
                        {v.portName ? (
                          <span className="inline-flex items-center gap-1 font-sans">
                            <span>{PORT_FLAGS[v.portId || ""] || "📍"}</span>
                            <span>{v.portName}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic font-sans">Open Water</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2">
                        {isStationary ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 font-sans">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Anchored / Waiting
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-sans">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Underway
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            live.setSelectedVessel(v);
                          }}
                          className="text-[11px] font-sans font-medium text-primary hover:underline"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-3.5 py-8 text-center text-muted-foreground">
                    No vessels found matching your active filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-3 w-3" /> Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40 transition-colors"
            >
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
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
