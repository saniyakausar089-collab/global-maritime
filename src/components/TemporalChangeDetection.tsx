import { useState, useMemo } from "react";
import {
  Scale,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  Anchor,
  Ship,
} from "lucide-react";
import {
  MONITORED_PORTS,
  compareHistoricalWindows,
  ARCHIVE_START_TIME,
  type PortArea,
} from "@/lib/historicalData";
import { Card } from "@/components/ui-bits";

export function TemporalChangeDetection() {
  const [selectedPortId, setSelectedPortId] = useState<string>("rotterdam");
  const [windowASplit, setWindowASplit] = useState<number>(12); // Split at hour 12

  const selectedPort = useMemo(
    () => MONITORED_PORTS.find((p) => p.id === selectedPortId) || MONITORED_PORTS[0],
    [selectedPortId],
  );

  // Window A: Hours 0 to split
  // Window B: Hours split to 24
  const comparison = useMemo(() => {
    const startA = ARCHIVE_START_TIME;
    const endA = ARCHIVE_START_TIME + windowASplit * 3600 * 1000;
    const startB = endA;
    const endB = ARCHIVE_START_TIME + 24 * 3600 * 1000;

    return compareHistoricalWindows(
      { start: startA, end: endA },
      { start: startB, end: endB },
      selectedPortId,
    );
  }, [selectedPortId, windowASplit]);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Scale className="h-5 w-5 text-cyan-400" />
            Temporal Change Detection — Period Delta Analytics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Normalized comparative analysis isolating shifts in vessel density, waiting queue depth, and Congestion Index across distinct temporal windows.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>Target: <strong>{selectedPort.name}</strong></span>
        </div>
      </div>

      {/* Control Bar: Port Hub & Window Splitter */}
      <Card className="p-4 bg-linear-to-r from-card to-card/60">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-medium text-foreground">Port Jurisdiction</label>
            <select
              value={selectedPortId}
              onChange={(e) => setSelectedPortId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              {MONITORED_PORTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.flag} {p.name} ({p.country})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-7 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">Window Split Point</span>
              <span className="font-mono font-bold text-foreground">
                Period A (00:00–{windowASplit}:00 UTC) vs Period B ({windowASplit}:00–24:00 UTC)
              </span>
            </div>
            <input
              type="range"
              min="4"
              max="20"
              step="1"
              value={windowASplit}
              onChange={(e) => setWindowASplit(parseInt(e.target.value, 10))}
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>Early Split (04:00)</span>
              <span>Equal Split (12:00)</span>
              <span>Late Split (20:00)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 3 Metric Delta Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Vessel Density Delta */}
        <Card className="p-4 space-y-2 border-border">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Total Vessel Volume</span>
            <Ship className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">
              {comparison.periodA.totalVessels} → {comparison.periodB.totalVessels}
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                comparison.delta.vesselChange >= 0 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              ({comparison.delta.vesselChange >= 0 ? `+${comparison.delta.vesselChange}` : comparison.delta.vesselChange})
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Net shift in active commercial vessels observed in approach roads.
          </p>
        </Card>

        {/* Anchored Queue Delta */}
        <Card className="p-4 space-y-2 border-border">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Anchorage Waiting Queue</span>
            <Anchor className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">
              {comparison.periodA.anchoredVessels} → {comparison.periodB.anchoredVessels}
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                comparison.delta.anchoredChange > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              ({comparison.delta.anchoredChange >= 0 ? `+${comparison.delta.anchoredChange}` : comparison.delta.anchoredChange})
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Shift in vessels holding position (&lt;0.5 kn) awaiting berth slots.
          </p>
        </Card>

        {/* Congestion Index Delta */}
        <Card className="p-4 space-y-2 border-border">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Congestion Index (CI)</span>
            <TrendingUp className="h-4 w-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">
              {comparison.periodA.congestionIndex} → {comparison.periodB.congestionIndex}
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                comparison.delta.ciChange > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              ({comparison.delta.ciChange >= 0 ? `+${comparison.delta.ciChange}` : comparison.delta.ciChange})
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Derived pressure index (0.6 + 1.4 × anchored / total).
          </p>
        </Card>
      </div>

      {/* Comparison Detail Table */}
      <Card className="p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Normalized Side-by-Side Breakdown: Period A vs Period B
        </h4>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-3 py-2">Metric</th>
                <th className="px-3 py-2">Period A (00:00–{windowASplit}:00)</th>
                <th className="px-3 py-2">Period B ({windowASplit}:00–24:00)</th>
                <th className="px-3 py-2 text-right">Net Shift Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-muted-foreground">
              <tr className="hover:bg-muted/30">
                <td className="px-3 py-2 font-sans font-semibold text-foreground">Total Observed Vessels</td>
                <td className="px-3 py-2">{comparison.periodA.totalVessels} vessels</td>
                <td className="px-3 py-2">{comparison.periodB.totalVessels} vessels</td>
                <td className="px-3 py-2 text-right font-bold text-foreground">
                  {comparison.delta.vesselChange >= 0 ? `+${comparison.delta.vesselChange}` : comparison.delta.vesselChange}
                </td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="px-3 py-2 font-sans font-semibold text-foreground">Anchorage Holding Road Queue</td>
                <td className="px-3 py-2">{comparison.periodA.anchoredVessels} vessels</td>
                <td className="px-3 py-2">{comparison.periodB.anchoredVessels} vessels</td>
                <td className="px-3 py-2 text-right font-bold text-foreground">
                  {comparison.delta.anchoredChange >= 0 ? `+${comparison.delta.anchoredChange}` : comparison.delta.anchoredChange}
                </td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="px-3 py-2 font-sans font-semibold text-foreground">Underway / Moving Ratio</td>
                <td className="px-3 py-2">
                  {comparison.periodA.totalVessels > 0
                    ? `${Math.round(((comparison.periodA.totalVessels - comparison.periodA.anchoredVessels) / comparison.periodA.totalVessels) * 100)}%`
                    : "0%"}
                </td>
                <td className="px-3 py-2">
                  {comparison.periodB.totalVessels > 0
                    ? `${Math.round(((comparison.periodB.totalVessels - comparison.periodB.anchoredVessels) / comparison.periodB.totalVessels) * 100)}%`
                    : "0%"}
                </td>
                <td className="px-3 py-2 text-right font-bold text-foreground">
                  {comparison.periodB.totalVessels > 0 && comparison.periodA.totalVessels > 0
                    ? `${Math.round(
                        ((comparison.periodB.totalVessels - comparison.periodB.anchoredVessels) / comparison.periodB.totalVessels) * 100 -
                          ((comparison.periodA.totalVessels - comparison.periodA.anchoredVessels) / comparison.periodA.totalVessels) * 100,
                      )}%`
                    : "0%"}
                </td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="px-3 py-2 font-sans font-semibold text-foreground">Congestion Index</td>
                <td className="px-3 py-2">{comparison.periodA.congestionIndex}</td>
                <td className="px-3 py-2">{comparison.periodB.congestionIndex}</td>
                <td className="px-3 py-2 text-right font-bold text-foreground">
                  {comparison.delta.ciChange >= 0 ? `+${comparison.delta.ciChange}` : comparison.delta.ciChange}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
