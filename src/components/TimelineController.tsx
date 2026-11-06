import { useState, useEffect, useRef, useCallback } from "react";
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
  Zap,
} from "lucide-react";

export interface TimelineControllerProps {
  currentTime: number;
  startTime: number;
  endTime: number;
  nowTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  coverageHourly?: Array<{ hour_bucket: string; vessel_count: number; sample_count: number }>;
  oldestRecordTs?: number | null;
  onTimeChange: (newTime: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onJumpToNow: () => void;
  onSpeedChange: (speed: number) => void;
  onStepBackward: () => void; // -15 min
  onStepForward: () => void;  // +15 min
}

const PLAYBACK_SPEEDS = [1, 5, 15, 60, 360];

export function TimelineController({
  currentTime,
  startTime,
  endTime,
  nowTime,
  isPlaying,
  playbackSpeed,
  coverageHourly = [],
  oldestRecordTs,
  onTimeChange,
  onTogglePlay,
  onReset,
  onJumpToNow,
  onSpeedChange,
  onStepBackward,
  onStepForward,
}: TimelineControllerProps) {
  const [sliderVal, setSliderVal] = useState(currentTime);
  const isDraggingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setSliderVal(currentTime);
    }
  }, [currentTime]);

  // Keyboard navigation (+/- 15 min with Left/Right arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onStepBackward();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onStepForward();
      } else if (e.key === " ") {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onStepBackward, onStepForward, onTogglePlay]);

  const totalDuration = Math.max(1, endTime - startTime);
  const progressPercent = Math.min(
    100,
    Math.max(0, ((currentTime - startTime) / totalDuration) * 100),
  );
  const nowPercent = Math.min(
    100,
    Math.max(0, ((nowTime - startTime) / totalDuration) * 100),
  );

  const isFuture = currentTime > nowTime + 60000;
  const isPast = currentTime < nowTime - 60000;

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

  // Format datetime-local input string YYYY-MM-DDTHH:MM
  const toLocalInputValue = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderVal(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onTimeChange(val);
    }, 100);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = new Date(e.target.value);
    if (!isNaN(parsed.getTime())) {
      onTimeChange(parsed.getTime());
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-2xl border border-white/10 space-y-4">
      {/* Top Bar: Controls, Time Picker, Status Pill & Speeds */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Playback Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReset}
            title="Jump to Oldest Recorded Data"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white transition cursor-pointer shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onStepBackward}
            title="Step Backward 15 Minutes (← arrow key)"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white transition cursor-pointer shadow-sm"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause Replay (Space)" : "Play Replay (Space)"}
            className={`flex h-8 px-4 items-center justify-center gap-1.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-lg ${
              isPlaying
                ? "bg-amber-400 text-black hover:bg-amber-300 shadow-amber-400/20"
                : "bg-accent text-black hover:bg-accent/90 shadow-accent/20"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" /> Play
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onStepForward}
            title="Step Forward 15 Minutes (→ arrow key)"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white transition cursor-pointer shadow-sm"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onJumpToNow}
            title="Jump to Current Live Instant"
            className="flex h-8 px-3 items-center justify-center gap-1.5 rounded-xl border border-accent/60 bg-accent/20 text-accent hover:bg-accent hover:text-black transition cursor-pointer text-xs font-mono font-bold shadow-sm"
          >
            <Zap className="h-3 w-3 fill-current" /> Jump to Now
          </button>
        </div>

        {/* Status Pill (Replay vs Live vs Forecast) */}
        <div className="flex items-center gap-2">
          {isFuture ? (
            <div className="flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/15 px-3 py-1 text-xs font-mono text-purple-300 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
              </span>
              <span className="font-bold uppercase tracking-wider">
                Forecast (+{Math.round((currentTime - nowTime) / 3600000)}h)
              </span>
            </div>
          ) : isPast ? (
            <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-mono text-amber-300 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="font-bold uppercase tracking-wider">Historical Replay</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-mono text-emerald-300 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-bold uppercase tracking-wider">Live Instant</span>
            </div>
          )}
        </div>

        {/* Exact Date-Time Input & Formatted Timestamp */}
        <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-1 font-mono text-xs text-white shadow-sm">
          <Clock className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="font-bold text-accent">{utcTimeStr}</span>
          <span className="text-white/30">|</span>
          <span className="text-slate-200">{utcDateStr}</span>
          <span className="hidden md:inline text-slate-400 text-[11px]">
            ({localTimeStr} Local)
          </span>
          <input
            type="datetime-local"
            value={toLocalInputValue(currentDate)}
            onChange={handleDateInputChange}
            className="ml-1 bg-black/60 border border-white/25 rounded px-2 py-0.5 text-xs text-white [color-scheme:dark] hover:border-accent focus:outline-none focus:border-accent cursor-pointer"
            title="Select exact date and time"
          />
        </div>

        {/* Playback Speeds */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-slate-300 hidden sm:inline flex items-center gap-1 font-semibold">
            <Gauge className="h-3 w-3 text-accent" /> Speed:
          </span>
          <div className="flex items-center gap-1 rounded-xl border border-white/20 bg-white/5 p-1 text-xs">
            {PLAYBACK_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSpeedChange(s)}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition cursor-pointer ${
                  playbackSpeed === s
                    ? "bg-accent text-black shadow-md shadow-accent/25"
                    : "text-slate-300 hover:text-white hover:bg-white/15"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Timeline Bar with Shaded Real-Data vs Gap Coverage Band and NOW Marker */}
      <div className="space-y-2 pt-2">
        <div className="relative flex items-center select-none">
          {/* Background Track with Coverage Bands */}
          <div className="relative w-full h-4 rounded-lg overflow-hidden bg-[#0A1019] border border-white/10">
            {/* Real Data Shading (Left of NOW) */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-emerald-500/15 border-r border-accent"
              style={{ width: `${nowPercent}%` }}
              title="Recorded Telemetry Region"
            />
            {/* Forecast Shading (Right of NOW) */}
            <div
              className="absolute top-0 bottom-0 bg-purple-500/20"
              style={{ left: `${nowPercent}%`, right: 0 }}
              title="Forecasting Horizon (+72h)"
            />

            {/* Coverage Hour Density Marks */}
            {coverageHourly.map((h, idx) => {
              const hTs = new Date(h.hour_bucket).getTime();
              if (hTs < startTime || hTs > endTime) return null;
              const leftPct = ((hTs - startTime) / totalDuration) * 100;
              const widthPct = (3600000 / totalDuration) * 100;
              return (
                <div
                  key={idx}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className="absolute top-0 bottom-0 bg-cyan-400/25 border-l border-cyan-400/30"
                  title={`${h.hour_bucket}: ${h.vessel_count} recorded vessels`}
                />
              );
            })}

            {/* NOW Marker on the track */}
            <div
              style={{ left: `${nowPercent}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-accent z-10 shadow-[0_0_8px_#5EE7FF]"
            />
          </div>

          {/* Interactive Range Input */}
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
            className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer z-20"
          />

          {/* Custom Current Position Scrubber Handle */}
          <div
            style={{ left: `${progressPercent}%` }}
            className={`pointer-events-none absolute -top-1.5 -bottom-1.5 w-3.5 -ml-1.75 rounded-full border-2 shadow-xl z-30 transition-transform ${
              isFuture
                ? "bg-purple-400 border-white shadow-[0_0_12px_#C084FC]"
                : "bg-accent border-white shadow-[0_0_12px_#5EE7FF]"
            }`}
          />
        </div>

        {/* Timeline Axis Labels */}
        <div className="flex justify-between text-[11px] font-mono text-ink-3 px-1">
          <span>{new Date(startTime).toISOString().slice(5, 16).replace("T", " ")} UTC</span>
          <span className="text-emerald-400 font-semibold">◀ Recorded History</span>
          <span className="text-accent font-bold">● NOW</span>
          <span className="text-purple-400 font-semibold">Forecast Ahead ▶</span>
          <span>+{Math.round((endTime - nowTime) / 3600000)}h Forecast</span>
        </div>
      </div>
    </div>
  );
}
