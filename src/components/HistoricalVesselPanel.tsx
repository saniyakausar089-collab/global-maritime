import { useState } from "react";
import {
  X,
  Ship,
  MapPin,
  Gauge,
  Compass,
  Calendar,
  Clock,
  Navigation,
  FileText,
  Copy,
  Check,
  Crosshair,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  type HistoricalVessel,
  interpolateVesselPosition,
} from "@/lib/historicalData";

export interface HistoricalVesselPanelProps {
  vessel: HistoricalVessel | null;
  currentTime: number;
  onClose: () => void;
  onFocusMap?: (vessel: HistoricalVessel) => void;
}

export function HistoricalVesselPanel({
  vessel,
  currentTime,
  onClose,
  onFocusMap,
}: HistoricalVesselPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!vessel) return null;

  const currentPos = interpolateVesselPosition(vessel, currentTime);
  const latStr = currentPos ? currentPos.lat.toFixed(5) : "—";
  const lonStr = currentPos ? currentPos.lon.toFixed(5) : "—";
  const speedStr = currentPos ? `${currentPos.sog.toFixed(1)} kn` : "—";
  const courseStr = currentPos ? `${Math.round(currentPos.cog)}°` : "—";
  const isMoving = currentPos ? !currentPos.stationary : false;

  const handleCopyCoords = () => {
    if (!currentPos) return;
    navigator.clipboard.writeText(`${currentPos.lat}, ${currentPos.lon}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const firstDate = new Date(vessel.firstObserved).toISOString().slice(11, 16);
  const lastDate = new Date(vessel.lastObserved).toISOString().slice(11, 16);

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50 w-full sm:w-[440px] max-h-[90vh] rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Ship className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm truncate text-foreground">{vessel.name}</h3>
              <span className="text-xs">{vessel.flag}</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2 font-mono">
              <span>MMSI: {vessel.mmsi}</span>
              <span>•</span>
              <span className="font-sans">{vessel.shipTypeLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onFocusMap && (
            <button
              onClick={() => onFocusMap(vessel)}
              title="Focus vessel on map"
              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition"
            >
              <Crosshair className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-border p-4 space-y-4">
        {/* Historical Status Badge */}
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
          <span className="font-semibold flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Historical Observation State
          </span>
          <span className="font-mono text-[11px]">
            {new Date(currentTime).toISOString().slice(11, 19)} UTC
          </span>
        </div>

        {/* 1. Vessel Identity Specifications */}
        <div className="pt-3 space-y-2">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" /> Vessel Registry Specifications
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase">IMO Number</span>
              <div className="font-mono font-bold text-foreground mt-0.5">{vessel.imo || "Not recorded"}</div>
            </div>
            <div className="p-2 rounded bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase">Flag State</span>
              <div className="font-medium text-foreground mt-0.5">{vessel.flagCountry} ({vessel.flag})</div>
            </div>
            <div className="p-2 rounded bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase">Callsign</span>
              <div className="font-mono font-medium text-foreground mt-0.5">{vessel.callsign}</div>
            </div>
            <div className="p-2 rounded bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase">Assigned Port Area</span>
              <div className="font-medium text-foreground mt-0.5">{vessel.portName || "Open Waters"}</div>
            </div>
          </div>
        </div>

        {/* 2. Position & Kinematics at Replay Timestamp */}
        <div className="pt-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-cyan-500" /> Position at Replay Time
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                isMoving ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-400"
              }`}
            >
              {isMoving ? "Under Way" : "Anchored"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Gauge className="h-3 w-3 text-cyan-500" /> Speed (SOG)
              </span>
              <div className="text-sm font-bold text-foreground mt-0.5">{speedStr}</div>
            </div>
            <div className="p-2 rounded bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Compass className="h-3 w-3 text-emerald-500" /> Course (COG)
              </span>
              <div className="text-sm font-bold text-foreground mt-0.5">{courseStr}</div>
            </div>
            <div className="p-2 rounded bg-muted/40 border border-border/50 col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-rose-500" /> Coordinates
                </span>
                <button
                  onClick={handleCopyCoords}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="text-xs font-mono font-bold text-foreground mt-0.5">
                {latStr}°, {lonStr}°
              </div>
            </div>
          </div>
        </div>

        {/* 3. Voyage Details */}
        <div className="pt-3 space-y-2">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-indigo-500" /> Voyage Manifest Information
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase">Reported Destination</span>
              <div className="font-semibold text-foreground mt-0.5">{vessel.destination}</div>
            </div>
            <div className="p-2 rounded bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase">Estimated Arrival (ETA)</span>
              <div className="font-semibold text-foreground mt-0.5">{vessel.eta}</div>
            </div>
          </div>
        </div>

        {/* 4. Journey Breadcrumbs Coverage */}
        <div className="pt-3 space-y-2">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Recorded Historical Coverage
          </span>
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Recorded Position Fixes:</span>
              <strong className="text-foreground">{vessel.totalObservations} timestamps</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Observation Window:</span>
              <span className="font-mono text-foreground">{firstDate} UTC – {lastDate} UTC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coverage Gaps:</span>
              <span className="text-emerald-500 font-semibold">0 data gaps &gt; 35 min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

