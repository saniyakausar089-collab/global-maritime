import * as THREE from "three";

export interface PortCoord {
  id: string;
  name: string;
  lat: number;
  lon: number;
  ci: number;
  country: string;
}

export const MONITORED_PORTS: PortCoord[] = [
  { id: "rotterdam", name: "Rotterdam", lat: 51.92, lon: 4.17, ci: 1.34, country: "Netherlands" },
  { id: "singapore", name: "Singapore", lat: 1.26, lon: 103.84, ci: 1.42, country: "Singapore" },
  { id: "shanghai", name: "Shanghai", lat: 31.23, lon: 121.8, ci: 1.18, country: "China" },
  { id: "los-angeles", name: "Los Angeles", lat: 33.73, lon: -118.26, ci: 0.95, country: "United States" },
  { id: "hamburg", name: "Hamburg", lat: 53.53, lon: 9.97, ci: 1.08, country: "Germany" },
  { id: "santos", name: "Santos", lat: -23.95, lon: -46.32, ci: 1.29, country: "Brazil" },
];

export const MAJOR_GLOBAL_HUBS: { name: string; lat: number; lon: number }[] = [
  { name: "Rotterdam", lat: 51.92, lon: 4.17 },
  { name: "Singapore", lat: 1.26, lon: 103.84 },
  { name: "Shanghai", lat: 31.23, lon: 121.8 },
  { name: "Los Angeles", lat: 33.73, lon: -118.26 },
  { name: "Hamburg", lat: 53.53, lon: 9.97 },
  { name: "Santos", lat: -23.95, lon: -46.32 },
  { name: "Tokyo", lat: 35.65, lon: 139.77 },
  { name: "Dubai", lat: 25.26, lon: 55.29 },
  { name: "New York", lat: 40.68, lon: -74.04 },
  { name: "Panama", lat: 8.95, lon: -79.56 },
  { name: "Suez", lat: 29.97, lon: 32.56 },
  { name: "Busan", lat: 35.1, lon: 129.04 },
  { name: "Hong Kong", lat: 22.3, lon: 114.17 },
  { name: "Gibraltar", lat: 36.14, lon: -5.35 },
  { name: "Sydney", lat: -33.86, lon: 151.21 },
  { name: "Cape Town", lat: -33.92, lon: 18.42 },
  { name: "Mumbai", lat: 18.94, lon: 72.84 },
  { name: "Antwerp", lat: 51.22, lon: 4.4 },
  { name: "Valencia", lat: 39.46, lon: -0.37 },
  { name: "Houston", lat: 29.76, lon: -95.36 },
];

export const TRADE_LANE_PAIRS: [string, string][] = [
  ["Rotterdam", "Singapore"],
  ["Rotterdam", "New York"],
  ["Rotterdam", "Hamburg"],
  ["Rotterdam", "Antwerp"],
  ["Rotterdam", "Gibraltar"],
  ["Gibraltar", "Suez"],
  ["Suez", "Dubai"],
  ["Dubai", "Singapore"],
  ["Singapore", "Shanghai"],
  ["Shanghai", "Los Angeles"],
  ["Shanghai", "Tokyo"],
  ["Shanghai", "Busan"],
  ["Shanghai", "Hong Kong"],
  ["Hong Kong", "Singapore"],
  ["Tokyo", "Los Angeles"],
  ["Panama", "Los Angeles"],
  ["Panama", "New York"],
  ["Panama", "Houston"],
  ["Santos", "Gibraltar"],
  ["Santos", "Rotterdam"],
  ["Cape Town", "Singapore"],
  ["Cape Town", "Rotterdam"],
  ["Singapore", "Sydney"],
  ["Dubai", "Mumbai"],
  ["Mumbai", "Singapore"],
];

/**
 * Converts Latitude & Longitude in degrees into 3D Cartesian coordinates on a sphere of radius R.
 */
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Generates smooth 3D spherical great-circle arc points between two coordinates.
 */
export function createArcPoints(
  v1: THREE.Vector3,
  v2: THREE.Vector3,
  radius: number,
  numPoints: number = 40,
  maxAltitude: number = 1.35
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const distance = v1.distanceTo(v2);
  const altitude = radius + Math.min(distance * 0.22, maxAltitude);

  const mid = v1.clone().add(v2).multiplyScalar(0.5);
  mid.normalize().multiplyScalar(altitude);

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const p1 = new THREE.Vector3().lerpVectors(v1, mid, t);
    const p2 = new THREE.Vector3().lerpVectors(mid, v2, t);
    const pt = new THREE.Vector3().lerpVectors(p1, p2, t);
    points.push(pt);
  }

  return points;
}

/**
 * 10-Scene Cinematic Narrative Definition matching exact sequence
 */
export const SCENES_10 = [
  {
    id: 0,
    title: "The Awakening of Earth",
    badge: "GLOBAL SURVEILLANCE",
    headline: "THE WORLD NEVER STOPS MOVING.",
    subtitle: "Explore the intelligence connecting global maritime operations.",
  },
  {
    id: 1,
    title: "Global Shipping Network",
    badge: "AIS LIVE TRACKING",
    headline: "HIGH-DENSITY COMMERCIAL FAIRWAYS",
    subtitle: "Multiple commercial vessels navigating synchronized great-circle trade corridors.",
  },
  {
    id: 2,
    title: "Weather Risk Intelligence",
    badge: "METEOROLOGICAL INTELLIGENCE",
    headline: "THE OCEAN IS UNPREDICTABLE. YOUR DECISIONS SHOULDN'T BE.",
    subtitle: "Doppler cyclone tracking, isobaric wind vectors, and dynamic route safety divergence.",
  },
  {
    id: 3,
    title: "The Time Machine",
    badge: "TEMPORAL VORTEX",
    headline: "EXPLORE MARITIME CONDITIONS ACROSS TIME",
    subtitle: "Navigate past, real-time, and predicted fleet congestion through 4D temporal forensics.",
  },
  {
    id: 4,
    title: "Global Port Congestion",
    badge: "BENCHMARKING",
    headline: "STRATEGIC GATEWAY CONGESTION RANKINGS",
    subtitle: "Live anchorage dwell analysis and queue density across the world's 6 prime maritime hubs.",
  },
  {
    id: 5,
    title: "Three Types of Ships",
    badge: "MERCHANT FLEET",
    headline: "THE PILLARS OF GLOBAL SEABORNE COMMERCE",
    subtitle: "Container carriers, passenger liners, and crude oil tankers operating simultaneously.",
  },
  {
    id: 6,
    title: "Cargo Ship",
    badge: "ULCV CONTAINER CARRIER",
    headline: "GLOBAL SUPPLY CHAIN WORKHORSES",
    subtitle: "Cargo vessels transport international goods and commodities across transoceanic supply chains.",
  },
  {
    id: 7,
    title: "Passenger Ship",
    badge: "LUXURY CRUISE LINER",
    headline: "CONNECTING SEAS AND DESTINATIONS",
    subtitle: "Passenger vessels transport people across oceans, connecting ports through cruise and ferry services.",
  },
  {
    id: 8,
    title: "Tanker Ship",
    badge: "VLCC CRUDE & CHEMICAL TANKER",
    headline: "CRITICAL ENERGY INFRASTRUCTURE",
    subtitle: "Tankers transport liquid cargo such as crude oil and petroleum products vital for global energy security.",
  },
  {
    id: 9,
    title: "Global Maritime Hero",
    badge: "OPERATIONAL LAUNCH",
    headline: "GLOBAL MARITIME",
    subtitle: "One ocean. Connected intelligence.",
  },
];
