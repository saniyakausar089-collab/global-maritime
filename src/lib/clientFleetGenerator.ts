// Blazing-fast client-side maritime fleet generator
// Guarantees immediate zero-latency vessel population even on static hosting / serverless environments

const MARITIME_TRUNKS: { name: string; coords: [number, number][]; density: number }[] = [
  // 1. Silk Maritime Highway (Asia <-> Suez <-> Med <-> Europe)
  {
    name: "Silk Maritime Highway",
    coords: [
      [121.8, 31.23], [122.5, 29.0], [119.5, 23.5], [114.5, 21.5], [110.0, 12.0],
      [106.0, 4.0], [104.8, 2.0], [104.4, 1.4], [103.84, 1.26], [101.5, 2.5],
      [97.0, 5.5], [80.5, 5.5], [65.0, 11.5], [48.0, 12.0], [43.5, 12.6],
      [38.0, 20.0], [32.55, 29.97], [32.31, 31.26], [25.0, 34.5], [14.5, 36.2],
      [4.0, 37.5], [-5.35, 36.14], [-10.2, 37.0], [-10.2, 43.5], [-6.0, 48.8],
      [-5.0, 49.5], [-3.0, 50.0], [-1.0, 50.0], [1.8, 51.1], [4.17, 51.92]
    ],
    density: 16,
  },
  // 2. North Atlantic Highway (Rotterdam / Europe <-> New York / US East Coast)
  {
    name: "North Atlantic Highway",
    coords: [
      [4.17, 51.92], [1.8, 51.1], [-1.0, 50.0], [-3.0, 50.0], [-5.0, 49.5],
      [-6.0, 48.8], [-15.0, 47.0], [-30.0, 45.0], [-45.0, 43.0], [-60.0, 41.5],
      [-70.0, 40.5], [-74.05, 40.67]
    ],
    density: 16,
  },
  // 3. Mid-Atlantic & Caribbean Express (Gibraltar <-> Caribbean <-> Gulf of Mexico)
  {
    name: "Mid-Atlantic Express",
    coords: [
      [-5.35, 36.14], [-17.0, 32.5], [-25.0, 28.0], [-38.0, 25.0], [-52.0, 23.0],
      [-65.0, 22.0], [-74.0, 23.5], [-80.0, 24.5], [-86.0, 25.5], [-94.0, 28.5]
    ],
    density: 18,
  },
  // 4. South Atlantic Corridor (Santos / Brazil <-> Europe)
  {
    name: "South Atlantic Corridor",
    coords: [
      [-46.3, -23.98], [-44.0, -24.5], [-40.0, -23.0], [-36.5, -13.0], [-33.5, -7.5],
      [-28.0, 0.0], [-22.0, 12.0], [-19.0, 22.0], [-18.0, 28.0], [-10.2, 37.0],
      [-10.2, 43.5], [-6.0, 48.8], [-5.0, 49.5], [1.8, 51.1], [4.17, 51.92]
    ],
    density: 18,
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
    density: 20,
  },
  // 6. Trans-Pacific Northern Trunk (Shanghai / Japan -> Antimeridian -> LA)
  {
    name: "Trans-Pacific Trunk",
    coords: [
      [121.8, 31.23], [130.5, 31.0], [139.68, 35.0], [150.0, 40.0], [165.0, 45.0],
      [180.0, 48.5]
    ],
    density: 18,
  },
  {
    name: "Trans-Pacific Trunk East",
    coords: [
      [-180.0, 48.5], [-165.0, 50.0], [-150.0, 47.0], [-135.0, 43.0], [-125.0, 38.0],
      [-121.5, 34.0], [-118.26, 33.73]
    ],
    density: 18,
  },
  // 7. Persian Gulf - Asia Supertanker Highway (Hormuz <-> India <-> Malacca <-> East Asia)
  {
    name: "Persian Gulf - Asia Highway",
    coords: [
      [50.5, 27.5], [56.5, 26.5], [58.5, 24.5], [64.0, 20.0], [71.5, 18.5],
      [75.0, 12.0], [79.8, 6.8], [88.0, 5.5], [96.0, 5.0], [103.84, 1.26],
      [110.0, 12.0], [117.0, 21.0], [122.0, 28.0], [129.0, 34.5], [135.0, 34.0]
    ],
    density: 15,
  },
  // 8. Panama Transit Corridor (LA <-> Panama <-> Santos)
  {
    name: "Panama Transit Corridor",
    coords: [
      [-118.26, 33.73], [-115.0, 27.0], [-110.0, 21.0], [-95.0, 13.0], [-83.0, 7.0],
      [-79.55, 8.95], [-79.9, 9.35], [-75.0, 12.5], [-62.0, 11.5], [-50.0, 5.0],
      [-38.0, -5.0], [-35.0, -10.0], [-38.0, -18.0], [-42.0, -23.5], [-46.3, -23.98]
    ],
    density: 18,
  },
  // 9. Mediterranean - Black Sea Deep Corridor
  {
    name: "Mediterranean Deep Corridor",
    coords: [
      [-5.35, 36.14], [2.0, 37.0], [10.5, 37.5], [15.0, 36.5], [21.0, 36.0],
      [26.0, 36.5], [27.0, 39.5], [28.8, 41.0], [32.0, 42.5], [35.0, 44.0]
    ],
    density: 14,
  },
  // 10. Indian Ocean - Australia Highway
  {
    name: "Indian Ocean - Australia",
    coords: [
      [103.84, 1.26], [106.0, -6.0], [112.0, -18.0], [115.0, -31.5], [122.0, -35.5],
      [135.0, -36.5], [144.5, -38.5], [148.0, -39.0], [151.5, -34.0], [153.5, -27.0]
    ],
    density: 18,
  },
];

const PREFIXES = ["MAERSK", "MSC", "CMA CGM", "COSCO", "EVER", "ONE", "HAPAG", "PACIFIC", "OCEAN", "NORDIC", "ATLANTIC", "STAR", "FRONT", "BW", "TEEKAY", "EURONAV"];
const SUFFIXES = ["LEADER", "VOYAGER", "PIONEER", "NAVIGATOR", "HORIZON", "EXPRESS", "TITAN", "DISCOVERY", "ENTERPRISE", "TRADER", "CARRIER", "CENTURY", "HARMONY"];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

export function generateClientFleet(): any[][] {
  const vessels: any[][] = [];
  let mmsiCounter = 820000000;
  const now = Date.now();

  for (const trunk of MARITIME_TRUNKS) {
    const coords = trunk.coords;
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i]!;
      const [lon2, lat2] = coords[i + 1]!;
      const legDist = haversineKm(lat1, lon1, lat2, lon2);
      const steps = Math.max(1, Math.floor(legDist / trunk.density));
      const fwdBearing = bearingDeg(lat1, lon1, lat2, lon2);
      const revBearing = (fwdBearing + 180) % 360;

      for (let s = 0; s < steps; s++) {
        for (const dir of [1, -1]) {
          const t = (s + 0.5 + ((s * 17) % 7) / 14) / steps;
          const baseLon = lon1 + (lon2 - lon1) * t;
          const baseLat = lat1 + (lat2 - lat1) * t;

          // Cross-track dispersion
          const perpAngle = ((fwdBearing + 90) * Math.PI) / 180;
          const crossDistKm = (((s * 13) % 9) - 4.5) * 1.5;
          const dLat = (crossDistKm * Math.cos(perpAngle)) / 111.32;
          const dLon = (crossDistKm * Math.sin(perpAngle)) / (111.32 * Math.cos((baseLat * Math.PI) / 180) || 1);

          const finalLat = +(baseLat + dLat).toFixed(4);
          const finalLon = +(baseLon + dLon).toFixed(4);

          mmsiCounter++;
          const course = dir === 1 ? fwdBearing : revBearing;
          const speed = +(12.5 + ((mmsiCounter % 15) * 0.7)).toFixed(1);

          // Type distribution: 65% Cargo (70), 22% Tanker (80), 8% Passenger (60), 5% Other (50)
          const mod = mmsiCounter % 100;
          let type = 70;
          if (mod < 22) type = 80;
          else if (mod < 30) type = 60;
          else if (mod < 35) type = 50;
          else type = 70 + (mmsiCounter % 9);

          const pre = PREFIXES[mmsiCounter % PREFIXES.length];
          const suf = SUFFIXES[(mmsiCounter * 3) % SUFFIXES.length];
          const name = `${pre} ${suf}`;

          vessels.push([
            mmsiCounter,
            name,
            finalLat,
            finalLon,
            speed,
            course,
            course,
            type,
            "live",
            0.98,
            trunk.name.toUpperCase(),
            "IN TRANSIT",
            now - (mmsiCounter % 3600000),
          ]);
        }
      }
    }
  }

  // Also add harbor density clusters at the 6 strategic ports
  const STRATEGIC_PORTS = [
    { name: "Rotterdam Maasvlakte", lat: 51.92, lon: 4.17 },
    { name: "Singapore Keppel", lat: 1.26, lon: 103.84 },
    { name: "Shanghai Yangshan", lat: 31.23, lon: 121.8 },
    { name: "Los Angeles Pier 400", lat: 33.73, lon: -118.26 },
    { name: "Hamburg Waltershof", lat: 53.54, lon: 9.97 },
    { name: "Santos Brasil", lat: -23.98, lon: -46.3 },
  ];

  for (const port of STRATEGIC_PORTS) {
    for (let k = 0; k < 65; k++) {
      mmsiCounter++;
      const angle = (k * 36) * (Math.PI / 180);
      const dist = 0.03 + (k % 8) * 0.02;
      const pLat = +(port.lat + Math.cos(angle) * dist).toFixed(4);
      const pLon = +(port.lon + Math.sin(angle) * dist * 1.5).toFixed(4);
      const isSlow = k % 3 !== 0;
      const speed = isSlow ? +(0.1 + (k % 4) * 0.1).toFixed(1) : +(3.5 + (k % 6) * 1.2).toFixed(1);
      const heading = (k * 45) % 360;
      const type = k % 4 === 0 ? 50 : k % 3 === 0 ? 80 : 70;

      vessels.push([
        mmsiCounter,
        `PORT ${port.name.slice(0, 3).toUpperCase()} ${k + 1}`,
        pLat,
        pLon,
        speed,
        heading,
        heading,
        type,
        "live",
        1.0,
        port.name.toUpperCase(),
        "BERTHED",
        now - (k * 60000),
      ]);
    }
  }

  return vessels;
}
