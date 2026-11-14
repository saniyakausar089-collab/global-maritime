import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpDown,
  ExternalLink,
  BarChart3,
  LineChart as LineChartIcon,
  Anchor,
  Info,
  Scale,
  Activity,
  Layers,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { Card, Empty, FallbackBanner, RefreshControl, Skeleton, StatusBadge } from "@/components/ui-bits";
import { historyQuery, median, portsQuery, type Port } from "@/lib/api";
import { useLiveVessels } from "@/lib/useLiveVessels";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Port Analytics & Benchmarking — Global Maritime" },
      {
        name: "description",
        content: "Multi-port cross-comparison, congestion benchmarking, and historical anchorage telemetry.",
      },
      { property: "og:title", content: "Compare Ports — Global Maritime" },
      {
        property: "og:description",
        content: "Multi-port cross-comparison, congestion benchmarking, and historical anchorage telemetry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Compare,
});

const PORT_FLAGS: Record<string, string> = {
  rotterdam: "🇳🇱",
  singapore: "🇸🇬",
  shanghai: "🇨🇳",
  "los-angeles": "🇺🇸",
  hamburg: "🇩🇪",
  santos: "🇧🇷",
};

const CHART_COLORS = ["#22D3EE", "#3978FF", "#FFB547", "#FF5577", "#A78BFA", "#18D69B"];

type PortSortKey = "name" | "ci";

function Compare() {
  const ports = useQuery(portsQuery());
  const live = useLiveVessels();
  const list = useMemo(() => {
    if (live.livePorts && live.livePorts.length > 0) return live.livePorts;
    return ports.data?.data ?? [];
  }, [live.livePorts, ports.data?.data]);
  const navigate = useNavigate();

  const [sel, setSel] = useState<string[]>([]);
  const [tableSort, setTableSort] = useState<{ key: PortSortKey; dir: 1 | -1 }>({
    key: "ci",
    dir: -1,
  });

  useEffect(() => {
    if (!sel.length && list.length >= 2) {
      setSel(list.slice(0, 3).map((p) => p.id));
    }
  }, [list, sel.length]);

  const hs = useQueries({ queries: sel.map((id) => historyQuery(id)) });
  const loading = hs.some((h) => h.isLoading);
  const fallback = [ports.data, ...hs.map((h) => h.data)].find((d) => d?.source === "fallback");

  // Normalized time-series data
  const timeSeriesData = useMemo(() => {
    const byHour = new Map<string, Record<string, number | string>>();
    sel.forEach((id, i) => {
      const h = hs[i]?.data?.data ?? [];
      const m = median(h.map((x) => x.stationary));
      if (!m) return;
      h.forEach((pt) => {
        const row = byHour.get(pt.hour) ?? { hour: pt.hour };
        row[id] = +(pt.stationary / m).toFixed(3);
        byHour.set(pt.hour, row);
      });
    });
    return [...byHour.values()].sort((a, b) => String(a["hour"]).localeCompare(String(b["hour"])));
  }, [sel, hs]);

  // Cross-port congestion bar chart data
  const barChartData = useMemo(() => {
    return list.map((p) => ({
      id: p.id,
      name: p.name,
      ci: p.congestion_index != null ? Number(p.congestion_index.toFixed(2)) : 0,
      hasCi: p.congestion_index != null,
    }));
  }, [list]);

  // Sortable ports list
  const sortedPorts = useMemo(() => {
    return [...list].sort((a, b) => {
      if (tableSort.key === "name") {
        return a.name.localeCompare(b.name) * tableSort.dir;
      }
      const av = a.congestion_index ?? -Infinity;
      const bv = b.congestion_index ?? -Infinity;
      return (av - bv) * tableSort.dir;
    });
  }, [list, tableSort]);

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));

  const name = (id: string) => list.find((p) => p.id === id)?.name ?? id;

  const toggleTableSort = (key: PortSortKey) => {
    setTableSort((s) => ({
      key,
      dir: s.key === key ? (-s.dir as 1 | -1) : -1,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header Profile */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-cyan-400" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-sans">
              Port Analytics &amp; Cross-Benchmarking
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-mono">
            Benchmark Congestion Index (CI), stationary queue density, and normalized anchorage turnaround across gateway hubs.
          </p>
        </div>
        <RefreshControl updatedAt={ports.data?.fetchedAt} />
      </div>

      {fallback && <FallbackBanner error={fallback.error} />}

      {/* 1. Comparison Cards for Monitored Hubs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => {
          const isSelected = sel.includes(p.id);
          const flag = PORT_FLAGS[p.id] || "⚓";
          const ci = p.congestion_index;

          return (
            <Card
              key={p.id}
              className={`p-3.5 border transition cursor-pointer relative overflow-hidden backdrop-blur-sm ${
                isSelected
                  ? "border-cyan-500 bg-cyan-950/20 shadow-cyan-500/10 shadow-md after:absolute after:top-0 after:left-0 after:right-0 after:h-[2px] after:bg-cyan-400"
                  : "border-border/80 bg-card/60 hover:bg-secondary/40 hover:border-border"
              }`}
              onClick={() => toggle(p.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{flag}</span>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{p.name}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {p.lat.toFixed(2)}°N, {p.lon.toFixed(2)}°E
                    </span>
                  </div>
                </div>
                <StatusBadge ci={ci} />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-border/60 font-mono">
                <span className="text-muted-foreground">
                  CI: <strong className="text-foreground">{ci != null ? ci.toFixed(2) : "N/A"}</strong>
                </span>
                <span className={`text-[11px] font-semibold flex items-center gap-1 ${isSelected ? "text-cyan-400" : "text-muted-foreground"}`}>
                  {isSelected ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Active in Trend
                    </>
                  ) : (
                    "+ Overlay"
                  )}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 2. Congestion Index Cross-Port Bar Chart */}
      <Card className="p-4 border-border/80 bg-card/80 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-wide text-foreground">
              Cross-Hub Congestion Index Comparison
            </h2>
          </div>
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
            Alert Threshold: CI &gt; 1.20
          </span>
        </div>

        <div className="h-64 font-mono">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 2.0]} />
              <Tooltip
                contentStyle={{
                  background: "rgba(10, 20, 36, 0.95)",
                  border: "1px solid rgba(34, 211, 238, 0.4)",
                  borderRadius: 10,
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
                formatter={(val: number) => [`${val} (Stationary Ratio)`, "Congestion Index"]}
              />
              <ReferenceLine
                y={1.2}
                stroke="#FF5577"
                strokeDasharray="4 4"
                label={{ value: "Congestion Threshold (1.20)", fill: "#FF5577", fontSize: 10, position: "top", fontFamily: "monospace" }}
              />
              <Bar dataKey="ci" radius={[6, 6, 0, 0]}>
                {barChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.ci > 1.2 ? "#FF5577" : entry.ci >= 0.8 ? "#FFB547" : "#18D69B"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 3. Normalized Congestion History Overlay Line Chart */}
      <Card className="p-4 border-border/80 bg-card/80 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-wide text-foreground">
              Normalized Historical Congestion Overlay
            </h2>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Normalized against individual hub median (1.0 = typical baseline)
          </span>
        </div>

        {/* Selected Port Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4 font-mono">
          <span className="text-xs text-muted-foreground mr-1">Overlay Selection (2–4 ports):</span>
          {list.map((p) => {
            const on = sel.includes(p.id);
            const disabled = !on && sel.length >= 4;
            return (
              <button
                key={p.id}
                disabled={disabled}
                onClick={() => toggle(p.id)}
                className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                  on
                    ? "border-cyan-500 bg-cyan-500 text-black font-bold shadow-xs"
                    : "border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground"
                } disabled:opacity-40`}
              >
                {PORT_FLAGS[p.id]} {p.name}
              </button>
            );
          })}
        </div>

        {sel.length < 2 ? (
          <Empty text="Select at least 2 ports to overlay historical trends" />
        ) : loading ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : !timeSeriesData.length ? (
          <Empty text="No historical telemetry recorded for selected combination" />
        ) : (
          <div className="h-72 font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: string) => h.slice(5, 16)}
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  minTickGap={40}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} domain={[0.4, 2.2]} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10, 20, 36, 0.95)",
                    border: "1px solid rgba(34, 211, 238, 0.4)",
                    borderRadius: 10,
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                  formatter={(val: number) => [`${val}x median`, "Congestion Ratio"]}
                />
                <Legend formatter={(v: string) => name(v)} />
                <ReferenceLine
                  y={1}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="6 4"
                  label={{ value: "Baseline Median (1.0)", fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace" }}
                />
                {sel.map((id, i) => (
                  <Line
                    key={id}
                    dataKey={id}
                    name={id}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* 4. Sortable Port Comparison Matrix Table */}
      <Card className="overflow-hidden p-0 border border-border/80 bg-card/80 shadow-md">
        <div className="border-b border-border bg-secondary/50 px-4 py-3">
          <h2 className="text-sm font-bold font-mono uppercase tracking-wide text-foreground">
            Port Performance Benchmark Matrix
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-secondary/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">
                  <button
                    onClick={() => toggleTableSort("name")}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Port Name <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3">Coordinates</th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => toggleTableSort("ci")}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Congestion Index (CI) <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Approaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-muted-foreground">
              {sortedPorts.map((p) => {
                const flag = PORT_FLAGS[p.id] || "⚓";
                const ci = p.congestion_index;

                return (
                  <tr key={p.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-foreground flex items-center gap-2">
                      <span className="text-base">{flag}</span>
                      <span>{p.name}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">
                      {p.lat.toFixed(2)}°N, {p.lon.toFixed(2)}°E
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-foreground">
                      {ci != null ? ci.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge ci={ci} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => navigate({ to: "/ports/$id", params: { id: p.id } })}
                        className="rounded-lg border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-secondary inline-flex items-center gap-1 transition"
                      >
                        Deep Dive <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
