import { useState, useMemo } from "react";
import {
  TrendingUp,
  Clock,
  Compass,
  AlertTriangle,
  Info,
  CheckCircle,
  BarChart2,
  Sliders,
} from "lucide-react";
import {
  computePortForecast,
  type PortForecastResult,
} from "@/lib/forecastEngine";
import { MONITORED_PORTS } from "@/lib/historicalData";
import { Card } from "@/components/ui-bits";

export function PredictiveIntelligence() {
  const [selectedPortId, setSelectedPortId] = useState<string>("rotterdam");
  const [selectedMetric, setSelectedMetric] = useState<"QUEUE_SIZE" | "VESSEL_DENSITY" | "ARRIVALS">("QUEUE_SIZE");
  const [trainingHours, setTrainingHours] = useState<number>(16);

  const forecastResult: PortForecastResult = useMemo(() => {
    return computePortForecast(selectedPortId, selectedMetric, trainingHours, 24 - trainingHours);
  }, [selectedPortId, selectedMetric, trainingHours]);

  const maxVal = useMemo(() => {
    const all = forecastResult.points.map((p) => Math.max(p.actual || 0, p.upperConfidence, p.predicted));
    return Math.max(10, Math.ceil(Math.max(...all) * 1.15));
  }, [forecastResult]);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-400" />
            Predictive Intelligence Engine — Time-Series Port Forecasting
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Temporal time-ordered forecasting model comparing unweighted historical baselines against dampened trend projections with forward backtesting.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>Model: <strong>{forecastResult.evaluation.modelVersion}</strong></span>
        </div>
      </div>

      {/* Control Bar: Port, Metric, Training Window */}
      <Card className="p-4 bg-linear-to-r from-card to-card/60">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Port Hub Selector */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-medium text-foreground">Port Hub</label>
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

          {/* Metric Selector */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-medium text-foreground">Forecast Target Metric</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="QUEUE_SIZE">Anchorage Queue Size (Waiting Vessels)</option>
              <option value="VESSEL_DENSITY">Port Zone Vessel Density (Total Vessels)</option>
              <option value="ARRIVALS">Projected Inbound Approaching Arrivals</option>
            </select>
          </div>

          {/* Training Window Slider */}
          <div className="md:col-span-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">Historical Training Window</span>
              <span className="font-mono font-bold text-teal-400">{trainingHours}h (Horizon: {24 - trainingHours}h)</span>
            </div>
            <input
              type="range"
              min="8"
              max="20"
              step="1"
              value={trainingHours}
              onChange={(e) => setTrainingHours(parseInt(e.target.value, 10))}
              className="w-full accent-teal-500 cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* Model Backtesting & Accuracy Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center border-border">
          <div className="text-[11px] text-muted-foreground">Mean Absolute Error (MAE)</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
            ±{forecastResult.evaluation.mae} {selectedMetric === "QUEUE_SIZE" ? "vessels" : "ships"}
          </div>
        </Card>

        <Card className="p-3 text-center border-border">
          <div className="text-[11px] text-muted-foreground">Root Mean Squared Error (RMSE)</div>
          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
            {forecastResult.evaluation.rmse}
          </div>
        </Card>

        <Card className="p-3 text-center border-border">
          <div className="text-[11px] text-muted-foreground">Mean Abs Percentage Error (MAPE)</div>
          <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
            {forecastResult.evaluation.mape}%
          </div>
        </Card>

        <Card className="p-3 text-center border-border">
          <div className="text-[11px] text-muted-foreground">Backtest Horizon Samples</div>
          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
            {forecastResult.evaluation.sampleCount} hours
          </div>
        </Card>
      </div>

      {/* Forecast Chart Visualization */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            24-Hour Actual Observations vs Predictive Projection
          </h4>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Recorded Actuals
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Projected Horizon
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-6 border-b border-dashed border-muted-foreground" /> Historical Mean
            </span>
          </div>
        </div>

        {/* Forecast Graph Canvas */}
        <div className="h-56 flex items-end gap-1 pt-6 pb-2 border-b border-border">
          {forecastResult.points.map((pt) => {
            const actualHeight = pt.actual !== undefined ? (pt.actual / maxVal) * 100 : 0;
            const predHeight = (pt.predicted / maxVal) * 100;
            const upperHeight = (pt.upperConfidence / maxVal) * 100;
            const lowerHeight = (pt.lowerConfidence / maxVal) * 100;

            return (
              <div
                key={pt.hourIndex}
                className={`flex-1 flex flex-col items-center h-full justify-end group relative ${
                  pt.isForecast ? "bg-amber-500/5 rounded-xs" : ""
                }`}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div className="bg-popover text-popover-foreground text-[10px] font-mono rounded-md shadow-md p-2 whitespace-nowrap border border-border">
                    <div className="font-bold text-foreground">{pt.hourLabel} UTC ({pt.isForecast ? "Forecast" : "Training"})</div>
                    {pt.actual !== undefined && <div>Actual: <strong>{pt.actual}</strong></div>}
                    <div>Projected: <strong>{pt.predicted}</strong></div>
                    <div>Confidence: [{pt.lowerConfidence} - {pt.upperConfidence}]</div>
                    <div>Baseline Mean: {pt.baseline}</div>
                  </div>
                </div>

                <div className="w-full flex items-end justify-center gap-0.5 h-full relative">
                  {/* Shaded Confidence Bar (behind) */}
                  {pt.isForecast && (
                    <div
                      style={{
                        bottom: `${lowerHeight}%`,
                        height: `${Math.max(4, upperHeight - lowerHeight)}%`,
                      }}
                      className="absolute w-full bg-amber-500/20 rounded-xs"
                      title="Confidence Interval (±1σ)"
                    />
                  )}

                  {/* Actual observation bar */}
                  {!pt.isForecast && pt.actual !== undefined && (
                    <div
                      style={{ height: `${actualHeight}%` }}
                      className="w-3/4 rounded-t-xs bg-cyan-500 transition-all z-1"
                    />
                  )}

                  {/* Predicted bar (during forecast window) */}
                  {pt.isForecast && (
                    <div
                      style={{ height: `${predHeight}%` }}
                      className="w-3/4 rounded-t-xs bg-amber-400 border border-amber-500/60 transition-all z-1"
                    />
                  )}
                </div>

                <span className="text-[9px] font-mono text-muted-foreground mt-1.5">
                  {pt.hourIndex % 3 === 0 ? pt.hourLabel.substring(0, 2) : ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* Limitation & Provenance Note */}
        <div className="flex items-start gap-2 pt-2 text-[11px] text-muted-foreground leading-relaxed">
          <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            {forecastResult.limitations} All error metrics (MAE/RMSE) are calculated strictly on the held-out forward horizon hours ({trainingHours}:00–23:00 UTC) without knowledge of future observations.
          </span>
        </div>
      </Card>
    </div>
  );
}
