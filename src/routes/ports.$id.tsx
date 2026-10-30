import { VesselDetailModal } from "@/components/VesselDetailModal";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpDown, Download, Ship } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
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

export const Route = createFileRoute("/ports/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Port detail · Port Monitor` },
      {
        name: "description",
        content: `Live vessels and hourly congestion history for port ${params.id}.`,
      },
      { property: "og:title", content: `${params.id} — Port detail` },
      {
        property: "og:description",
        content: `Live vessels and hourly congestion history for port ${params.id}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

  const port = ports.data?.data.find((p) => p.id === id);
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
    })) as LiveVessel[];
  }, [live.vesselsList, id, vessels.data?.data, port]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return livePortVessels
      .filter((v) =>
        filter === "all" ? true : filter === "stationary" ? v.stationary : !v.stationary,
      )
      .filter((v) => !s || v.ship_name?.toLowerCase().includes(s) || String(v.mmsi).includes(s))
      .sort((a, b) => (a.sog - b.sog) * dir);
  }, [livePortVessels, search, filter, dir]);

  const hist = history.data?.data ?? [];
  const med = median(hist.map((h) => h.stationary));
  const fallback = [ports.data, vessels.data, history.data].find((d) => d?.source === "fallback");
  const ci = port?.congestion_index ?? null;

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Overview
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{port?.name ?? id}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge ci={ci} />
            <span className="text-sm text-muted-foreground">
              Status: {STATUS_LABEL[statusOf(ci)]}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-mono text-muted-foreground">
              {livePortVessels.length} ships in sector
            </span>
          </div>
        </div>
        <RefreshControl updatedAt={vessels.data?.fetchedAt} />
      </div>
      {fallback && live.status === "offline" && <FallbackBanner error={fallback.error} />}

      <Card className="p-2">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-sm font-semibold tracking-wide">Maritime Visualizer</span>
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button
              onClick={() => setMapMode("2d")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${mapMode === "2d" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              🗺️ 2D Live Canvas Map
            </button>
            <button
              onClick={() => setMapMode("3d")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${mapMode === "3d" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              🌍 3D Cesium Globe
            </button>
          </div>
        </div>

        {mapMode === "3d" ? (
          <iframe
            src={`${API_BASE_URL}/ports/${id}/globe-html`}
            className="h-[520px] w-full rounded-lg border-0 shadow-inner"
            title="3D Cesium Animated Globe"
          />
        ) : !port ? (
          <Skeleton className="h-[400px] w-full" />
        ) : (
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
        )}
        <div className="flex flex-wrap gap-4 px-2 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3 w-3 rounded-full bg-[#10b981]" /> Cargo
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3 w-3 rounded-full bg-[#f59e0b]" /> Tanker
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3 w-3 rounded-full bg-[#ec4899]" /> Passenger
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3 w-3 rounded-full bg-[#8b5cf6]" /> Fast (&gt;14 kn)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3 w-3 rounded-full bg-[#06b6d4]" /> Tug / Special
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3 w-3 rounded-full bg-[#64748b] border border-white/60" /> Anchored (&lt;0.5 kn)
          </span>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Stationary vessels per hour</h2>
          <button
            disabled={!hist.length}
            onClick={() => downloadCsv(`${id}-history.csv`, hist)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
        {history.isLoading ? (
          <Skeleton className="h-64" />
        ) : !hist.length ? (
          <Empty text="Waiting for historical telemetry..." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={hist}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: string) => h.slice(11, 16)}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  minTickGap={30}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="stationary"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
                {med != null && (
                  <ReferenceLine
                    y={med}
                    stroke="var(--chart-3)"
                    strokeDasharray="6 4"
                    label={{
                      value: `median ${med}`,
                      fill: "var(--muted-foreground)",
                      fontSize: 11,
                      position: "insideTopRight",
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ship name or MMSI"
            className="h-9 min-w-[200px] flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex rounded-md border p-0.5">
            {(["all", "stationary", "moving"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1 text-xs capitalize ${filter === f ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            disabled={!rows.length}
            onClick={() => downloadCsv(`${id}-vessels.csv`, rows)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
        {vessels.isLoading && !livePortVessels.length ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="p-4">
            <Empty
              text={
                livePortVessels.length
                  ? "No vessels match your filters"
                  : "No live vessels reported in this port box yet"
              }
            />
          </div>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Ship</th>
                  <th className="px-4 py-2">MMSI</th>
                  <th className="px-4 py-2">
                    <button
                      onClick={() => setDir((d) => -d as 1 | -1)}
                      className="flex items-center gap-1"
                    >
                      Speed (kn) <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr
                    key={v.mmsi}
                    onClick={() => live.setSelectedVessel(v)}
                    className="cursor-pointer border-t hover:bg-secondary transition-colors"
                  >
                    <td className="px-4 py-2 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                        {v.ship_name || v.name || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-muted-foreground">{v.mmsi}</td>
                    <td className="px-4 py-2 font-mono">{v.sog.toFixed(1)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {v.shipTypeLabel || "Vessel"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs font-medium ${v.stationary ? "text-vessel-stationary" : "text-vessel-moving"}`}
                      >
                        {v.stationary ? "Stationary (Anchored)" : "Moving (Under Way)"}
                      </span>
                    </td>
                  </tr>
                ))}
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
