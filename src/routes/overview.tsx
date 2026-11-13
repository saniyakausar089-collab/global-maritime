import { VesselDetailModal } from "@/components/VesselDetailModal";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useRef } from "react";
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
  Radio,
  Clock,
  Navigation,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  CloudSun,
} from "lucide-react";
import { MapView } from "@/components/MapView";
import { FallbackBanner, Skeleton, StatusBadge } from "@/components/ui-bits";
import { portsQuery, statusOf, downloadCsv, type Port } from "@/lib/api";
import { useLiveVessels, getVesselCategory, type LiveVessel } from "@/lib/useLiveVessels";

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

// Apple-style smooth animated counter
function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const startRef = useRef(value);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    const start = startRef.current;
    const end = value;
    if (start === end) return;

    const startTime = performance.now();
    let animId: number;

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Apple cubic-bezier ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);
      if (progress < 1) {
        animId = requestAnimationFrame(update);
      } else {
        startRef.current = end;
      }
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  return <span className="tabular-nums">{displayValue.toLocaleString()}</span>;
}

// Minimal SVG Sparkline
function Sparkline({ data, color = "#5EE7FF", height = 24 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-6 overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// Apple-style Radial Arc Congestion Gauge
function RadialGauge({
  value,
  max = 2.0,
  size = 130,
  strokeWidth = 9,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.72; // ~260 degrees arc
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const strokeDashoffset = arcLength * (1 - ratio);

  const color = value > 1.2 ? "#FF5C70" : value > 1.0 ? "#FBBF24" : "#34D399";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-125">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          className="text-white/10"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-semibold tabular-nums text-ink tracking-tight">
          {value.toFixed(2)}
        </span>
        <span className="text-[10px] text-ink-3 uppercase tracking-wider font-mono">CI INDEX</span>
      </div>
    </div>
  );
}

function Overview() {
  const q = useQuery(portsQuery());
  const navigate = useNavigate();
  const live = useLiveVessels();

  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 10]);
  const [mapZoom, setMapZoom] = useState<number>(2);

  // Vessel Activity Table State
  const [tableSort, setTableSort] = useState<{ key: TableSortKey; dir: 1 | -1 }>({
    key: "sog",
    dir: -1,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // If live relay connected but initial query captured fallback data, auto-refetch live metrics
  useEffect(() => {
    if (live.status === "live" && q.data?.source === "fallback") {
      q.refetch();
    }
  }, [live.status, q]);

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

  // Category counts computation - uses category or resolves via getVesselCategory (fixes the bug!)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: live.vessels?.length || 0,
      cargo: 0,
      tanker: 0,
      tug: 0,
      passenger: 0,
      fishing: 0,
      other: 0,
    };
    (live.vessels || []).forEach((v) => {
      const cat = v.category || getVesselCategory(v.type || v.shipType);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [live.vessels]);

  // Filtered vessels for the data table
  const filteredVessels = useMemo(() => {
    const query = (live.searchQuery || "").trim().toLowerCase();
    const filter = live.typeFilter;
    const selectedPort = live.selectedPortId;

    return (live.vessels || []).filter((v) => {
      const cat = v.category || getVesselCategory(v.type || v.shipType);

      const matchesSearch =
        !query ||
        v.name.toLowerCase().includes(query) ||
        v.mmsi.toString().includes(query) ||
        (v.callsign && v.callsign.toLowerCase().includes(query));

      const matchesType = filter === "all" || cat === filter;
      const matchesPort = !selectedPort || v.portId === selectedPort;

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

  const totalVesselsCount = live.totalVesselsCount || live.vessels?.length || 14070;

  return (
    <div className="space-y-16 sm:space-y-24 max-w-[1280px] mx-auto py-6 sm:py-10">
      {/* 1. HERO STRIP: Huge Apple-like statement with animated numbers */}
      <section className="relative space-y-8 sm:space-y-10">
        <div className="hero-radial-bloom absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[350px] pointer-events-none" />

        <div className="relative space-y-4">
          <h1 className="text-gradient-apple text-4xl sm:text-6xl md:text-7xl lg:text-[84px] font-semibold tracking-[-0.04em] leading-[1.05] tabular-nums">
            <AnimatedCounter value={live.liveCount} /> vessels live. {ports.length || 6} ports.
          </h1>
          <p className="text-base sm:text-lg text-ink-2 max-w-2xl font-normal leading-relaxed">
            Real-time AIS telemetry, strategic berth capacity, and commercial corridor indexing.
            <span className="block mt-1 text-sm font-mono text-ink-3">
              Tracked fleet: <strong className="text-emerald-400 font-semibold">{live.liveCount.toLocaleString()} live</strong>
              {live.estimatedCount > 0 && (
                <> · <span className="text-ink-2">+ {live.estimatedCount.toLocaleString()} estimated at sea</span></>
              )}
            </span>
          </p>
        </div>

        {/* 4 Small Stat Glass Cards with Sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Monitored Hubs */}
          <div className="glass-panel card-hover-lift rounded-[20px] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-2">Operational Hubs</span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono text-[#34D399] bg-[#34D399]/12 border border-[#34D399]/25">
                <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
                100% ONLINE
              </span>
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold tabular-nums text-ink tracking-tight">
                {ports.length || 6}
              </div>
              <p className="text-[11px] text-ink-3 mt-0.5">Strategic maritime choke-points</p>
            </div>
            <Sparkline data={[1, 1, 1, 1, 1, 1, 1]} color="#34D399" />
          </div>

          {/* Card 2: Highest Congestion Port */}
          <div className="glass-panel card-hover-lift rounded-[20px] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-2">Peak Congestion Point</span>
              {busiest && (
                <span className="text-lg" title={busiest.name}>
                  {PORT_FLAGS[busiest.id] || "⚓"}
                </span>
              )}
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold tracking-tight text-ink truncate">
                {busiest ? busiest.name.split(" ")[0] : "Normal"}
              </div>
              <p className="text-[11px] text-ink-3 mt-0.5">
                {busiest?.congestion_index != null
                  ? `Congestion Index ${busiest.congestion_index.toFixed(2)}`
                  : "Nominal operational baseline"}
              </p>
            </div>
            <Sparkline data={[0.95, 1.05, 1.15, 1.25, 1.35, 1.4]} color="#FF5C70" />
          </div>

          {/* Card 3: Hubs Above 1.20 Baseline */}
          <div className="glass-panel card-hover-lift rounded-[20px] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-2">Above 1.20 Baseline</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono ${
                  congested > 0
                    ? "text-[#FF5C70] bg-[#FF5C70]/12 border border-[#FF5C70]/25"
                    : "text-[#34D399] bg-[#34D399]/12 border border-[#34D399]/25"
                }`}
              >
                {congested > 0 ? "ALERT" : "STABLE"}
              </span>
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold tabular-nums text-ink tracking-tight">
                {congested} <span className="text-sm font-normal text-ink-3">/ {ports.length || 6}</span>
              </div>
              <p className="text-[11px] text-ink-3 mt-0.5">Anchorage queue &gt; 20% over baseline</p>
            </div>
            <Sparkline data={[0, 1, 1, 2, 1, congested]} color="#FBBF24" />
          </div>

          {/* Card 4: Live AIS vessels */}
          <div className="glass-panel card-hover-lift rounded-[20px] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-2">Live AIS vessels</span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono text-accent bg-accent/12 border border-accent/25">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                {live.isDemoMode ? "DEMO DATA" : live.status === "live" ? "REAL-TIME AIS" : "CONNECTING"}
              </span>
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold tabular-nums text-ink tracking-tight">
                <AnimatedCounter value={live.liveCount} />
              </div>
              <p className="text-[11px] text-ink-3 mt-0.5">
                {live.estimatedCount > 0 ? `+ ${live.estimatedCount.toLocaleString()} estimated at sea` : "100% direct feed"}
              </p>
            </div>
            <Sparkline data={[live.liveCount - 15, live.liveCount - 8, live.liveCount, live.liveCount + 2, live.liveCount]} color="#5EE7FF" />
          </div>
        </div>
      </section>

      {/* 2. THE MAP CENTERPIECE: Global Vessel Monitor */}
      <section className="relative space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase font-sans">
              GLOBAL VESSEL MONITOR
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-semibold tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE MAP
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/weather"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all font-sans text-xs font-semibold"
            >
              <CloudSun className="h-3.5 w-3.5" />
              <span>Weather & Marine</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-ink-3">
              <span className="text-white/20">·</span>
              <span>AIS TELEMETRY</span>
              <span className="text-white/20">·</span>
              <span className="text-emerald-400 font-semibold">CONNECTED</span>
            </div>
          </div>
        </div>

        <MapView
          center={mapCenter}
          zoom={mapZoom}
          ports={ports}
          vessels={live.vesselsList}
          status={live.status}
          statusMessage={live.statusMessage}
          isSimulated={live.isSimulated}
          isDemoMode={live.isDemoMode}
          selectedVessel={live.selectedVessel}
          onSelectVessel={live.setSelectedVessel}
          onSelectPort={handleSelectPort}
          selectedPortId={live.selectedPortId}
          onClosePort={() => live.setSelectedPortId(null)}
          className="h-[78vh] min-h-[580px] w-full"
        />
      </section>

      {/* 3. PORT CONGESTION: Asymmetric Bento Grid (12-col) */}
      <section className="space-y-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-ink tracking-[-0.03em]">
            Strategic approach corridors
          </h2>
          <p className="text-sm sm:text-base text-ink-2 mt-1">
            Congestion Index (CI) evaluated across 25km tactical radii. Ratios above 1.20 denote anchorage queue bottlenecks.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4 sm:gap-5">
          {/* Double-size Hero Bento Tile for the most congested port */}
          {busiest && (
            <div
              onClick={() => handleSelectPort(busiest)}
              className="col-span-12 lg:col-span-7 glass-panel card-hover-lift rounded-[20px] p-6 sm:p-8 cursor-pointer relative overflow-hidden flex flex-col justify-between group border-accent/20 hover:border-accent/50"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl">{PORT_FLAGS[busiest.id] || "⚓"}</span>
                    <div>
                      <h3 className="text-2xl font-semibold text-ink group-hover:text-accent transition-colors">
                        {busiest.name}
                      </h3>
                      <p className="text-xs font-mono text-ink-3 mt-0.5">
                        {busiest.lat.toFixed(2)}°N, {busiest.lon.toFixed(2)}°E · Strategic Corridor
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-[#FF5C70]/12 text-[#FF5C70] border border-[#FF5C70]/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FF5C70] animate-pulse" />
                      Highest Congestion Point
                    </span>
                    <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-mono text-ink-2">
                      Queue Delay Alert
                    </span>
                  </div>
                </div>

                {/* Radial Gauge Visual */}
                <div className="flex justify-center sm:justify-end">
                  <RadialGauge value={busiest.congestion_index ?? 1.4} size={140} strokeWidth={10} />
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-ink-2 font-mono">
                  Stationary vs. underway traffic: <strong className="text-ink">Critical ratio</strong>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPort(busiest);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink transition cursor-pointer"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>Focus on radar</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate({ to: "/ports/$id", params: { id: busiest.id } });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-black hover:bg-accent/90 transition shadow-[0_0_12px_rgba(94,231,255,0.25)] cursor-pointer"
                  >
                    <span>Deep dive</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Remaining Ports Bento Tiles */}
          {ports
            .filter((p) => p.id !== busiest?.id)
            .map((p) => {
              const flag = PORT_FLAGS[p.id] || "⚓";
              const ci = p.congestion_index ?? 1.0;
              const isSelected = live.selectedPortId === p.id;
              const statusColor = ci > 1.2 ? "#FF5C70" : ci > 1.0 ? "#FBBF24" : "#34D399";

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPort(p)}
                  className={`col-span-12 sm:col-span-6 lg:col-span-5 xl:col-span-4 glass-panel card-hover-lift rounded-[20px] p-5 sm:p-6 cursor-pointer flex flex-col justify-between group transition-all ${
                    isSelected ? "border-accent/60 bg-accent/[0.04]" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{flag}</span>
                        <div>
                          <h4 className="font-semibold text-base text-ink group-hover:text-accent transition-colors">
                            {p.name}
                          </h4>
                          <p className="text-[11px] font-mono text-ink-3">
                            {p.lat.toFixed(2)}°N, {p.lon.toFixed(2)}°E
                          </p>
                        </div>
                      </div>
                      <StatusBadge ci={p.congestion_index} />
                    </div>

                    {/* CI Number & Gauge */}
                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-ink-3 block">
                          Congestion Index
                        </span>
                        <span className="text-2xl font-semibold tabular-nums text-ink">
                          {p.congestion_index != null ? p.congestion_index.toFixed(2) : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-mono text-ink-3 block">
                          Approach Flow
                        </span>
                        <span className="text-xs font-mono font-medium" style={{ color: statusColor }}>
                          {ci > 1.2 ? "Congested" : ci > 1.0 ? "Moderate" : "Smooth"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(Math.round((ci / 2.0) * 100), 100)}%`,
                          backgroundColor: statusColor,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPort(p);
                      }}
                      className="font-mono text-[11px] text-ink-3 group-hover:text-ink-2 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Navigation className="h-3 w-3 text-accent" />
                      <span>Focus on radar</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ to: "/ports/$id", params: { id: p.id } });
                      }}
                      className="text-accent hover:text-accent/80 font-medium text-[11px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Deep dive</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* 4. LIVE FLEET TABLE: Borderless glass panel with category filter pills */}
      <section className="space-y-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-ink tracking-[-0.03em]">
            Tracked fleet activity
          </h2>
          <p className="text-sm sm:text-base text-ink-2 mt-1">
            Real-time AIS speed-over-ground, course, draft, and station-keeping across all monitored approach routes.
          </p>
        </div>

        <div className="glass-panel rounded-[20px] p-5 sm:p-6 space-y-5">
          {/* Controls: Search with '/' shortcut hint, Category Pills & Export */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-ink-3" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by vessel name, MMSI, or callsign..."
                value={live.searchQuery}
                onChange={(e) => {
                  live.setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-12 py-2 text-xs text-ink placeholder:text-ink-3 focus:outline-hidden focus:border-accent/60 focus:ring-1 focus:ring-accent font-mono transition"
              />
              <span className="absolute right-3.5 top-2.5 text-[10px] font-mono text-ink-3 border border-white/10 rounded px-1.5 py-0.5 bg-white/5 pointer-events-none">
                /
              </span>
            </div>

            {/* Category Filter Pills with colored dots */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: "all", label: "All Fleet", dotColor: "#F4F7FB" },
                { id: "cargo", label: "Cargo", dotColor: "#5EE7FF" },
                { id: "tanker", label: "Tanker", dotColor: "#FFB547" },
                { id: "passenger", label: "Passenger", dotColor: "#A78BFA" },
                { id: "tug", label: "Tug", dotColor: "#FBBF24" },
                { id: "fishing", label: "Fishing", dotColor: "#34D399" },
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
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-accent text-black font-semibold shadow-[0_0_12px_rgba(94,231,255,0.25)]"
                        : "bg-white/5 text-ink-2 hover:text-ink hover:bg-white/10 border border-white/10"
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? "#000" : cat.dotColor }}
                    />
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] font-mono rounded-full px-1.5 py-0.2 ${
                        isSelected ? "bg-black/20 text-black font-bold" : "bg-white/10 text-ink-3"
                      }`}
                    >
                      {count.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Export CSV & Clear Port Filter */}
            <div className="flex items-center gap-2">
              {live.selectedPortId && (
                <button
                  onClick={() => live.setSelectedPortId(null)}
                  className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-mono text-accent hover:bg-accent/20 transition cursor-pointer"
                >
                  Clear Port Filter ✕
                </button>
              )}
              <button
                onClick={() => downloadCsv("vessels-live-export.csv", sortedVessels)}
                disabled={!sortedVessels.length}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-mono text-ink-2 hover:text-ink hover:bg-white/10 disabled:opacity-40 transition cursor-pointer"
                title="Download CSV"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          </div>

          {/* Borderless Glass Table */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-ink-3 border-b border-white/10">
                <tr>
                  <th
                    onClick={() => toggleSort("name")}
                    className="px-4 py-3 cursor-pointer hover:text-ink"
                  >
                    <span className="flex items-center gap-1">
                      Vessel Name
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("mmsi")}
                    className="px-4 py-3 cursor-pointer hover:text-ink"
                  >
                    <span className="flex items-center gap-1">
                      MMSI
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("type")}
                    className="px-4 py-3 cursor-pointer hover:text-ink"
                  >
                    <span className="flex items-center gap-1">
                      Category
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("sog")}
                    className="px-4 py-3 cursor-pointer hover:text-ink"
                  >
                    <span className="flex items-center gap-1">
                      Speed (SOG)
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3">Course (COG)</th>
                  <th
                    onClick={() => toggleSort("portName")}
                    className="px-4 py-3 cursor-pointer hover:text-ink"
                  >
                    <span className="flex items-center gap-1">
                      Corridor Sector
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3">Telemetry Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Intel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-ink-2">
                {paginatedVessels.length > 0 ? (
                  paginatedVessels.map((v) => {
                    const isStationary = (v.sog ?? 0) < 0.5;
                    const cat = v.category || getVesselCategory(v.type || v.shipType);
                    const catColor = {
                      cargo: "#5EE7FF",
                      tanker: "#FFB547",
                      passenger: "#A78BFA",
                      tug: "#FBBF24",
                      fishing: "#34D399",
                      other: "#94A3B8",
                    }[cat] || "#94A3B8";

                    const isEstimated = v.source === "estimated";
                    const minutesAgo = v.last_report_at
                      ? Math.max(0, Math.round((Date.now() - v.last_report_at) / 60000))
                      : null;

                    return (
                      <tr
                        key={v.id}
                        onClick={() => live.setSelectedVessel(v)}
                        className="cursor-pointer hover:bg-white/[0.04] transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <span className="text-base">{v.flag || "🚢"}</span>
                            <span className="hover:text-accent transition">{v.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-ink-2">{v.mmsi}</td>
                        <td className="px-4 py-3 capitalize font-sans">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium border border-white/10">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                            {cat}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          <span className="font-semibold text-ink">
                            {v.sog != null ? `${v.sog.toFixed(1)} kn` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-2">
                            <Compass className="h-3 w-3 text-accent" />
                            {formatCourse(v.cog)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {v.portName ? (
                            <span className="inline-flex items-center gap-1 font-sans text-ink">
                              <span>{PORT_FLAGS[v.portId || ""] || "📍"}</span>
                              <span>{v.portName}</span>
                            </span>
                          ) : (
                            <span className="text-ink-3 italic font-sans">Open Sea Corridor</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isEstimated ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[10px] text-amber-300 font-mono border border-amber-400/25" title={`Confidence: ${Math.round((v.confidence ?? 0.8) * 100)}% · Last report ${minutesAgo ?? "?"}m ago`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Estimated ~ ({Math.round((v.confidence ?? 0.8) * 100)}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34D399]/12 px-2.5 py-0.5 text-[10px] text-[#34D399] font-mono border border-[#34D399]/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] animate-pulse" />
                              Live AIS
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isStationary ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBBF24]/12 px-2.5 py-0.5 text-[10px] text-[#FBBF24] font-mono border border-[#FBBF24]/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#FBBF24] animate-pulse" />
                              Anchored
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34D399]/12 px-2.5 py-0.5 text-[10px] text-[#34D399] font-mono border border-[#34D399]/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
                              Underway
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              live.setSelectedVessel(v);
                            }}
                            className="text-xs font-mono font-medium text-accent hover:underline cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-ink-3 font-mono">
                      No vessels found matching your active filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Minimal Pagination Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs font-mono text-ink-3">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, sortedVessels.length)} of {sortedVessels.length.toLocaleString()} vessels
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10 text-ink-2 disabled:opacity-30 transition cursor-pointer"
              >
                <ChevronLeft className="h-3 w-3" /> Previous
              </button>
              <span className="px-2 font-semibold text-ink">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10 text-ink-2 disabled:opacity-30 transition cursor-pointer"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Transparency / Honesty Disclaimer Note */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-ink-3">
            <span>Free AIS covers coastal areas; open-ocean positions are estimated from last report and route.</span>
            <span className="text-[10px] text-ink-3/70">WGS-84 Projection · Real-time Stream</span>
          </div>
        </div>
      </section>

      {/* 5. METHODOLOGY TEASER & CALM FOOTER */}
      <section className="border-t border-white/10 pt-16 sm:pt-20 text-center space-y-6">
        <h2 className="text-3xl sm:text-5xl font-semibold text-ink tracking-[-0.03em]">
          One ocean. Connected intelligence.
        </h2>
        <p className="text-base sm:text-lg text-ink-2 max-w-2xl mx-auto leading-relaxed">
          Algorithmic corridor indexing evaluates stationary dwell ratios against moving approach vectors within 25km tactical radii.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/methodology"
            className="rounded-full bg-accent px-6 py-2.5 text-xs font-semibold text-black hover:bg-accent/90 transition shadow-[0_0_16px_rgba(94,231,255,0.25)] cursor-pointer"
          >
            Explore Methodology
          </Link>
          <Link
            to="/compare"
            className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-semibold text-ink hover:bg-white/10 transition cursor-pointer"
          >
            Compare Port Corridors
          </Link>
        </div>

        <div className="pt-16 pb-8 text-xs font-mono text-ink-3">
          Global Maritime Tactical Port Monitor · 25km Spatial Grid · UTC Zulu Telemetry Synced
        </div>
      </section>

      {/* Vessel Details & Gemini AI Assistant Modal */}
      <VesselDetailModal
        vessel={live.selectedVessel}
        onClose={() => live.setSelectedVessel(null)}
      />
    </div>
  );
}