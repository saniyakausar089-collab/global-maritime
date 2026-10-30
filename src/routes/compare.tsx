import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, Empty, FallbackBanner, RefreshControl, Skeleton } from "@/components/ui-bits";
import { historyQuery, median, portsQuery } from "@/lib/api";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare ports — Global Maritime Port Monitor" },
      {
        name: "description",
        content: "Overlay normalized congestion history for up to four ports.",
      },
      { property: "og:title", content: "Compare ports — Port Monitor" },
      {
        property: "og:description",
        content: "Overlay normalized congestion history for up to four ports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Compare,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function Compare() {
  const ports = useQuery(portsQuery());
  const list = ports.data?.data ?? [];
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (!sel.length && list.length >= 2) setSel(list.slice(0, 2).map((p) => p.id));
  }, [list, sel.length]);

  const hs = useQueries({ queries: sel.map((id) => historyQuery(id)) });
  const loading = hs.some((h) => h.isLoading);
  const fallback = [ports.data, ...hs.map((h) => h.data)].find((d) => d?.source === "fallback");

  const data = useMemo(() => {
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

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  const name = (id: string) => list.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compare ports</h1>
          <p className="text-sm text-muted-foreground">
            Select 2–4 ports. Each series is divided by its own median (1.0 = typical).
          </p>
        </div>
        <RefreshControl updatedAt={ports.data?.fetchedAt} />
      </div>
      {fallback && <FallbackBanner error={fallback.error} />}

      <Card>
        {ports.isLoading ? (
          <Skeleton className="h-9" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((p) => {
              const on = sel.includes(p.id);
              const disabled = !on && sel.length >= 4;
              return (
                <button
                  key={p.id}
                  disabled={disabled}
                  onClick={() => toggle(p.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"} disabled:opacity-40`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        {sel.length < 2 ? (
          <Empty text="Select at least 2 ports to compare" />
        ) : loading ? (
          <Skeleton className="h-80" />
        ) : !data.length ? (
          <Empty />
        ) : (
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: string) => h.slice(5, 16)}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  minTickGap={40}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Legend formatter={(v: string) => name(v)} />
                <ReferenceLine y={1} stroke="var(--muted-foreground)" strokeDasharray="6 4" />
                {sel.map((id, i) => (
                  <Line
                    key={id}
                    dataKey={id}
                    name={id}
                    stroke={COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
