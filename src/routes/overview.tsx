import { VesselDetailModal } from "@/components/VesselDetailModal";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Search,
  Compass,
  Ship,
  Anchor,
  Info,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Download,
  Activity,
  Layers,
  Radio,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
  Navigation,
  Globe2,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { MapView } from "@/components/MapView";
import {
  Card,
  FallbackBanner,
  Skeleton,
  StatusBadge,
} from "@/components/ui-bits";
import { portsQuery, statusOf, STATUS_VAR, downloadCsv, type Port } from "@/lib/api";
import { useLiveVessels, type LiveVessel } from "@/lib/useLiveVessels";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Command Overview — Global Maritime Port Monitor" },
      {
        name: "description",
        content: "Enterprise AIS vessel tracking and global port congestion analytics dashboard.",
      },
      { property: "og:title", content: "Command Overview — Global Maritime Port Monitor" },
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

function formatCourse(cog: number | null | undefined): string {
  if (cog == null) return "—";
  const deg = Math.round(cog) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return `${deg}° ${dirs[idx]}`;
}

function Overview() {
  const q = useQuery(portsQuery());
  const navigate = useNavigate();
  const live = useLiveVessels();

  // Digital UTC Zulu Clock
  const [utcTime, setUtcTime] = useState<string>(() => new Date().toISOString().slice(11, 19) + " UTC");
  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toISOString().slice(11, 19) + " UTC");
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // If live relay connected but initial query captured fallback data, auto-refetch live metrics
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

  const avgCi = withCi.length
    ? withCi.reduce((sum, p) => sum + (p.congestion_index || 0), 0) / withCi.length
    : 0;

  const handleSelectPort = (p: Port) => {
    setMapCenter([p.lat, p.lon]);
    setMapZoom(11);
    live.setSelectedPortId(p.id);
  };

  const handleResetMap = () => {
    setMapCenter([20, 10]);
    setMapZoom(2);
    live.setSelectedPortId(null);
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

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: live.vessels?.length || 0 };
    (live.vessels || []).forEach((v) => {
      const cat = v.category || "other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [live.vessels]);

  return (
    <div className="space-y-6">
      {q.data?.source === "fallback" && (
        <FallbackBanner reason={q.data.fallbackReason} />
      )}

      {/* TOP COMMAND TELEMETRY STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-gradient-to-r from-[#0d1829]/90 via-[#0a1424]/90 to-[#0e1e36]/90 p-3.5 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                Maritime Tactical Command
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.2 border border-emerald-500/40 text-[10px] font-mono text-emerald-300">
                {live.status === "live" ? "RELAY CONNECTED" : "LOCAL SIMULATION"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              Real-time AIS Kinematics &amp; Global Congestion Indexing
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/50 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-foreground font-bold">{utcTime}</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/50 px-3 py-1.5">
            <Cpu className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-muted-foreground">Global Avg CI:</span>
            <span className={`font-bold ${avgCi > 1.2 ? "text-[#FF5577]" : avgCi > 1.0 ? "text-[#FFB547]" : "text-[#18D69B]"}`}>
              {avgCi.toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => q.refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/50 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition"
            title="Refresh AIS telemetry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin text-cyan-400" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 4 COMMAND KPI SUMMARY CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ports Monitored"
          variant="blue"
          value={q.isLoading ? null : `${ports.length}`}
          subValue="100% OPERATIONAL"
          context="Global strategic maritime hubs"
          tooltip="Total number of major commercial gateway ports actively evaluated for vessel dwell time and berthing capacity."
        />

        <KpiCard
          label="Peak Congestion Point"
          variant="amber"
          value={busiest ? busiest.name : q.isLoading ? null : "Normal"}
          subValue={busiest?.congestion_index != null ? `CI ${busiest.congestion_index.toFixed(2)}` : undefined}
          flag={busiest ? PORT_FLAGS[busiest.id] : undefined}
          context={busiest ? "Highest dwell & queue ratio" : "No active data"}
          tooltip="Port with highest ratio of stationary ships relative to active inbound & outbound movements within 25km radius."
        />

        <KpiCard
          label="Corridors Under Alert"
          variant="red"
          value={q.isLoading ? null : `${congested}`}
          subValue={`of ${ports.length} hubs`}
          context="Congestion Index > 1.20"
          accent={congested > 0}
          tooltip="Ports where anchorage queues exceed nominal operational baseline by >20%, requiring tactical rerouting."
        />

        <KpiCard
          label="Fleet Transponders"
          variant="cyan"
          value={
            live.totalVesselsCount > 0
              ? live.totalVesselsCount.toLocaleString()
              : q.isLoading
              ? null
              : "0"
          }
          subValue={live.status === "live" ? "REAL-TIME" : "SIMULATED"}
          context={
            live.status === "live"
              ? "Live satellite & coastal AIS stream"
              : "High-fidelity kinematic simulation"
          }
          tooltip="Active commercial vessels reporting position, SOG, COG, and draft telemetry through the live WebSocket relay."
        />
      </div>

      {/* HIGH-TECH MAP RADAR CHASSIS */}
      <div className="relative rounded-2xl border border-cyan-500/30 bg-[#080F20] shadow-2xl overflow-hidden">
        {/* Chassis Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-background/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-bold tracking-wider text-foreground uppercase">
                Geospatial Tactical Radar
              </h2>
              <span className="hidden sm:inline-block text-[10px] font-mono text-muted-foreground border-l border-border pl-2">
                25KM PORT CORRIDOR SCANNER
              </span>
            </div>
          </div>

          {/* Quick Port Jump Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="text-[10px] uppercase text-muted-foreground mr-1 hidden md:inline">Quick Jump:</span>
            {ports.map((p) => {
              const isSelected = live.selectedPortId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPort(p)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition flex items-center gap-1 ${
                    isSelected
                      ? "bg-cyan-500 text-black shadow-sm font-bold"
                      : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <span>{PORT_FLAGS[p.id] || "⚓"}</span>
                  <span>{p.name.split(" ")[0]}</span>
                </button>
              );
            })}
            <button
              onClick={handleResetMap}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
              title="Reset global view"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Untouched MapView - preserving exact component, props and interactions */}
        <div className="relative">
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            ports={ports}
            vessels={live.vesselsList}
            status={live.status}
            statusMessage={live.statusMessage}
            isSimulated={live.isSimulated}
            selectedVessel={live.selectedVessel}
            onSelectVessel={live.setSelectedVessel}
            onSelectPort={handleSelectPort}
          />
        </div>

        {/* Chassis Bottom Telemetry Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-background/90 px-4 py-2 text-[11px] font-mono text-muted-foreground backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span>
              Target Coordinates: <span className="text-cyan-400 font-bold">{mapCenter[0].toFixed(2)}°, {mapCenter[1].toFixed(2)}°</span>
            </span>
            <span>
              Zoom Level: <span className="text-foreground font-bold">{mapZoom}x</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#18D69B]" /> Normal (&lt;1.0)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#FFB547]" /> Moderate (1.0-1.2)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#FF5577]" /> Congested (&gt;1.2)
            </span>
          </div>
        </div>
      </div>

      {/* STRATEGIC MONITORED APPROACH CORRIDORS */}
      <Card className="p-4 space-y-3.5 border-border/80">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Anchor className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wide">
              Strategic Approach Corridors
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Congestion Index (CI): Ratio of stationary (&lt;0.5 kn) to moving traffic in 25km radius
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ports.map((p) => {
            const flag = PORT_FLAGS[p.id] || "⚓";
            const ci = p.congestion_index ?? 0;
            const status = statusOf(p.congestion_index);
            const isSelected = live.selectedPortId === p.id;
            const ciPercent = Math.min(Math.round((ci / 2.0) * 100), 100);

            return (
              <div
                key={p.id}
                onClick={() => handleSelectPort(p)}
                className={`group cursor-pointer rounded-xl border p-3.5 transition shadow-sm ${
                  isSelected
                    ? "border-cyan-500 bg-cyan-950/20 shadow-cyan-500/10"
                    : "border-border bg-card/60 hover:border-cyan-500/50 hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{flag}</span>
                    <div>
                      <span className="font-bold text-sm text-foreground group-hover:text-cyan-400 transition font-sans">
                        {p.name}
                      </span>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {p.lat.toFixed(2)}°N, {p.lon.toFixed(2)}°E
                      </p>
                    </div>
                  </div>
                  <StatusBadge ci={p.congestion_index} />
                </div>

                {/* Micro Congestion Bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-muted-foreground">Congestion Gauge</span>
                    <span className="font-bold text-foreground">
                      {p.congestion_index != null ? p.congestion_index.toFixed(2) : "N/A"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        ci > 1.2 ? "bg-[#FF5577]" : ci > 1.0 ? "bg-[#FFB547]" : "bg-[#18D69B]"
                      }`}
                      style={{ width: `${ciPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-border/50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPort(p);
                    }}
                    className="font-mono text-xs text-muted-foreground hover:text-cyan-400 flex items-center gap-1"
                  >
                    <Navigation className="h-3 w-3" /> Focus Radar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate({ to: "/ports/$id", params: { id: p.id } });
                    }}
                    className="font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono text-xs"
                  >
                    Deep Dive <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* LIVE VESSEL TELEMETRY DATA MATRIX */}
      <Card className="p-4 space-y-4 border-border/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 font-mono uppercase tracking-wide">
              <Ship className="h-4 w-4 text-cyan-400" />
              Live Transponder Feed &amp; Kinematics
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time AIS speed-over-ground, course, draft, and station-keeping across all monitored approach routes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadCsv("vessels-live-export.csv", sortedVessels)}
              disabled={!sortedVessels.length}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-mono text-foreground hover:bg-secondary disabled:opacity-40 transition"
              title="Download CSV"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            {live.selectedPortId && (
              <button
                onClick={() => live.setSelectedPortId(null)}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-mono text-cyan-300 hover:bg-cyan-500/20 transition"
              >
                Clear Port Filter ✕
              </button>
            )}
          </div>
        </div>

        {/* Table Search & Category Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by vessel name, MMSI, or callsign..."
              value={live.searchQuery}
              onChange={(e) => {
                live.setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-input bg-background/60 pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            {[
              { id: "all", label: "All Fleet" },
              { id: "cargo", label: "Cargo" },
              { id: "tanker", label: "Tanker" },
              { id: "tug", label: "Tug" },
              { id: "passenger", label: "Passenger" },
              { id: "fishing", label: "Fishing" },
            ].map((cat) => {
              const isSelected = live.typeFilter === cat.id;
              const count = categoryCounts[cat.id] ?? 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    live.setTypeFilter(cat.id);
                    setCurrentPage(1);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-cyan-500 text-black font-bold shadow-sm"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.2 ${isSelected ? "bg-black/20 text-black" : "bg-background/80 text-muted-foreground"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Table View */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card/40">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-secondary/70 text-[10px] uppercase text-muted-foreground border-b border-border">
              <tr>
                <th
                  onClick={() => toggleSort("name")}
                  className="px-4 py-3 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    Vessel Name
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("mmsi")}
                  className="px-4 py-3 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    MMSI
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("type")}
                  className="px-4 py-3 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    Category
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("sog")}
                  className="px-4 py-3 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    Speed (SOG)
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="px-4 py-3">Course (COG)</th>
                <th
                  onClick={() => toggleSort("portName")}
                  className="px-4 py-3 cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    Sector / Port
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-muted-foreground">
              {paginatedVessels.length > 0 ? (
                paginatedVessels.map((v) => {
                  const isStationary = (v.sog ?? 0) < 0.5;
                  const speedPercent = Math.min(Math.round(((v.sog ?? 0) / 22) * 100), 100);
                  return (
                    <tr
                      key={v.id}
                      onClick={() => live.setSelectedVessel(v)}
                      className="cursor-pointer hover:bg-secondary/40 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-semibold text-foreground whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <span className="text-base">{v.flag || "🚢"}</span>
                          <span className="hover:text-cyan-400 transition">{v.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{v.mmsi}</td>
                      <td className="px-4 py-2.5 capitalize font-sans">
                        <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium border border-border/60">
                          {v.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground min-w-[50px]">
                            {v.sog != null ? `${v.sog.toFixed(1)} kn` : "—"}
                          </span>
                          <div className="h-1.5 w-12 rounded-full bg-secondary overflow-hidden hidden md:block">
                            <div
                              className="h-full rounded-full bg-cyan-400"
                              style={{ width: `${speedPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <Compass className="h-3 w-3 text-cyan-400" />
                          {formatCourse(v.cog)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {v.portName ? (
                          <span className="inline-flex items-center gap-1 font-sans">
                            <span>{PORT_FLAGS[v.portId || ""] || "📍"}</span>
                            <span>{v.portName}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic font-sans">Open Sea Corridor</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {isStationary ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-mono border border-amber-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Anchored
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 font-mono border border-emerald-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Underway
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            live.setSelectedVessel(v);
                          }}
                          className="text-xs font-mono font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground font-mono">
                    No vessels found matching your active filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-2 text-xs font-mono text-muted-foreground">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} -{" "}
            {Math.min(currentPage * pageSize, sortedVessels.length)} of {sortedVessels.length} vessels
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-xs hover:bg-secondary disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-3 w-3" /> Previous
            </button>
            <span className="px-2 font-bold text-foreground">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-xs hover:bg-secondary disabled:opacity-40 transition"
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

// Polished Enterprise Holographic KPI Card Component
function KpiCard({
  label,
  value,
  subValue,
  flag,
  context,
  tooltip,
  accent,
  variant = "cyan",
}: {
  label: string;
  value: string | null;
  subValue?: string;
  flag?: string;
  context: string;
  tooltip: string;
  accent?: boolean;
  variant?: "cyan" | "amber" | "red" | "emerald" | "blue";
}) {
  const topBorderClass = {
    cyan: "after:bg-[#22D3EE] hover:border-cyan-500/40",
    blue: "after:bg-[#3978FF] hover:border-blue-500/40",
    amber: "after:bg-[#FFB547] hover:border-amber-500/40",
    red: "after:bg-[#FF5577] hover:border-red-500/40",
    emerald: "after:bg-[#18D69B] hover:border-emerald-500/40",
  }[variant];

  return (
    <Card className={`relative overflow-hidden border border-border/80 bg-card/80 p-4 shadow-md transition backdrop-blur-sm after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] ${topBorderClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {variant === "cyan" && <span className="h-1.5 w-1.5 rounded-full bg-[#22D3EE] animate-pulse" />}
          {variant === "red" && <span className="h-1.5 w-1.5 rounded-full bg-[#FF5577] animate-pulse" />}
          {variant === "amber" && <span className="h-1.5 w-1.5 rounded-full bg-[#FFB547]" />}
          {variant === "blue" && <span className="h-1.5 w-1.5 rounded-full bg-[#3978FF]" />}
          {variant === "emerald" && <span className="h-1.5 w-1.5 rounded-full bg-[#18D69B]" />}
          {label}
        </p>
        <div className="group relative cursor-help">
          <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-foreground" />
          <div className="pointer-events-none absolute right-0 top-5 z-50 hidden w-64 rounded-xl border border-border bg-popover p-3 text-[11px] text-popover-foreground shadow-2xl group-hover:block backdrop-blur-md font-sans">
            {tooltip}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        {value == null ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-center gap-2">
            {flag && <span className="text-2xl">{flag}</span>}
            <span
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${
                accent ? "text-[#FF5577]" : "text-foreground"
              }`}
            >
              {value}
            </span>
          </div>
        )}
        {subValue && (
          <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground border border-border">
            {subValue}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground truncate font-mono">{context}</p>
    </Card>
  );
}
