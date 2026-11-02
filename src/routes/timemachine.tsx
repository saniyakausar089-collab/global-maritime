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
  Flame,
  CheckCircle2,
} from "lucide-react";
import {
  getHistoricalArchive,
  ARCHIVE_START_TIME,
  ARCHIVE_END_TIME,
  type HistoricalVessel,
  type HistoricalEvent,
  type PortArea,
  MONITORED_PORTS,
} from "@/lib/historicalData";
import { HistoricalMapView } from "@/components/HistoricalMapView";
import { TimelineController } from "@/components/TimelineController";
import { HistoricalVesselPanel } from "@/components/HistoricalVesselPanel";
import { HistoricalPortAnalytics } from "@/components/HistoricalPortAnalytics";
import { HistoricalEventsLog } from "@/components/HistoricalEventsLog";
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
import { Card } from "@/components/ui-bits";

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

export const Route = createFileRoute("/timemachine")({
  head: () => ({
    meta: [
      { title: "Time Machine — Flagship Maritime Intelligence Platform" },
      {
        name: "description",
        content:
          "Temporal maritime intelligence: 24h vessel replay, black box telemetry, rule-based anomaly detection, what-if queue simulation, knowledge graph, forecasting, and ripple network.",
      },
      { property: "og:title", content: "Time Machine — Global Maritime Port Monitor" },
      {
        property: "og:description",
        content:
          "Temporal maritime intelligence: 24h vessel replay, black box telemetry, rule-based anomaly detection, what-if queue simulation, knowledge graph, forecasting, and ripple network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TimeMachinePage,
});

export function TimeMachinePage() {
  const archive = useMemo(() => getHistoricalArchive(), []);

  // Active Workspace Mode
  const [activeMode, setActiveMode] = useState<TimeMachineMode>("REPLAY");

  // Timeline Replay State
  const [currentTime, setCurrentTime] = useState<number>(ARCHIVE_START_TIME);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [timeWindow, setTimeWindow] = useState<{ start: number; end: number }>({
    start: ARCHIVE_START_TIME,
    end: ARCHIVE_END_TIME,
  });

  // Selection State
  const [selectedVessel, setSelectedVessel] = useState<HistoricalVessel | null>(null);
  const [selectedPort, setSelectedPort] = useState<PortArea | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(null);

  // Ripple state passed from What-If simulation
  const [rippleInitialData, setRippleInitialData] = useState<{ portId: string; delayHours: number }>({
    portId: "rotterdam",
    delayHours: 12,
  });

  // Map Layer Toggles
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [showEvents, setShowEvents] = useState<boolean>(true);

  // Animation frame / timer for replay loop
  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Filter vessels if a specific port is selected
  const visibleVessels = useMemo(() => {
    if (!selectedPort) return archive.vessels;
    return archive.vessels.filter((v) => v.portId === selectedPort.id);
  }, [archive.vessels, selectedPort]);

  // Main Replay Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTickRef.current = Date.now();

    const loop = () => {
      const now = Date.now();
      const elapsedMs = now - lastTickRef.current;
      lastTickRef.current = now;

      // 1 real second = 6 minutes in real world at 1x speed (360x time compression for smooth visualization)
      const simulatedStepMs = elapsedMs * 360 * playbackSpeed;

      setCurrentTime((prev) => {
        const next = prev + simulatedStepMs;
        if (next >= timeWindow.end) {
          setIsPlaying(false);
          return timeWindow.end;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, timeWindow.end]);

  const handleTogglePlay = () => {
    if (currentTime >= timeWindow.end) {
      setCurrentTime(timeWindow.start);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(timeWindow.start);
  };

  const handleStepBackward = () => {
    setIsPlaying(false);
    setCurrentTime((t) => Math.max(timeWindow.start, t - 3600 * 1000));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentTime((t) => Math.min(timeWindow.end, t + 3600 * 1000));
  };

  const handleSelectEvent = useCallback((event: HistoricalEvent) => {
    setSelectedEvent(event);
    setCurrentTime(event.timestamp);
    setIsPlaying(false);

    const v = archive.vessels.find((item) => item.id === event.vesselId);
    if (v) setSelectedVessel(v);
  }, [archive.vessels]);

  const handleSelectTimeWindow = (start: number, end: number) => {
    setTimeWindow({ start, end });
    setCurrentTime(start);
    setIsPlaying(false);
  };

  const handleSeekAnomaly = useCallback((timestamp: number, vesselId: number) => {
    setCurrentTime(timestamp);
    setIsPlaying(false);
    const v = archive.vessels.find((item) => item.id === vesselId);
    if (v) setSelectedVessel(v);
    setActiveMode("REPLAY");
  }, [archive.vessels]);

  const handleNavigateToRipple = useCallback((portId: string, delayHours: number) => {
    setRippleInitialData({ portId, delayHours });
    setActiveMode("RIPPLE");
  }, []);

  const handleSelectVesselById = useCallback((vesselId: number) => {
    const v = archive.vessels.find((item) => item.id === vesselId);
    if (v) {
      setSelectedVessel(v);
      setActiveMode("REPLAY");
    }
  }, [archive.vessels]);

  const handleSelectPortById = useCallback((portId: string) => {
    const p = MONITORED_PORTS.find((item) => item.id === portId);
    if (p) {
      setSelectedPort(p);
      setActiveMode("REPLAY");
    }
  }, []);

  const eventTickTimestamps = useMemo(() => {
    return archive.events.map((e) => ({
      timestamp: e.timestamp,
      title: e.title,
    }));
  }, [archive.events]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5 font-sans">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <History className="h-4 w-4" />
            </span>
            TIME MACHINE — Temporal Maritime Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-mono">
            4-Dimensional kinematic replay, AIS black box telemetry, rule-based anomaly scoring, scenario queue simulations, and ripple network forecasting.
          </p>
        </div>

        {/* Live vs Replay Badge */}
        <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1 text-xs font-mono text-amber-400 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span className="font-bold">HISTORICAL REPLAY — VERIFIED ARCHIVE</span>
        </div>
      </div>

      {/* 2. Honest Data Architecture Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-card/60 p-3.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
        <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground font-mono">
            Deterministic Telemetry Architecture (Verified 24-Hour Archive)
          </p>
          <p className="leading-relaxed">
            The upstream live AIS relay retains a rolling 15-minute in-memory window. To guarantee scientifically verifiable forensics without unrecorded telemetry jumps, TIME MACHINE computes over a <strong>verified 24-hour deterministic recorded archive</strong> featuring 30 commercial vessels, continuous kinematic tracks with &gt;35m gap detection, rule-based anomaly scoring, and scenario queue simulations.
          </p>
        </div>
      </div>

      {/* 3. Flagship Command Center Navigation Tabs (11 Specialized Modes) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/80 text-xs scrollbar-none font-mono">
        {[
          { id: "REPLAY", label: "Digital Twin Replay", icon: History },
          { id: "BLACK_BOX", label: "Vessel Black Box", icon: Gauge },
          {
            id: "ANOMALIES",
            label: "Anomaly Detective 2.0",
            icon: ShieldAlert,
            badge: archive.anomalies.length,
          },
          { id: "WHAT_IF", label: "What-If Simulator", icon: SlidersHorizontal },
          { id: "RIPPLE", label: "Ripple Network", icon: Network },
          { id: "KNOWLEDGE_GRAPH", label: "Knowledge Graph", icon: Compass },
          { id: "PREDICTIVE", label: "Forecasting", icon: TrendingUp },
          { id: "CHANGE_DETECTION", label: "Change Detection", icon: Scale },
          { id: "ALERTS", label: "Alert Engine", icon: Bell },
          { id: "AI_ASSISTANT", label: "AI Assistant", icon: Bot },
          { id: "INVESTIGATIONS", label: "Incident Dossiers", icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMode(tab.id as TimeMachineMode)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 font-medium transition-all ${
                isActive
                  ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/80"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                    isActive
                      ? "bg-black/20 text-black font-extrabold"
                      : "bg-rose-500/20 text-rose-400 font-bold"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Active Workspace Views */}
      {activeMode === "REPLAY" && (
        <div className="space-y-6">
          {/* Map Layer Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-[11px]">Layer Toggles:</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTrails}
                  onChange={(e) => setShowTrails(e.target.checked)}
                  className="rounded-sm accent-cyan-400 cursor-pointer"
                />
                <span className="text-foreground">Wake Trails</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showRoutes}
                  onChange={(e) => setShowRoutes(e.target.checked)}
                  className="rounded-sm accent-cyan-400 cursor-pointer"
                />
                <span className="text-foreground">Full Waypoints</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showEvents}
                  onChange={(e) => setShowEvents(e.target.checked)}
                  className="rounded-sm accent-cyan-400 cursor-pointer"
                />
                <span className="text-foreground">Event Markers</span>
              </label>
            </div>

            {selectedPort && (
              <button
                onClick={() => setSelectedPort(null)}
                className="text-xs text-cyan-400 hover:underline font-mono"
              >
                Clear Sector Filter ({selectedPort.name}) ✕
              </button>
            )}
          </div>

          {/* Centerpiece Replay Map */}
          <div className="rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#080F20] shadow-2xl">
            <HistoricalMapView
              currentTime={currentTime}
              vessels={visibleVessels}
              events={archive.events}
              selectedVessel={selectedVessel}
              selectedPort={selectedPort}
              onSelectVessel={setSelectedVessel}
              onSelectPort={setSelectedPort}
              onSelectEvent={handleSelectEvent}
              showTrails={showTrails}
              showRoutes={showRoutes}
              showEvents={showEvents}
            />
          </div>

          {/* Interactive Timeline & Playback Controller */}
          <TimelineController
            currentTime={currentTime}
            startTime={timeWindow.start}
            endTime={timeWindow.end}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onTimeChange={(val) => {
              setIsPlaying(false);
              setCurrentTime(val);
            }}
            onTogglePlay={handleTogglePlay}
            onReset={handleReset}
            onSpeedChange={setPlaybackSpeed}
            onStepBackward={handleStepBackward}
            onStepForward={handleStepForward}
            onSelectTimeWindow={handleSelectTimeWindow}
            eventTimestamps={eventTickTimestamps}
          />

          {/* Intelligence Section: Port Analytics & Chronological Event Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <HistoricalPortAnalytics
              selectedPort={selectedPort}
              currentTime={currentTime}
            />

            <HistoricalEventsLog
              events={archive.events}
              selectedEvent={selectedEvent}
              onSelectEvent={handleSelectEvent}
            />
          </div>

          {/* Historical Vessel Detail Side Panel */}
          <HistoricalVesselPanel
            vessel={selectedVessel}
            currentTime={currentTime}
            onClose={() => setSelectedVessel(null)}
            onFocusMap={() => {
              if (selectedVessel) setSelectedVessel({ ...selectedVessel });
            }}
          />
        </div>
      )}

      {activeMode === "BLACK_BOX" && (
        <VesselBlackBox
          vessels={archive.vessels}
          selectedVessel={selectedVessel}
          currentTime={currentTime}
          onSelectVessel={setSelectedVessel}
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
          onSeekAnomaly={handleSeekAnomaly}
        />
      )}

      {activeMode === "WHAT_IF" && (
        <WhatIfSimulator
          onNavigateToRipple={handleNavigateToRipple}
        />
      )}

      {activeMode === "RIPPLE" && (
        <RippleEffectNetwork
          initialPortId={rippleInitialData.portId}
          initialDelayHours={rippleInitialData.delayHours}
        />
      )}

      {activeMode === "KNOWLEDGE_GRAPH" && (
        <TemporalKnowledgeGraph
          onSelectVessel={handleSelectVesselById}
          onSelectPort={handleSelectPortById}
          onSeekTime={(t) => {
            setCurrentTime(t);
            setActiveMode("REPLAY");
          }}
        />
      )}

      {activeMode === "PREDICTIVE" && (
        <PredictiveIntelligence />
      )}

      {activeMode === "CHANGE_DETECTION" && (
        <TemporalChangeDetection />
      )}

      {activeMode === "ALERTS" && (
        <TimeAwareAlerts
          onSeekTime={(t) => {
            setCurrentTime(t);
            setActiveMode("REPLAY");
          }}
        />
      )}

      {activeMode === "AI_ASSISTANT" && (
        <AiMaritimeAssistant
          currentTime={currentTime}
          onSeekTime={(t) => {
            setCurrentTime(t);
            setActiveMode("REPLAY");
          }}
          onSelectVessel={(v) => {
            setSelectedVessel(v);
            setActiveMode("REPLAY");
          }}
        />
      )}

      {activeMode === "INVESTIGATIONS" && (
        <InvestigationWorkspace />
      )}
    </div>
  );
}
