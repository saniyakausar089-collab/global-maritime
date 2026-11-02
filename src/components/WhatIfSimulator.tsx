import { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Clock,
  Anchor,
  HelpCircle,
  Network,
  ArrowRight,
} from "lucide-react";
import {
  MONITORED_PORTS,
  simulatePortScenario,
  type ScenarioConfig,
  type ScenarioOutcome,
  type PortArea,
} from "@/lib/historicalData";
import { Card } from "@/components/ui-bits";

interface WhatIfSimulatorProps {
  onNavigateToRipple?: (portId: string, delayHours: number) => void;
}

export function WhatIfSimulator({ onNavigateToRipple }: WhatIfSimulatorProps) {
  const [selectedPortId, setSelectedPortId] = useState<string>("rotterdam");
  const [arrivalMultiplier, setArrivalMultiplier] = useState<number>(1.25);
  const [capacityMultiplier, setCapacityMultiplier] = useState<number>(0.65);
  const [startHour, setStartHour] = useState<number>(6);
  const [durationHours, setDurationHours] = useState<number>(8);

  const selectedPort = useMemo(
    () => MONITORED_PORTS.find((p) => p.id === selectedPortId) || MONITORED_PORTS[0],
    [selectedPortId],
  );

  // Preset Scenarios
  const PRESETS = [
    {
      id: "crane_outage",
      label: "Terminal Crane Outage",
      desc: "-35% berth throughput for 8h during morning shift",
      arrival: 1.0,
      capacity: 0.65,
      start: 6,
      duration: 8,
    },
    {
      id: "arrival_surge",
      label: "Post-Storm Inbound Surge",
      desc: "+40% vessel arrivals from delayed convoys",
      arrival: 1.4,
      capacity: 1.0,
      start: 2,
      duration: 12,
    },
    {
      id: "dense_fog",
      label: "Navigational Channel Fog Closure",
      desc: "-75% movement capacity for 5h night hold",
      arrival: 1.1,
      capacity: 0.25,
      start: 1,
      duration: 5,
    },
    {
      id: "baseline",
      label: "Baseline Normal Operations",
      desc: "Historical actual 1.0x arrival & capacity profile",
      arrival: 1.0,
      capacity: 1.0,
      start: 0,
      duration: 0,
    },
  ];

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setArrivalMultiplier(preset.arrival);
    setCapacityMultiplier(preset.capacity);
    setStartHour(preset.start);
    setDurationHours(preset.duration);
  };

  const scenarioConfig: ScenarioConfig = useMemo(() => {
    return {
      targetPortId: selectedPortId,
      arrivalRateMultiplier: arrivalMultiplier,
      capacityMultiplier: capacityMultiplier,
      disruptionStartHour: startHour,
      disruptionDurationHours: durationHours,
    };
  }, [selectedPortId, arrivalMultiplier, capacityMultiplier, startHour, durationHours]);

  const outcome: ScenarioOutcome = useMemo(() => {
    return simulatePortScenario(scenarioConfig);
  }, [scenarioConfig]);

  const handleReset = () => {
    setArrivalMultiplier(1.0);
    setCapacityMultiplier(1.0);
    setStartHour(0);
    setDurationHours(0);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-teal-400" />
            What-If Universe — Operational Maritime Scenario Simulation
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Model alternative operational disruptions, arrival waves, and berth outages using queueing kinematics ($M/M/c$).
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          Reset to Baseline
        </button>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Presets:</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            className="rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/80 hover:border-primary/40 transition-colors shadow-2xs"
            title={p.desc}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scenario Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Anchor className="h-3.5 w-3.5" />
              Scenario Parameters & Injection
            </h3>

            {/* Target Port Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Target Port Hub</label>
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

            {/* Arrival Rate Multiplier Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">Inbound Arrival Wave</span>
                <span className="font-mono font-bold text-teal-400">
                  {arrivalMultiplier.toFixed(2)}x ({arrivalMultiplier >= 1 ? `+${Math.round((arrivalMultiplier - 1) * 100)}%` : `${Math.round((arrivalMultiplier - 1) * 100)}%`})
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={arrivalMultiplier}
                onChange={(e) => setArrivalMultiplier(parseFloat(e.target.value))}
                className="w-full accent-teal-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0.5x (-50%)</span>
                <span>1.0x (Norm)</span>
                <span>2.0x (+100%)</span>
              </div>
            </div>

            {/* Port Berth Capacity Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">Terminal Handling Capacity</span>
                <span className="font-mono font-bold text-amber-400">
                  {capacityMultiplier.toFixed(2)}x ({capacityMultiplier >= 1 ? `+${Math.round((capacityMultiplier - 1) * 100)}%` : `${Math.round((capacityMultiplier - 1) * 100)}%`})
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.05"
                value={capacityMultiplier}
                onChange={(e) => setCapacityMultiplier(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0.2x (Severe Stoppage)</span>
                <span>1.0x (Normal)</span>
                <span>1.5x (Surge Berth)</span>
              </div>
            </div>

            {/* Disruption Start Hour */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">Disruption Injection Time</span>
                <span className="font-mono font-bold text-foreground">
                  {startHour.toString().padStart(2, "0")}:00 UTC
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="23"
                step="1"
                value={startHour}
                onChange={(e) => setStartHour(parseInt(e.target.value, 10))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Disruption Duration */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">Disruption Duration</span>
                <span className="font-mono font-bold text-foreground">
                  {durationHours} Hours
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="1"
                value={durationHours}
                onChange={(e) => setDurationHours(parseInt(e.target.value, 10))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Downstream Ripple CTA */}
            {outcome.avgDelayIncreaseHours > 0 && onNavigateToRipple && (
              <div className="pt-2 border-t border-border">
                <button
                  onClick={() => onNavigateToRipple(selectedPortId, outcome.avgDelayIncreaseHours)}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-cyan-600/20 border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-400 hover:bg-cyan-600/30 transition-colors"
                >
                  <Network className="h-4 w-4" />
                  <span>Inspect Corridor Ripple Effects</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* Simulation Outcomes & Chart (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* 4 Outcome Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 text-center border-border">
              <div className="text-[11px] text-muted-foreground">Peak Queue Delta</div>
              <div className={`text-lg font-bold font-mono mt-0.5 ${outcome.peakQueueDelta > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {outcome.peakQueueDelta >= 0 ? `+${outcome.peakQueueDelta}` : outcome.peakQueueDelta} vessels
              </div>
            </Card>

            <Card className="p-3 text-center border-border">
              <div className="text-[11px] text-muted-foreground">Modeled Delay Shift</div>
              <div className={`text-lg font-bold font-mono mt-0.5 ${outcome.avgDelayIncreaseHours > 0 ? "text-amber-500" : "text-foreground"}`}>
                +{outcome.avgDelayIncreaseHours}h
              </div>
            </Card>

            <Card className="p-3 text-center border-border">
              <div className="text-[11px] text-muted-foreground">Estimated Recovery</div>
              <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
                {outcome.recoveryHours}h
              </div>
            </Card>

            <Card className="p-3 text-center border-border">
              <div className="text-[11px] text-muted-foreground">Peak Modeled CI</div>
              <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                {Math.max(...outcome.modeledCongestionIndex).toFixed(2)}
              </div>
            </Card>
          </div>

          {/* Queue Progression Visualization */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                24-Hour Queue Progression: Baseline vs What-If Universe
              </h4>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Baseline
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-teal-400" /> Simulated Scenario
                </span>
              </div>
            </div>

            {/* Sparkline / Bar Chart */}
            <div className="h-44 flex items-end gap-1.5 pt-4 pb-2 border-b border-border">
              {outcome.scenarioQueue.map((val, idx) => {
                const baseVal = outcome.baselineQueue[idx];
                const maxVal = Math.max(12, ...outcome.scenarioQueue, ...outcome.baselineQueue);
                const scenHeightPct = Math.min(100, (val / maxVal) * 100);
                const baseHeightPct = Math.min(100, (baseVal / maxVal) * 100);
                const isDisruptedHour = idx >= startHour && idx < startHour + durationHours;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Hover Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                      <div className="bg-popover text-popover-foreground text-[10px] font-mono rounded-md shadow-md p-1.5 whitespace-nowrap border border-border">
                        <div>Hour: {idx.toString().padStart(2, "0")}:00</div>
                        <div>Simulated: <strong>{val}</strong> vessels</div>
                        <div>Baseline: {baseVal} vessels</div>
                      </div>
                    </div>

                    <div className="w-full flex items-end justify-center gap-0.5 h-full">
                      {/* Baseline Bar */}
                      <div
                        style={{ height: `${baseHeightPct}%` }}
                        className="w-1/2 rounded-t-xs bg-muted-foreground/30 transition-all"
                      />
                      {/* Scenario Bar */}
                      <div
                        style={{ height: `${scenHeightPct}%` }}
                        className={`w-1/2 rounded-t-xs transition-all ${
                          isDisruptedHour ? "bg-amber-500" : "bg-teal-400"
                        }`}
                      />
                    </div>

                    <span className="text-[9px] font-mono text-muted-foreground mt-1">
                      {idx % 4 === 0 ? idx : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-muted-foreground leading-relaxed pt-1 flex items-start gap-2">
              <HelpCircle className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Queue dynamics are modeled via multi-server deterministic arrival queues. Amber bars denote active operational disruption hours at <strong>{selectedPort.name}</strong>.
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
