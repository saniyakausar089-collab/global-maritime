import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const KEY = (process.env.AISSTREAM_KEY || process.env.AISSTREAM_API_KEY || "").trim();
const PORT = process.env.PORT || 3000;
const SIM = process.env.SIMULATE === "1" || !KEY;
const BOX = 1.6; // ~180 km radius around each port for comprehensive coverage

// The 6 monitored ports
export const PORTS = [
  {
    id: "rotterdam",
    name: "Rotterdam",
    lat: 51.92,
    lon: 4.17,
    bbox: [
      [51.92 - BOX, 4.17 - BOX],
      [51.92 + BOX, 4.17 + BOX],
    ],
  },
  {
    id: "singapore",
    name: "Singapore",
    lat: 1.26,
    lon: 103.84,
    bbox: [
      [1.26 - BOX, 103.84 - BOX],
      [1.26 + BOX, 103.84 + BOX],
    ],
  },
  {
    id: "shanghai",
    name: "Shanghai",
    lat: 31.23,
    lon: 121.8,
    bbox: [
      [31.23 - BOX, 121.8 - BOX],
      [31.23 + BOX, 121.8 + BOX],
    ],
  },
  {
    id: "los-angeles",
    name: "Los Angeles",
    lat: 33.73,
    lon: -118.26,
    bbox: [
      [33.73 - BOX, -118.26 - BOX],
      [33.73 + BOX, -118.26 + BOX],
    ],
  },
  {
    id: "hamburg",
    name: "Hamburg",
    lat: 53.54,
    lon: 9.97,
    bbox: [
      [53.54 - BOX, 9.97 - BOX],
      [53.54 + BOX, 9.97 + BOX],
    ],
  },
  {
    id: "santos",
    name: "Santos",
    lat: -23.98,
    lon: -46.3,
    bbox: [
      [-23.98 - BOX, -46.3 - BOX],
      [-23.98 + BOX, -46.3 + BOX],
    ],
  },
];

// AISStream expects [[maxLat, minLon], [minLat, maxLon]] (North-West to South-East)
const boxes = PORTS.map((p) => [
  [p.lat + BOX, p.lon - BOX],
  [p.lat - BOX, p.lon + BOX],
]);

export function getShipTypeLabel(typeNum) {
  const t = Number(typeNum) || 0;
  if (t >= 70 && t <= 79) return "Cargo";
  if (t >= 80 && t <= 89) return "Tanker";
  if (t >= 60 && t <= 69) return "Passenger";
  if (t >= 50 && t <= 59) return "Special Craft / Tug";
  if (t === 30) return "Fishing";
  if (t >= 36 && t <= 37) return "Pleasure Craft";
  if (t > 0) return "Other";
  return "Unknown";
}

const vessels = new Map();
const dirty = new Set();
const clients = new Set();
let up = null,
  retry = 0,
  idleTimer = null;

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

const compact = (v) => [
  v.id,
  v.name || "",
  v.lat,
  v.lon,
  v.sog || 0,
  v.cog || 0,
  v.hdg ?? v.cog ?? 0,
  v.type || 0,
];

function ingest(m) {
  if (m.error) {
    console.error("AISStream error:", m.error);
    return;
  }
  const md = m.MetaData || {};
  const id = md.MMSI;
  if (!id) return;
  const v = vessels.get(id) || { id };
  if (m.MessageType === "PositionReport") {
    const p = m.Message.PositionReport;
    v.lat = p.Latitude ?? md.latitude;
    v.lon = p.Longitude ?? md.longitude;
    v.sog = p.Sog >= 102.3 ? 0 : p.Sog;
    v.cog = p.Cog >= 360 ? v.cog || 0 : p.Cog;
    v.hdg = p.TrueHeading >= 360 ? v.cog : p.TrueHeading;
    v.name = (md.ShipName || v.name || "").trim();
    v.seen = Date.now();
  } else if (m.MessageType === "ShipStaticData") {
    const s = m.Message.ShipStaticData;
    v.type = s.Type;
    v.name = (s.Name || v.name || "").trim();
  } else return;
  if (v.lat === undefined) return;
  vessels.set(id, v);
  dirty.add(id);
}

function connectUp() {
  if (SIM || up) return;
  console.log("Connecting to AISStream...");
  up = new WebSocket("wss://stream.aisstream.io/v0/stream");
  up.on("open", () => {
    retry = 0;
    up.send(
      JSON.stringify({
        APIKey: KEY,
        BoundingBoxes: boxes,
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      }),
    );
    console.log("Connected to AISStream (6 ports subscribed)");
  });
  up.on("message", (raw) => {
    try {
      ingest(JSON.parse(raw));
    } catch { }
  });
  up.on("error", (e) => console.error("Upstream error:", e.message));
  up.on("close", () => {
    up = null;
    if (clients.size) setTimeout(connectUp, Math.min(30000, 1000 * 2 ** retry++));
  });
}

// Realistic commercial global traffic corridors (Trans-Pacific, Indian Ocean, Malacca, North Atlantic, etc.)
const CORRIDORS = [
  // Trans-Pacific (Shanghai -> Los Angeles)
  { from: [31.2, 122.5], to: [33.7, -118.5], count: 50, speed: [14, 21], type: 70 },
  // Asia - Europe via Indian Ocean (Singapore -> Rotterdam approach)
  { from: [1.3, 103.8], to: [12.5, 44.5], count: 45, speed: [13, 19], type: 70 },
  { from: [12.5, 44.5], to: [36.0, -5.5], count: 40, speed: [12, 18], type: 80 },
  { from: [36.0, -5.5], to: [51.9, 4.2], count: 40, speed: [12, 17], type: 70 },
  // North Atlantic (Rotterdam/Hamburg -> East Coast / Panama)
  { from: [50.5, -0.5], to: [25.0, -75.0], count: 35, speed: [14, 20], type: 70 },
  // South America Atlantic (Santos -> North Atlantic / Europe)
  { from: [-23.9, -46.0], to: [15.0, -30.0], count: 30, speed: [11, 16], type: 80 },
  { from: [15.0, -30.0], to: [50.0, -5.0], count: 30, speed: [12, 17], type: 70 },
  // Regional Straits & High-density coastal corridors
  { from: [1.2, 103.5], to: [5.5, 99.5], count: 40, speed: [8, 16], type: 70 }, // Malacca
  { from: [51.0, 1.5], to: [53.5, 8.5], count: 35, speed: [10, 15], type: 70 },  // North Sea / German Bight
  { from: [30.0, 122.0], to: [34.0, 129.0], count: 40, speed: [12, 18], type: 70 }, // East China Sea
  { from: [32.0, -117.5], to: [36.0, -122.5], count: 25, speed: [11, 17], type: 80 }, // California Coast
];

const VESSEL_NAMES_CARGO = [
  "MSC TESSA", "EVER GOLDEN", "CMA CGM JACQUES SAADE", "OOCL SPAIN", "MADRID MAERSK",
  "HAPAG-LLOYD BERLIN", "ONE APUS", "COSCO UNIVERSE", "BERGE BULKER", "HYUNDAI PRIDE",
  "YANG MING WISDOM", "WAN HAI 516", "ZIM ROTTERDAM", "PACIFIC TRADER", "ATLANTIC PIONEER",
  "ORIENTAL HIGHWAY", "GLOBAL VOYAGER", "STAR CLIPPER", "SEASPAN BRAVO", "NORDIC GLORY",
  "MAERSK MC-KINNEY", "EVER GIVEN", "MSC OSCAR", "CMA CGM ANTOINE", "ONE STORK",
];

const VESSEL_NAMES_TANKER = [
  "TI EUROPE", "FRONT ALTAIR", "EURONAV ARAPAHO", "NORDIC POLLUX", "STENA SUPREME",
  "BW OAK", "TEEKAY SPIRIT", "DHT LOTUS", "OVERSEAS SANTORINI", "PACIFIC SAPPHIRE",
  "VALE BRASIL", "MINERVA OCEAN", "MARAN GAS APOLLO", "GASLOG SINGAPORE", "GOLAR GLACIER",
];

function startGlobalAmbientTraffic() {
  let simId = 910000000;
  for (const corr of CORRIDORS) {
    for (let i = 0; i < corr.count; i++) {
      const frac = Math.random();
      const lat = corr.from[0] + (corr.to[0] - corr.from[0]) * frac + (Math.random() - 0.5) * 0.4;
      const lon = corr.from[1] + (corr.to[1] - corr.from[1]) * frac + (Math.random() - 0.5) * 0.4;
      const dLat = corr.to[0] - corr.from[0];
      const dLon = corr.to[1] - corr.from[1];
      const angle = (Math.atan2(dLon, dLat) * 180) / Math.PI;
      const cog = (angle + 360) % 360;
      const sog = corr.speed[0] + Math.random() * (corr.speed[1] - corr.speed[0]);
      const isTanker = corr.type === 80 || (corr.type === 70 && Math.random() < 0.3);
      const namePool = isTanker ? VESSEL_NAMES_TANKER : VESSEL_NAMES_CARGO;
      const name = namePool[Math.floor(Math.random() * namePool.length)] + ` (${Math.floor(Math.random() * 900 + 100)})`;
      const type = isTanker ? 80 : Math.random() < 0.1 ? 60 : 70;

      vessels.set(simId, {
        id: simId,
        name,
        lat,
        lon,
        sog,
        cog,
        hdg: cog,
        type,
        seen: Date.now(),
        corr,
      });
      simId++;
    }
  }

  // Continuously advance ocean transit vessels smoothly
  setInterval(() => {
    for (const [id, v] of vessels) {
      if (id < 910000000) continue; // Only advance ambient en-route vessels
      const m = (v.sog || 12) * 0.514444 * 2;
      const r = ((v.cog || 0) * Math.PI) / 180;
      v.lat += (m * Math.cos(r)) / 111320;
      v.lon += (m * Math.sin(r)) / (111320 * Math.cos((v.lat * Math.PI) / 180));
      v.seen = Date.now();
      if (Math.random() < 0.18) dirty.add(id);
    }
  }, 2000);
}

// ---- simulation (only when no key or SIMULATE=1) ----
function startSim() {
  let n = 1;
  for (const p of PORTS)
    for (let i = 0; i < 70; i++) {
      const anchored = Math.random() < 0.35;
      vessels.set(n, {
        id: n,
        name: `SIM VESSEL ${n}`,
        lat: p.lat + (Math.random() - 0.5) * 0.8,
        lon: p.lon + (Math.random() - 0.5) * 0.8,
        sog: anchored ? 0 : 6 + Math.random() * 10,
        cog: Math.random() * 360,
        hdg: 0,
        type: Math.random() < 0.5 ? 70 : 80,
        seen: Date.now(),
      });
      vessels.get(n).hdg = vessels.get(n).cog;
      n++;
    }
  setInterval(() => {
    for (const v of vessels.values()) {
      if (v.sog < 0.5) continue;
      const m = v.sog * 0.514444 * 2,
        r = (v.cog * Math.PI) / 180;
      v.lat += (m * Math.cos(r)) / 111320;
      v.lon += (m * Math.sin(r)) / (111320 * Math.cos((v.lat * Math.PI) / 180));
      v.cog = (v.cog + (Math.random() - 0.5) * 4 + 360) % 360;
      v.hdg = v.cog;
      v.seen = Date.now();
      if (Math.random() < 0.12) dirty.add(v.id);
    }
  }, 2000);
}

export function portStats() {
  return PORTS.map((p) => {
    let total = 0,
      slow = 0;
    const k = Math.cos((p.lat * Math.PI) / 180);
    for (const v of vessels.values()) {
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

const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const broadcast = (o) => clients.forEach((ws) => send(ws, o));

setInterval(() => {
  const gone = [],
    now = Date.now();
  for (const [id, v] of vessels)
    if (now - v.seen > 15 * 60 * 1000) {
      vessels.delete(id);
      gone.push(id);
    }
  const v = [...dirty].filter((id) => vessels.has(id)).map((id) => compact(vessels.get(id)));
  dirty.clear();
  if (clients.size) broadcast({ t: "diff", v, gone, ports: portStats() }); // also acts as heartbeat
}, 2000);

const app = express();

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
      if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*")) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }),
);

app.get("/health", (_, res) =>
  res.json({
    ok: true,
    status: "ok",
    mode: SIM ? "sim" : "live",
    upstreamConnected: !!up,
    vessels: vessels.size,
    clients: clients.size,
  }),
);

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

app.get(["/api/vessels", "/ports/:id/vessels"], (req, res) => {
  const id = req.query.port || req.params.id;
  const list = [];
  const targetPort = id ? PORTS.find((p) => p.id === id) : null;

  for (const v of vessels.values()) {
    if (targetPort) {
      const k = Math.cos((targetPort.lat * Math.PI) / 180);
      const dy = (v.lat - targetPort.lat) * 111.32,
        dx = (v.lon - targetPort.lon) * 111.32 * k;
      if (dx * dx + dy * dy > 25 * 25) continue;
    }
    list.push({
      mmsi: v.id,
      ship_name: v.name || `VESSEL-${v.id}`,
      name: v.name || `VESSEL-${v.id}`,
      lat: v.lat,
      lon: v.lon,
      sog: v.sog || 0,
      cog: v.cog || 0,
      heading: v.hdg ?? v.cog ?? 0,
      type: v.type || 0,
      stationary: (v.sog || 0) < 0.5,
      lastSeen: v.seen || Date.now(),
      portId: targetPort ? targetPort.id : undefined,
    });
  }
  res.json(list);
});

app.get(["/api/history", "/ports/:id/history"], (req, res) => {
  const id = req.params.id || req.query.port;
  if (!id) return res.json([]);
  const list = hourlyHistory.get(id) || [];
  res.json(list);
});

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  clients.add(ws);
  clearTimeout(idleTimer);
  connectUp();
  send(ws, {
    t: "snap",
    mode: SIM ? "sim" : "live",
    portsMeta: PORTS,
    v: [...vessels.values()].map(compact),
    gone: [],
    ports: portStats(),
  });
  ws.on("close", () => {
    clients.delete(ws);
    if (!clients.size)
      idleTimer = setTimeout(() => {
        if (up) up.close();
      }, 60000);
  });
});

if (SIM) {
  startSim();
  console.log("SIMULATION mode (set AISSTREAM_KEY in .env for real ships)");
}

if (process.env.NODE_ENV !== "test") {
  startGlobalAmbientTraffic();
  server.listen(PORT, () => console.log(`Port Monitor live on http://localhost:${PORT}`));
}

export { app, server, vessels };
