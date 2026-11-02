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
import { ArrowUpDown, ExternalLink, BarChart3, LineChart as LineChartIcon, Anchor, Info } from "lucide-react";
import { Card, Empty, FallbackBanner, RefreshControl, Skeleton, StatusBadge } from "@/components/ui-bits";
import { historyQuery, median, portsQuery, type Port } from "@/lib/api";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Port Analytics & Comparison — Global Maritime Port Monitor" },
      {
        name: "description",
        content: "Multi-port cross-comparison, congestion benchmarking, and historical anchorage telemetry.",
      },
      { property: "og:title", content: "Compare Ports — Global Maritime Port Monitor" },
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

const CHART_COLORS = ["#14B8A6", "#22D3EE", "#F59E0B", "#EF4444", "#8B5CF6", "#10B981"];

type PortSortKey = "name" | "ci";

function Compare() {
  const ports = useQuery(portsQuery());
  const list = ports.data?.data ?? [];
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
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Port Analytics & Cross-Comparison
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Benchmark congestion index metrics, berth turnaround performance, and normalized anchorage density.
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
              className={`p-3.5 border transition cursor-pointer ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border bg-card hover:bg-secondary/30"
              }`}
              onClick={() => toggle(p.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{flag}</span>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{p.name}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°
                    </span>
                  </div>
                </div>
                <StatusBadge ci={ci} />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-border">
                <span className="text-muted-foreground">
                  Score: <strong className="text-foreground">{ci != null ? ci.toFixed(2) : "N/A"}</strong>
                </span>
                <span className={`text-[11px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                  {isSelected ? "Selected for Trends ✓" : "+ Add to Overlay"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 2. Congestion Index Cross-Port Bar Chart */}
      <Card className="p-4 border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Cross-Port Congestion Index Comparison</h2>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Alert Threshold: CI &gt; 1.2
          </span>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 2.0]} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(val: number) => [`${val} (Ratio <0.5 kn)`, "Congestion Index"]}
              />
              <ReferenceLine
                y={1.2}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{ value: "Congestion Threshold (1.2)", fill: "#EF4444", fontSize: 10, position: "top" }}
              />
              <Bar dataKey="ci" radius={[4, 4, 0, 0]}>
                {barChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.ci > 1.2 ? "#EF4444" : entry.ci >= 0.8 ? "#F59E0B" : "#10B981"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 3. Normalized Congestion History Overlay Line Chart */}
      <Card className="p-4 border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-cyan-500" />
            <h2 className="text-sm font-bold text-foreground">Historical Normalized Congestion Trends</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Normalized against individual port median (1.0 = typical baseline)
          </span>
        </div>

        {/* Selected Port Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-xs text-muted-foreground mr-1">Overlay Ports (select 2–4):</span>
          {list.map((p) => {
            const on = sel.includes(p.id);
            const disabled = !on && sel.length >= 4;
            return (
              <button
                key={p.id}
                disabled={disabled}
                onClick={() => toggle(p.id)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                  on
                    ? "border-primary bg-primary text-primary-foreground shadow-2xs"
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
          <Skeleton className="h-72" />
        ) : !timeSeriesData.length ? (
          <Empty text="No historical telemetry recorded for selected combination" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: string) => h.slice(5, 16)}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  minTickGap={40}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0.4, 2.2]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(val: number) => [`${val}x median`, "Congestion Ratio"]}
                />
                <Legend formatter={(v: string) => name(v)} />
                <ReferenceLine
                  y={1}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="6 4"
                  label={{ value: "Baseline Median (1.0)", fill: "var(--muted-foreground)", fontSize: 10 }}
                />
                {sel.map((id, i) => (
                  <Line
                    key={id}
                    dataKey={id}
                    name={id}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2.2}
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
      <Card className="overflow-hidden p-0 border border-border bg-card shadow-xs">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <h2 className="text-sm font-bold text-foreground">Port Comparison Matrix</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/20 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">
                  <button
                    onClick={() => toggleTableSort("name")}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Port Name <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-2.5">Coordinates</th>
                <th className="px-4 py-2.5">
                  <button
                    onClick={() => toggleTableSort("ci")}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Congestion Index (CI) <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-2.5">Queuing State</th>
                <th className="px-4 py-2.5 text-right">Approaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                      {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold">
                      {ci != null ? ci.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge ci={ci} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => navigate({ to: "/ports/$id", params: { id: p.id } })}
                        className="rounded border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary inline-flex items-center gap-1"
                      >
                        Details <ExternalLink className="h-3 w-3" />
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
