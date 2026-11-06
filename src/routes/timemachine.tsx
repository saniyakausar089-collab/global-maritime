import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  History,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Anchor,
  Compass,
  AlertTriangle,
  Radio,
  FileText,
  SlidersHorizontal,
  Gauge,
  ShieldAlert,
  Network,
  BookOpen,
  TrendingUp,
  Scale,
  Bell,
  Bot,
  Zap,
  CheckCircle2,
} from "lucide-react";
import {
  HistoricalMapView,
  type ReplayVesselRecord,
} from "@/components/HistoricalMapView";
import { TimelineController } from "@/components/TimelineController";
import { VesselBlackBox } from "@/components/VesselBlackBox";
import { AnomalyDetective } from "@/components/AnomalyDetective";
import { WhatIfSimulator } from "@/components/WhatIfSimulator";
import { RippleEffectNetwork } from "@/components/RippleEffectNetwork";
import { InvestigationWorkspace } from "@/components/InvestigationWorkspace";
import { TemporalKnowledgeGraph } from "@/components/TemporalKnowledgeGraph";
import { PredictiveIntelligence } from "@/components/PredictiveIntelligence";
import { TemporalChangeDetection } from "@/components/TemporalChangeDetection";
import { TimeAwareAlerts } from "@/components/TimeAwareAlerts";
import { AiMaritimeAssistant } from "@/components/AiMaritimeAssistant";
import { getHistoricalArchive } from "@/lib/historicalData";

export type TimeMachineMode =
  | "REPLAY"
  | "BLACK_BOX"
  | "ANOMALIES"
  | "WHAT_IF"
  | "RIPPLE"
  | "KNOWLEDGE_GRAPH"
  | "PREDICTIVE"
  | "CHANGE_DETECTION"
  | "ALERTS"
  | "AI_ASSISTANT"
  | "INVESTIGATIONS";

interface CoverageData {
  oldestRecordTs: number | null;
  newestRecordTs: number | null;
  totalSamples: number;
  uniqueVessels: number;
  hourly: Array<{
    hour_bucket: string;
    vessel_count: number;
    sample_count: number;
  }>;
}

interface PortArrivalForecast {
  id: string;
  name: string;
  predictedCount: number;
  currentCount: number;
  forecastIndex: number | null;
  forecastLabel?: string;
  topIncoming: Array<{
    name: string;
    mmsi: number;
    eta: string;
    confidence: number;
    distKm: number;
  }>;
}

interface ReplayResponse {
  at: number;
  iso: string;
  mode: "replay" | "live" | "forecast";
  status: string;
  historyAvailableFrom: number | null;
  hoursAhead?: number;
  count: number;
  vessels: {
    mmsi: number[];
    lat: number[];
    lon: number[];
    sog: number[];
    cog: number[];
    hdg: number[];
    type: number[];
    status: string[];
    confidence: number[];
    source: string[];
    isGap: number[];
    isInterpolated: number[];
    name: string[];
    destination: string[];
    eta: string[];
    haloRadius: number[];
  };
  portArrivals: PortArrivalForecast[];
  debug: {
    recordedSamples: number;
    interpolated: number;
    gapVessels: number;
    forecastVessels: number;
  };
}

export const Route = createFileRoute("/timemachine")({
  head: () => ({
    meta: [
      { title: "Time Machine — Real 4D Maritime Replay & Forecasting" },
      {
        name: "description",
        content:
          "Temporal maritime intelligence: real time-travel replay of vessel positions, AIS black box telemetry, and route-following future forecasts.",
      },
      { property: "og:title", content: "Time Machine — Global Maritime Port Monitor" },
      {
        property: "og:description",
        content:
          "Temporal maritime intelligence: real time-travel replay of vessel positions and honest route-following future forecasts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TimeMachinePage,
});

export function TimeMachinePage() {
  const archive = useMemo(() => getHistoricalArchive(), []);
  const [activeMode, setActiveMode] = useState<TimeMachineMode>("REPLAY");

  const now = useMemo(() => Date.now(), []);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Bounds
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [replayData, setReplayData] = useState<ReplayResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Selection
  const [selectedVessel, setSelectedVessel] = useState<ReplayVesselRecord | null>(null);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);

  // Ripple state
  const [rippleInitialData, setRippleInitialData] = useState<{ portId: string; delayHours: number }>({
    portId: "rotterdam",
    delayHours: 12,
  });

  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Fetch Coverage on Mount
  useEffect(() => {
    fetch("/api/replay/coverage?days=7")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CoverageData | null) => {
        if (data) {
          setCoverage(data);
        }
      })
      .catch(() => {});
  }, []);

  // Compute Timeline Start & End
  const startTime = useMemo(() => {
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    if (coverage?.oldestRecordTs) {
      return Math.min(now - 3600 * 1000, Math.max(sevenDaysAgo, coverage.oldestRecordTs));
    }
    return now - 24 * 3600 * 1000;
  }, [coverage, now]);

  const endTime = useMemo(() => {
    return now + 72 * 3600 * 1000; // +72h forecast horizon
  }, [now]);

  // 2. Fetch Replay Data for currentTime
  const fetchReplay = useCallback((ts: number) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setIsLoading(true);
    fetch(`/api/replay?at=${ts}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReplayResponse | null) => {
        if (data) {
          setReplayData(data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setIsLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    fetchReplay(currentTime);
  }, [currentTime, fetchReplay]);

  // Convert Columnar JSON to Object Array
  const vesselsList = useMemo<ReplayVesselRecord[]>(() => {
    if (!replayData?.vessels?.mmsi) return [];
    const v = replayData.vessels;
    const n = v.mmsi.length;
    const list: ReplayVesselRecord[] = [];
    for (let i = 0; i < n; i++) {
      list.push({
        mmsi: v.mmsi[i],
        lat: v.lat[i],
        lon: v.lon[i],
        sog: v.sog[i],
        cog: v.cog[i],
        hdg: v.hdg[i],
        type: v.type[i],
        status: v.status[i],
        confidence: v.confidence[i],
        source: v.source[i],
        isGap: v.isGap[i],
        isInterpolated: v.isInterpolated[i],
        name: v.name[i],
        destination: v.destination[i],
        eta: v.eta[i],
        haloRadius: v.haloRadius[i],
      });
    }
    return list;
  }, [replayData]);

  // 3. Playback Loop
  // 1x = 1 simulated minute per real second (60x time compression)
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTickRef.current = Date.now();

    const loop = () => {
      const curTick = Date.now();
      const elapsedMs = curTick - lastTickRef.current;
      lastTickRef.current = curTick;

      // 1 real second = 60,000 simulated ms (1 minute) * playbackSpeed
      const simulatedStepMs = (elapsedMs / 1000) * 60000 * playbackSpeed;

      setCurrentTime((prev) => {
        const next = prev + simulatedStepMs;
        if (next >= endTime) {
          setIsPlaying(false);
          return endTime;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, endTime]);

  const handleTogglePlay = () => setIsPlaying((p) => !p);
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(startTime);
  };
  const handleJumpToNow = () => {
    setIsPlaying(false);
    setCurrentTime(Date.now());
  };
  const handleStepBackward = () => {
    setIsPlaying(false);
    setCurrentTime((t) => Math.max(startTime, t - 15 * 60 * 1000));
  };
  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentTime((t) => Math.min(endTime, t + 15 * 60 * 1000));
  };

  const isFuture = currentTime > now + 60000;
  const isPast = currentTime < now - 60000;

  // Recorded history hours calculation
  const recordedHours = useMemo(() => {
    if (!coverage?.oldestRecordTs) return 0;
    return Math.max(1, Math.round((now - coverage.oldestRecordTs) / (3600 * 1000)));
  }, [coverage, now]);

  const historyStartDateStr = useMemo(() => {
    if (!coverage?.oldestRecordTs) return null;
    return new Date(coverage.oldestRecordTs).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }, [coverage]);

  return (
    <div className="pt-24 pb-16 min-h-screen bg-[#04070D] text-[#F4F7FB] px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <History className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-sans">
              TIME MACHINE — 4D Maritime Telemetry & Forecast
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-ink-2 mt-1 font-mono">
            Recorded real AIS position history, great-circle kinematic interpolation, and route-following future forecasts.
          </p>
        </div>

        {/* Dynamic Status Pill */}
        <div className="flex items-center gap-3">
          {isFuture ? (
            <div className="flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/15 px-3.5 py-1 text-xs font-mono text-purple-300 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
              </span>
              <span className="font-bold">FORECAST (+{Math.round((currentTime - now) / 3600000)}h)</span>
            </div>
          ) : isPast ? (
            <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3.5 py-1 text-xs font-mono text-amber-300 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="font-bold">HISTORICAL REPLAY</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-1 text-xs font-mono text-emerald-300 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-bold">LIVE TELEMETRY</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Honest History Availability Banner */}
      {historyStartDateStr && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-[#0A1019] p-3.5 text-xs text-ink-2 shadow-lg backdrop-blur-md">
          <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <div className="space-y-0.5 font-mono">
            <span className="font-semibold text-ink">
              Real Position Archive: Available from {historyStartDateStr} ({recordedHours} hours recorded).
            </span>
            <p className="text-[11px] text-ink-3">
              Only authentic AIS reports are stored as history. Times prior to archive start contain no data (never synthetic ships). Times in the future are predicted along verified sea corridors.
            </p>
          </div>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10 text-xs scrollbar-none font-mono">
        {[
          { id: "REPLAY", label: "4D Replay & Forecast", icon: History },
          { id: "BLACK_BOX", label: "Vessel Black Box", icon: Gauge },
          { id: "ANOMALIES", label: "Anomaly Detective", icon: ShieldAlert, badge: archive.anomalies.length },
          { id: "WHAT_IF", label: "What-If Simulator", icon: SlidersHorizontal },
          { id: "RIPPLE", label: "Ripple Network", icon: Network },
          { id: "PREDICTIVE", label: "Predictive Corridors", icon: TrendingUp },
          { id: "INVESTIGATIONS", label: "Incident Dossiers", icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMode(tab.id as TimeMachineMode)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 font-bold text-xs transition cursor-pointer shadow-sm ${
                isActive
                  ? "bg-accent text-black font-extrabold shadow-md shadow-accent/25"
                  : "bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white border border-white/20 hover:border-accent/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="rounded-full px-1.5 py-0.2 font-mono text-[10px] bg-rose-500/20 text-rose-400 font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Active Replay View */}
      {activeMode === "REPLAY" && (
        <div className="space-y-6">
          {/* Map Centerpiece */}
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0A1019] shadow-2xl relative">
            <HistoricalMapView
              currentTime={currentTime}
              vessels={vesselsList}
              mode={replayData?.mode || "replay"}
              selectedVessel={selectedVessel}
              selectedPortId={selectedPortId}
              onSelectVessel={setSelectedVessel}
              onSelectPort={setSelectedPortId}
              showRoutes={true}
            />

            {/* No Data Overlay when scrubbed prior to history */}
            {replayData?.status === "no_data_before_history" && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center z-20">
                <AlertTriangle className="h-10 w-10 text-amber-400" />
                <h3 className="text-lg font-bold text-ink">No Historical Data For This Instant</h3>
                <p className="text-xs font-mono text-ink-2 max-w-md">
                  Real AIS telemetry recording began at {historyStartDateStr}. Position records prior to this point do not exist and are not fabricated.
                </p>
                <button
                  type="button"
                  onClick={handleJumpToNow}
                  className="mt-2 px-4 py-2 rounded-xl bg-accent text-black font-bold text-xs shadow-lg hover:bg-accent/90 transition cursor-pointer font-mono"
                >
                  Jump to Live Telemetry
                </button>
              </div>
            )}
          </div>

          {/* Interactive Timeline Controller */}
          <TimelineController
            currentTime={currentTime}
            startTime={startTime}
            endTime={endTime}
            nowTime={now}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            coverageHourly={coverage?.hourly}
            oldestRecordTs={coverage?.oldestRecordTs}
            onTimeChange={(val) => {
              setIsPlaying(false);
              setCurrentTime(val);
            }}
            onTogglePlay={handleTogglePlay}
            onReset={handleReset}
            onJumpToNow={handleJumpToNow}
            onSpeedChange={setPlaybackSpeed}
            onStepBackward={handleStepBackward}
            onStepForward={handleStepForward}
          />

          {/* Debug Line */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-xl border border-white/10 bg-[#0A1019] text-[11px] font-mono text-ink-3">
            <div className="flex items-center gap-4">
              <span>Recorded Samples: <b className="text-ink">{replayData?.debug?.recordedSamples || 0}</b></span>
              <span>Interpolated: <b className="text-accent">{replayData?.debug?.interpolated || 0}</b></span>
              <span>Gap Vessels: <b className="text-amber-400">{replayData?.debug?.gapVessels || 0}</b></span>
              <span>Forecast Vessels: <b className="text-purple-400">{replayData?.debug?.forecastVessels || 0}</b></span>
            </div>
            <div>
              <span>Rendered on Map: <b className="text-emerald-400">{vesselsList.length}</b> vessels</span>
            </div>
          </div>

          {/* Forecast Arrivals Panel (For times after NOW) */}
          {isFuture && replayData?.portArrivals && (
            <div className="glass-panel rounded-2xl p-5 border border-purple-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-ink font-mono uppercase tracking-wider">
                    Forecast Port Arrivals (+{Math.round((currentTime - now) / 3600000)}h Horizon)
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Forecast, low confidence · Nautical corridor dead-reckoning
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {replayData.portArrivals.map((p) => {
                  const delta = p.predictedCount - p.currentCount;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPortId(p.id)}
                      className={`p-4 rounded-xl border transition cursor-pointer ${
                        selectedPortId === p.id
                          ? "bg-purple-500/15 border-purple-400 shadow-lg"
                          : "bg-[#0A1019] border-white/10 hover:border-purple-400/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink text-sm">{p.name}</span>
                        {p.forecastIndex !== null && (
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                            CI: {p.forecastIndex}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-ink font-mono">{p.predictedCount}</span>
                        <span className="text-xs font-mono text-ink-3">predicted within 25km</span>
                        <span className={`text-xs font-mono ml-auto ${delta >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {delta >= 0 ? `+${delta}` : delta} vs now
                        </span>
                      </div>

                      {p.topIncoming?.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1">
                          <span className="text-[10px] font-mono text-ink-3 uppercase tracking-wider block">
                            Top Incoming Vessels:
                          </span>
                          {p.topIncoming.map((v, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] font-mono text-ink-2">
                              <span className="truncate max-w-[150px]">{v.name}</span>
                              <span className="text-purple-300 text-[10px]">{v.eta}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Vessel Inspector */}
          {selectedVessel && (
            <div className="glass-panel rounded-2xl p-4 border border-accent/30 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Ship className="h-4 w-4 text-accent" />
                  <span className="font-bold text-ink">{selectedVessel.name}</span>
                  <span className="text-xs font-mono text-ink-3">(MMSI: {selectedVessel.mmsi})</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    selectedVessel.source === "forecast"
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-accent/20 text-accent"
                  }`}>
                    {selectedVessel.source.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-ink-2">
                  <span>Speed: <b>{selectedVessel.sog} kn</b></span>
                  <span>Heading: <b>{selectedVessel.hdg}°</b></span>
                  <span>Coordinates: <b>{selectedVessel.lat.toFixed(4)}, {selectedVessel.lon.toFixed(4)}</b></span>
                  {selectedVessel.destination && <span>Dest: <b>{selectedVessel.destination}</b></span>}
                  <span>Confidence: <b>{Math.round((selectedVessel.confidence ?? 1.0) * 100)}%</b></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVessel(null)}
                className="px-3 py-1 rounded-xl border border-white/10 bg-[#0A1019] text-xs font-mono text-ink-2 hover:text-ink cursor-pointer"
              >
                Close ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Other Specialized Forensic Tabs */}
      {activeMode === "BLACK_BOX" && (
        <VesselBlackBox
          vessels={archive.vessels}
          selectedVessel={archive.vessels[0] || null}
          currentTime={currentTime}
          onSelectVessel={() => {}}
          onSeekTime={(t) => {
            setCurrentTime(t);
            setActiveMode("REPLAY");
          }}
        />
      )}

      {activeMode === "ANOMALIES" && (
        <AnomalyDetective
          anomalies={archive.anomalies}
          currentTime={currentTime}
          onSeekAnomaly={(t) => {
            setCurrentTime(t);
            setActiveMode("REPLAY");
          }}
        />
      )}

      {activeMode === "WHAT_IF" && (
        <WhatIfSimulator
          onNavigateToRipple={(p, d) => {
            setRippleInitialData({ portId: p, delayHours: d });
            setActiveMode("RIPPLE");
          }}
        />
      )}

      {activeMode === "RIPPLE" && (
        <RippleEffectNetwork
          initialPortId={rippleInitialData.portId}
          initialDelayHours={rippleInitialData.delayHours}
        />
      )}

      {activeMode === "PREDICTIVE" && <PredictiveIntelligence />}
      {activeMode === "INVESTIGATIONS" && <InvestigationWorkspace />}
    </div>
  );
}
