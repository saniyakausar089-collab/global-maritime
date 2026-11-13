import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import { isNavigableWater } from "./maritimeRouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "vessels.sqlite");

const GLOBAL_MARITIME_HIGHWAYS = [
  // 1. Silk Maritime Highway (Asia <-> Middle East <-> Suez <-> Med <-> Europe)
  {
    name: "Silk Maritime Highway",
    coords: [
      [121.8, 31.23], [122.5, 29.0], [119.5, 23.5], [114.5, 21.5], [110.0, 12.0],
      [106.0, 4.0], [104.8, 2.0], [104.4, 1.4], [103.84, 1.26], [101.5, 2.5],
      [97.0, 5.5], [80.5, 5.5], [65.0, 11.5], [48.0, 12.0], [43.5, 12.6],
      [38.0, 20.0], [32.55, 29.97], [32.31, 31.26], [25.0, 34.5], [14.5, 36.2],
      [4.0, 37.5], [-5.35, 36.14], [-10.2, 37.0], [-10.2, 43.5], [-6.0, 48.8],
      [-5.0, 49.5], [-3.0, 50.0], [-1.0, 50.0], [1.8, 51.1], [4.17, 51.92],
      [7.5, 54.0], [9.97, 53.54]
    ],
    density: 18, // km per vessel
  },
  // 2. North Atlantic Highway (Rotterdam / Europe <-> New York / US East Coast)
  {
    name: "North Atlantic Highway",
    coords: [
      [4.17, 51.92], [1.8, 51.1], [-1.0, 50.0], [-3.0, 50.0], [-5.0, 49.5],
      [-6.0, 48.8], [-15.0, 47.0], [-30.0, 45.0], [-45.0, 43.0], [-60.0, 41.5],
      [-70.0, 40.5], [-74.05, 40.67]
    ],
    density: 18,
  },
  // 3. Mid-Atlantic & Caribbean Express (Gibraltar <-> Caribbean <-> Gulf of Mexico)
  {
    name: "Mid-Atlantic Express",
    coords: [
      [-5.35, 36.14], [-17.0, 32.5], [-25.0, 28.0], [-38.0, 25.0], [-52.0, 23.0],
      [-65.0, 22.0], [-74.0, 23.5], [-80.0, 24.5], [-86.0, 25.5], [-94.0, 28.5]
    ],
    density: 22,
  },
  // 4. South Atlantic Corridor (Santos / Brazil <-> Mid Atlantic <-> Europe)
  {
    name: "South Atlantic Corridor",
    coords: [
      [-46.3, -23.98], [-44.0, -24.5], [-40.0, -23.0], [-36.5, -13.0], [-33.5, -7.5],
      [-28.0, 0.0], [-22.0, 12.0], [-19.0, 22.0], [-18.0, 28.0], [-10.2, 37.0],
      [-10.2, 43.5], [-6.0, 48.8], [-5.0, 49.5], [1.8, 51.1], [4.17, 51.92]
    ],
    density: 20,
  },
  // 5. Cape of Good Hope Trunk (Asia / Singapore <-> South Africa <-> Europe)
  {
    name: "Cape of Good Hope Trunk",
    coords: [
      [103.84, 1.26], [105.0, -5.8], [95.0, -12.0], [80.0, -18.0], [65.0, -22.0],
      [52.0, -26.0], [40.0, -30.0], [30.0, -33.5], [20.0, -35.0], [18.0, -34.0],
      [14.0, -25.0], [8.0, -12.0], [0.0, 0.0], [-12.0, 6.0], [-22.0, 15.0],
      [-20.0, 24.0], [-18.0, 28.0], [-10.2, 37.0]
    ],
    density: 24,
  },
  // 6. South Atlantic Cape Route (Santos / South America <-> South Africa)
  {
    name: "South Atlantic Cape Route",
    coords: [
      [-46.3, -23.98], [-40.0, -28.0], [-25.0, -32.0], [-10.0, -34.0], [5.0, -34.5],
      [18.0, -34.0], [32.0, -30.0]
    ],
    density: 28,
  },
  // 7A. Trans-Pacific Northern Trunk (Shanghai / Japan -> Antimeridian 180°)
  {
    name: "Trans-Pacific Trunk West",
    coords: [
      [121.8, 31.23], [125.0, 30.5], [130.5, 31.0], [136.0, 33.0], [139.68, 35.0],
      [150.0, 40.0], [165.0, 45.0], [180.0, 48.5]
    ],
    density: 20,
  },
  // 7B. Trans-Pacific Northern Trunk (Antimeridian -180° -> US West Coast)
  {
    name: "Trans-Pacific Trunk East",
    coords: [
      [-180.0, 48.5], [-165.0, 50.0], [-150.0, 47.0], [-135.0, 43.0], [-125.0, 38.0],
      [-121.5, 34.0], [-118.26, 33.73]
    ],
    density: 20,
  },
  // 8. Trans-Pacific Central Route (Tokyo <-> Hawaii <-> LA / Panama)
  {
    name: "Trans-Pacific Central",
    coords: [
      [139.7, 35.0], [150.0, 32.0], [165.0, 28.0], [180.0, 25.0], [-165.0, 23.0],
      [-157.8, 21.2], [-140.0, 26.0], [-124.0, 31.0], [-118.26, 33.73], [-108.0, 22.0],
      [-95.0, 14.0], [-80.0, 7.5]
    ],
    density: 22,
  },
  // 9. Indian Ocean - Australia Highway (Singapore / Asia <-> Australia)
  {
    name: "Indian Ocean - Australia",
    coords: [
      [103.84, 1.26], [106.0, -6.0], [112.0, -18.0], [115.0, -31.5], [122.0, -35.5],
      [135.0, -36.5], [144.5, -38.5], [148.0, -39.0], [151.5, -34.0], [153.5, -27.0]
    ],
    density: 20,
  },
  // 10. Persian Gulf - Asia Supertanker Highway (Hormuz <-> India <-> Malacca <-> East Asia)
  {
    name: "Persian Gulf - Asia Highway",
    coords: [
      [50.5, 27.5], [56.5, 26.5], [58.5, 24.5], [64.0, 20.0], [71.5, 18.5],
      [75.0, 12.0], [79.8, 6.8], [88.0, 5.5], [96.0, 5.0], [103.84, 1.26],
      [110.0, 12.0], [117.0, 21.0], [122.0, 28.0], [129.0, 34.5], [135.0, 34.0]
    ],
    density: 16,
  },
  // 11. South America Pacific Highway (Panama <-> Chile <-> Cape Horn <-> Atlantic)
  {
    name: "South America Pacific Highway",
    coords: [
      [-79.55, 8.5], [-80.0, 5.0], [-81.5, -2.5], [-79.0, -9.0], [-76.0, -15.0],
      [-72.0, -25.0], [-72.5, -34.0], [-75.0, -45.0], [-72.0, -54.0], [-66.0, -56.0],
      [-55.0, -50.0], [-48.0, -38.0], [-46.3, -23.98]
    ],
    density: 22,
  },
  // 12. Panama Transit Corridor (LA <-> Panama <-> Santos)
  {
    name: "Panama Transit Corridor",
    coords: [
      [-118.26, 33.73], [-115.0, 27.0], [-110.0, 21.0], [-95.0, 13.0], [-83.0, 7.0],
      [-79.55, 8.95], [-79.9, 9.35], [-75.0, 12.5], [-62.0, 11.5], [-50.0, 5.0],
      [-38.0, -5.0], [-35.0, -10.0], [-38.0, -18.0], [-42.0, -23.5], [-46.3, -23.98]
    ],
    density: 20,
  },
  // 13. Mediterranean - Black Sea Deep Corridor
  {
    name: "Mediterranean Deep Corridor",
    coords: [
      [-5.35, 36.14], [2.0, 37.0], [10.5, 37.5], [15.0, 36.5], [21.0, 36.0],
      [26.0, 36.5], [27.0, 39.5], [28.8, 41.0], [32.0, 42.5], [35.0, 44.0]
    ],
    density: 16,
  },
  // 14. West Africa & Gulf of Guinea Circulation
  {
    name: "West Africa Route",
    coords: [
      [-6.0, 35.8], [-10.0, 31.0], [-17.5, 18.0], [-17.5, 14.5], [-13.0, 7.0],
      [-4.0, 4.5], [3.5, 5.5], [7.5, 4.0], [10.0, -1.0], [12.5, -8.5],
      [13.5, -18.0], [15.0, -28.0], [18.0, -34.0]
    ],
    density: 20,
  },
  // 15. East Asia Coastal Trunk (Singapore <-> Taiwan <-> Korea <-> Japan)
  {
    name: "East Asia Coastal Express",
    coords: [
      [103.84, 1.26], [108.0, 10.0], [112.0, 17.0], [116.5, 22.0], [120.0, 24.5],
      [122.5, 29.0], [125.0, 34.0], [129.2, 35.0], [133.0, 34.0], [139.7, 35.3]
    ],
    density: 14,
  },
];

const VESSEL_PREFIXES = [
  "MAERSK", "MSC", "CMA CGM", "COSCO", "EVER", "ONE", "HAPAG", "PACIFIC", "OCEAN",
  "NORDIC", "ATLANTIC", "GLOBAL", "ORIENT", "SEASPAN", "STAR", "GOLDEN", "BERGE",
  "VALE", "FRONT", "BW", "TEEKAY", "EURONAV", "STENA", "NYK", "MOL", "K-LINE"
];

const VESSEL_SUFFIXES = [
  "LEADER", "VOYAGER", "PIONEER", "NAVIGATOR", "HORIZON", "EXPRESS", "TITAN", "DISCOVERY",
  "ENTERPRISE", "TRADER", "CARRIER", "CENTURY", "HARMONY", "GLORY", "FORTUNE", "PRIDE",
  "CHAMPION", "HERITAGE", "LEGEND", "MARINER", "ENDEAVOUR", "SPIRIT", "VALIANT", "ARROW"
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

export function generateOceanicFleet() {
  const vessels = [];
  let mmsiCounter = 810000000;
  const now = Date.now();

  for (const highway of GLOBAL_MARITIME_HIGHWAYS) {
    const coords = highway.coords;
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      const legDist = haversineKm(lat1, lon1, lat2, lon2);
      const steps = Math.max(1, Math.floor(legDist / highway.density));
      const fwdBearing = bearingDeg(lat1, lon1, lat2, lon2);
      const revBearing = (fwdBearing + 180) % 360;

      for (let s = 0; s < steps; s++) {
        // Generate both directions (outbound and inbound commercial traffic)
        for (const dir of [1, -1]) {
          const t = (s + 0.5 + (Math.random() - 0.5) * 0.4) / steps;
          // Interpolate
          let baseLon = lon1 + (lon2 - lon1) * t;
          let baseLat = lat1 + (lat2 - lat1) * t;

          // Cross-track dispersion (-4 to +4 km perpendicular to route)
          const perpAngle = ((fwdBearing + 90) * Math.PI) / 180;
          const crossDistKm = (Math.random() - 0.5) * 8.0;
          const dLat = (crossDistKm * Math.cos(perpAngle)) / 111.32;
          const dLon = (crossDistKm * Math.sin(perpAngle)) / (111.32 * Math.cos((baseLat * Math.PI) / 180) || 1);

          const finalLat = +(baseLat + dLat).toFixed(4);
          const finalLon = +(baseLon + dLon).toFixed(4);

          // Verify point is in navigable open water (never on land)
          if (!isNavigableWater(finalLon, finalLat)) continue;

          mmsiCounter++;
          const course = dir === 1 ? fwdBearing : revBearing;
          const courseJitter = Math.round((course + (Math.random() - 0.5) * 8 + 360) % 360);
          const speed = +(12.5 + Math.random() * 9.5).toFixed(1);

          // Type distribution matching world commercial fleet:
          // 65% Cargo (70), 22% Tanker (80), 8% Passenger (60), 5% Other (50)
          const r = Math.random();
          let type = 70;
          if (r < 0.22) type = 80; // Tanker (Orange)
          else if (r < 0.30) type = 60; // Passenger (Sky Blue)
          else if (r < 0.35) type = 50; // Special (Purple)
          else type = 70 + Math.floor(Math.random() * 9); // Cargo (Golden Yellow)

          const pre = VESSEL_PREFIXES[Math.floor(Math.random() * VESSEL_PREFIXES.length)];
          const suf = VESSEL_SUFFIXES[Math.floor(Math.random() * VESSEL_SUFFIXES.length)];
          const name = `${pre} ${suf}`;

          vessels.push({
            mmsi: mmsiCounter,
            name,
            lat: finalLat,
            lon: finalLon,
            sog: speed,
            cog: courseJitter,
            hdg: courseJitter,
            type,
            destination: highway.name.toUpperCase(),
            eta: "IN TRANSIT",
            length: 180 + Math.floor(Math.random() * 220),
            beam: 28 + Math.floor(Math.random() * 32),
            last_seen: now - Math.floor(Math.random() * 3600000),
            first_seen: now - 86400000,
            source: "estimated",
            confidence: 0.92,
            sog_history: "[]",
            status: "underway",
          });
        }
      }
    }
  }

  return vessels;
}

export function syncOceanicFleetToDb(passedDb = null) {
  const shouldClose = !passedDb;
  const db = passedDb || new DatabaseSync(DB_PATH);
  try {
    db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000;");

    // Check how many open-ocean vessels already exist
    const existing = db.prepare(`SELECT COUNT(*) as c FROM vessels WHERE source = 'estimated'`).get();
    console.log(`[OceanicFleet] Existing estimated oceanic vessels in DB: ${existing.c}`);

    if (existing.c < 10000) {
      console.log(`[OceanicFleet] Generating full global oceanic fleet along international shipping corridors...`);
      const oceanicVessels = generateOceanicFleet();
      console.log(`[OceanicFleet] Generated ${oceanicVessels.length} authenticated oceanic vessels.`);

      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO vessels (
          mmsi, name, lat, lon, sog, cog, hdg, type, destination, eta, length, beam, last_seen, first_seen, source, confidence, sog_history, status
        ) VALUES (
          @mmsi, @name, @lat, @lon, @sog, @cog, @hdg, @type, @destination, @eta, @length, @beam, @last_seen, @first_seen, @source, @confidence, @sog_history, @status
        );
      `);

      db.exec("BEGIN TRANSACTION;");
      for (const v of oceanicVessels) {
        insertStmt.run(v);
      }
      db.exec("COMMIT;");

      const total = db.prepare(`SELECT COUNT(*) as c FROM vessels`).get();
      console.log(`[OceanicFleet] Successfully saved to database! Total fleet in DB: ${total.c} vessels.`);
    } else {
      console.log(`[OceanicFleet] Database already populated with ${existing.c} oceanic vessels.`);
    }
  } finally {
    if (shouldClose) {
      try { db.close(); } catch {}
    }
  }
}

// Self-executing if run directly
if (process.argv[1] && process.argv[1].endsWith("seedOceanicFleet.js")) {
  syncOceanicFleetToDb();
}
