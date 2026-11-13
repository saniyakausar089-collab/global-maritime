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

// Futuristic Glowing SVG Sparkline with Area Fill
function Sparkline({ data, color = "#00f3ff", height = 28 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPoints = `${points} ${width},${height} 0,${height}`;
  const gradId = `spark-${Math.random().toString(36).substr(2, 6)}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-7 overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradId})`} points={areaPoints} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// Tactical Radar Arc Congestion Gauge with Dual HUD Rings
function RadialGauge({
  value,
  max = 2.0,
  size = 140,
  strokeWidth = 10,
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

  const color = value > 1.2 ? "#ff3b5c" : value > 1.0 ? "#ffaa00" : "#00ffc6";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer Tactical Reticle Ring */}
      <svg width={size + 14} height={size + 14} className="absolute inset-[-7px] transform -rotate-125 pointer-events-none opacity-40">
        <circle
          cx={(size + 14) / 2}
          cy={(size + 14) / 2}
          r={radius + 6}
          stroke="#00f3ff"
          strokeWidth="1"
          fill="none"
          strokeDasharray="2 4"
        />
      </svg>

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
        <span className="text-3xl font-bold tabular-nums text-white tracking-tight font-mono">
          {value.toFixed(2)}
        </span>
        <span className="text-[9px] text-cyan-400 font-mono tracking-widest uppercase font-bold">
          CI INDEX
        </span>
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

  const { underwayCount, anchoredCount, fastCount } = useMemo(() => {
    let underway = 0;
    let anchored = 0;
    let fast = 0;
    (live.vessels || []).forEach((v) => {
      const sog = v.sog ?? 0;
      if (sog >= 14) fast++;
      if (sog >= 0.5) underway++;
      else anchored++;
    });
    return { underwayCount: underway, anchoredCount: anchored, fastCount: fast };
  }, [live.vessels]);

  const toggleSort = (key: TableSortKey) => {
    setTableSort((prev) => ({
      key,
      dir: prev.key === key ? ((prev.dir * -1) as 1 | -1) : 1,
    }));
  };

  const totalVesselsCount = live.totalVesselsCount || live.vessels?.length || 14070;

  return (
    <div className="space-y-12 sm:space-y-16 max-w-[1360px] mx-auto py-4 sm:py-8">
      {q.data?.source === "fallback" && (
        <FallbackBanner reason={q.data.fallbackReason} />
      )}

      {/* 1. TACTICAL STATUS TICKER / MARQUEE RIBBON */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 rounded-xl bg-[#0B0E14]/90 border border-cyan-500/20 text-xs font-mono backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 relative">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ffc6] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00ffc6]" />
          </span>
          <span className="text-white font-bold tracking-wider">DEFCON 1 TELEMETRY</span>
          <span className="text-cyan-500/30">|</span>
          <span className="text-slate-400 hidden sm:inline">COVERAGE: 6 GLOBAL STRATEGIC CORRIDORS</span>
          <span className="text-cyan-500/30 hidden sm:inline">|</span>
          <span className="text-cyan-300">SPATIAL RADII: 25KM TACTICAL</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <Link
            to="/weather"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all font-sans text-xs font-semibold"
          >
            <CloudSun className="h-3.5 w-3.5" />
            <span>Weather & Marine</span>
          </Link>
          <span className="text-[10px] uppercase font-bold text-cyan-400">DATUM:</span>
          <span className="text-slate-300">WGS-84 MERCATOR</span>
        </div>
      </div>

      {/* 2. COMMAND HERO SECTION: Cinematic Bold Statement & Tactical Fleet Metrics */}
      <section className="relative space-y-6 sm:space-y-8">
        <div className="hero-radial-bloom absolute -top-24 left-1/2 -translate-x-1/2 w-[850px] h-[380px] pointer-events-none" />

        <div className="relative space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-medium shadow-[0_0_12px_rgba(0,243,255,0.2)]">
            <Radio className="h-3.5 w-3.5 animate-pulse text-[#00f3ff]" />
            <span>GLOBAL MARITIME SURVEILLANCE &amp; FLEET INTELLIGENCE</span>
          </div>

          <h1 className="text-gradient-cyan text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-bold tracking-[-0.035em] leading-[1.08] tabular-nums font-sans">
            <AnimatedCounter value={live.liveCount} /> vessels live. {ports.length || 6} strategic ports.
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-3xl font-normal leading-relaxed">
            Real-time AIS transponder stream, strategic anchorage congestion indexing, and automated corridor dwell monitoring.
          </p>

          {/* Real-time Fleet Telemetry Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-cyan-500/25 flex items-center gap-2 text-white shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#00ffc6]" />
              <span className="text-slate-400">Underway:</span>
              <span className="font-bold text-[#00ffc6]">{underwayCount.toLocaleString()}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-cyan-500/25 flex items-center gap-2 text-white shadow-sm">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-slate-400">At Anchor:</span>
              <span className="font-bold text-amber-300">{anchoredCount.toLocaleString()}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-cyan-500/25 flex items-center gap-2 text-white shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#00f3ff]" />
              <span className="text-slate-400">Fast Transit (&gt;14 kn):</span>
              <span className="font-bold text-[#00f3ff]">{fastCount.toLocaleString()}</span>
            </div>
            {live.estimatedCount > 0 && (
              <div className="px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-cyan-500/25 flex items-center gap-2 text-white shadow-sm">
                <span className="h-2 w-2 rounded-full border border-amber-400" />
                <span className="text-slate-400">Oceanic Estimated:</span>
                <span className="font-bold text-amber-300">+{live.estimatedCount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. FOUR TACTICAL STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Monitored Hubs */}
          <div className="relative rounded-2xl bg-[#0B0E14]/90 border border-cyan-500/25 p-5 flex flex-col justify-between card-hover-lift shadow-[0_12px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl group">
            <div className="pointer-events-none absolute top-1.5 right-1.5 text-cyan-400/40 font-mono text-[10px] select-none">┼</div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">Operational Hubs</span>
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold text-[#00ffc6] bg-[#00ffc6]/15 border border-[#00ffc6]/30 shadow-[0_0_8px_rgba(0,255,198,0.2)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00ffc6]" />
                100% ONLINE
              </span>
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold font-mono tabular-nums text-white tracking-tight">
                {ports.length || 6}
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">Strategic maritime choke-points</p>
            </div>
            <Sparkline data={[1, 1, 1, 1, 1, 1, 1]} color="#00ffc6" />
          </div>

          {/* Card 2: Peak Congestion Port */}
          <div className="relative rounded-2xl bg-[#0B0E14]/90 border border-cyan-500/25 p-5 flex flex-col justify-between card-hover-lift shadow-[0_12px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl group">
            <div className="pointer-events-none absolute top-1.5 right-1.5 text-cyan-400/40 font-mono text-[10px] select-none">┼</div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">Peak Congestion Point</span>
              {busiest && (
                <span className="text-xl" title={busiest.name}>
                  {PORT_FLAGS[busiest.id] || "⚓"}
                </span>
              )}
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold font-mono tracking-tight text-white truncate">
                {busiest ? busiest.name.split(" ")[0] : "Normal"}
              </div>
              <p className="text-[11px] font-mono text-rose-300 mt-0.5 flex items-center gap-1">
                <span>CI Index:</span>
                <strong className="text-white font-bold">{busiest?.congestion_index != null ? busiest.congestion_index.toFixed(2) : "Nominal"}</strong>
                <span>(Queue Alert)</span>
              </p>
            </div>
            <Sparkline data={[0.95, 1.05, 1.15, 1.25, 1.35, 1.4]} color="#ff3b5c" />
          </div>

          {/* Card 3: Hubs Above 1.20 Baseline */}
          <div className="relative rounded-2xl bg-[#0B0E14]/90 border border-cyan-500/25 p-5 flex flex-col justify-between card-hover-lift shadow-[0_12px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl group">
            <div className="pointer-events-none absolute top-1.5 right-1.5 text-cyan-400/40 font-mono text-[10px] select-none">┼</div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">Above 1.20 Baseline</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                  congested > 0
                    ? "text-rose-400 bg-rose-500/15 border border-rose-500/35 shadow-[0_0_8px_rgba(255,59,92,0.2)]"
                    : "text-[#00ffc6] bg-[#00ffc6]/15 border border-[#00ffc6]/35 shadow-[0_0_8px_rgba(0,255,198,0.2)]"
                }`}
              >
                {congested > 0 ? "ALERT" : "STABLE"}
              </span>
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold font-mono tabular-nums text-white tracking-tight">
                {congested} <span className="text-sm font-normal text-slate-400">/ {ports.length || 6} hubs</span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">Anchorage queue &gt; 20% over baseline</p>
            </div>
            <Sparkline data={[0, 1, 1, 2, 1, Math.max(1, congested)]} color="#ffaa00" />
          </div>

          {/* Card 4: Live AIS vessels */}
          <div className="relative rounded-2xl bg-[#0B0E14]/90 border border-cyan-500/25 p-5 flex flex-col justify-between card-hover-lift shadow-[0_12px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl group">
            <div className="pointer-events-none absolute top-1.5 right-1.5 text-cyan-400/40 font-mono text-[10px] select-none">┼</div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">Live AIS Telemetry</span>
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold text-[#00f3ff] bg-cyan-500/15 border border-cyan-500/35 shadow-[0_0_8px_rgba(0,243,255,0.2)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00f3ff] animate-pulse" />
                {live.isDemoMode ? "DEMO DATA" : live.status === "live" ? "REAL-TIME AIS" : "CONNECTING"}
              </span>
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold font-mono tabular-nums text-white tracking-tight">
                <AnimatedCounter value={live.liveCount} />
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                {live.estimatedCount > 0 ? `+ ${live.estimatedCount.toLocaleString()} estimated at sea` : "100% direct feed"}
              </p>
            </div>
            <Sparkline data={[live.liveCount - 15, live.liveCount - 8, live.liveCount, live.liveCount + 2, live.liveCount]} color="#00f3ff" />
          </div>
        </div>
      </section>

      {/* 4. THE MAP CENTERPIECE: Tactical Radar Viewport */}
      <section className="relative space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="h-2 w-2 rounded-full bg-[#00f3ff] animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-white">INTERACTIVE TACTICAL RADAR VIEWPORT</span>
            <span className="text-slate-500 hidden md:inline">·</span>
            <span className="text-slate-400 hidden md:inline">REAL-TIME AIS SATELLITE RELAY &amp; SEA CORRIDOR TRACKS</span>
          </div>
          <span className="text-[11px] font-mono text-cyan-400 hidden sm:inline">
            CLICK ANY VESSEL OR PORT TO INSPECT DOSSIER
          </span>
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

      {/* 5. PORT CONGESTION: Tactical Approach Corridors Bento Grid (12-col) */}
      <section className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono font-semibold mb-1.5">
            CORRIDOR SURVEILLANCE BAY
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-[-0.02em] font-sans">
            Strategic Approach Corridors &amp; Choke-Points
          </h2>
          <p className="text-xs sm:text-sm font-mono text-slate-400 mt-1">
            Congestion Index (CI) evaluated across 25km tactical radii. Ratios above 1.20 denote anchorage queue bottlenecks.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4 sm:gap-5">
          {/* Double-size Hero Bento Tile for the most congested port */}
          {busiest && (
            <div
              onClick={() => handleSelectPort(busiest)}
              className="col-span-12 lg:col-span-7 rounded-2xl p-6 sm:p-7 cursor-pointer relative overflow-hidden flex flex-col justify-between group border border-cyan-500/35 bg-gradient-to-b from-[#0E131C] to-[#0A0D14] hover:border-cyan-400 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(0,243,255,0.15)] transition-all card-hover-lift"
            >
              <div className="pointer-events-none absolute top-2 right-2 text-cyan-400/40 font-mono text-xs select-none">┌┐</div>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30">{PORT_FLAGS[busiest.id] || "⚓"}</span>
                    <div>
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                        TACTICAL CORRIDOR PRIORITY
                      </span>
                      <h3 className="text-2xl font-bold text-white group-hover:text-[#00f3ff] transition-colors font-sans mt-0.5">
                        {busiest.name}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        {busiest.lat.toFixed(3)}°N, {busiest.lon.toFixed(3)}°E · Strategic Anchorage Sector
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 font-mono">
                    <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/35 shadow-[0_0_10px_rgba(255,59,92,0.25)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                      Highest Congestion Point
                    </span>
                    <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                      Queue Delay Bottleneck
                    </span>
                  </div>
                </div>

                {/* Radial Gauge Visual */}
                <div className="flex justify-center sm:justify-end">
                  <RadialGauge value={busiest.congestion_index ?? 1.4} size={140} strokeWidth={10} />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <span className="text-slate-400">
                  Stationary vs underway dwell: <strong className="text-white font-bold">Critical Bottleneck</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPort(busiest);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-[#0B0E14] text-slate-300 hover:text-[#00f3ff] hover:border-cyan-500/60 transition cursor-pointer"
                  >
                    <Navigation className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Focus Radar</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate({ to: "/ports/$id", params: { id: busiest.id } });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#00f3ff] to-[#0284c7] px-4 py-1.5 text-xs font-bold text-black hover:opacity-95 transition shadow-[0_0_15px_rgba(0,243,255,0.4)] cursor-pointer tracking-wider"
                  >
                    <span>Dossier Deep Dive</span>
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
              const statusColor = ci > 1.2 ? "#ff3b5c" : ci > 1.0 ? "#ffaa00" : "#00ffc6";

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPort(p)}
                  className={`col-span-12 sm:col-span-6 lg:col-span-5 xl:col-span-4 rounded-2xl p-5 sm:p-6 cursor-pointer flex flex-col justify-between group transition-all card-hover-lift border bg-[#0B0E14]/90 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.8)] ${
                    isSelected ? "border-cyan-400 bg-cyan-950/20 shadow-[0_0_20px_rgba(0,243,255,0.25)]" : "border-cyan-500/20 hover:border-cyan-500/50"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">{flag}</span>
                        <div>
                          <h4 className="font-bold text-base text-white group-hover:text-[#00f3ff] transition-colors font-sans">
                            {p.name}
                          </h4>
                          <p className="text-[11px] font-mono text-slate-400">
                            {p.lat.toFixed(3)}°N, {p.lon.toFixed(3)}°E
                          </p>
                        </div>
                      </div>
                      <StatusBadge ci={p.congestion_index} />
                    </div>

                    {/* CI Number & Flow Indicator */}
                    <div className="mt-4 flex items-baseline justify-between font-mono">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-bold">
                          CONGESTION INDEX
                        </span>
                        <span className="text-2xl font-bold tabular-nums text-white">
                          {p.congestion_index != null ? p.congestion_index.toFixed(2) : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-slate-400 block font-bold">
                          APPROACH FLOW
                        </span>
                        <span className="text-xs font-semibold" style={{ color: statusColor }}>
                          {ci > 1.2 ? "Congested Queue" : ci > 1.0 ? "Moderate Rate" : "Optimal Flow"}
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

                  <div className="mt-5 pt-3 border-t border-cyan-500/15 flex items-center justify-between text-xs font-mono">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPort(p);
                      }}
                      className="text-slate-400 group-hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Navigation className="h-3 w-3 text-cyan-400" />
                      <span>Focus Radar</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ to: "/ports/$id", params: { id: p.id } });
                      }}
                      className="text-[#00f3ff] hover:text-white font-medium text-[11px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Deep Dive</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* 6. LIVE FLEET TABLE: Precision Military Intelligence Terminal */}
      <section className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono font-semibold mb-1.5">
            SURVEILLANCE REGISTRY
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-[-0.02em] font-sans">
            Tracked Commercial Fleet Telemetry
          </h2>
          <p className="text-xs sm:text-sm font-mono text-slate-400 mt-1">
            Real-time AIS speed-over-ground, course, draft, and station-keeping across all monitored approach routes.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-500/25 bg-[#0B0E14]/90 p-5 sm:p-6 space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          {/* Controls: Search with '/' shortcut hint, Category Pills & Export */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-cyan-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by vessel name, MMSI, or callsign..."
                value={live.searchQuery}
                onChange={(e) => {
                  live.setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-cyan-500/30 bg-[#07090E] pl-10 pr-12 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#00f3ff] focus:ring-1 focus:ring-[#00f3ff] font-mono transition shadow-inner"
              />
              <span className="absolute right-3.5 top-2.5 text-[10px] font-mono text-cyan-300 border border-cyan-500/30 rounded px-1.5 py-0.5 bg-cyan-500/10 pointer-events-none">
                /
              </span>
            </div>

            {/* Category Filter Pills with colored dots */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
              {[
                { id: "all", label: "All Fleet", dotColor: "#F4F7FB" },
                { id: "cargo", label: "Cargo", dotColor: "#00f3ff" },
                { id: "tanker", label: "Tanker", dotColor: "#fb923c" },
                { id: "passenger", label: "Passenger", dotColor: "#a78bfa" },
                { id: "tug", label: "Tug", dotColor: "#facc15" },
                { id: "fishing", label: "Fishing", dotColor: "#00ffc6" },
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
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-r from-[#00f3ff] to-[#0284c7] text-black font-bold shadow-[0_0_15px_rgba(0,243,255,0.4)]"
                        : "bg-[#07090E] text-slate-300 hover:text-white hover:bg-cyan-500/10 border border-cyan-500/25"
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? "#000" : cat.dotColor }}
                    />
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] font-mono rounded px-1.5 py-0.2 ${
                        isSelected ? "bg-black/20 text-black font-bold" : "bg-white/10 text-slate-400"
                      }`}
                    >
                      {count.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Export CSV & Clear Port Filter */}
            <div className="flex items-center gap-2 font-mono">
              {live.selectedPortId && (
                <button
                  onClick={() => live.setSelectedPortId(null)}
                  className="rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs text-[#00f3ff] hover:bg-cyan-500/25 transition cursor-pointer"
                >
                  Clear Port Filter ✕
                </button>
              )}
              <button
                onClick={() => downloadCsv("vessels-live-export.csv", sortedVessels)}
                disabled={!sortedVessels.length}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-[#07090E] px-3.5 py-1.5 text-xs text-slate-300 hover:text-[#00f3ff] hover:border-cyan-500/60 disabled:opacity-40 transition cursor-pointer shadow-sm"
                title="Download CSV"
              >
                <Download className="h-3.5 w-3.5 text-cyan-400" /> Export CSV
              </button>
            </div>
          </div>

          {/* Borderless High-Tech Table */}
          <div className="overflow-x-auto rounded-xl border border-cyan-500/20 bg-[#07090E]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0B0E14] text-[11px] uppercase tracking-wider text-slate-400 border-b border-cyan-500/20">
                <tr>
                  <th
                    onClick={() => toggleSort("name")}
                    className="px-4 py-3 cursor-pointer hover:text-[#00f3ff] transition"
                  >
                    <span className="flex items-center gap-1">
                      Vessel Name
                      <ArrowUpDown className="h-3 w-3 text-cyan-400" />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("mmsi")}
                    className="px-4 py-3 cursor-pointer hover:text-[#00f3ff] transition"
                  >
                    <span className="flex items-center gap-1">
                      MMSI
                      <ArrowUpDown className="h-3 w-3 text-cyan-400" />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("type")}
                    className="px-4 py-3 cursor-pointer hover:text-[#00f3ff] transition"
                  >
                    <span className="flex items-center gap-1">
                      Category
                      <ArrowUpDown className="h-3 w-3 text-cyan-400" />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("sog")}
                    className="px-4 py-3 cursor-pointer hover:text-[#00f3ff] transition"
                  >
                    <span className="flex items-center gap-1">
                      Speed (SOG)
                      <ArrowUpDown className="h-3 w-3 text-cyan-400" />
                    </span>
                  </th>
                  <th className="px-4 py-3">Course (COG)</th>
                  <th
                    onClick={() => toggleSort("portName")}
                    className="px-4 py-3 cursor-pointer hover:text-[#00f3ff] transition"
                  >
                    <span className="flex items-center gap-1">
                      Corridor Sector
                      <ArrowUpDown className="h-3 w-3 text-cyan-400" />
                    </span>
                  </th>
                  <th className="px-4 py-3">Telemetry Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Intel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {paginatedVessels.length > 0 ? (
                  paginatedVessels.map((v) => {
                    const isStationary = (v.sog ?? 0) < 0.5;
                    const cat = v.category || getVesselCategory(v.type || v.shipType);
                    const catColor = {
                      cargo: "#00f3ff",
                      tanker: "#fb923c",
                      passenger: "#a78bfa",
                      tug: "#facc15",
                      fishing: "#00ffc6",
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
                        className="cursor-pointer hover:bg-cyan-500/[0.06] transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <span className="text-base">{v.flag || "🚢"}</span>
                            <span className="hover:text-[#00f3ff] transition">{v.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-300 font-mono">{v.mmsi}</td>
                        <td className="px-4 py-3 capitalize font-mono">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B0E14] px-2.5 py-0.5 text-[11px] font-medium border border-cyan-500/20">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                            {cat}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums font-mono">
                          <span className="font-semibold text-white">
                            {v.sog != null ? `${v.sog.toFixed(1)} kn` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300">
                            <Compass className="h-3 w-3 text-cyan-400" />
                            {formatCourse(v.cog)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {v.portName ? (
                            <span className="inline-flex items-center gap-1 font-mono text-white">
                              <span>{PORT_FLAGS[v.portId || ""] || "📍"}</span>
                              <span>{v.portName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 italic font-mono">Open Sea Corridor</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isEstimated ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-0.5 text-[10px] text-amber-300 font-mono border border-amber-400/30" title={`Confidence: ${Math.round((v.confidence ?? 0.8) * 100)}% · Last report ${minutesAgo ?? "?"}m ago`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Estimated ~ ({Math.round((v.confidence ?? 0.8) * 100)}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#00ffc6]/15 px-2.5 py-0.5 text-[10px] text-[#00ffc6] font-mono border border-[#00ffc6]/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#00ffc6] animate-pulse" />
                              Live AIS
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isStationary ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-2.5 py-0.5 text-[10px] text-amber-300 font-mono border border-amber-400/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Anchored
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#00ffc6]/15 px-2.5 py-0.5 text-[10px] text-[#00ffc6] font-mono border border-[#00ffc6]/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#00ffc6]" />
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
                            className="text-xs font-mono font-bold text-[#00f3ff] hover:underline cursor-pointer"
                          >
                            Inspect Dossier
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500 font-mono">
                      No vessels found matching your active filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tactical Pagination Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs font-mono text-slate-400">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, sortedVessels.length)} of {sortedVessels.length.toLocaleString()} vessels
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 rounded-xl border border-cyan-500/25 bg-[#07090E] px-3.5 py-1.5 text-xs hover:border-cyan-500/50 hover:text-white text-slate-300 disabled:opacity-30 transition cursor-pointer"
              >
                <ChevronLeft className="h-3 w-3" /> Previous
              </button>
              <span className="px-2 font-bold text-white">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 rounded-xl border border-cyan-500/25 bg-[#07090E] px-3.5 py-1.5 text-xs hover:border-cyan-500/50 hover:text-white text-slate-300 disabled:opacity-30 transition cursor-pointer"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Transparency / Honesty Disclaimer Note */}
          <div className="pt-2 border-t border-cyan-500/15 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Free coastal AIS covers monitored littoral sectors; open-ocean positions are estimated via dead-reckoning kinematics.</span>
            <span className="text-[10px] text-cyan-400">WGS-84 Projection · Real-time Stream</span>
          </div>
        </div>
      </section>

      {/* 7. METHODOLOGY & CONNECTED INTELLIGENCE FOOTER */}
      <section className="border-t border-cyan-500/20 pt-12 sm:pt-16 text-center space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-medium">
          <Anchor className="h-3.5 w-3.5 text-[#00f3ff]" />
          <span>CONNECTED GLOBAL INTELLIGENCE</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-[-0.03em] font-sans">
          One Ocean. Connected Intelligence.
        </h2>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed font-mono">
          Algorithmic corridor indexing evaluates stationary dwell ratios against moving approach vectors within 25km tactical radii.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 font-mono">
          <Link
            to="/methodology"
            className="rounded-xl bg-gradient-to-r from-[#00f3ff] to-[#0284c7] px-6 py-2.5 text-xs font-bold text-black hover:opacity-95 transition shadow-[0_0_20px_rgba(0,243,255,0.35)] cursor-pointer tracking-wider"
          >
            Explore Methodology
          </Link>
          <Link
            to="/compare"
            className="rounded-xl border border-cyan-500/30 bg-[#0B0E14] px-6 py-2.5 text-xs font-semibold text-white hover:border-cyan-500/60 hover:bg-cyan-500/10 transition cursor-pointer"
          >
            Compare Port Corridors
          </Link>
        </div>

        <div className="pt-10 pb-6 text-xs font-mono text-slate-500">
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