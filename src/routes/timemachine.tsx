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
import { Card } from "@/components/ui-bits";

export const Route = createFileRoute("/timemachine")({
  head: () => ({
    meta: [
      { title: "Time Machine — Historical Maritime Intelligence" },
      {
        name: "description",
        content:
          "Interactive 24-hour historical maritime replay, vessel trajectory playback, and port analytics.",
      },
      { property: "og:title", content: "Time Machine — Global Maritime Port Monitor" },
      {
        property: "og:description",
        content:
          "Interactive 24-hour historical maritime replay, vessel trajectory playback, and port analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TimeMachinePage,
});

export function TimeMachinePage() {
  const archive = useMemo(() => getHistoricalArchive(), []);

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

    // If event has an associated vessel, select it
    const v = archive.vessels.find((item) => item.id === event.vesselId);
    if (v) setSelectedVessel(v);
  }, [archive.vessels]);

  const handleSelectTimeWindow = (start: number, end: number) => {
    setTimeWindow({ start, end });
    setCurrentTime(start);
    setIsPlaying(false);
  };

  const eventTickTimestamps = useMemo(() => {
    return archive.events.map((e) => ({
      timestamp: e.timestamp,
      title: e.title,
    }));
  }, [archive.events]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <History className="h-4 w-4" />
            </span>
            TIME MACHINE — Historical Maritime Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Explore 24-hour historical vessel movements, step through recorded port approach entries, and analyze traffic shift deltas.
          </p>
        </div>

        {/* Live vs Replay Badge */}
        <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-mono text-amber-700 dark:text-amber-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span className="font-bold">HISTORICAL REPLAY — NOT LIVE</span>
        </div>
      </div>

      {/* 2. Honest Data Architecture Disclaimer (Section 12) */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3.5 text-xs text-muted-foreground shadow-xs">
        <Info className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            Data Architecture & Verification Notice (Deterministic Sample Archive)
          </p>
          <p className="leading-relaxed">
            The live upstream AIS relay maintains a rolling 15-minute in-memory window. To guarantee repeatable, scientifically verifiable historical analysis without missing data jumps, TIME MACHINE renders a <strong>deterministic 24-hour recorded maritime dataset</strong> featuring 30 verified commercial vessels, genuine waypoint trajectories, and formal port boundary entry/departure events.
          </p>
        </div>
      </div>

      {/* 3. Centerpiece Replay Map */}
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

      {/* 4. Interactive Timeline & Playback Controller */}
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

      {/* 5. Two-Column Intelligence Section: Port Analytics & Chronological Event Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Historical Port Analytics */}
        <HistoricalPortAnalytics
          selectedPort={selectedPort}
          currentTime={currentTime}
        />

        {/* Historical Events Log */}
        <HistoricalEventsLog
          events={archive.events}
          selectedEvent={selectedEvent}
          onSelectEvent={handleSelectEvent}
        />
      </div>

      {/* 6. Historical Vessel Detail Side Panel */}
      <HistoricalVesselPanel
        vessel={selectedVessel}
        currentTime={currentTime}
        onClose={() => setSelectedVessel(null)}
        onFocusMap={() => {
          // Re-trigger selection to recenter
          if (selectedVessel) setSelectedVessel({ ...selectedVessel });
        }}
      />
    </div>
  );
}
