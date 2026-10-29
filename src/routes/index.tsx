import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { MapView } from "@/components/MapView";
import { Card, Empty, FallbackBanner, RefreshControl, Skeleton, StatusBadge } from "@/components/ui-bits";
import { portsQuery, statusOf, STATUS_VAR, type Port } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Global Maritime Port Monitor" },
      { name: "description", content: "World map and ranking of port congestion from live AIS data." },
      { property: "og:title", content: "Overview — Global Maritime Port Monitor" },
      { property: "og:description", content: "World map and ranking of port congestion from live AIS data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

type SortKey = "name" | "congestion_index";

function Overview() {
  const q = useQuery(portsQuery());
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "congestion_index", dir: -1 });
  const ports = q.data?.data ?? [];

  const sorted = useMemo(() => {
    return [...ports].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * sort.dir;
      const av = a.congestion_index ?? -Infinity, bv = b.congestion_index ?? -Infinity;
      return (av - bv) * sort.dir;
    });
  }, [ports, sort]);

  const withCi = ports.filter((p) => p.congestion_index != null);
  const busiest = withCi.sort((a, b) => b.congestion_index! - a.congestion_index!)[0];
  const congested = ports.filter((p) => (p.congestion_index ?? 0) > 1.2).length;
  const go = (p: Port) => navigate({ to: "/ports/$id", params: { id: p.id } });
  const toggle = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Port Congestion</h1>
          <p className="text-sm text-muted-foreground">Click a port marker or row for vessel-level detail.</p>
        </div>
        <RefreshControl updatedAt={q.data?.fetchedAt} />
      </div>
      {q.data?.source === "fallback" && <FallbackBanner error={q.data.error} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ports monitored" value={q.isLoading ? null : String(ports.length)} />
        <Stat label="Busiest port" value={q.isLoading ? null : busiest ? `${busiest.name} (${busiest.congestion_index!.toFixed(2)})` : "—"} />
        <Stat label="Ports above 1.2" value={q.isLoading ? null : String(congested)} accent />
      </div>

      <Card className="p-2">
        {q.isLoading ? (
          <Skeleton className="h-[420px] w-full" />
        ) : (
          <MapView
            center={[20, 10]}
            zoom={2}
            markers={ports.map((p) => ({
              key: p.id,
              lat: p.lat,
              lon: p.lon,
              radius: 9,
              color: STATUS_VAR[statusOf(p.congestion_index)],
              label: `${p.name}: ${p.congestion_index?.toFixed(2) ?? "n/a"}`,
              onClick: () => go(p),
            }))}
          />
        )}
        <div className="flex flex-wrap gap-4 px-2 pt-2 text-xs text-muted-foreground">
          {(["normal", "busy", "congested", "unknown"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_VAR[s] }} />
              {{ normal: "< 0.8", busy: "0.8 – 1.2", congested: "> 1.2", unknown: "No data" }[s]}
            </span>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        {q.isLoading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : !ports.length ? (
          <div className="p-4"><Empty /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2"><button onClick={() => toggle("name")} className="flex items-center gap-1">Port <ArrowUpDown className="h-3 w-3" /></button></th>
                <th className="px-4 py-2"><button onClick={() => toggle("congestion_index")} className="flex items-center gap-1">Congestion index <ArrowUpDown className="h-3 w-3" /></button></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.id} onClick={() => go(p)} className="cursor-pointer border-t hover:bg-secondary">
                  <td className="px-4 py-2 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2"><StatusBadge ci={p.congestion_index} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {value == null ? <Skeleton className="mt-2 h-7 w-24" /> : (
        <p className={`mt-1 text-2xl font-semibold ${accent ? "text-accent" : ""}`}>{value}</p>
      )}
    </Card>
  );
}
