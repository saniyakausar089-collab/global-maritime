import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  BarChart3,
  LineChart as LineChartIcon,
  GitCompare,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Anchor,
  Clock,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui-bits";
import {
  type PortArea,
  getHourlyPortMetrics,
  compareHistoricalWindows,
  ARCHIVE_START_TIME,
  ARCHIVE_END_TIME,
} from "@/lib/historicalData";

export interface HistoricalPortAnalyticsProps {
  selectedPort: PortArea | null;
  currentTime: number;
}

export function HistoricalPortAnalytics({
  selectedPort,
  currentTime,
}: HistoricalPortAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<"density" | "moving_vs_anchored" | "compare">("density");

  // Hourly metrics for selected port or all ports
  const hourlyData = useMemo(() => {
    return getHourlyPortMetrics(selectedPort?.id);
  }, [selectedPort?.id]);

  // Comparison between Period A (00:00-12:00) and Period B (12:00-24:00)
  const comparison = useMemo(() => {
    const half = 12 * 3600 * 1000;
    return compareHistoricalWindows(
      { start: ARCHIVE_START_TIME, end: ARCHIVE_START_TIME + half },
      { start: ARCHIVE_START_TIME + half, end: ARCHIVE_END_TIME },
      selectedPort?.id,
    );
  }, [selectedPort?.id]);

  const currentHourLabel = `${new Date(currentTime).getUTCHours().toString().padStart(2, "0")}:00`;

  return (
    <Card className="p-4 border border-border bg-card shadow-xs space-y-4">
      {/* Header and Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            {selectedPort ? `${selectedPort.name} Historical Analytics` : "Global Port Traffic Analytics"}
          </h3>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            24h Recorded Observations
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 text-xs">
          <button
            onClick={() => setActiveTab("density")}
            className={`rounded px-2.5 py-1 text-[11px] font-medium transition flex items-center gap-1 ${
              activeTab === "density"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LineChartIcon className="h-3 w-3" /> Traffic Density
          </button>
          <button
            onClick={() => setActiveTab("moving_vs_anchored")}
            className={`rounded px-2.5 py-1 text-[11px] font-medium transition flex items-center gap-1 ${
              activeTab === "moving_vs_anchored"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3 w-3" /> Moving vs Anchored
          </button>
          <button
            onClick={() => setActiveTab("compare")}
            className={`rounded px-2.5 py-1 text-[11px] font-medium transition flex items-center gap-1 ${
              activeTab === "compare"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitCompare className="h-3 w-3" /> Compare Periods
          </button>
        </div>
      </div>

      {/* Tab 1: Traffic Density Over Time */}
      {activeTab === "density" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Recorded Vessel Traffic Density Across 24-Hour Horizon</span>
            <span className="font-mono text-cyan-500 font-semibold">
              Current Replay Hour: {currentHourLabel} UTC
            </span>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend />
                <ReferenceLine
                  x={currentHourLabel}
                  stroke="#22D3EE"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{ value: "Current Replay Time", fill: "#22D3EE", fontSize: 10, position: "top" }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total Vessels"
                  stroke="#14B8A6"
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="anchored"
                  name="Anchored Queue (<0.5 kn)"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 2: Moving vs Anchored Breakdown */}
      {activeTab === "moving_vs_anchored" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Dynamic Kinematic State Breakdown (Under Way vs Berth / Outer Anchorage Queue)</span>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Bar dataKey="moving" name="Moving Vessels" stackId="a" fill="#22D3EE" radius={[0, 0, 0, 0]} />
                <Bar dataKey="anchored" name="Anchored Vessels" stackId="a" fill="#64748B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 3: Historical Period Comparison (00:00–12:00 vs 12:00–24:00) */}
      {activeTab === "compare" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Period A Card */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Period A: Morning (00:00 – 12:00 UTC)
              </span>
              <div className="text-2xl font-bold text-foreground">
                {comparison.periodA.totalVessels}{" "}
                <span className="text-xs font-normal text-muted-foreground">vessels observed</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Anchored Queue: <strong>{comparison.periodA.anchoredVessels}</strong></div>
                <div>Congestion Index: <strong>CI {comparison.periodA.congestionIndex}</strong></div>
              </div>
            </div>

            {/* Delta Comparison Card */}
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 flex flex-col justify-center text-center">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                <GitCompare className="h-3.5 w-3.5 text-primary" /> Shift Delta
              </span>
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`text-2xl font-bold ${
                    comparison.delta.vesselChange >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {comparison.delta.vesselChange >= 0 ? `+${comparison.delta.vesselChange}` : comparison.delta.vesselChange}
                </span>
                <span className="text-xs text-muted-foreground">vessels</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Congestion Index Shift:{" "}
                <strong
                  className={comparison.delta.ciChange > 0 ? "text-amber-500" : "text-emerald-500"}
                >
                  {comparison.delta.ciChange > 0 ? `+${comparison.delta.ciChange}` : comparison.delta.ciChange}
                </strong>
              </div>
            </div>

            {/* Period B Card */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Period B: Afternoon (12:00 – 24:00 UTC)
              </span>
              <div className="text-2xl font-bold text-foreground">
                {comparison.periodB.totalVessels}{" "}
                <span className="text-xs font-normal text-muted-foreground">vessels observed</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Anchored Queue: <strong>{comparison.periodB.anchoredVessels}</strong></div>
                <div>Congestion Index: <strong>CI {comparison.periodB.congestionIndex}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

