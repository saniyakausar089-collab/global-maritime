import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Maritime Routing & Authentic Sea Corridor Engine
 * Provides destination normalization, maritime shipping corridor graphs,
 * fast point-in-polygon land collision checks (Natural Earth 110m),
 * and realistic open-ocean dead-reckoning advance along sanctioned lanes.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Major Global Maritime Hubs & UN/LOCODE aliases
export const KNOWN_PORTS = [
  {
    id: "rotterdam",
    name: "Rotterdam",
    locode: "NLRTM",
    lat: 51.92,
    lon: 4.17,
    aliases: ["ROTTERDAM", "RTM", "NLRTM", "EUROPOORT", "MAASVLAKTE", "BOTLEK"],
  },
  {
    id: "singapore",
    name: "Singapore",
    locode: "SGSIN",
    lat: 1.26,
    lon: 103.84,
    aliases: ["SINGAPORE", "SGSIN", "SIN", "PEBGB", "JURONG", "PASIR PANJANG", "KEPPEL"],
  },
  {
    id: "shanghai",
    name: "Shanghai",
    locode: "CNSHA",
    lat: 31.23,
    lon: 121.8,
    aliases: ["SHANGHAI", "CNSHA", "SHA", "YANGSHAN", "WAIGAOQIAO", "WUSONG"],
  },
  {
    id: "los-angeles",
    name: "Los Angeles",
    locode: "USLAX",
    lat: 33.73,
    lon: -118.26,
    aliases: ["LOS ANGELES", "USLAX", "LA", "LONG BEACH", "USLGB", "SAN PEDRO"],
  },
  {
    id: "hamburg",
    name: "Hamburg",
    locode: "DEHAM",
    lat: 53.54,
    lon: 9.97,
    aliases: ["HAMBURG", "DEHAM", "HAM", "ELBE", "WALTERSHOF"],
  },
  {
    id: "santos",
    name: "Santos",
    locode: "BRSSZ",
    lat: -23.98,
    lon: -46.3,
    aliases: ["SANTOS", "BRSSZ", "SSZ"],
  },
  {
    id: "new-york",
    name: "New York",
    locode: "USNYC",
    lat: 40.67,
    lon: -74.05,
    aliases: ["NEW YORK", "USNYC", "NYC", "NEWARK", "ELIZABETH"],
  },
  {
    id: "tokyo",
    name: "Tokyo / Yokohama",
    locode: "JPTYO",
    lat: 35.44,
    lon: 139.68,
    aliases: ["TOKYO", "JPTYO", "YOKOHAMA", "JPYOK", "KAWASAKI"],
  },
  {
    id: "hong-kong",
    name: "Hong Kong",
    locode: "HKHKG",
    lat: 22.3,
    lon: 114.12,
    aliases: ["HONG KONG", "HKHKG", "HKG", "KWAI TSING"],
  },
  {
    id: "suez",
    name: "Suez Canal / Port Said",
    locode: "EGPSD",
    lat: 31.26,
    lon: 32.31,
    aliases: ["SUEZ", "PORT SAID", "EGPSD", "EGSUZ", "CANAL"],
  },
  {
    id: "panama",
    name: "Panama Canal",
    locode: "PAPCN",
    lat: 8.95,
    lon: -79.55,
    aliases: ["PANAMA", "BALBOA", "CRISTOBAL", "PABLB"],
  },
  {
    id: "gibraltar",
    name: "Strait of Gibraltar",
    locode: "GIB",
    lat: 36.14,
    lon: -5.35,
    aliases: ["GIBRALTAR", "ALGECIRAS", "TANGER MED"],
  },
  {
    id: "cape-town",
    name: "Cape Town",
    locode: "ZACPT",
    lat: -33.91,
    lon: 18.44,
    aliases: ["CAPE TOWN", "ZACPT", "CPT"],
  },
  {
    id: "dubai",
    name: "Jebel Ali / Dubai",
    locode: "AEJEA",
    lat: 25.0,
    lon: 55.06,
    aliases: ["JEBEL ALI", "AEJEA", "DUBAI"],
  },
];

/**
 * Normalizes raw AIS destination string to a known destination hub.
 */
export function normalizeDestination(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const clean = rawText
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .trim();

  if (!clean) return null;

  for (const port of KNOWN_PORTS) {
    for (const alias of port.aliases) {
      if (clean === alias || clean.startsWith(alias + " ") || clean.includes(" " + alias)) {
        return port;
      }
    }
  }

  return null;
}

// ============================================================================
// Natural Earth Land Polygon Index & Fast Point-in-Polygon Check
// ============================================================================
let landPolygons = [];

function initLandPolygons() {
  try {
    let geoPath = path.join(__dirname, "data", "ne_110m_land.geojson");
    if (!fs.existsSync(geoPath)) {
      geoPath = path.resolve(__dirname, "../node_modules/three-globe/example/country-polygons/ne_110m_admin_0_countries.geojson");
    }
    if (!fs.existsSync(geoPath)) {
      console.warn("[MaritimeRouter] Warning: Land GeoJSON not found at", geoPath);
      return;
    }

    const geojson = JSON.parse(fs.readFileSync(geoPath, "utf8"));
    const polygons = [];

    for (const feat of geojson.features || []) {
      const geom = feat.geometry;
      if (!geom) continue;
      const type = geom.type;
      const coordsList = type === "Polygon" ? [geom.coordinates] : (type === "MultiPolygon" ? geom.coordinates : []);

      for (const coords of coordsList) {
        const outerRing = coords[0];
        if (!outerRing || outerRing.length < 3) continue;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of outerRing) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        polygons.push({
          minX, minY, maxX, maxY,
          outerRing,
          holes: coords.slice(1),
        });
      }
    }
    landPolygons = polygons;
    console.log(`[MaritimeRouter] Indexed ${landPolygons.length} land polygons for maritime boundary verification.`);
  } catch (err) {
    console.error("[MaritimeRouter] Failed to load land GeoJSON:", err.message);
  }
}

initLandPolygons();

function pointInRing(pt, ring) {
  let inside = false;
  const x = pt[0], y = pt[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Fast ray-casting point-in-polygon land check with bounding box acceleration.
 */
export function isPointOnLand(lon, lat) {
  for (let i = 0; i < landPolygons.length; i++) {
    const poly = landPolygons[i];
    if (lon < poly.minX || lon > poly.maxX || lat < poly.minY || lat > poly.maxY) continue;
    if (pointInRing([lon, lat], poly.outerRing)) {
      let inHole = false;
      for (let h = 0; h < poly.holes.length; h++) {
        if (pointInRing([lon, lat], poly.holes[h])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

/**
 * Checks if a coordinate is in navigable water:
 * Either open sea (not in land polygons) OR within a recognized port / canal approach zone (35km radius).
 */
export function isNavigableWater(lon, lat) {
  // Allow recognized commercial port & canal approach waterways
  for (let i = 0; i < KNOWN_PORTS.length; i++) {
    const p = KNOWN_PORTS[i];
    if (haversineKm(lat, lon, p.lat, p.lon) <= 35) {
      return true;
    }
  }
  return !isPointOnLand(lon, lat);
}

// Master maritime deep-sea trunk corridors (coordinates in [lon, lat])
export const MARITIME_TRUNK_LANES = [
  // 1. Asia <-> Europe via Malacca, Indian Ocean, Suez, Med & English Channel
  {
    name: "Silk Maritime Highway",
    ports: ["shanghai", "hong-kong", "singapore", "suez", "gibraltar", "rotterdam", "hamburg"],
    coordinates: [
      [121.8, 31.23], // Shanghai
      [120.0, 24.0],  // Taiwan Strait
      [114.12, 22.3], // Hong Kong
      [109.0, 12.0],  // South China Sea West
      [103.84, 1.26], // Singapore / Malacca
      [95.0, 5.5],    // Andaman Sea
      [80.0, 5.8],    // Sri Lanka South
      [65.0, 11.5],   // Arabian Sea
      [51.0, 12.0],   // Gulf of Aden Entry
      [43.5, 12.6],   // Bab-el-Mandeb
      [38.0, 20.0],   // Red Sea Central
      [32.55, 29.97], // Suez South
      [32.31, 31.26], // Port Said
      [25.0, 34.5],   // South Crete
      [15.0, 36.5],   // Malta Channel
      [5.0, 37.5],    // West Med
      [-5.35, 36.14], // Gibraltar
      [-9.5, 38.0],   // Cape St. Vincent
      [-9.0, 43.5],   // Cape Finisterre
      [-5.0, 48.5],   // Ushant / Celtic Entry
      [-1.0, 50.0],   // English Channel
      [2.0, 51.5],    // Dover Strait
      [4.17, 51.92],  // Rotterdam
      [7.5, 54.0],    // German Bight
      [9.97, 53.54],  // Hamburg
    ],
  },
  // 2. Trans-Pacific Great Circle (East Asia <-> US West Coast)
  {
    name: "Trans-Pacific Trunk",
    ports: ["shanghai", "tokyo", "los-angeles"],
    coordinates: [
      [121.8, 31.23],  // Shanghai
      [130.0, 30.5],   // East China Sea
      [139.68, 35.44], // Tokyo Bay
      [155.0, 42.0],   // Kuril Approach
      [175.0, 48.0],   // Date Line North
      [-165.0, 50.0],  // Aleutian South
      [-140.0, 45.0],  // North East Pacific
      [-126.0, 38.0],  // California Approach
      [-118.26, 33.73] // Los Angeles
    ],
  },
  // 3. North Atlantic Highway (Rotterdam / Europe <-> New York / US East Coast)
  {
    name: "North Atlantic Highway",
    ports: ["rotterdam", "new-york"],
    coordinates: [
      [4.17, 51.92], // Rotterdam
      [-1.0, 50.0],  // English Channel
      [-8.0, 49.0],  // Celtic Sea
      [-25.0, 46.0], // Mid North Atlantic
      [-45.0, 43.0], // Grand Banks South
      [-65.0, 41.0], // Nova Scotia South
      [-74.05, 40.67] // New York
    ],
  },
  // 4. South Atlantic / Cape Route (Santos <-> Europe & West Africa)
  {
    name: "South Atlantic Corridor",
    ports: ["santos", "rotterdam", "cape-town"],
    coordinates: [
      [-46.3, -23.98], // Santos
      [-38.0, -15.0],  // Brazil Basin
      [-32.0, -5.0],   // Natal East
      [-20.0, 10.0],   // Mid Atlantic Ridge
      [-15.0, 25.0],   // Canary Islands South
      [-9.5, 38.0],    // Cape St. Vincent
      [-5.0, 48.5],    // Ushant
      [4.17, 51.92]    // Rotterdam
    ],
  },
  // 5. Americas Inter-Oceanic (Los Angeles <-> Panama <-> Santos / US East Coast)
  {
    name: "Panama Transit Corridor",
    ports: ["los-angeles", "panama", "santos"],
    coordinates: [
      [-118.26, 33.73], // Los Angeles
      [-110.0, 22.0],   // Baja South
      [-95.0, 14.0],    // Gulf of Tehuantepec
      [-82.0, 8.0],     // Gulf of Chiriqui
      [-79.55, 8.95],   // Panama Canal Pacific
      [-79.9, 9.35],    // Panama Canal Atlantic
      [-75.0, 12.0],    // Caribbean Sea
      [-50.0, 0.0],     // Amazon Mouth Approach
      [-35.0, -8.0],    // Recife Approach
      [-46.3, -23.98]   // Santos
    ],
  },
];

export function haversineKm(lat1, lon1, lat2, lon2) {
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

export function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

// Telemetry counters
export const landCheckMetrics = {
  landCheckRejections: 0,
  resnappedToRoute: 0,
};

/**
 * Advance position along a polyline of [lon, lat] coordinates by distanceKm.
 * Returns { lat, lon, heading, onLand }
 */
function advanceAlongPolyline(coords, startIndex, forward, distanceKm) {
  let remaining = distanceKm;
  let currIdx = startIndex;
  let nextIdx = forward ? currIdx + 1 : currIdx - 1;

  while (remaining > 0 && nextIdx >= 0 && nextIdx < coords.length) {
    const p1 = coords[currIdx];
    const p2 = coords[nextIdx];
    const segDist = haversineKm(p1[1], p1[0], p2[1], p2[0]);

    if (remaining <= segDist && segDist > 0) {
      const frac = remaining / segDist;
      const lon = p1[0] + (p2[0] - p1[0]) * frac;
      const lat = p1[1] + (p2[1] - p1[1]) * frac;
      const heading = bearingDeg(p1[1], p1[0], p2[1], p2[0]);
      return { lat, lon, heading, isEnd: false };
    }

    remaining -= segDist;
    currIdx = nextIdx;
    nextIdx = forward ? currIdx + 1 : currIdx - 1;
  }

  // Reached end of corridor
  const lastPt = coords[currIdx];
  const prevPt = coords[forward ? Math.max(0, currIdx - 1) : Math.min(coords.length - 1, currIdx + 1)];
  const heading = bearingDeg(prevPt[1], prevPt[0], lastPt[1], lastPt[0]);
  return { lat: lastPt[1], lon: lastPt[0], heading, isEnd: true };
}

/**
 * Projects a dead-reckoned position along genuine sea routes towards destination.
 * If destination is unknown, projects along COG over water only and drops if hitting land.
 */
export function estimateDeadReckonedPosition(vessel, now = Date.now()) {
  const lastSeen = vessel.last_seen || vessel.seen;
  if (!lastSeen) return vessel;

  const elapsedMs = Math.max(0, now - lastSeen);
  const elapsedHours = elapsedMs / (3600 * 1000);

  // If last report is fresh (<10 min), mark live with 1.0 confidence
  if (elapsedHours < 0.166) {
    return {
      ...vessel,
      source: "live",
      confidence: 1.0,
      opacity: 1.0,
      isOldEstimate: false,
      last_report_at: lastSeen,
    };
  }

  // Cap estimates strictly at 24 hours
  if (elapsedHours > 24) {
    return null; // Stale, should be dropped
  }

  const isOldEstimate = elapsedHours > 6.0;
  // Confidence fades linearly from 0.95 down to 0.10 over 24 hours
  const confidence = Math.max(0.1, +(1.0 - elapsedHours / 24).toFixed(2));
  let opacity = Math.max(0.2, +(1.0 - elapsedHours / 24).toFixed(2));
  if (isOldEstimate) opacity *= 0.65; // Older than 6h render smaller and dimmer

  const sog = Number(vessel.sog || 0);
  // Stationary or very slow vessels remain in position
  if (sog < 1.0) {
    if (!isNavigableWater(vessel.lon, vessel.lat)) {
      landCheckMetrics.landCheckRejections++;
      return null;
    }
    return {
      ...vessel,
      source: "estimated",
      confidence,
      opacity,
      isOldEstimate,
      last_report_at: lastSeen,
    };
  }

  // Distance traveled in km
  const distanceKm = sog * 1.852 * elapsedHours;
  const destPort = normalizeDestination(vessel.destination);

  let estLat = vessel.lat;
  let estLon = vessel.lon;
  let estHeading = vessel.cog ?? vessel.hdg ?? 0;

  if (destPort) {
    // 1. ROUTE FOLLOWING: Match best sea lane containing destPort
    let bestLane = null;
    let bestDestIdx = -1;

    for (const lane of MARITIME_TRUNK_LANES) {
      if (lane.ports && lane.ports.includes(destPort.id)) {
        bestLane = lane;
        // Find waypoint closest to destPort
        let minD = Infinity;
        for (let i = 0; i < lane.coordinates.length; i++) {
          const d = haversineKm(destPort.lat, destPort.lon, lane.coordinates[i][1], lane.coordinates[i][0]);
          if (d < minD) {
            minD = d;
            bestDestIdx = i;
          }
        }
        break;
      }
    }

    if (bestLane && bestDestIdx !== -1) {
      // Find waypoint closest to vessel's current position
      let bestVesselIdx = 0;
      let minVD = Infinity;
      for (let i = 0; i < bestLane.coordinates.length; i++) {
        const d = haversineKm(vessel.lat, vessel.lon, bestLane.coordinates[i][1], bestLane.coordinates[i][0]);
        if (d < minVD) {
          minVD = d;
          bestVesselIdx = i;
        }
      }

      const forward = bestDestIdx >= bestVesselIdx;
      const adv = advanceAlongPolyline(bestLane.coordinates, bestVesselIdx, forward, distanceKm);
      estLat = adv.lat;
      estLon = adv.lon;
      estHeading = adv.heading;

      // Verify not on land; if so, re-snap to the closest open-water waypoint on the corridor
      if (!isNavigableWater(estLon, estLat)) {
        let snapped = false;
        for (const pt of bestLane.coordinates) {
          if (isNavigableWater(pt[0], pt[1])) {
            estLon = pt[0];
            estLat = pt[1];
            landCheckMetrics.resnappedToRoute++;
            snapped = true;
            break;
          }
        }
        if (!snapped) {
          landCheckMetrics.landCheckRejections++;
          return null; // Reject land collision
        }
      }
    } else {
      // Vector towards destination hub across navigable water
      const totalDist = haversineKm(vessel.lat, vessel.lon, destPort.lat, destPort.lon);
      if (totalDist > 0) {
        const travel = Math.min(distanceKm, totalDist * 0.95);
        const ratio = travel / totalDist;
        estLat = vessel.lat + (destPort.lat - vessel.lat) * ratio;
        estLon = vessel.lon + (destPort.lon - vessel.lon) * ratio;
        estHeading = bearingDeg(vessel.lat, vessel.lon, destPort.lat, destPort.lon);

        if (!isNavigableWater(estLon, estLat)) {
          landCheckMetrics.landCheckRejections++;
          return null;
        }
      }
    }
  } else if (vessel.cog != null) {
    // 2. UNKNOWN DESTINATION: Project along COG over water only
    // Test in discrete steps. If path would hit land, DROP the estimate.
    const rad = (vessel.cog * Math.PI) / 180;
    const stepCount = Math.max(2, Math.min(10, Math.ceil(distanceKm / 15)));
    const stepDistKm = distanceKm / stepCount;

    let currLat = vessel.lat;
    let currLon = vessel.lon;

    for (let step = 1; step <= stepCount; step++) {
      const dLat = (stepDistKm * Math.cos(rad)) / 111.32;
      const dLon = (stepDistKm * Math.sin(rad)) / (111.32 * Math.cos((currLat * Math.PI) / 180) || 1);
      currLat += dLat;
      currLon += dLon;

      if (!isNavigableWater(currLon, currLat)) {
        // Hit land! Reject estimate per specification
        landCheckMetrics.landCheckRejections++;
        return null;
      }
    }

    estLat = currLat;
    estLon = currLon;
    estHeading = vessel.cog;
  } else {
    // No destination and no COG available: cannot project safely over water
    if (!isNavigableWater(vessel.lon, vessel.lat)) {
      landCheckMetrics.landCheckRejections++;
      return null;
    }
  }

  // Clamp coordinates
  estLat = Math.max(-85, Math.min(85, estLat));
  estLon = Math.max(-180, Math.min(180, estLon));

  return {
    ...vessel,
    lat: estLat,
    lon: estLon,
    cog: estHeading,
    hdg: estHeading,
    heading: estHeading,
    source: "estimated",
    confidence,
    opacity,
    isOldEstimate,
    last_report_at: lastSeen,
  };
}

/**
 * Returns GeoJSON FeatureCollection of verified maritime trunk corridors.
 */
export function getMaritimeLanesGeoJson() {
  return {
    type: "FeatureCollection",
    features: MARITIME_TRUNK_LANES.map((lane, idx) => ({
      type: "Feature",
      id: `lane-${idx}`,
      properties: {
        name: lane.name,
      },
      geometry: {
        type: "LineString",
        coordinates: lane.coordinates,
      },
    })),
  };
}
