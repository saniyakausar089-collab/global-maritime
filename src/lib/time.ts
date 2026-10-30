import { useEffect, useState } from "react";

/**
 * Hook providing a live Date object that ticks every second.
 * Automatically clears interval on unmount.
 */
export function useLiveTime(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return now;
}

/** Formats a Date into standard UTC clock string `HH:MM:SS UTC`. */
export function formatUtcClock(date: Date | null): string {
  if (!date) return "--:--:-- UTC";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

/** Formats relative time elapsed since `timestamp` in seconds/minutes/hours. */
export function formatTimeAgo(timestamp?: number, currentNow?: Date | null): string {
  if (!timestamp) return "—";
  const nowMs = currentNow ? currentNow.getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}
