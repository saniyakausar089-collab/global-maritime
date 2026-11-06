import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import dotenv from "dotenv";

import { VesselStore } from "./storage.js";
import { AisStreamProvider } from "./providers/aisstreamProvider.js";
import { SatelliteStubProvider } from "./providers/satelliteStubProvider.js";
import { filterMetrics } from "./sanity.js";
import {
  estimateDeadReckonedPosition,
  getMaritimeLanesGeoJson,
  normalizeDestination,
  isNavigableWater,
  landCheckMetrics,
  KNOWN_PORTS,
} from "./maritimeRouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = process.env.PORT || 3000;
const KEY = (process.env.AISSTREAM_KEY || process.env.AISSTREAM_API_KEY || "").trim();
const DEMO_MODE = process.env.DEMO_MODE === "true";
const AIS_PROVIDER = (process.env.AIS_PROVIDER || "aisstream").toLowerCase();
const AIS_API_KEY = (process.env.AIS_API_KEY || KEY || "").trim();

// The 6 monitored strategic ports
export const PORTS = [
  { id: "rotterdam", name: "Rotterdam", lat: 51.92, lon: 4.17 },
  { id: "singapore", name: "Singapore", lat: 1.26, lon: 103.84 },
  { id: "shanghai", name: "Shanghai", lat: 31.23, lon: 121.8 },
  { id: "los-angeles", name: "Los Angeles", lat: 33.73, lon: -118.26 },
  { id: "hamburg", name: "Hamburg", lat: 53.54, lon: 9.97 },
  { id: "santos", name: "Santos", lat: -23.98, lon: -46.3 },
];

export function getShipTypeLabel(typeNum) {
  const t = Number(typeNum) || 0;
  if (t >= 70 && t <= 79) return "Cargo";
  if (t >= 80 && t <= 89) return "Tanker";
  if (t >= 60 && t <= 69) return "Passenger";
  if (t >= 50 && t <= 59) return "Special Craft / Tug";
  if (t === 30 || t === 31 || t === 32) return "Fishing";
  if (t >= 36 && t <= 37) return "Pleasure Craft";
  if (t > 0) return "Other";
  return "Unknown";
}

// Persistent Storage Engine (In-Memory + SQLite)
const store = new VesselStore();
const clients = new Set();
let idleTimer = null;

// Select and initialize AIS provider
let provider;
if (AIS_PROVIDER === "satellite") {
  provider = new SatelliteStubProvider(AIS_API_KEY, "Commercial-Satellite");
} else {
  provider = new AisStreamProvider(KEY);
}

provider.on("position", (pos) => {
  store.updatePosition(pos);
});

provider.on("static", (stat) => {
  store.updateStatic(stat);
});

provider.on("status", (s) => {
  console.log(`[Provider Status] ${s.state}: ${s.message}`);
});

provider.on("error", (err) => {
  console.error(`[Provider Error]`, err.message);
});

// Hourly history snapshots per port (for Compare & Detail charts)
const hourlyHistory = new Map();
PORTS.forEach((p) => hourlyHistory.set(p.id, []));

function recordHourlySnapshot() {
  const now = new Date();
  const hourStr = now.toISOString().slice(0, 13) + ":00";
  const stats = portStats();
  for (const p of stats) {
    const list = hourlyHistory.get(p.id) || [];
    const last = list[list.length - 1];
    if (last && last.hour === hourStr) {
      last.stationary = p.slow;
    } else {
      list.push({ hour: hourStr, stationary: p.slow });
      if (list.length > 48) list.shift();
    }
    hourlyHistory.set(p.id, list);
  }
}
recordHourlySnapshot();
setInterval(recordHourlySnapshot, 10 * 60 * 1000);

export function computePortMetrics(portId) {
  const stats = portStats();
  const p = stats.find((x) => x.id === portId);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    congestion_index: p.index,
    total_vessels: p.total,
    stationary_vessels: p.slow,
    moving_vessels: p.total - p.slow,
  };
}

export function portStats() {
  const allVessels = store.getAll();
  return PORTS.map((p) => {
    let total = 0,
      slow = 0;
    const k = Math.cos((p.lat * Math.PI) / 180);
    for (const v of allVessels.values()) {
      const dy = (v.lat - p.lat) * 111.32,
        dx = (v.lon - p.lon) * 111.32 * k;
      if (dx * dx + dy * dy > 25 * 25) continue;
      total++;
      if ((v.sog || 0) < 0.5) slow++;
    }
    const index = total >= 5 ? Math.min(2, +(0.6 + (1.6 * slow) / total).toFixed(2)) : null;
    return {
      id: p.id,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      index,
      congestion_index: index,
      total,
      total_vessels: total,
      slow,
      waiting: slow,
      stationary_vessels: slow,
      moving_vessels: total - slow,
    };
  });
}

// Compact binary/array representation for high performance WebSocket telemetry
// [id, name, lat, lon, sog, cog, hdg, type, source, confidence, destination, eta, last_report_at, opacity, isOldEstimate]
const compact = (v) => [
  v.id || v.mmsi,
  v.name || "",
  +v.lat.toFixed(4),
  +v.lon.toFixed(4),
  v.sog != null ? +v.sog.toFixed(1) : 0,
  v.cog != null ? Math.round(v.cog) : 0,
  v.hdg != null ? Math.round(v.hdg) : 0,
  v.type || 0,
  v.source || "live",
  v.confidence ?? 1.0,
  v.destination || "",
  v.eta || "",
  v.last_report_at || v.last_seen || v.seen || Date.now(),
  v.opacity ?? 1.0,
  v.isOldEstimate ? 1 : 0,
];

const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const broadcast = (o) => clients.forEach((ws) => send(ws, o));

// 2-second Broadcast & Estimation Loop
setInterval(() => {
  const now = Date.now();
  // Prune vessels older than 24 hours
  const gone = store.pruneStale();

  // Evaluate dead-reckoned positions for active vessels
  const allVessels = store.getAll();
  for (const [mmsi, v] of allVessels) {
    const elapsed = now - (v.last_seen || v.seen || now);
    if (elapsed > 10 * 60 * 1000) {
      const estimated = estimateDeadReckonedPosition(v, now);
      if (estimated) {
        allVessels.set(mmsi, estimated);
        store.dirtyMmsis.add(mmsi);
      } else {
        // Drop vessel if stale (>24h) or rejected by maritime land collision check
        allVessels.delete(mmsi);
        gone.push(mmsi);
      }
    }
  }

  const dirtyMmsis = store.getDirtyAndClear();
  const dirtyVessels = dirtyMmsis
    .filter((id) => allVessels.has(id))
    .map((id) => compact(allVessels.get(id)));

  if (clients.size) {
    broadcast({
      t: "diff",
      v: dirtyVessels,
      gone,
      ports: portStats(),
      provider: provider.name,
      demo_mode: DEMO_MODE,
    });
  }
}, 2000);

// Demo Simulation Mode (GATED STRICTLY BEHIND DEMO_MODE=true)
function startDemoSimulation() {
  console.warn("[DEMO MODE] Running synthetic vessel simulation (DEMO_MODE=true)");
  let n = 900000001;
  for (const p of PORTS) {
    for (let i = 0; i < 35; i++) {
      const anchored = Math.random() < 0.35;
      const v = {
        id: n,
        mmsi: n,
        name: `DEMO VESSEL ${n % 1000}`,
        lat: p.lat + (Math.random() - 0.5) * 0.7,
        lon: p.lon + (Math.random() - 0.5) * 0.7,
        sog: anchored ? 0 : 6 + Math.random() * 10,
        cog: Math.random() * 360,
        hdg: 0,
        type: Math.random() < 0.5 ? 70 : 80,
        destination: p.name.toUpperCase(),
        eta: "DEMO",
        last_seen: Date.now(),
        seen: Date.now(),
        source: "estimated",
        confidence: 0.85,
      };
      v.hdg = v.cog;
      store.getAll().set(n, v);
      n++;
    }
  }
}

if (DEMO_MODE) {
  startDemoSimulation();
}

const app = express();
app.use(express.json());

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,http://localhost:8080,http://localhost:8081,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:8080,http://127.0.0.1:8081,http://localhost:4173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  }),
);

// Health Endpoint
app.get("/health", (_, res) => {
  const all = [...store.getAll().values()];
  const liveCount = all.filter((v) => v.source === "live").length;
  const estCount = all.filter((v) => v.source === "estimated").length;

  res.json({
    ok: true,
    status: "ok",
    mode: DEMO_MODE ? "demo" : "live",
    demo_mode: DEMO_MODE,
    provider: provider.name,
    upstreamConnected: provider.isConnected(),
    totalVessels: all.length,
    liveVessels: liveCount,
    estimatedVessels: estCount,
    clients: clients.size,
  });
});

// Telemetry & Debug Verification Endpoint
app.get("/api/debug", (_, res) => {
  const all = [...store.getAll().values()];
  const liveCount = all.filter((v) => v.source === "live").length;
  const estCount = all.filter((v) => v.source === "estimated").length;

  const now = Date.now();
  const totalAgeMs = all.reduce((sum, v) => sum + (now - (v.last_seen || v.seen || now)), 0);
  const avgAgeMinutes = all.length ? +(totalAgeMs / (all.length * 60000)).toFixed(1) : 0;

  const ageHistogram = {
    "<10m": 0,
    "10m-1h": 0,
    "1h-3h": 0,
    "3h-6h": 0,
    "6h-12h": 0,
    "12h-24h": 0,
    ">24h": 0,
  };

  for (const v of all) {
    const ageMin = (now - (v.last_seen || v.seen || now)) / 60000;
    if (ageMin < 10) ageHistogram["<10m"]++;
    else if (ageMin < 60) ageHistogram["10m-1h"]++;
    else if (ageMin < 180) ageHistogram["1h-3h"]++;
    else if (ageMin < 360) ageHistogram["3h-6h"]++;
    else if (ageMin < 720) ageHistogram["6h-12h"]++;
    else if (ageMin < 1440) ageHistogram["12h-24h"]++;
    else ageHistogram[">24h"]++;
  }

  res.json({
    provider: provider.name,
    demo_mode: DEMO_MODE,
    totalVessels: all.length,
    vesselsBySource: {
      live: liveCount,
      estimated: estCount,
    },
    liveVessels: liveCount,
    estimatedVessels: estCount,
    avgReportAgeMinutes: avgAgeMinutes,
    landCheckMetrics,
    ageHistogram,
    filterMetrics,
  });
});

// Authentic Shipping Corridor Lanes GeoJSON
app.get("/api/routes", (_, res) => {
  res.json(getMaritimeLanesGeoJson());
});

// Monitored Ports Endpoints
function handlePorts(_, res) {
  res.json(portStats());
}
app.get("/api/ports", handlePorts);
app.get("/ports", handlePorts);

app.get(["/api/ports/:id", "/ports/:id"], (req, res) => {
  const stats = portStats();
  const p = stats.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Port not found" });
  res.json(p);
});

// Real Vessels List Endpoint with Honest Source & Confidence
app.get(["/api/vessels", "/ports/:id/vessels"], (req, res) => {
  const id = req.query.port || req.params.id;
  const list = [];
  const targetPort = id ? PORTS.find((p) => p.id === id) : null;
  const all = store.getAll().values();

  for (const v of all) {
    if (targetPort) {
      const k = Math.cos((targetPort.lat * Math.PI) / 180);
      const dy = (v.lat - targetPort.lat) * 111.32,
        dx = (v.lon - targetPort.lon) * 111.32 * k;
      if (dx * dx + dy * dy > 25 * 25) continue;
    }
    list.push({
      mmsi: v.id || v.mmsi,
      ship_name: v.name || `VESSEL-${v.id || v.mmsi}`,
      name: v.name || `VESSEL-${v.id || v.mmsi}`,
      lat: v.lat,
      lon: v.lon,
      sog: v.sog || 0,
      cog: v.cog || 0,
      heading: v.hdg ?? v.cog ?? 0,
      type: v.type || 0,
      destination: v.destination || null,
      eta: v.eta || null,
      stationary: (v.sog || 0) < 0.5,
      lastSeen: v.last_seen || v.seen || Date.now(),
      last_report_at: v.last_report_at || v.last_seen || v.seen || Date.now(),
      source: v.source || "live",
      confidence: v.confidence ?? 1.0,
      portId: targetPort ? targetPort.id : undefined,
    });
  }
  res.json(list);
});

// Breadcrumbs & Historic Track for Selected Vessel
app.get("/api/vessels/:mmsi/track", (req, res) => {
  const mmsi = Number(req.params.mmsi);
  if (!mmsi) return res.status(400).json({ error: "Invalid MMSI" });

  const vessel = store.get(mmsi);
  const breadcrumbs = store.getBreadcrumbs(mmsi);
  const destPort = vessel ? normalizeDestination(vessel.destination) : null;

  res.json({
    mmsi,
    breadcrumbs: breadcrumbs.map((b) => [b.lon, b.lat]),
    destination: destPort
      ? {
          name: destPort.name,
          coordinates: [destPort.lon, destPort.lat],
        }
      : null,
  });
});

app.get(["/api/history", "/ports/:id/history"], (req, res) => {
  const id = req.params.id || req.query.port;
  if (!id) return res.json([]);
  const list = hourlyHistory.get(id) || [];
  res.json(list);
});

// Gemini Vessel Intel Assistant Endpoint
app.post("/api/vessel-chat", async (req, res) => {
  try {
    const { vessel, question, history } = req.body;
    if (!vessel) return res.status(400).json({ error: "Vessel details required" });

    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return res.json({
        answer: `Tracking **${vessel.name}** (MMSI: ${vessel.mmsi}). Speed: ${vessel.sog} kn, Course: ${vessel.cog}°, Source: ${vessel.source || "live"}.`,
        vessel,
      });
    }

    const systemInstruction = `You are an expert maritime intelligence system embedded in the Port Monitor command bridge. Answer queries about vessel kinematics, commercial route profiles, and navigation status concisely and professionally.`;
    const prompt = `Vessel Name: ${vessel.name}, MMSI: ${vessel.mmsi}, Type: ${getShipTypeLabel(vessel.type)}, Speed: ${vessel.sog} kn, Course: ${vessel.cog}°, Status: ${vessel.stationary ? "Anchored" : "Underway"}, Telemetry Source: ${vessel.source}. Question: ${question || "Provide vessel summary and routing intelligence."}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    if (!geminiRes.ok) {
      return res.json({
        answer: `I am actively monitoring **${vessel.name}** (MMSI: ${vessel.mmsi}). Speed: ${vessel.sog} knots on course ${vessel.cog}°. Telemetry source: ${vessel.source || "live"}.`,
        vessel,
      });
    }

    const data = await geminiRes.json();
    const answer =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      `Telemetry for ${vessel.name} recorded successfully.`;

    return res.json({ answer, vessel });
  } catch (err) {
    return res.json({
      answer: `Telemetry active for ${req.body?.vessel?.name || "vessel"}.`,
      vessel: req.body?.vessel,
    });
  }
});

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  clients.add(ws);
  clearTimeout(idleTimer);
  provider.start();

  const all = [...store.getAll().values()];
  send(ws, {
    t: "snap",
    mode: DEMO_MODE ? "demo" : "live",
    demo_mode: DEMO_MODE,
    provider: provider.name,
    portsMeta: PORTS,
    v: all.map(compact),
    gone: [],
    ports: portStats(),
  });

  ws.on("close", () => {
    clients.delete(ws);
    if (!clients.size) {
      idleTimer = setTimeout(() => {
        // Standby
      }, 60000);
    }
  });
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`Port Monitor Server running on http://localhost:${PORT}`);
    console.log(`Active Provider: ${provider.name} | Demo Mode: ${DEMO_MODE ? "ENABLED" : "OFF (Real AIS Only)"}`);
    provider.start();
  });
}

export { app, server, store };
