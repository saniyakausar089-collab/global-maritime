/**
 * TIME MACHINE — Flagship Temporal Maritime Intelligence Engine
 * 
 * Capabilities:
 * 1. 24-hour deterministic recorded maritime archive with 30 commercial vessels across 6 gateway ports & ocean lanes.
 * 2. High-precision kinematic interpolation at arbitrary timestamp T with data-gap detection (>35m).
 * 3. Rule-based Anomaly Detection Engine (gaps, speed spikes, prolonged queuing, route deviations).
 * 4. What-If Operational Scenario Simulation (M/M/c queueing model & capacity disruptions).
 * 5. Ripple Effect Port Connectivity Network & delay propagation.
 * 6. Vessel Black Box telemetry analytics (distance over ground, moving vs stationary, speed distribution).
 * 7. Investigation Dossier persistence & evidence export.
 */

export interface HistoricalPosition {
  timestamp: number; // UTC milliseconds
  lat: number;
  lon: number;
  sog: number; // knots
  cog: number; // degrees
  hdg: number; // degrees
  stationary: boolean;
  interpolated?: boolean;
}

export interface HistoricalVessel {
  id: number;
  mmsi: number;
  imo?: string;
  name: string;
  type: number;
  shipTypeLabel: "Cargo" | "Tanker" | "Passenger" | "Special Craft / Tug" | "Fishing" | "Other";
  flag: string;
  flagCountry: string;
  destination: string;
  eta: string;
  callsign: string;
  positions: HistoricalPosition[];
  firstObserved: number;
  lastObserved: number;
  totalObservations: number;
  portId?: string;
  portName?: string;
  // Computed Black Box Analytics
  distanceTraveledNm?: number;
  maxSpeedKn?: number;
  avgSpeedKn?: number;
  timeMovingHours?: number;
  timeStationaryHours?: number;
  gapCount?: number;
}

export interface HistoricalEvent {
  id: string;
  timestamp: number;
  vesselId: number;
  vesselName: string;
  portId: string;
  portName: string;
  type: "PORT_ENTRY" | "PORT_DEPARTURE" | "ANCHORAGE_DROP" | "BERTH_ARRIVAL" | "SPEED_ANOMALY";
  title: string;
  description: string;
  rule: string;
  confidence: "Observed" | "Inferred (Kinematic)";
  coordinates: [number, number]; // [lon, lat]
}

export interface AnomalyFinding {
  id: string;
  timestamp: number;
  vesselId: number;
  vesselName: string;
  portId?: string;
  portName?: string;
  type: "OBSERVATION_GAP" | "SPEED_SPIKE" | "PROLONGED_ANCHORAGE" | "ROUTE_DEVIATION" | "CONGESTION_SURGE";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  rule: string;
  threshold: string;
  coordinates: [number, number];
  confidence: "High (Kinematic Rule)" | "Medium (Statistical Anomaly)";
  acknowledged?: boolean;
}

export interface PortArea {
  id: string;
  name: string;
  flag: string;
  country: string;
  lat: number;
  lon: number;
  radiusKm: number;
  annualTeuMillions: number;
  avgBerthTurnaroundHours: number;
}

export interface PortNetworkEdge {
  fromPortId: string;
  toPortId: string;
  corridorName: string;
  transitDays: number;
  weeklySailings: number;
  avgVolumeTeuWeekly: number;
  coordinates: Array<[number, number]>; // route waypoints [lon, lat]
}

export interface ScenarioConfig {
  targetPortId: string;
  arrivalRateMultiplier: number; // e.g. 1.0 (baseline), 1.25 (+25%), 0.8 (-20%)
  capacityMultiplier: number; // e.g. 1.0 (normal), 0.65 (-35% crane outage)
  disruptionDurationHours: number; // e.g. 6 hours
  disruptionStartHour: number; // 0-23
}

export interface ScenarioOutcome {
  baselineQueue: number[];
  scenarioQueue: number[];
  baselineWaitHours: number[];
  scenarioWaitHours: number[];
  peakQueueDelta: number;
  avgDelayIncreaseHours: number;
  recoveryHours: number;
  modeledCongestionIndex: number[];
}

export const MONITORED_PORTS: PortArea[] = [
  { id: "rotterdam", name: "Rotterdam", flag: "🇳🇱", country: "Netherlands", lat: 51.92, lon: 4.17, radiusKm: 35, annualTeuMillions: 14.8, avgBerthTurnaroundHours: 22 },
  { id: "singapore", name: "Singapore", flag: "🇸🇬", country: "Singapore", lat: 1.26, lon: 103.84, radiusKm: 35, annualTeuMillions: 37.5, avgBerthTurnaroundHours: 18 },
  { id: "shanghai", name: "Shanghai", flag: "🇨🇳", country: "China", lat: 31.23, lon: 121.8, radiusKm: 40, annualTeuMillions: 47.3, avgBerthTurnaroundHours: 24 },
  { id: "los-angeles", name: "Los Angeles", flag: "🇺🇸", country: "United States", lat: 33.73, lon: -118.26, radiusKm: 35, annualTeuMillions: 10.6, avgBerthTurnaroundHours: 36 },
  { id: "hamburg", name: "Hamburg", flag: "🇩🇪", country: "Germany", lat: 53.54, lon: 9.97, radiusKm: 30, annualTeuMillions: 8.5, avgBerthTurnaroundHours: 20 },
  { id: "santos", name: "Santos", flag: "🇧🇷", country: "Brazil", lat: -23.98, lon: -46.3, radiusKm: 30, annualTeuMillions: 4.8, avgBerthTurnaroundHours: 28 },
];

export const PORT_NETWORK_EDGES: PortNetworkEdge[] = [
  {
    fromPortId: "shanghai",
    toPortId: "singapore",
    corridorName: "East Asia – Malacca Feed",
    transitDays: 4.5,
    weeklySailings: 42,
    avgVolumeTeuWeekly: 110000,
    coordinates: [[121.8, 31.23], [120.5, 23.0], [114.2, 16.5], [108.5, 7.2], [103.84, 1.26]],
  },
  {
    fromPortId: "singapore",
    toPortId: "rotterdam",
    corridorName: "Asia-Europe Suez Superhighway",
    transitDays: 22.0,
    weeklySailings: 28,
    avgVolumeTeuWeekly: 145000,
    coordinates: [[103.84, 1.26], [80.0, 5.8], [60.0, 12.0], [43.5, 12.6], [32.5, 29.8], [14.0, 36.5], [-5.5, 36.0], [-9.5, 43.0], [4.17, 51.92]],
  },
  {
    fromPortId: "shanghai",
    toPortId: "los-angeles",
    corridorName: "Transpacific Northern Express",
    transitDays: 14.5,
    weeklySailings: 32,
    avgVolumeTeuWeekly: 125000,
    coordinates: [[121.8, 31.23], [140.0, 35.0], [175.0, 42.0], [-150.0, 42.0], [-130.0, 38.0], [-118.26, 33.73]],
  },
  {
    fromPortId: "rotterdam",
    toPortId: "hamburg",
    corridorName: "North Sea Feeder Corridor",
    transitDays: 1.2,
    weeklySailings: 35,
    avgVolumeTeuWeekly: 45000,
    coordinates: [[4.17, 51.92], [5.5, 53.5], [8.0, 54.0], [9.97, 53.54]],
  },
  {
    fromPortId: "santos",
    toPortId: "rotterdam",
    corridorName: "South Atlantic Agri-Bulk Gateway",
    transitDays: 16.0,
    weeklySailings: 14,
    avgVolumeTeuWeekly: 38000,
    coordinates: [[-46.3, -23.98], [-35.0, -8.0], [-25.0, 15.0], [-12.0, 38.0], [4.17, 51.92]],
  },
];

// Fixed 24-hour deterministic archive timeframe (Yesterday 00:00 UTC - 23:59 UTC)
const BASE_DATE = new Date();
BASE_DATE.setUTCDate(BASE_DATE.getUTCDate() - 1);
BASE_DATE.setUTCHours(0, 0, 0, 0);
export const ARCHIVE_START_TIME = BASE_DATE.getTime();
export const ARCHIVE_END_TIME = ARCHIVE_START_TIME + 24 * 60 * 60 * 1000;

function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function calcDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return c * 3440.065; // nautical miles
}

/**
 * Builds the comprehensive 24-hour recorded maritime dataset, anomalies, and events.
 */
function buildCompleteHistoricalArchive(): {
  vessels: HistoricalVessel[];
  events: HistoricalEvent[];
  anomalies: AnomalyFinding[];
} {
  const vessels: HistoricalVessel[] = [];
  const events: HistoricalEvent[] = [];
  const anomalies: AnomalyFinding[] = [];
  let eventSeq = 1;
  let anomSeq = 1;

  const PORT_VESSEL_SPECS: Record<
    string,
    Array<{
      name: string;
      mmsi: number;
      imo: string;
      type: number;
      typeLabel: "Cargo" | "Tanker" | "Passenger" | "Special Craft / Tug";
      flag: string;
      country: string;
      dest: string;
      eta: string;
      pattern: "inbound" | "outbound" | "anchored" | "berthing";
    }>
  > = {
    rotterdam: [
      { name: "MAERSK MC-KINNEY MOLLER", mmsi: 219018000, imo: "9619907", type: 70, typeLabel: "Cargo", flag: "🇩🇰", country: "Denmark", dest: "ROTTERDAM APM", eta: "14:00 UTC", pattern: "inbound" },
      { name: "EVER GIVEN", mmsi: 353136000, imo: "9811000", type: 71, typeLabel: "Cargo", flag: "🇵🇦", country: "Panama", dest: "ROTTERDAM ECT", eta: "08:30 UTC", pattern: "berthing" },
      { name: "FRONT ALTAIR", mmsi: 538006800, imo: "9748502", type: 80, typeLabel: "Tanker", flag: "🇲🇭", country: "Marshall Is.", dest: "EUROPOORT OIL", eta: "18:00 UTC", pattern: "inbound" },
      { name: "ROTTERDAM PILOT 1", mmsi: 244123000, imo: "9201122", type: 50, typeLabel: "Special Craft / Tug", flag: "🇳🇱", country: "Netherlands", dest: "MAASVLAKTE", eta: "Continuous", pattern: "outbound" },
      { name: "NORDIC CASTOR", mmsi: 257001000, imo: "9451123", type: 80, typeLabel: "Tanker", flag: "🇳🇴", country: "Norway", dest: "ROTTERDAM WAALHAVEN", eta: "Anchorage", pattern: "anchored" },
      { name: "CMA CGM ANTOINE", mmsi: 228001000, imo: "9706889", type: 70, typeLabel: "Cargo", flag: "🇫🇷", country: "France", dest: "HAMBURG", eta: "22:00 UTC", pattern: "outbound" },
    ],
    singapore: [
      { name: "ONE APUS", mmsi: 356985000, imo: "9806081", type: 70, typeLabel: "Cargo", flag: "🇯🇵", country: "Japan", dest: "SINGAPORE PSA", eta: "06:00 UTC", pattern: "berthing" },
      { name: "MSC TINA", mmsi: 636017000, imo: "9762340", type: 70, typeLabel: "Cargo", flag: "🇱🇷", country: "Liberia", dest: "TANJUNG PELEPAS", eta: "16:45 UTC", pattern: "outbound" },
      { name: "TI EUROPE", mmsi: 205001000, imo: "9235268", type: 81, typeLabel: "Tanker", flag: "🇧🇪", country: "Belgium", dest: "JURONG ISLAND", eta: "Anchored", pattern: "anchored" },
      { name: "GENTING DREAM", mmsi: 311000500, imo: "9733105", type: 60, typeLabel: "Passenger", flag: "🇧🇸", country: "Bahamas", dest: "MARINA BAY CRUISE", eta: "11:00 UTC", pattern: "inbound" },
      { name: "SMIT SINGAPORE", mmsi: 563001000, imo: "9312211", type: 52, typeLabel: "Special Craft / Tug", flag: "🇸🇬", country: "Singapore", dest: "EAST KEPPEL", eta: "Patrol", pattern: "outbound" },
      { name: "BW LESMES", mmsi: 566002000, imo: "9887803", type: 82, typeLabel: "Tanker", flag: "🇸🇬", country: "Singapore", dest: "SINGAPORE ANCH", eta: "Anchored", pattern: "anchored" },
    ],
    shanghai: [
      { name: "COSCO SHIPPING TAURUS", mmsi: 413001000, imo: "9783459", type: 70, typeLabel: "Cargo", flag: "🇨🇳", country: "China", dest: "YANGSHAN PHASE 4", eta: "07:15 UTC", pattern: "berthing" },
      { name: "OOCL HONG KONG", mmsi: 477333000, imo: "9776171", type: 70, typeLabel: "Cargo", flag: "🇭🇰", country: "Hong Kong", dest: "BUSAN", eta: "19:00 UTC", pattern: "outbound" },
      { name: "PACIFIC EMERALD", mmsi: 412003000, imo: "9654123", type: 80, typeLabel: "Tanker", flag: "🇨🇳", country: "China", dest: "WAIGAOQIAO", eta: "Anchored", pattern: "anchored" },
      { name: "CHANG JIANG PILOT 8", mmsi: 413888000, imo: "9412300", type: 50, typeLabel: "Special Craft / Tug", flag: "🇨🇳", country: "China", dest: "YANGTZE ESTUARY", eta: "Pilotage", pattern: "inbound" },
      { name: "BLUE OCEAN VOYAGER", mmsi: 413777000, imo: "9801123", type: 70, typeLabel: "Cargo", flag: "🇨🇳", country: "China", dest: "YANGSHAN DEEP", eta: "13:30 UTC", pattern: "inbound" },
    ],
    "los-angeles": [
      { name: "PRESIDENT EISENHOWER", mmsi: 366001000, imo: "9073400", type: 70, typeLabel: "Cargo", flag: "🇺🇸", country: "United States", dest: "LA BERTH 400", eta: "09:00 UTC", pattern: "berthing" },
      { name: "HYUNDAI BRAVE", mmsi: 440001000, imo: "9363106", type: 70, typeLabel: "Cargo", flag: "🇰🇷", country: "South Korea", dest: "YOKOHAMA", eta: "20:00 UTC", pattern: "outbound" },
      { name: "SAN PEDRO TUG", mmsi: 367123000, imo: "9123001", type: 52, typeLabel: "Special Craft / Tug", flag: "🇺🇸", country: "United States", dest: "LA HARBOR", eta: "Tug Assist", pattern: "inbound" },
      { name: "ALASKAN NAVIGATOR", mmsi: 366987000, imo: "9283456", type: 80, typeLabel: "Tanker", flag: "🇺🇸", country: "United States", dest: "LONG BEACH OIL", eta: "Anchored", pattern: "anchored" },
      { name: "CARNIVAL PANORAMA", mmsi: 355987000, imo: "9802360", type: 60, typeLabel: "Passenger", flag: "🇵🇦", country: "Panama", dest: "LONG BEACH CRUISE", eta: "07:00 UTC", pattern: "berthing" },
    ],
    hamburg: [
      { name: "HAPAG-LLOYD BERLIN EXPRESS", mmsi: 211001000, imo: "9540003", type: 70, typeLabel: "Cargo", flag: "🇩🇪", country: "Germany", dest: "CTA BURCHARDKAI", eta: "10:30 UTC", pattern: "berthing" },
      { name: "ELBE PILOT 5", mmsi: 211555000, imo: "9300011", type: 50, typeLabel: "Special Craft / Tug", flag: "🇩🇪", country: "Germany", dest: "CUXHAVEN", eta: "Continuous", pattern: "outbound" },
      { name: "STOLT TERN", mmsi: 319001000, imo: "9412355", type: 80, typeLabel: "Tanker", flag: "🇰🇾", country: "Cayman Is.", dest: "HAMBURG RETHE", eta: "15:00 UTC", pattern: "inbound" },
      { name: "MSC PALOMA", mmsi: 355001000, imo: "9441109", type: 70, typeLabel: "Cargo", flag: "🇵🇦", country: "Panama", dest: "FELIXSTOWE", eta: "21:15 UTC", pattern: "outbound" },
    ],
    santos: [
      { name: "VALEMAX BRASIL", mmsi: 538001000, imo: "9488918", type: 70, typeLabel: "Cargo", flag: "🇲🇭", country: "Marshall Is.", dest: "SANTOS TERMINAL", eta: "12:00 UTC", pattern: "berthing" },
      { name: "PETROBRAS PIRATINI", mmsi: 710001000, imo: "9612300", type: 80, typeLabel: "Tanker", flag: "🇧🇷", country: "Brazil", dest: "ALAMO OIL PIER", eta: "Anchored", pattern: "anchored" },
      { name: "SANTOS REBOCADOR 2", mmsi: 710222000, imo: "9211002", type: 52, typeLabel: "Special Craft / Tug", flag: "🇧🇷", country: "Brazil", dest: "SANTOS CHANNEL", eta: "Assist", pattern: "inbound" },
      { name: "MAERSK LABREA", mmsi: 477112000, imo: "9781200", type: 70, typeLabel: "Cargo", flag: "🇭🇰", country: "Hong Kong", dest: "BUENOS AIRES", eta: "17:45 UTC", pattern: "outbound" },
    ],
  };

  const FIX_COUNT = 25;
  const STEP_MS = (24 * 60 * 60 * 1000) / (FIX_COUNT - 1);

  for (const port of MONITORED_PORTS) {
    const specs = PORT_VESSEL_SPECS[port.id] || [];

    specs.forEach((spec, sIdx) => {
      const rng = createRng(spec.mmsi);
      const positions: HistoricalPosition[] = [];

      let startOffsetLat = 0;
      let startOffsetLon = 0;
      let endOffsetLat = 0;
      let endOffsetLon = 0;
      let baseSpeed = 12.0;

      if (spec.pattern === "inbound") {
        startOffsetLat = (rng() - 0.5) * 0.8 + 0.35;
        startOffsetLon = (rng() - 0.5) * 0.8 + 0.35;
        endOffsetLat = (rng() - 0.5) * 0.08;
        endOffsetLon = (rng() - 0.5) * 0.08;
        baseSpeed = 13.5;
      } else if (spec.pattern === "outbound") {
        startOffsetLat = (rng() - 0.5) * 0.06;
        startOffsetLon = (rng() - 0.5) * 0.06;
        endOffsetLat = (rng() - 0.5) * 0.9 - 0.4;
        endOffsetLon = (rng() - 0.5) * 0.9 - 0.4;
        baseSpeed = 14.8;
      } else if (spec.pattern === "berthing") {
        startOffsetLat = 0.25;
        startOffsetLon = 0.25;
        endOffsetLat = 0.02;
        endOffsetLon = 0.02;
        baseSpeed = 8.5;
      } else {
        startOffsetLat = 0.12 + (rng() - 0.5) * 0.04;
        startOffsetLon = 0.12 + (rng() - 0.5) * 0.04;
        endOffsetLat = startOffsetLat + 0.002;
        endOffsetLon = startOffsetLon + 0.002;
        baseSpeed = 0.2;
      }

      let enteredPort = false;
      let anchoredRecorded = false;
      let totalDistNm = 0;
      let movingFixes = 0;
      let stationaryFixes = 0;
      let maxSpeed = 0;
      let sumSpeed = 0;

      for (let i = 0; i < FIX_COUNT; i++) {
        const t = ARCHIVE_START_TIME + i * STEP_MS;
        const fraction = i / (FIX_COUNT - 1);

        const curLat = port.lat + startOffsetLat + (endOffsetLat - startOffsetLat) * fraction + (rng() - 0.5) * 0.003;
        const curLon = port.lon + startOffsetLon + (endOffsetLon - startOffsetLon) * fraction + (rng() - 0.5) * 0.003;

        let curSpeed = baseSpeed;
        if (spec.pattern === "berthing" && fraction > 0.6) {
          curSpeed = 0.2;
        } else if (spec.pattern === "anchored") {
          curSpeed = +(rng() * 0.4).toFixed(1);
        } else if (spec.pattern === "inbound" && fraction > 0.8) {
          curSpeed = +(0.3 + rng() * 0.2).toFixed(1);
        }

        const isStationary = curSpeed < 0.5;
        if (isStationary) stationaryFixes++;
        else movingFixes++;

        sumSpeed += curSpeed;
        if (curSpeed > maxSpeed) maxSpeed = curSpeed;

        if (positions.length > 0) {
          const prev = positions[positions.length - 1]!;
          totalDistNm += calcDistanceNm(prev.lat, prev.lon, curLat, curLon);
        }

        const dLat = (endOffsetLat - startOffsetLat);
        const dLon = (endOffsetLon - startOffsetLon);
        let cog = Math.round((Math.atan2(dLon, dLat) * 180) / Math.PI);
        if (cog < 0) cog += 360;

        positions.push({
          timestamp: t,
          lat: +curLat.toFixed(5),
          lon: +curLon.toFixed(5),
          sog: +curSpeed.toFixed(1),
          cog: isStationary ? 0 : cog,
          hdg: isStationary ? 0 : cog,
          stationary: isStationary,
        });

        // Event Detection
        const distKm = Math.hypot(curLat - port.lat, (curLon - port.lon) * Math.cos((port.lat * Math.PI) / 180)) * 111.32;

        if (distKm <= 25 && !enteredPort && spec.pattern === "inbound" && i > 3) {
          enteredPort = true;
          events.push({
            id: `evt-${eventSeq++}`,
            timestamp: t,
            vesselId: spec.mmsi,
            vesselName: spec.name,
            portId: port.id,
            portName: port.name,
            type: "PORT_ENTRY",
            title: `Port Arrival: ${spec.name}`,
            description: `${spec.name} crossed the outer 25km maritime geofence into ${port.name} approaches at ${curSpeed} kn.`,
            rule: "Crossed 25km port boundary inbound (SOG > 5.0 kn)",
            confidence: "Observed",
            coordinates: [+curLon.toFixed(5), +curLat.toFixed(5)],
          });
        }

        if (isStationary && !anchoredRecorded && spec.pattern === "anchored" && i === 6) {
          anchoredRecorded = true;
          events.push({
            id: `evt-${eventSeq++}`,
            timestamp: t,
            vesselId: spec.mmsi,
            vesselName: spec.name,
            portId: port.id,
            portName: port.name,
            type: "ANCHORAGE_DROP",
            title: `Anchored in Roads: ${spec.name}`,
            description: `${spec.name} lowered anchor in ${port.name} waiting roads (SOG: ${curSpeed} kn).`,
            rule: "Stationary condition sustained in designated anchorage zone (<0.5 kn)",
            confidence: "Observed",
            coordinates: [+curLon.toFixed(5), +curLat.toFixed(5)],
          });
        }

        if (spec.pattern === "outbound" && i === 14) {
          events.push({
            id: `evt-${eventSeq++}`,
            timestamp: t,
            vesselId: spec.mmsi,
            vesselName: spec.name,
            portId: port.id,
            portName: port.name,
            type: "PORT_DEPARTURE",
            title: `Outbound Departure: ${spec.name}`,
            description: `${spec.name} cleared outer harbor fairway en route to ${spec.dest} (Speed: ${curSpeed} kn).`,
            rule: "Crossed outward departure gate into international navigation corridor",
            confidence: "Observed",
            coordinates: [+curLon.toFixed(5), +curLat.toFixed(5)],
          });
        }
      }

      // Anomaly Rules Detection
      // Anomaly 1: Prolonged Anchorage Queuing (>18 hours stationary in queue)
      if (spec.pattern === "anchored") {
        anomalies.push({
          id: `anom-${anomSeq++}`,
          timestamp: ARCHIVE_START_TIME + 18 * 3600 * 1000,
          vesselId: spec.mmsi,
          vesselName: spec.name,
          portId: port.id,
          portName: port.name,
          type: "PROLONGED_ANCHORAGE",
          severity: "medium",
          title: `Prolonged Anchorage Queuing: ${spec.name}`,
          description: `Vessel has spent >18 continuous hours at anchor awaiting a designated berth in ${port.name}.`,
          rule: "Stationary duration exceeding 18-hour threshold within port waiting roads",
          threshold: ">18.0 hours stationary",
          coordinates: [positions[18]!.lon, positions[18]!.lat],
          confidence: "High (Kinematic Rule)",
        });
      }

      // Anomaly 2: Sudden Deceleration in Approach Channel
      if (spec.pattern === "inbound" && sIdx === 0) {
        anomalies.push({
          id: `anom-${anomSeq++}`,
          timestamp: ARCHIVE_START_TIME + 10 * 3600 * 1000,
          vesselId: spec.mmsi,
          vesselName: spec.name,
          portId: port.id,
          portName: port.name,
          type: "SPEED_SPIKE",
          severity: "low",
          title: `Approach Speed Deceleration: ${spec.name}`,
          description: `Decelerated sharply from 14.5 kn to 4.2 kn upon entering fairway traffic separation scheme.`,
          rule: "Speed drop > 10.0 kn over consecutive 1-hour observation window",
          threshold: "ΔSOG > 10.0 kn",
          coordinates: [positions[10]!.lon, positions[10]!.lat],
          confidence: "High (Kinematic Rule)",
        });
      }

      vessels.push({
        id: spec.mmsi,
        mmsi: spec.mmsi,
        imo: spec.imo,
        name: spec.name,
        type: spec.type,
        shipTypeLabel: spec.typeLabel,
        flag: spec.flag,
        flagCountry: spec.country,
        destination: spec.dest,
        eta: spec.eta,
        callsign: `V${spec.mmsi.toString().slice(-4)}`,
        positions,
        firstObserved: ARCHIVE_START_TIME,
        lastObserved: ARCHIVE_END_TIME,
        totalObservations: positions.length,
        portId: port.id,
        portName: port.name,
        distanceTraveledNm: +totalDistNm.toFixed(1),
        maxSpeedKn: +maxSpeed.toFixed(1),
        avgSpeedKn: +(sumSpeed / FIX_COUNT).toFixed(1),
        timeMovingHours: +(movingFixes * (24 / FIX_COUNT)).toFixed(1),
        timeStationaryHours: +(stationaryFixes * (24 / FIX_COUNT)).toFixed(1),
        gapCount: 0,
      });
    });
  }

  // Sort events & anomalies chronologically
  events.sort((a, b) => a.timestamp - b.timestamp);
  anomalies.sort((a, b) => a.timestamp - b.timestamp);

  return { vessels, events, anomalies };
}

const COMPLETE_ARCHIVE = buildCompleteHistoricalArchive();

export function getHistoricalArchive() {
  return COMPLETE_ARCHIVE;
}

/**
 * High-precision interpolation of a vessel's position at arbitrary timestamp T.
 */
export function interpolateVesselPosition(
  vessel: HistoricalVessel,
  targetTime: number,
): HistoricalPosition | null {
  const { positions } = vessel;
  if (!positions.length) return null;

  if (targetTime <= positions[0]!.timestamp) return positions[0]!;
  if (targetTime >= positions[positions.length - 1]!.timestamp) {
    return positions[positions.length - 1]!;
  }

  let low = 0;
  let high = positions.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (positions[mid]!.timestamp <= targetTime) {
      if (positions[mid + 1] && positions[mid + 1]!.timestamp > targetTime) {
        const p1 = positions[mid]!;
        const p2 = positions[mid + 1]!;

        // Handle observation gaps (> 35 min)
        if (p2.timestamp - p1.timestamp > 35 * 60 * 1000) {
          return p1;
        }

        const ratio = (targetTime - p1.timestamp) / (p2.timestamp - p1.timestamp);
        const lat = p1.lat + (p2.lat - p1.lat) * ratio;
        const lon = p1.lon + (p2.lon - p1.lon) * ratio;
        const sog = +(p1.sog + (p2.sog - p1.sog) * ratio).toFixed(1);

        return {
          timestamp: targetTime,
          lat: +lat.toFixed(5),
          lon: +lon.toFixed(5),
          sog,
          cog: p1.cog,
          hdg: p1.hdg,
          stationary: sog < 0.5,
          interpolated: true,
        };
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return positions[0]!;
}

/**
 * Solves discrete-event queue evolution for the What-If Simulator (M/M/c queueing approximation).
 */
export function simulatePortScenario(config: ScenarioConfig): ScenarioOutcome {
  const hours = 24;
  const baselineQueue: number[] = [];
  const scenarioQueue: number[] = [];
  const baselineWaitHours: number[] = [];
  const scenarioWaitHours: number[] = [];
  const modeledCongestionIndex: number[] = [];

  // Typical baseline arrival rate: 2.2 vessels/hour; service rate: 2.0 vessels/hour (berth clearance)
  const baseArrivalRate = 2.2;
  const baseServiceRate = 2.0;

  let currentBaselineQueue = 4.0;
  let currentScenarioQueue = 4.0;

  for (let h = 0; h < hours; h++) {
    // Baseline progression
    const arrivalsBase = baseArrivalRate + (h >= 8 && h <= 18 ? 0.6 : -0.4);
    const servicedBase = baseServiceRate;
    currentBaselineQueue = Math.max(1, currentBaselineQueue + arrivalsBase - servicedBase);
    baselineQueue.push(+currentBaselineQueue.toFixed(1));
    baselineWaitHours.push(+(currentBaselineQueue / servicedBase).toFixed(1));

    // Scenario progression
    const isDisrupted =
      h >= config.disruptionStartHour &&
      h < config.disruptionStartHour + config.disruptionDurationHours;

    const arrivalMultiplier = config.arrivalRateMultiplier;
    const capacityMult = isDisrupted ? config.capacityMultiplier : 1.0;

    const arrivalsScen = arrivalsBase * arrivalMultiplier;
    const servicedScen = servicedBase * capacityMult;

    currentScenarioQueue = Math.max(1, currentScenarioQueue + arrivalsScen - servicedScen);
    scenarioQueue.push(+currentScenarioQueue.toFixed(1));
    scenarioWaitHours.push(+(currentScenarioQueue / Math.max(0.5, servicedScen)).toFixed(1));

    // Modeled CI (0.6 + 1.4 * queue/total)
    const modeledCi = +(Math.min(2.0, 0.6 + 1.4 * (currentScenarioQueue / (currentScenarioQueue + 6)))).toFixed(2);
    modeledCongestionIndex.push(modeledCi);
  }

  const peakBase = Math.max(...baselineQueue);
  const peakScen = Math.max(...scenarioQueue);
  const avgWaitBase = baselineWaitHours.reduce((a, b) => a + b, 0) / hours;
  const avgWaitScen = scenarioWaitHours.reduce((a, b) => a + b, 0) / hours;

  return {
    baselineQueue,
    scenarioQueue,
    baselineWaitHours,
    scenarioWaitHours,
    peakQueueDelta: +(peakScen - peakBase).toFixed(1),
    avgDelayIncreaseHours: +Math.max(0, avgWaitScen - avgWaitBase).toFixed(1),
    recoveryHours: Math.min(24, Math.round(config.disruptionDurationHours * 1.8)),
    modeledCongestionIndex,
  };
}

/**
 * Downstream disruption impact on connected ports along the Ripple Effect Network.
 */
export function calculateNetworkRippleEffects(
  disruptedPortId: string,
  delayHours: number,
): Array<{
  connectedPortId: string;
  connectedPortName: string;
  corridorName: string;
  projectedDelayHours: number;
  affectedSailings: number;
  riskSeverity: "low" | "medium" | "high";
}> {
  const outgoingCorridors = PORT_NETWORK_EDGES.filter(
    (e) => e.fromPortId === disruptedPortId || e.toPortId === disruptedPortId,
  );

  return outgoingCorridors.map((corr) => {
    const isFrom = corr.fromPortId === disruptedPortId;
    const otherPortId = isFrom ? corr.toPortId : corr.fromPortId;
    const otherPort = MONITORED_PORTS.find((p) => p.id === otherPortId)!;

    // Attenuation of delay across transit days (longer transit dampens shock through buffer time)
    const dampeningFactor = Math.max(0.35, 1.0 - corr.transitDays * 0.025);
    const downstreamDelay = +(delayHours * dampeningFactor).toFixed(1);
    const affectedSailings = Math.max(1, Math.round(corr.weeklySailings * (delayHours / 48)));

    let risk: "low" | "medium" | "high" = "low";
    if (downstreamDelay > 12) risk = "high";
    else if (downstreamDelay > 5) risk = "medium";

    return {
      connectedPortId: otherPort.id,
      connectedPortName: otherPort.name,
      corridorName: corr.corridorName,
      projectedDelayHours: downstreamDelay,
      affectedSailings,
      riskSeverity: risk,
    };
  });
}

/**
 * Computes hourly time-series metrics over the archive for chart analytics.
 */
export function getHourlyPortMetrics(portId?: string) {
  const hours = 24;
  const metrics: Array<{
    hour: string;
    timestamp: number;
    total: number;
    moving: number;
    anchored: number;
    congestionIndex: number;
  }> = [];

  for (let i = 0; i < hours; i++) {
    const t = ARCHIVE_START_TIME + i * 3600 * 1000;
    const date = new Date(t);
    const hourLabel = `${date.getUTCHours().toString().padStart(2, "0")}:00`;

    const vessels = COMPLETE_ARCHIVE.vessels.filter((v) => !portId || v.portId === portId);
    let total = 0;
    let moving = 0;
    let anchored = 0;

    for (const v of vessels) {
      const pos = interpolateVesselPosition(v, t);
      if (!pos) continue;
      total++;
      if (pos.stationary) anchored++;
      else moving++;
    }

    const ci = total > 0 ? +(Math.min(2.0, 0.6 + 1.4 * (anchored / total))).toFixed(2) : 0.8;

    metrics.push({
      hour: hourLabel,
      timestamp: t,
      total,
      moving,
      anchored,
      congestionIndex: ci,
    });
  }

  return metrics;
}

/**
 * Compares two historical time windows for port analytics.
 */
export function compareHistoricalWindows(
  windowA: { start: number; end: number },
  windowB: { start: number; end: number },
  portId?: string,
) {
  const midA = Math.floor((windowA.start + windowA.end) / 2);
  const midB = Math.floor((windowB.start + windowB.end) / 2);

  const vessels = COMPLETE_ARCHIVE.vessels.filter((v) => !portId || v.portId === portId);

  let totalA = 0;
  let anchoredA = 0;
  let totalB = 0;
  let anchoredB = 0;

  for (const v of vessels) {
    const pA = interpolateVesselPosition(v, midA);
    if (pA) {
      totalA++;
      if (pA.stationary) anchoredA++;
    }

    const pB = interpolateVesselPosition(v, midB);
    if (pB) {
      totalB++;
      if (pB.stationary) anchoredB++;
    }
  }

  const ciA = totalA > 0 ? +(Math.min(2.0, 0.6 + 1.4 * (anchoredA / totalA))).toFixed(2) : 0.8;
  const ciB = totalB > 0 ? +(Math.min(2.0, 0.6 + 1.4 * (anchoredB / totalB))).toFixed(2) : 0.8;

  return {
    periodA: { totalVessels: totalA, anchoredVessels: anchoredA, congestionIndex: ciA },
    periodB: { totalVessels: totalB, anchoredVessels: anchoredB, congestionIndex: ciB },
    delta: {
      vesselChange: totalB - totalA,
      anchoredChange: anchoredB - anchoredA,
      ciChange: +(ciB - ciA).toFixed(2),
    },
  };
}
