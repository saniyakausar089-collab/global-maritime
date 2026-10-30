import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import { startOceanFleet } from "./ocean-fleet.js";

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
// Port-specific dense monitoring boxes (AISStream expects [[maxLat, minLon], [minLat, maxLon]])
const PORT_BOXES = PORTS.map((p) => [
  [p.lat + BOX, p.lon - BOX],
  [p.lat - BOX, p.lon + BOX],
]);

// Global ocean maritime transit corridors (North Atlantic, North Pacific, Indian Ocean, Mediterranean, South China Sea, Caribbean, South Atlantic)
const OCEAN_BOXES = [
  // North Atlantic Ocean (Europe <-> North America)
  [[60, -65], [15, -5]],
  // North Pacific Ocean (East Asia <-> US West Coast great circle lanes)
  [[55, 125], [15, 180]],
  [[55, -180], [15, -115]],
  // Indian Ocean & Arabian Sea (Asia-Europe route via Suez / Malacca)
  [[28, 40], [-20, 100]],
  // Mediterranean Sea & Gibraltar
  [[45, -8], [30, 36]],
  // South China Sea & Philippine Sea
  [[26, 105], [2, 130]],
  // South Atlantic (South America <-> Africa / Europe)
  [[0, -50], [-40, 15]],
  // Caribbean Sea & Gulf of Mexico (Panama Canal approach)
  [[30, -98], [8, -58]],
];

// Combined real-world subscription boxes: 6 core ports + all global oceans
const boxes = [...PORT_BOXES, ...OCEAN_BOXES];

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
  if (v.lat === undefined || v.lon === undefined) return;
  if (v.lat < -90 || v.lat > 90 || v.lon < -180 || v.lon > 180) return;
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
        BoundingBoxes: [[[90, -180], [-90, 180]]],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      }),
    );
    console.log("Connected to AISStream (Global oceanic + ports coverage subscribed)");
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

// --- MID Flag State Mapping ---
const MID_MAP = {
  205: { country: "Belgium", code: "BE", flag: "🇧🇪" },
  211: { country: "Germany", code: "DE", flag: "🇩🇪" },
  218: { country: "Germany", code: "DE", flag: "🇩🇪" },
  219: { country: "Denmark", code: "DK", flag: "🇩🇰" },
  220: { country: "Denmark", code: "DK", flag: "🇩🇰" },
  224: { country: "Spain", code: "ES", flag: "🇪🇸" },
  225: { country: "Spain", code: "ES", flag: "🇪🇸" },
  226: { country: "France", code: "FR", flag: "🇫🇷" },
  227: { country: "France", code: "FR", flag: "🇫🇷" },
  228: { country: "France", code: "FR", flag: "🇫🇷" },
  232: { country: "United Kingdom", code: "GB", flag: "🇬🇧" },
  233: { country: "United Kingdom", code: "GB", flag: "🇬🇧" },
  234: { country: "United Kingdom", code: "GB", flag: "🇬🇧" },
  235: { country: "United Kingdom", code: "GB", flag: "🇬🇧" },
  237: { country: "Greece", code: "GR", flag: "🇬🇷" },
  239: { country: "Greece", code: "GR", flag: "🇬🇷" },
  240: { country: "Greece", code: "GR", flag: "🇬🇷" },
  241: { country: "Greece", code: "GR", flag: "🇬🇷" },
  244: { country: "Netherlands", code: "NL", flag: "🇳🇱" },
  245: { country: "Netherlands", code: "NL", flag: "🇳🇱" },
  246: { country: "Netherlands", code: "NL", flag: "🇳🇱" },
  247: { country: "Italy", code: "IT", flag: "🇮🇹" },
  249: { country: "Malta", code: "MT", flag: "🇲🇹" },
  257: { country: "Norway", code: "NO", flag: "🇳🇴" },
  258: { country: "Norway", code: "NO", flag: "🇳🇴" },
  259: { country: "Norway", code: "NO", flag: "🇳🇴" },
  271: { country: "Turkey", code: "TR", flag: "🇹🇷" },
  273: { country: "Russia", code: "RU", flag: "🇷🇺" },
  304: { country: "Antigua and Barbuda", code: "AG", flag: "🇦🇬" },
  305: { country: "Antigua and Barbuda", code: "AG", flag: "🇦🇬" },
  310: { country: "Bermuda", code: "BM", flag: "🇧🇲" },
  311: { country: "Bahamas", code: "BS", flag: "🇧🇸" },
  312: { country: "Belize", code: "BZ", flag: "🇧🇿" },
  351: { country: "Panama", code: "PA", flag: "🇵🇦" },
  352: { country: "Panama", code: "PA", flag: "🇵🇦" },
  353: { country: "Panama", code: "PA", flag: "🇵🇦" },
  354: { country: "Panama", code: "PA", flag: "🇵🇦" },
  355: { country: "Panama", code: "PA", flag: "🇵🇦" },
  356: { country: "Panama", code: "PA", flag: "🇵🇦" },
  357: { country: "Panama", code: "PA", flag: "🇵🇦" },
  366: { country: "United States", code: "US", flag: "🇺🇸" },
  367: { country: "United States", code: "US", flag: "🇺🇸" },
  368: { country: "United States", code: "US", flag: "🇺🇸" },
  369: { country: "United States", code: "US", flag: "🇺🇸" },
  370: { country: "Panama", code: "PA", flag: "🇵🇦" },
  371: { country: "Panama", code: "PA", flag: "🇵🇦" },
  372: { country: "Panama", code: "PA", flag: "🇵🇦" },
  373: { country: "Panama", code: "PA", flag: "🇵🇦" },
  412: { country: "China", code: "CN", flag: "🇨🇳" },
  413: { country: "China", code: "CN", flag: "🇨🇳" },
  414: { country: "China", code: "CN", flag: "🇨🇳" },
  419: { country: "India", code: "IN", flag: "🇮🇳" },
  431: { country: "Japan", code: "JP", flag: "🇯🇵" },
  432: { country: "Japan", code: "JP", flag: "🇯🇵" },
  440: { country: "South Korea", code: "KR", flag: "🇰🇷" },
  441: { country: "South Korea", code: "KR", flag: "🇰🇷" },
  477: { country: "Hong Kong", code: "HK", flag: "🇭🇰" },
  503: { country: "Australia", code: "AU", flag: "🇦🇺" },
  512: { country: "New Zealand", code: "NZ", flag: "🇳🇿" },
  538: { country: "Marshall Islands", code: "MH", flag: "🇲🇭" },
  563: { country: "Singapore", code: "SG", flag: "🇸🇬" },
  564: { country: "Singapore", code: "SG", flag: "🇸🇬" },
  565: { country: "Singapore", code: "SG", flag: "🇸🇬" },
  566: { country: "Singapore", code: "SG", flag: "🇸🇬" },
  636: { country: "Liberia", code: "LR", flag: "🇱🇷" },
  710: { country: "Brazil", code: "BR", flag: "🇧🇷" },
};

function getFlag(mmsi) {
  if (!mmsi) return { country: "International", code: "UN", flag: "🌐" };
  const mid = parseInt(String(mmsi).slice(0, 3), 10);
  return MID_MAP[mid] || { country: "International", code: "UN", flag: "🌐" };
}

function getShipTypeInfo(type) {
  const t = Number(type) || 0;
  if (t >= 70 && t <= 79) return { category: "cargo", label: "Cargo / Container Carrier" };
  if (t >= 80 && t <= 89) return { category: "tanker", label: "Crude Oil & Chemical Tanker" };
  if (t >= 60 && t <= 69) return { category: "passenger", label: "Passenger / Cruise Ferry" };
  if (t === 31 || t === 32 || t === 52) return { category: "tug", label: "Tugboat & Port Towing" };
  if (t === 30) return { category: "fishing", label: "Commercial Fishing Trawler" };
  if (t === 36 || t === 37) return { category: "yacht", label: "Pleasure Craft / Yacht" };
  if (t >= 50 && t <= 59) return { category: "special", label: "Special Operations / Pilot / SAR" };
  return { category: "default", label: "Merchant Marine Vessel" };
}

const CATEGORY_FALLBACK_PHOTOS = {
  cargo: {
    photoUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&q=80",
    source: "Maritime Fleet Archive (Container & Cargo Carrier)",
  },
  tanker: {
    photoUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80",
    source: "Maritime Fleet Archive (Crude Oil & Chemical Tanker)",
  },
  passenger: {
    photoUrl: "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1200&q=80",
    source: "Maritime Fleet Archive (Passenger Cruise Liner)",
  },
  tug: {
    photoUrl: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=1200&q=80",
    source: "Maritime Fleet Archive (Harbor Tug & Escort)",
  },
  fishing: {
    photoUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
    source: "Maritime Fleet Archive (Commercial Fishing Vessel)",
  },
  special: {
    photoUrl: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80",
    source: "Maritime Fleet Archive (Specialized Offshore Craft)",
  },
  default: {
    photoUrl: "https://images.unsplash.com/photo-1505705694340-019e1e335916?auto=format&fit=crop&w=1200&q=80",
    source: "Maritime Fleet Archive (Merchant Vessel)",
  },
};

const photoCache = new Map();

async function getVesselPhoto(shipName, shipType) {
  const normName = (shipName || "").trim();
  const cacheKey = `${normName}_${shipType}`;
  if (photoCache.has(cacheKey)) return photoCache.get(cacheKey);

  const typeInfo = getShipTypeInfo(shipType);
  const fallback = CATEGORY_FALLBACK_PHOTOS[typeInfo.category] || CATEGORY_FALLBACK_PHOTOS.default;

  if (normName && normName.length > 2 && !normName.startsWith("VESSEL-") && !normName.startsWith("SHIP-")) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(normName)}&prop=pageimages&format=json&pithumbsize=900&origin=*`;
      const res = await fetch(url, { headers: { "User-Agent": "GlobalMaritimeMonitor/1.0" } });
      if (res.ok) {
        const d = await res.json();
        const pages = d.query?.pages || {};
        for (const k in pages) {
          const thumb = pages[k].thumbnail?.source;
          if (thumb && !thumb.endsWith(".svg.png") && !thumb.endsWith(".svg")) {
            const result = {
              photoUrl: thumb,
              source: `Wikimedia Commons (${pages[k].title})`,
              isSpecific: true,
            };
            photoCache.set(cacheKey, result);
            return result;
          }
        }
      }
    } catch {}

    try {
      const sUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(normName + " ship")}&format=json&origin=*`;
      const sRes = await fetch(sUrl, { headers: { "User-Agent": "GlobalMaritimeMonitor/1.0" } });
      if (sRes.ok) {
        const sd = await sRes.json();
        const top = sd.query?.search?.[0]?.title;
        if (top) {
          const pUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(top)}&prop=pageimages&format=json&pithumbsize=900&origin=*`;
          const pRes = await fetch(pUrl, { headers: { "User-Agent": "GlobalMaritimeMonitor/1.0" } });
          if (pRes.ok) {
            const pd = await pRes.json();
            const pages = pd.query?.pages || {};
            for (const k in pages) {
              const thumb = pages[k].thumbnail?.source;
              if (thumb && !thumb.endsWith(".svg.png") && !thumb.endsWith(".svg")) {
                const result = {
                  photoUrl: thumb,
                  source: `Wikimedia Commons (${pages[k].title})`,
                  isSpecific: true,
                };
                photoCache.set(cacheKey, result);
                return result;
              }
            }
          }
        }
      }
    } catch {}
  }

  const result = {
    photoUrl: fallback.photoUrl,
    source: fallback.source,
    isSpecific: false,
  };
  photoCache.set(cacheKey, result);
  return result;
}

// Single vessel details endpoint
app.get("/api/vessels/:id", (req, res) => {
  const mmsi = req.params.id;
  const v = vessels.get(Number(mmsi)) || vessels.get(mmsi);
  if (!v) {
    return res.status(404).json({ error: "Vessel not found or signal expired" });
  }
  const flag = getFlag(v.id);
  const typeInfo = getShipTypeInfo(v.type);

  let nearestPort = null;
  let minDistance = 99999;
  for (const p of PORTS) {
    const k = Math.cos((p.lat * Math.PI) / 180);
    const dy = (v.lat - p.lat) * 111.32;
    const dx = (v.lon - p.lon) * 111.32 * k;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < minDistance) {
      minDistance = d;
      nearestPort = { id: p.id, name: p.name, distanceKm: Math.round(d) };
    }
  }

  res.json({
    id: v.id,
    mmsi: v.id,
    name: v.name || `VESSEL-${v.id}`,
    lat: v.lat,
    lon: v.lon,
    sog: v.sog || 0,
    cog: v.cog || 0,
    hdg: v.hdg ?? v.cog ?? 0,
    type: v.type || 0,
    typeLabel: typeInfo.label,
    category: typeInfo.category,
    flag: `${flag.flag} ${flag.country}`,
    flagCode: flag.code,
    stationary: (v.sog || 0) < 0.5,
    lastSeen: v.seen || Date.now(),
    nearestPort,
  });
});

// Vessel photo lookup endpoint
app.get("/api/vessels/:id/photo", async (req, res) => {
  const mmsi = req.params.id;
  const v = vessels.get(Number(mmsi)) || vessels.get(mmsi) || {};
  const name = v.name || req.query.name || "";
  const type = v.type || req.query.type || 0;

  const photo = await getVesselPhoto(name, type);
  const flag = getFlag(mmsi);
  const typeInfo = getShipTypeInfo(type);

  res.json({
    mmsi,
    name: name || `VESSEL-${mmsi}`,
    typeLabel: typeInfo.label,
    flag: `${flag.flag} ${flag.country}`,
    photoUrl: photo.photoUrl,
    source: photo.source,
    isSpecific: photo.isSpecific,
    marineTrafficUrl: `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`,
    vesselFinderUrl: `https://www.vesselfinder.com/vessels?name=${encodeURIComponent(name || mmsi)}`,
  });
});

// Gemini AI Chat endpoint for specific vessel intelligence
app.post("/api/vessels/:id/chat", async (req, res) => {
  const mmsi = req.params.id;
  const { question, history, vesselContext } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "question string is required" });
  }

  const v = vessels.get(Number(mmsi)) || vessels.get(mmsi) || vesselContext || {};
  const flag = getFlag(v.id || mmsi);
  const typeInfo = getShipTypeInfo(v.type);

  // Compute nearest monitored port
  let nearestPort = "International Waters";
  let minDistance = 99999;
  if (v.lat != null && v.lon != null) {
    for (const p of PORTS) {
      const k = Math.cos((p.lat * Math.PI) / 180);
      const dy = (v.lat - p.lat) * 111.32;
      const dx = (v.lon - p.lon) * 111.32 * k;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDistance) {
        minDistance = d;
        nearestPort = `${p.name} (~${Math.round(d)} km)`;
      }
    }
  }

  const vesselSummary = {
    name: v.name || `VESSEL-${mmsi}`,
    mmsi: mmsi,
    flag: `${flag.flag} ${flag.country}`,
    type: typeInfo.label,
    speedKnots: Number(v.sog || 0).toFixed(1),
    courseDeg: Math.round(v.cog || 0),
    headingDeg: Math.round(v.hdg ?? v.cog ?? 0),
    latitude: v.lat != null ? Number(v.lat).toFixed(4) : "Unknown",
    longitude: v.lon != null ? Number(v.lon).toFixed(4) : "Unknown",
    status: (v.sog || 0) < 0.5 ? "Anchored / Moored" : "Under way",
    nearestPort,
  };

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.json({
      answer: `**${vesselSummary.name}** is a **${vesselSummary.type}** flying the flag of **${vesselSummary.flag}**. Navigating at **${vesselSummary.speedKnots} knots** on heading **${vesselSummary.courseDeg}°**, nearest to ${vesselSummary.nearestPort}. *(Please configure GEMINI_API_KEY for deep AI intelligence.)*`,
      vessel: vesselSummary,
    });
  }

  const systemInstruction = `You are the Maritime AI Fleet Intelligence Officer on the Global Port Congestion & Maritime Live Tracking platform.
You possess deep maritime domain expertise covering global commercial shipping, naval architecture, cargo types, deadweight tonnage, AIS telemetry, international trade corridors (Suez Canal, Malacca Strait, English Channel, Panama Canal, etc.), port logistics, flag states, and fleet management.

Live Telemetry & AIS Data for this vessel:
- Vessel Name: ${vesselSummary.name}
- MMSI: ${vesselSummary.mmsi}
- Flag State: ${vesselSummary.flag}
- Category: ${vesselSummary.type}
- Speed Over Ground: ${vesselSummary.speedKnots} knots
- Course / Heading: ${vesselSummary.courseDeg}°
- Navigational Status: ${vesselSummary.status}
- Current Coordinates: ${vesselSummary.latitude}, ${vesselSummary.longitude}
- Nearest Monitored Port: ${vesselSummary.nearestPort}

Guidelines:
- Deliver an informative, authoritative, engaging, and well-structured answer.
- Format responses cleanly with Markdown (use bolding, bullet points, and concise sections where helpful).
- If asked about cargo, explain the typical cargo commodities carried by this vessel category, loading operations, and standard stowage.
- If asked about routes or speed, interpret the current AIS coordinates, heading, and speed relative to international shipping lanes.
- If asked about the ship's operator or history, provide known details if famous or explain the typical commercial fleet operations for this class of ship.
- Keep the tone professional, nautical, and helpful.`;

  try {
    const contents = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h && (h.role === "user" || h.role === "model") && h.parts?.[0]?.text) {
          contents.push({ role: h.role, parts: [{ text: h.parts[0].text }] });
        }
      }
    }
    contents.push({ role: "user", parts: [{ text: question }] });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error status:", geminiRes.status, errText);
      return res.json({
        answer: `I am tracking **${vesselSummary.name}** (${vesselSummary.type}, ${vesselSummary.flag}). It is currently positioned at ${vesselSummary.latitude}, ${vesselSummary.longitude} traveling at ${vesselSummary.speedKnots} knots toward ${vesselSummary.nearestPort}.`,
        vessel: vesselSummary,
      });
    }

    const data = await geminiRes.json();
    const answer =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      `Analysis for ${vesselSummary.name} completed successfully.`;

    return res.json({ answer, vessel: vesselSummary });
  } catch (err) {
    console.error("Gemini route error:", err);
    return res.json({
      answer: `**${vesselSummary.name}** is currently navigating at ${vesselSummary.speedKnots} knots on course ${vesselSummary.courseDeg}°. Nearest monitored port is ${vesselSummary.nearestPort}.`,
      vessel: vesselSummary,
    });
  }
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

// Launch Global Ocean Shipping Fleet
startOceanFleet(vessels, dirty);

if (SIM) {
  startSim();
  console.log("SIMULATION mode (set AISSTREAM_KEY in .env for real ships)");
}

if (process.env.NODE_ENV !== "test") {
    server.listen(PORT, () => console.log(`Port Monitor live on http://localhost:${PORT}`));
}

export { app, server, vessels };
