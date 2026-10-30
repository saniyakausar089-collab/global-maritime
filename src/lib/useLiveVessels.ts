import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { API_BASE_URL, WS_BASE_URL, getShipTypeLabel, type Port } from "@/lib/api";

export type LiveVessel = {
  id: number;
  mmsi: number;
  name: string;
  ship_name: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  hdg: number;
  heading: number;
  type: number;
  shipType: number;
  shipTypeLabel: string;
  stationary: boolean;
  seen: number;
  lastSeen: number;
  t: number;
  ox: number;
  oy: number;
  portId?: string | null;
  portName?: string;
  distanceToPortKm?: number;
};

export type PortStat = {
  id: string;
  name?: string;
  lat?: number;
  lon?: number;
  total: number;
  slow: number;
  index: number | null;
  congestion_index?: number | null;
  waiting?: number;
};

export type ConnectionStatus = "probing" | "waking_up" | "live" | "reconnecting" | "offline";

export function deadReckonPos(s: LiveVessel, now: number): [number, number] {
  let la = s.lat;
  let lo = s.lon;
  if (s.sog > 0.5) {
    const el = Math.min(45, (now - s.t) / 1000);
    const m = s.sog * 0.514444 * el;
    const r = (s.cog * Math.PI) / 180;
    la += (m * Math.cos(r)) / 111320;
    lo += (m * Math.sin(r)) / (111320 * Math.cos((la * Math.PI) / 180));
  }
  if (s.ox || s.oy) {
    const k = Math.exp(-(now - s.t) / 2000);
    lo += s.ox * k;
    la += s.oy * k;
  }
  return [lo, la];
}

export function useLiveVessels() {
  const [vesselsMap, setVesselsMap] = useState<Map<number, LiveVessel>>(new Map());
  const [status, setStatus] = useState<ConnectionStatus>("probing");
  const statusRef = useRef<ConnectionStatus>("probing");
  statusRef.current = status;
  const [statusMessage, setStatusMessage] = useState<string>("Connecting to relay...");
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [portsStats, setPortsStats] = useState<PortStat[]>([]);

  const [search, setSearch] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedPortId, setSelectedPortId] = useState<string>("all");
  const [selectedVessel, setSelectedVessel] = useState<LiveVessel | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const vesselsRef = useRef<Map<number, LiveVessel>>(new Map());
  const lastMsgRef = useRef<number>(Date.now());
  const attemptRef = useRef<number>(0);

  const connectWsRef = useRef<() => void>(() => {});

  const upsertVessel = useCallback(
    (a: [number, string, number, number, number, number, number, number]) => {
      const [id, name, lat, lon, sog, cog, hdg, type] = a;
      const now = Date.now();
      const o = vesselsRef.current.get(id);
      const s: LiveVessel = {
        id,
        mmsi: id,
        name: name || `VESSEL-${id}`,
        ship_name: name || `VESSEL-${id}`,
        lat,
        lon,
        sog: sog || 0,
        cog: cog || 0,
        hdg: hdg ?? cog ?? 0,
        heading: hdg ?? cog ?? 0,
        type: type || 0,
        shipType: type || 0,
        shipTypeLabel: getShipTypeLabel(type),
        stationary: (sog || 0) < 0.5,
        seen: now,
        lastSeen: now,
        t: now,
        ox: 0,
        oy: 0,
      };

      if (o) {
        const p = deadReckonPos(o, now);
        const dx = p[0] - lon;
        const dy = p[1] - lat;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          s.ox = dx;
          s.oy = dy;
        }
      }

      vesselsRef.current.set(id, s);
    },
    [],
  );

  // Probe server /health with backoff for Render cold start
  const probeAndConnect = useCallback(async (attempt = 1, maxAttempts = 5) => {
    if (cancelledRef.current) return;

    if (attempt > 1) {
      setStatus("waking_up");
      setStatusMessage(
        `Waking up server... (Render free tier spin-up, attempt ${attempt}/${maxAttempts})`,
      );
    } else {
      setStatus("probing");
      setStatusMessage("Connecting to relay...");
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        attemptRef.current = 0;
        connectWsRef.current();
        return;
      }
      throw new Error(`Server returned HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[Relay Probe] Attempt ${attempt} failed for ${API_BASE_URL}/health:`, err);
      if (attempt < maxAttempts) {
        const delay = Math.min(attempt * 2500, 12000);
        retryTimerRef.current = setTimeout(() => {
          probeAndConnect(attempt + 1, maxAttempts);
        }, delay);
      } else {
        setStatus("offline");
        setStatusMessage(
          `Server offline (${err instanceof Error ? err.message : "Unreachable"}). Retrying...`,
        );
        retryTimerRef.current = setTimeout(() => {
          probeAndConnect(1, maxAttempts);
        }, 5000);
      }
    }
  }, []);

  const connectWs = useCallback(() => {
    if (cancelledRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setStatus("probing");
    setStatusMessage("Connecting to stream...");

    const wakeTimer = setTimeout(() => {
      if (statusRef.current === "probing") {
        setStatus("waking_up");
        setStatusMessage("Waking up server...");
      }
    }, 3500);

    try {
      const ws = new WebSocket(WS_BASE_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        clearTimeout(wakeTimer);
        attemptRef.current = 0;
        lastMsgRef.current = Date.now();
        setStatus("live");
        setStatusMessage("LIVE");
        console.log(`[LiveVessels] Connected to WebSocket at ${WS_BASE_URL}`);
      };

      ws.onmessage = (event) => {
        lastMsgRef.current = Date.now();
        try {
          const msg = JSON.parse(event.data);

          // Support both port-monitor-live { t: "snap"|"diff" } and older { type: "snapshot"|"diff" }
          if (msg.t === "snap") {
            vesselsRef.current.clear();
            setIsSimulated(msg.mode === "sim");
            if (Array.isArray(msg.v)) {
              msg.v.forEach(
                (item: [number, string, number, number, number, number, number, number]) =>
                  upsertVessel(item),
              );
            }
            if (Array.isArray(msg.ports)) {
              setPortsStats(msg.ports);
            }
            setVesselsMap(new Map(vesselsRef.current));
          } else if (msg.t === "diff") {
            if (Array.isArray(msg.v)) {
              msg.v.forEach(
                (item: [number, string, number, number, number, number, number, number]) =>
                  upsertVessel(item),
              );
            }
            if (Array.isArray(msg.gone)) {
              msg.gone.forEach((id: number) => vesselsRef.current.delete(id));
            }
            if (Array.isArray(msg.ports)) {
              setPortsStats(msg.ports);
            }
            setVesselsMap(new Map(vesselsRef.current));
          } else if (msg.type === "snapshot" && Array.isArray(msg.vessels)) {
            vesselsRef.current.clear();
            for (const v of msg.vessels) {
              upsertVessel([
                v.mmsi || v.id,
                v.ship_name || v.name || "",
                v.lat,
                v.lon,
                v.sog || 0,
                v.cog || 0,
                v.heading ?? v.cog ?? 0,
                v.shipType || 0,
              ]);
            }
            setVesselsMap(new Map(vesselsRef.current));
          } else if (msg.type === "diff") {
            if (Array.isArray(msg.updated)) {
              for (const v of msg.updated) {
                upsertVessel([
                  v.mmsi || v.id,
                  v.ship_name || v.name || "",
                  v.lat,
                  v.lon,
                  v.sog || 0,
                  v.cog || 0,
                  v.heading ?? v.cog ?? 0,
                  v.shipType || 0,
                ]);
              }
            }
            if (Array.isArray(msg.removed)) {
              for (const id of msg.removed) {
                vesselsRef.current.delete(id);
              }
            }
            setVesselsMap(new Map(vesselsRef.current));
          }
        } catch (e) {
          console.error("[LiveVessels] Error processing WS packet:", e);
        }
      };

      ws.onclose = () => {
        clearTimeout(wakeTimer);
        wsRef.current = null;
        if (!cancelledRef.current) {
          setStatus("reconnecting");
          setStatusMessage("Reconnecting...");
          const delay = Math.min(10000, 1000 * Math.pow(2, attemptRef.current++));
          retryTimerRef.current = setTimeout(() => {
            connectWsRef.current();
          }, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      console.error("[LiveVessels] Failed to create WebSocket:", err);
      setStatus("offline");
      setStatusMessage("Failed to connect");
    }
  }, [upsertVessel]);

  connectWsRef.current = connectWs;

  // 10s no-heartbeat detection loop
  useEffect(() => {
    heartbeatTimerRef.current = setInterval(() => {
      if (
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN &&
        Date.now() - lastMsgRef.current > 10000
      ) {
        console.warn("[LiveVessels] No heartbeat received in 10s. Triggering reconnect...");
        wsRef.current.close();
      }
    }, 3000);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    probeAndConnect(1, 5);

    const onWakeOrFocus = () => {
      if (statusRef.current === "offline" || statusRef.current === "reconnecting") {
        probeAndConnect(1, 5);
      }
    };
    window.addEventListener("focus", onWakeOrFocus);
    window.addEventListener("online", onWakeOrFocus);

    return () => {
      cancelledRef.current = true;
      window.removeEventListener("focus", onWakeOrFocus);
      window.removeEventListener("online", onWakeOrFocus);
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [probeAndConnect]);

  const vesselsList = useMemo(() => Array.from(vesselsMap.values()), [vesselsMap]);

  // Filtered vessel list based on search, type, and port
  const filteredVessels = useMemo(() => {
    const q = search.trim().toLowerCase();

    return vesselsList.filter((v) => {
      // Type filter
      if (typeFilter !== "all") {
        const t = v.shipTypeLabel?.toLowerCase() || "";
        if (typeFilter === "cargo" && !t.includes("cargo")) return false;
        if (typeFilter === "tanker" && !t.includes("tanker")) return false;
        if (typeFilter === "passenger" && !t.includes("passenger")) return false;
        if (
          typeFilter === "other" &&
          (t.includes("cargo") || t.includes("tanker") || t.includes("passenger"))
        ) {
          return false;
        }
      }

      // Search filter
      if (q) {
        const matchName =
          v.name?.toLowerCase().includes(q) || v.ship_name?.toLowerCase().includes(q);
        const matchMmsi = String(v.mmsi || v.id).includes(q);
        if (!matchName && !matchMmsi) return false;
      }

      return true;
    });
  }, [vesselsList, search, typeFilter]);

  return {
    vesselsMap,
    vesselsList,
    filteredVessels,
    totalCount: vesselsMap.size,
    filteredCount: filteredVessels.length,
    status,
    statusMessage,
    isSimulated,
    portsStats,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    selectedPortId,
    setSelectedPortId,
    selectedVessel,
    setSelectedVessel,
  };
}
