import { VesselDetailModal } from "@/components/VesselDetailModal";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Download,
  Ship,
  Anchor,
  Compass,
  Activity,
  Layers,
  Clock,
  Radio,
  ExternalLink,
  Search,
} from "lucide-react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MapView } from "@/components/MapView";
import {
  Card,
  Empty,
  FallbackBanner,
  RefreshControl,
  Skeleton,
  StatusBadge,
} from "@/components/ui-bits";
import {
  API_BASE_URL,
  downloadCsv,
  historyQuery,
  median,
  portsQuery,
  STATUS_LABEL,
  statusOf,
  vesselsQuery,
  type Vessel,
} from "@/lib/api";
import { useLiveVessels, type LiveVessel } from "@/lib/useLiveVessels";

const PORT_FLAGS: Record<string, string> = {
  rotterdam: "🇳🇱",
  singapore: "🇸🇬",
  shanghai: "🇨🇳",
  "los-angeles": "🇺🇸",
  hamburg: "🇩🇪",
  santos: "🇧🇷",
};

export const Route = createFileRoute("/ports/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id.toUpperCase()} — Tactical Port Intelligence · Global Maritime` },
      {
        name: "description",
        content: `Live AIS vessels, 48-hour anchorage history and congestion intelligence for ${params.id}.`,
      },
      { property: "og:title", content: `${params.id.toUpperCase()} — Tactical Port Intelligence` },
      {
        property: "og:description",
        content: `Live AIS vessels, 48-hour anchorage history and congestion intelligence for ${params.id}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortDetail,
});

function PortDetail() {
  const { id } = Route.useParams();
  const ports = useQuery(portsQuery());
  const vessels = useQuery(vesselsQuery(id));
  const history = useQuery(historyQuery(id));
  const live = useLiveVessels();

  const port = useMemo(() => {
    const lp = live.livePorts?.find((p) => p.id === id);
    if (lp) return lp;
    return ports.data?.data.find((p) => p.id === id);
  }, [live.livePorts, ports.data?.data, id]);
  const flag = PORT_FLAGS[id] || "⚓";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "stationary" | "moving">("all");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");

  // Get live vessels for this port from WebSocket relay; fallback to REST query data if WS empty
  const livePortVessels = useMemo(() => {
    if (port) {
      const k = Math.cos((port.lat * Math.PI) / 180);
      const nearby = live.vesselsList.filter((v) => {
        const dy = (v.lat - port.lat) * 111.32;
        const dx = (v.lon - port.lon) * 111.32 * k;
        return dx * dx + dy * dy <= 50 * 50; // within 50km radius of port
      });
      if (nearby.length > 0) return nearby;
    }
    const list = live.vesselsList.filter((v) => v.portId === id);
    if (list.length > 0) return list;

    // Map REST vessels to LiveVessel format
    return (vessels.data?.data ?? []).map((v) => ({
      id: v.mmsi,
      mmsi: v.mmsi,
      name: v.ship_name || `VESSEL-${v.mmsi}`,
      ship_name: v.ship_name || `VESSEL-${v.mmsi}`,
      lat: v.lat,
      lon: v.lon,
      sog: v.sog,
      cog: 0,
      hdg: 0,
      heading: 0,
      navStatus: v.stationary ? 1 : 0,
      stationary: v.stationary,
      shipType: 0,
      shipTypeLabel: "Vessel",
      lastSeen: Date.now(),
      portId: id,
      portName: port?.name,
    })) as unknown as LiveVessel[];
  }, [live.vesselsList, id, vessels.data?.data, port]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return livePortVessels
      .filter((v) =>
        filter === "all" ? true : filter === "stationary" ? v.stationary : !v.stationary,
      )
      .filter((v) => !s || (v.ship_name || v.name)?.toLowerCase().includes(s) || String(v.mmsi).includes(s))
      .sort((a, b) => (a.sog - b.sog) * dir);
  }, [livePortVessels, search, filter, dir]);

  const hist = history.data?.data ?? [];
  const med = median(hist.map((h) => h.stationary));
  const peak = hist.length ? Math.max(...hist.map((h) => h.stationary)) : 0;
  const fallback = [ports.data, vessels.data, history.data].find((d) => d?.source === "fallback");
  const ci = port?.congestion_index ?? null;

  const stationaryCount = livePortVessels.filter((v) => v.stationary || (v.sog ?? 0) < 0.5).length;
  const underwayCount = livePortVessels.length - stationaryCount;

  return (
    <div className="space-y-6">
      {/* Back Link & Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/overview"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-cyan-400 transition"
        >
          <ArrowLeft className="h-4 w-4" /> &larr; Return to Tactical Overview
        </Link>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>PORT TELEMETRY ACTIVE</span>
        </div>
      </div>

      {/* Header Hub Profile */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-[#0d1829]/90 via-[#0a1424]/90 to-[#0e1e36]/90 p-4.5 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-3xl shadow-inner">
            {flag}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-sans">
                {port?.name ?? id}
              </h1>
              <StatusBadge ci={ci} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
              <span>Sector Status: <strong className="text-foreground">{STATUS_LABEL[statusOf(ci)]}</strong></span>
              <span>·</span>
              <span>Coordinates: <strong className="text-cyan-400">{port ? `${port.lat.toFixed(2)}°N, ${port.lon.toFixed(2)}°E` : "—"}</strong></span>
              <span>·</span>
              <span>Sector Basin: <strong className="text-foreground">50km Approach Box</strong></span>
            </div>
          </div>
        </div>
        <RefreshControl updatedAt={vessels.data?.fetchedAt} />
      </div>

      {fallback && live.status === "offline" && <FallbackBanner error={fallback.error} />}

      {/* 4 Sector KPI Micro-Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono">
        <Card className="p-3.5 border-border/80 bg-card/80 after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] after:bg-cyan-400 relative overflow-hidden">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Congestion Index</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold ${(ci ?? 0) > 1.2 ? "text-[#FF5577]" : (ci ?? 0) > 1.0 ? "text-[#FFB547]" : "text-[#18D69B]"}`}>
              {ci != null ? ci.toFixed(2) : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground">baseline 1.00</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground truncate">Ratio of stationary to moving traffic</p>
        </Card>

        <Card className="p-3.5 border-border/80 bg-card/80 after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] after:bg-amber-400 relative overflow-hidden">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Anchored / In Roads</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-400">{stationaryCount}</span>
            <span className="text-[10px] text-muted-foreground">vessels</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground truncate">Speed &lt; 0.5 knots in approach roads</p>
        </Card>

        <Card className="p-3.5 border-border/80 bg-card/80 after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] after:bg-emerald-400 relative overflow-hidden">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Underway &amp; Maneuvering</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-400">{underwayCount}</span>
            <span className="text-[10px] text-muted-foreground">vessels</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground truncate">Active pilotage or fairway transit</p>
        </Card>

        <Card className="p-3.5 border-border/80 bg-card/80 after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] after:bg-blue-400 relative overflow-hidden">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">48h Historical Peak</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground">{peak}</span>
            <span className="text-[10px] text-muted-foreground">max queue</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground truncate">Median stationary: {med ?? "—"}</p>
        </Card>
      </div>

      {/* Geospatial Sector Visualizer Terminal */}
      <Card className="p-3 border-cyan-500/30 bg-[#080F20] shadow-2xl rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3 mb-2 px-1">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
            <h2 className="text-xs font-mono font-bold tracking-wider text-foreground uppercase">
              Sector Visualizer — {port?.name ?? id}
            </h2>
          </div>
          <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5 font-mono text-xs">
            <button
              onClick={() => setMapMode("2d")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                mapMode === "2d" ? "bg-cyan-500 text-black shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🗺️ 2D Live Vector Radar
            </button>
            <button
              onClick={() => setMapMode("3d")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                mapMode === "3d" ? "bg-cyan-500 text-black shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🌍 3D Cesium Digital Twin
            </button>
          </div>
        </div>

        {mapMode === "3d" ? (
          <iframe
            src={`${API_BASE_URL}/ports/${id}/globe-html`}
            className="h-[520px] w-full rounded-xl border-0 shadow-inner"
            title="3D Cesium Animated Globe"
          />
        ) : !port ? (
          <Skeleton className="h-[460px] w-full rounded-xl" />
        ) : (
          <div className="rounded-xl overflow-hidden border border-border/60">
            <MapView
              key={id}
              center={[port.lat, port.lon]}
              zoom={10}
              ports={[port]}
              vessels={livePortVessels}
              status={live.status}
              statusMessage={live.statusMessage}
              selectedVessel={live.selectedVessel}
              onSelectVessel={live.setSelectedVessel}
            />
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 px-2 pt-3 text-[11px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" /> Cargo
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" /> Tanker
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ec4899]" /> Passenger
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" /> Fast (&gt;14 kn)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-[#06b6d4]" /> Tug / Special
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-[#64748b] border border-white/60" /> Anchored (&lt;0.5 kn)
          </span>
        </div>
      </Card>

      {/* 48-Hour Hourly Queue Telemetry Chart */}
      <Card className="p-4 border-border/80">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="font-bold font-mono text-sm uppercase tracking-wide flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-cyan-400" />
              48-Hour Stationary Anchorage Queue Trend
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hourly aggregate of vessels delayed or waiting at anchor within port radar boundaries.
            </p>
          </div>
          <button
            disabled={!hist.length}
            onClick={() => downloadCsv(`${id}-history.csv`, hist)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-mono text-foreground hover:bg-secondary disabled:opacity-50 transition"
          >
            <Download className="h-3.5 w-3.5" /> Export History CSV
          </button>
        </div>

        {history.isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : !hist.length ? (
          <Empty text="Waiting for historical telemetry stream..." />
        ) : (
          <div className="h-64 font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hist}>
                <defs>
                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22D3EE" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: string) => h.slice(11, 16)}
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  minTickGap={30}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10, 20, 36, 0.95)",
                    border: "1px solid rgba(34, 211, 238, 0.4)",
                    borderRadius: 10,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="stationary"
                  name="Stationary Vessels"
                  stroke="#22D3EE"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#cyanGradient)"
                />
                {med != null && (
                  <ReferenceLine
                    y={med}
                    stroke="#FFB547"
                    strokeDasharray="6 4"
                    label={{
                      value: `Median: ${med}`,
                      fill: "#FFB547",
                      fontSize: 10,
                      position: "insideTopRight",
                      fontFamily: "monospace",
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Sector Live Vessel Telemetry Table */}
      <Card className="p-4 border-border/80 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold font-mono uppercase tracking-wide text-foreground">
              Sector Vessel Activity Matrix ({rows.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={!rows.length}
              onClick={() => downloadCsv(`${id}-vessels.csv`, rows)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-mono text-foreground hover:bg-secondary disabled:opacity-50 transition"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 font-mono">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by ship name or MMSI..."
              className="h-8.5 w-full rounded-lg border border-input bg-background/60 pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <div className="flex rounded-lg border border-border bg-secondary/40 p-0.5 text-xs">
            {(["all", "stationary", "moving"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs capitalize font-medium transition ${
                  filter === f
                    ? "bg-cyan-500 text-black font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {vessels.isLoading && !livePortVessels.length ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 rounded-lg" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="p-8 text-center text-xs font-mono text-muted-foreground">
            No vessels match the current search filter in this sector.
          </div>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-xl border border-border bg-card/40">
            <table className="w-full text-xs font-mono text-left">
              <thead className="sticky top-0 bg-secondary/80 text-[10px] uppercase text-muted-foreground border-b border-border backdrop-blur-md">
                <tr>
                  <th className="px-4 py-3">Ship Name</th>
                  <th className="px-4 py-3">MMSI</th>
                  <th className="px-4 py-3">
                    <button
                      onClick={() => setDir((d) => -d as 1 | -1)}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Speed (SOG) <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Operational State</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-muted-foreground">
                {rows.map((v) => {
                  const isStationary = v.stationary || (v.sog ?? 0) < 0.5;
                  return (
                    <tr
                      key={v.mmsi}
                      onClick={() => live.setSelectedVessel(v)}
                      className="cursor-pointer hover:bg-secondary/40 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-semibold text-foreground whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <Ship className="h-3.5 w-3.5 text-cyan-400" />
                          <span className="hover:text-cyan-400 transition">{v.ship_name || v.name || "—"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{v.mmsi}</td>
                      <td className="px-4 py-2.5 font-bold text-foreground">
                        {v.sog != null ? `${v.sog.toFixed(1)} kn` : "—"}
                      </td>
                      <td className="px-4 py-2.5 capitalize font-sans">
                        <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] border border-border/60">
                          {v.shipTypeLabel || "Vessel"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {isStationary ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-mono border border-amber-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Anchored (Roads)
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
                })}
              </tbody>
            </table>
          </div>
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
