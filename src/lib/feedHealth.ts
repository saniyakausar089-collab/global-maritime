import { useEffect, useState } from "react";

export type FeedHealthState = "LIVE" | "DELAYED" | "STALE" | "OFFLINE";

interface FeedHealthData {
  state: FeedHealthState;
  lastSyncTime: number | null;
  message: string;
}

let currentFeedHealth: FeedHealthData = {
  state: "LIVE",
  lastSyncTime: Date.now(),
  message: "Connected to AIS relay",
};

const listeners = new Set<(data: FeedHealthData) => void>();

export function updateFeedHealth(data: Partial<FeedHealthData>) {
  currentFeedHealth = {
    ...currentFeedHealth,
    ...data,
  };
  listeners.forEach((listener) => listener(currentFeedHealth));
}

export function useFeedHealth(): FeedHealthData {
  const [health, setHealth] = useState<FeedHealthData>(currentFeedHealth);

  useEffect(() => {
    const listener = (data: FeedHealthData) => setHealth(data);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return health;
}
