import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Clock,
  Gauge,
  Calendar,
  Sparkles,
} from "lucide-react";

export interface TimelineControllerProps {
  currentTime: number;
  startTime: number;
  endTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTimeChange: (newTime: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onSelectTimeWindow?: (start: number, end: number) => void;
  eventTimestamps?: Array<{ timestamp: number; title: string }>;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 5, 10];

export function TimelineController({
  currentTime,
  startTime,
  endTime,
  isPlaying,
  playbackSpeed,
  onTimeChange,
  onTogglePlay,
  onReset,
  onSpeedChange,
  onStepBackward,
  onStepForward,
  onSelectTimeWindow,
  eventTimestamps = [],
}: TimelineControllerProps) {
  const [sliderVal, setSliderVal] = useState(currentTime);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setSliderVal(currentTime);
    }
  }, [currentTime]);

  const progressPercent = Math.min(
    100,
    Math.max(0, ((currentTime - startTime) / (endTime - startTime)) * 100),
  );

  const currentDate = new Date(currentTime);
  const utcDateStr = currentDate.toISOString().slice(0, 10);
  const utcTimeStr = `${currentDate.getUTCHours().toString().padStart(2, "0")}:${currentDate
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")}:${currentDate.getUTCSeconds().toString().padStart(2, "0")} UTC`;

  const localTimeStr = currentDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderVal(val);
    onTimeChange(val);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-md space-y-3">
      {/* Top Bar: Playback Controls, UTC Replay Clock, and Playback Speed */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Playback Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onReset}
            title="Reset to Start"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onStepBackward}
            title="Step Backward (1 hour)"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onTogglePlay}
            title={isPlaying ? "Pause Replay" : "Play Replay"}
            className="flex h-9 px-3.5 items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:bg-primary/90 transition"
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Play
              </>
            )}
          </button>
          <button
            onClick={onStepForward}
            title="Step Forward (1 hour)"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Current Replay Timestamp Display */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1 font-mono text-xs">
          <Clock className="h-3.5 w-3.5 text-cyan-500" />
          <span className="font-bold text-foreground">{utcTimeStr}</span>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-muted-foreground">{utcDateStr}</span>
          <span className="hidden md:inline text-muted-foreground/60 text-[11px]">
            ({localTimeStr} Local)
          </span>
        </div>

        {/* Playback Speed Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline flex items-center gap-1">
            <Gauge className="h-3 w-3" /> Speed:
          </span>
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 text-xs">
            {PLAYBACK_SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
                  playbackSpeed === s
                    ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Seek Slider & Track */}
      <div className="space-y-1.5 pt-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min={startTime}
            max={endTime}
            step={60000} // 1 minute resolution
            value={sliderVal}
            onMouseDown={() => (isDraggingRef.current = true)}
            onMouseUp={() => (isDraggingRef.current = false)}
            onTouchStart={() => (isDraggingRef.current = true)}
            onTouchEnd={() => (isDraggingRef.current = false)}
            onChange={handleSliderChange}
            className="w-full h-2.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />

          {/* Event Tick Marks along the timeline */}
          {eventTimestamps.map((evt, idx) => {
            const leftPct = Math.min(
              100,
              Math.max(0, ((evt.timestamp - startTime) / (endTime - startTime)) * 100),
            );
            return (
              <div
                key={idx}
                style={{ left: `${leftPct}%` }}
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-1 bg-amber-400 rounded-full shadow-sm"
                title={evt.title}
              />
            );
          })}
        </div>

        {/* Timeline Axis Labels (Hour markers 00:00, 06:00, 12:00, 18:00, 24:00) */}
        <div className="flex justify-between text-[11px] font-mono text-muted-foreground px-1">
          <span>00:00 UTC</span>
          <span>06:00 UTC</span>
          <span>12:00 UTC</span>
          <span>18:00 UTC</span>
          <span>24:00 UTC</span>
        </div>
      </div>

      {/* Quick Time Window Presets */}
      {onSelectTimeWindow && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium mr-1">Replay Range:</span>
            <button
              onClick={() => onSelectTimeWindow(startTime, endTime)}
              className="rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-secondary text-foreground"
            >
              Full 24 Hours
            </button>
            <button
              onClick={() => onSelectTimeWindow(startTime, startTime + 12 * 3600 * 1000)}
              className="rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-secondary text-foreground"
            >
              00:00 – 12:00 UTC
            </button>
            <button
              onClick={() => onSelectTimeWindow(startTime + 12 * 3600 * 1000, endTime)}
              className="rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-secondary text-foreground"
            >
              12:00 – 24:00 UTC
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-[11px]">Gold ticks denote recorded port events</span>
          </div>
        </div>
      )}
    </div>
  );
}

