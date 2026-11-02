import { useState, useMemo } from "react";
import {
  Network,
  ArrowRight,
  Clock,
  Ship,
  AlertTriangle,
  ShieldAlert,
  Layers,
  TrendingDown,
  Info,
  CheckCircle2,
  Anchor,
} from "lucide-react";
import {
  MONITORED_PORTS,
  PORT_NETWORK_EDGES,
  calculateNetworkRippleEffects,
  type PortArea,
  type PortNetworkEdge,
} from "@/lib/historicalData";
import { Card } from "@/components/ui-bits";

interface RippleEffectNetworkProps {
  initialPortId?: string;
  initialDelayHours?: number;
}

export function RippleEffectNetwork({
  initialPortId = "rotterdam",
  initialDelayHours = 12,
}: RippleEffectNetworkProps) {
  const [selectedPortId, setSelectedPortId] = useState<string>(initialPortId);
  const [delayHours, setDelayHours] = useState<number>(initialDelayHours);
  const [selectedCorridor, setSelectedCorridor] = useState<PortNetworkEdge | null>(null);

  const selectedPort = useMemo(
    () => MONITORED_PORTS.find((p) => p.id === selectedPortId) || MONITORED_PORTS[0],
    [selectedPortId],
  );

  const rippleEffects = useMemo(() => {
    return calculateNetworkRippleEffects(selectedPortId, delayHours);
  }, [selectedPortId, delayHours]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Network className="h-5 w-5 text-cyan-400" />
            Ripple Effect Network — Global Maritime Corridor Cascade
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Model how localized port congestion propagates downstream through primary container superhighways and feeder corridors.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>Active Nodes: <strong>6 Gateway Hubs</strong></span>
          <span>•</span>
          <span>Active Corridors: <strong>{PORT_NETWORK_EDGES.length} Arteries</strong></span>
        </div>
      </div>

      {/* Disruption Origin Controller */}
      <Card className="p-4 bg-linear-to-r from-card to-card/60">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-medium text-foreground">Disruption Origin Hub</label>
            <select
              value={selectedPortId}
              onChange={(e) => setSelectedPortId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              {MONITORED_PORTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.flag} {p.name} ({p.country}) — {p.annualTeuMillions}M TEU/yr
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">Origin Port Delay Shock</span>
              <span className="font-mono font-bold text-amber-400">+{delayHours} Hours</span>
            </div>
            <input
              type="range"
              min="2"
              max="72"
              step="2"
              value={delayHours}
              onChange={(e) => setDelayHours(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>+2h (Minor Hold)</span>
              <span>+24h (Full Shift)</span>
              <span>+72h (Severe Crisis)</span>
            </div>
          </div>

          <div className="md:col-span-2 text-center md:text-right">
            <div className="text-[11px] text-muted-foreground">Connected Corridors</div>
            <div className="text-xl font-bold font-mono text-foreground mt-0.5">
              {rippleEffects.length} Arteries
            </div>
          </div>
        </div>
      </Card>

      {/* Downstream Impact Corridor Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-cyan-400" />
          Projected Downstream Propagation by Corridor
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rippleEffects.map((effect, idx) => {
            const edge = PORT_NETWORK_EDGES.find(
              (e) =>
                (e.fromPortId === selectedPortId && e.toPortId === effect.connectedPortId) ||
                (e.toPortId === selectedPortId && e.fromPortId === effect.connectedPortId),
            );

            const severityBorder =
              effect.riskSeverity === "high"
                ? "border-rose-500/50 bg-rose-500/5"
                : effect.riskSeverity === "medium"
                ? "border-amber-500/50 bg-amber-500/5"
                : "border-border bg-card";

            const riskBadge =
              effect.riskSeverity === "high"
                ? "bg-rose-500/20 text-rose-400"
                : effect.riskSeverity === "medium"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-sky-500/20 text-sky-400";

            return (
              <Card
                key={idx}
                className={`p-4 space-y-3 transition-all border ${severityBorder}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono ${riskBadge}`}
                    >
                      {effect.riskSeverity} Risk
                    </span>
                    <h4 className="text-sm font-bold text-foreground mt-1.5 flex items-center gap-1.5">
                      <span>{selectedPort.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{effect.connectedPortName}</span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {effect.corridorName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-border/50">
                  <div className="rounded-md bg-background/50 p-2">
                    <div className="text-[10px] text-muted-foreground">Transit Days</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {edge?.transitDays ?? 7}d
                    </div>
                  </div>
                  <div className="rounded-md bg-background/50 p-2">
                    <div className="text-[10px] text-muted-foreground">Projected Delay</div>
                    <div className={`font-mono font-bold mt-0.5 ${effect.projectedDelayHours > 6 ? "text-amber-400" : "text-foreground"}`}>
                      +{effect.projectedDelayHours}h
                    </div>
                  </div>
                  <div className="rounded-md bg-background/50 p-2">
                    <div className="text-[10px] text-muted-foreground">Sailings At Risk</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {effect.affectedSailings} ships
                    </div>
                  </div>
                </div>

                {edge && (
                  <div className="text-[11px] font-mono text-muted-foreground flex justify-between pt-1">
                    <span>Weekly Throughput:</span>
                    <strong className="text-foreground">{edge.avgVolumeTeuWeekly.toLocaleString()} TEU</strong>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Network Intelligence & Mitigation Advisory */}
      <Card className="p-4 space-y-3 bg-card border-border">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
          Automated Carrier Mitigation & Speed Compensation Advisory
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground leading-relaxed">
          <div className="space-y-1">
            <strong className="text-foreground flex items-center gap-1">
              <Ship className="h-3.5 w-3.5 text-cyan-400" /> Transit Speed Absorption:
            </strong>
            <p>
              On long-haul corridors (e.g., Asia-Europe Suez and Transpacific Express), carriers can absorb up to 10 hours of origin delay by boosting cruising velocity by +1.1 to +1.4 knots over the open ocean leg.
            </p>
          </div>
          <div className="space-y-1">
            <strong className="text-foreground flex items-center gap-1">
              <Anchor className="h-3.5 w-3.5 text-amber-400" /> Feeder Buffer Vulnerability:
            </strong>
            <p>
              Short-sea feeder corridors (e.g. Rotterdam to Hamburg with 1.2 transit days) exhibit near-zero delay dampening (0.95 factor), causing berthing slot misses at destination unless early swap protocols are enacted.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
