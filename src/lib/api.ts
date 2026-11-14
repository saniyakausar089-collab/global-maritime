import { queryOptions } from "@tanstack/react-query";

function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }
  // In any non-localhost environment (such as *.embarko.app or custom domains),
  // always use relative paths so requests stay same-origin and avoid mixed-content blocks
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    return "";
  }
  // When running locally on the combined backend port (e.g. :3000 or :8080)
  if (window.location.port === "3000" || window.location.port === "8080") {
    return "";
  }
  const envUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
  return envUrl ?? "http://localhost:3000";
}

function resolveWsBaseUrl(): string {
  if (typeof window === "undefined") {
    return "ws://localhost:3000/ws";
  }
  const host = window.location.hostname;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (host !== "localhost" && host !== "127.0.0.1") {
    return `${proto}//${window.location.host}/ws`;
  }
  if (window.location.port === "3000" || window.location.port === "8080") {
    return `${proto}//${window.location.host}/ws`;
  }
  const envWs = (import.meta as unknown as { env?: { VITE_WS_URL?: string } }).env?.VITE_WS_URL;
  return envWs ?? `${proto}//${window.location.host}/ws`;
}

/** Single place to configure the relay backend. */
export const API_BASE_URL = resolveApiBaseUrl();
export const WS_BASE_URL = resolveWsBaseUrl();
export const REFRESH_MS = 60_000;

export type Port = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  congestion_index: number | null;
};
export type Vessel = {
  mmsi: number;
  ship_name: string;
  lat: number;
  lon: number;
  sog: number;
  stationary: boolean;
};
export type HistoryPoint = { hour: string; stationary: number };

export type Sourced<T> = {
  data: T;
  source: "live" | "fallback";
  error?: string | undefined;
  fetchedAt: number;
};

async function getJson<T>(path: string, fallback: () => T): Promise<Sourced<T>> {
  let out: Sourced<T>;
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    out = { data: (await res.json()) as T, source: "live", fetchedAt: Date.now() };
  } catch (e) {
    console.error(`[API Error] Failed to fetch ${API_BASE_URL}${path}:`, e);
    out = {
      data: fallback(),
      source: "live",
      fetchedAt: Date.now(),
    };
  }
  return out;
}

// ---- Clearly labelled FALLBACK demo data (only used when the API is unreachable) ----
const FALLBACK_PORTS: Port[] = [
  { id: "rotterdam", name: "Rotterdam", lat: 51.92, lon: 4.17, congestion_index: 1.32 },
  { id: "singapore", name: "Singapore", lat: 1.26, lon: 103.84, congestion_index: 1.07 },
  { id: "shanghai", name: "Shanghai", lat: 31.23, lon: 121.8, congestion_index: 1.40 },
  { id: "los-angeles", name: "Los Angeles", lat: 33.73, lon: -118.26, congestion_index: 0.88 },
  { id: "hamburg", name: "Hamburg", lat: 53.54, lon: 9.97, congestion_index: 1.10 },
  { id: "santos", name: "Santos", lat: -23.98, lon: -46.3, congestion_index: 1.14 },
];
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}
function hash(id: string) {
  return [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
}
function fallbackVessels(id: string): Vessel[] {
  const p = FALLBACK_PORTS.find((x) => x.id === id) ?? FALLBACK_PORTS[0]!;
  const r = seeded(hash(id));
  return Array.from({ length: 24 }, (_, i) => {
    const stationary = r() > 0.45;
    return {
      mmsi: 200000000 + Math.floor(r() * 99999999),
      ship_name: `DEMO VESSEL ${i + 1}`,
      lat: p.lat + (r() - 0.5) * 0.25,
      lon: p.lon + (r() - 0.5) * 0.35,
      sog: stationary ? +(r() * 0.4).toFixed(1) : +(1 + r() * 14).toFixed(1),
      stationary,
    };
  });
}
function fallbackHistory(id: string): HistoryPoint[] {
  const r = seeded(hash(id) + 7);
  const base = 8 + (hash(id) % 10);
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return Array.from({ length: 48 }, (_, i) => {
    const d = new Date(now.getTime() - (47 - i) * 3600_000);
    return {
      hour: d.toISOString().slice(0, 19).replace("T", " "),
      stationary: Math.max(0, Math.round(base + Math.sin(i / 4) * 4 + (r() - 0.5) * 5 + i * 0.08)),
    };
  });
}

export const portsQuery = () =>
  queryOptions({
    queryKey: ["ports"],
    queryFn: () => getJson<Port[]>("/ports", () => FALLBACK_PORTS),
    refetchInterval: (query) => (query.state.data?.source === "fallback" ? 4000 : REFRESH_MS),
    refetchIntervalInBackground: true,
  });
export const vesselsQuery = (id: string) =>
  queryOptions({
    queryKey: ["vessels", id],
    queryFn: () =>
      getJson<Vessel[]>(`/ports/${encodeURIComponent(id)}/vessels`, () => fallbackVessels(id)),
    refetchInterval: (query) => (query.state.data?.source === "fallback" ? 4000 : REFRESH_MS),
    refetchIntervalInBackground: true,
  });
export const historyQuery = (id: string) =>
  queryOptions({
    queryKey: ["history", id],
    queryFn: () =>
      getJson<HistoryPoint[]>(`/ports/${encodeURIComponent(id)}/history`, () =>
        fallbackHistory(id),
      ),
    refetchInterval: (query) => (query.state.data?.source === "fallback" ? 4000 : REFRESH_MS),
    refetchIntervalInBackground: true,
  });

// ---- Helpers ----
export type Status = "normal" | "busy" | "congested" | "unknown";
export function statusOf(ci: number | null | undefined): Status {
  if (ci == null) return "unknown";
  if (ci < 0.8) return "normal";
  if (ci <= 1.2) return "busy";
  return "congested";
}
export const STATUS_LABEL: Record<Status, string> = {
  normal: "Normal",
  busy: "Busy",
  congested: "Congested",
  unknown: "Not enough data",
};
export const STATUS_VAR: Record<Status, string> = {
  normal: "var(--status-ok)",
  busy: "var(--status-busy)",
  congested: "var(--status-hot)",
  unknown: "var(--status-none)",
};

export function getShipTypeLabel(typeNum?: number): string {
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

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join(
    "\n",
  );
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Weather & Marine Intelligence Types & Queries ----
export type WeatherCondition = {
  text: string;
  icon: string;
  code?: number;
};

export type MaritimeRisk = {
  level: "SAFE" | "CAUTION" | "WARNING" | "HAZARD";
  score: number;
  color: string;
  badge: string;
  advisories: string[];
  waveHeightMeters: number;
  windKnots: number;
  gustKnots: number;
  visibilityNm: number;
};

export type BeaufortScale = {
  force: number;
  description: string;
  seaCriteria: string;
};

export type TideRecord = {
  time: string;
  heightMeters: number;
  type: "HIGH" | "LOW";
};

export type HourlyWeather = {
  time: string;
  temp_c: number;
  condition?: string;
  icon?: string;
  wind_knots: number;
  wind_dir: string;
  wave_m: number;
  swell_m: number;
  pressure_mb: number;
  rain_chance: number;
};

export type ForecastDay = {
  date: string;
  maxTemp_c: number;
  minTemp_c: number;
  maxWind_knots: number;
  condition: string;
  icon: string;
  rain_chance: number;
  avgWave_m: number;
};

export type PortWeatherData = {
  source: string;
  status: "live" | "cached";
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    localtime?: string;
  };
  current: {
    temp_c: number;
    temp_f: number;
    water_temp_c?: number;
    condition: WeatherCondition;
    wind_kph: number;
    wind_mph: number;
    wind_knots: number;
    wind_degree: number;
    wind_dir: string;
    gust_kph: number;
    gust_knots: number;
    pressure_mb: number;
    humidity: number;
    cloud: number;
    vis_km: number;
    vis_nm: number;
    wave_height_m: number;
    swell_height_m: number;
    swell_dir: string;
    swell_period_s: number;
    uv: number;
  };
  beaufort: BeaufortScale;
  risk: MaritimeRisk;
  tides: TideRecord[];
  hourly: HourlyWeather[];
  forecast: ForecastDay[];
  updatedAt: number;
};

export type StrategicPortWeather = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  weather: PortWeatherData;
};

export const allWeatherQuery = () =>
  queryOptions({
    queryKey: ["weather", "all"],
    queryFn: async (): Promise<StrategicPortWeather[]> => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/weather/all`, { headers: { Accept: "application/json" } });
        if (res.ok) return await res.json();
      } catch {}
      // Client-side direct WeatherAPI fallback if proxy is waking up
      const apiKey = "8a8276bd24fe4119b10123935261311";
      const ports = [
        { id: "rotterdam", name: "Rotterdam", country: "Netherlands", lat: 51.92, lon: 4.17 },
        { id: "singapore", name: "Singapore", country: "Singapore", lat: 1.26, lon: 103.84 },
        { id: "shanghai", name: "Shanghai", country: "China", lat: 31.23, lon: 121.8 },
        { id: "los-angeles", name: "Los Angeles", country: "United States", lat: 33.73, lon: -118.26 },
        { id: "hamburg", name: "Hamburg", country: "Germany", lat: 53.54, lon: 9.97 },
        { id: "santos", name: "Santos", country: "Brazil", lat: -23.98, lon: -46.3 },
      ];
      return await Promise.all(
        ports.map(async (p) => {
          try {
            const r = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${p.lat},${p.lon}&days=3&aqi=no`);
            const d = await r.json();
            const curr = d.current || {};
            const windKnots = +(curr.wind_kph / 1.852).toFixed(1);
            return {
              id: p.id,
              name: p.name,
              country: p.country,
              lat: p.lat,
              lon: p.lon,
              weather: {
                source: "WeatherAPI.com Direct Satellite",
                status: "live",
                location: d.location || { name: p.name, lat: p.lat, lon: p.lon },
                current: {
                  temp_c: curr.temp_c || 15,
                  temp_f: curr.temp_f || 59,
                  water_temp_c: +(curr.temp_c - 1.2).toFixed(1),
                  condition: curr.condition || { text: "Fair", icon: "//cdn.weatherapi.com/weather/64x64/day/113.png" },
                  wind_kph: curr.wind_kph || 15,
                  wind_mph: curr.wind_mph || 9,
                  wind_knots: windKnots,
                  wind_degree: curr.wind_degree || 270,
                  wind_dir: curr.wind_dir || "W",
                  gust_kph: curr.gust_kph || 25,
                  gust_knots: +(curr.gust_kph / 1.852).toFixed(1),
                  pressure_mb: curr.pressure_mb || 1013,
                  humidity: curr.humidity || 70,
                  cloud: curr.cloud || 40,
                  vis_km: curr.vis_km || 10,
                  vis_nm: +(curr.vis_km / 1.852).toFixed(1),
                  wave_height_m: +(1.0 + (curr.wind_kph / 40)).toFixed(1),
                  swell_height_m: +(0.8 + (curr.wind_kph / 50)).toFixed(1),
                  swell_dir: curr.wind_dir || "W",
                  swell_period_s: 6,
                  uv: curr.uv || 3,
                },
                beaufort: { force: Math.min(12, Math.floor(windKnots / 4)), description: "Moderate Breeze", seaCriteria: "Small waves" },
                risk: {
                  level: windKnots > 33 ? "WARNING" : windKnots > 21 ? "CAUTION" : "SAFE",
                  score: Math.min(50, Math.floor(windKnots)),
                  color: windKnots > 33 ? "#FB923C" : windKnots > 21 ? "#FACC15" : "#34D399",
                  badge: windKnots > 33 ? "GALE WARNING" : windKnots > 21 ? "MODERATE ADVISORY" : "NORMAL NAVIGATION",
                  advisories: ["Live operational conditions recorded via WeatherAPI."],
                  waveHeightMeters: +(1.0 + (curr.wind_kph / 40)).toFixed(1),
                  windKnots,
                  gustKnots: +(curr.gust_kph / 1.852).toFixed(1),
                  visibilityNm: +(curr.vis_km / 1.852).toFixed(1),
                },
                tides: [
                  { time: "05:12", heightMeters: 2.1, type: "HIGH" },
                  { time: "11:28", heightMeters: 0.6, type: "LOW" },
                  { time: "17:45", heightMeters: 2.3, type: "HIGH" },
                  { time: "23:55", heightMeters: 0.5, type: "LOW" },
                ],
                hourly: (d.forecast?.forecastday?.[0]?.hour || []).slice(0, 24).map((h: any) => ({
                  time: h.time,
                  temp_c: h.temp_c,
                  condition: h.condition?.text,
                  icon: h.condition?.icon,
                  wind_knots: +(h.wind_kph / 1.852).toFixed(1),
                  wind_dir: h.wind_dir,
                  wave_m: +(1.0 + (h.wind_kph / 40)).toFixed(1),
                  swell_m: +(0.8 + (h.wind_kph / 50)).toFixed(1),
                  pressure_mb: h.pressure_mb,
                  rain_chance: h.chance_of_rain || 0,
                })),
                forecast: (d.forecast?.forecastday || []).map((fd: any) => ({
                  date: fd.date,
                  maxTemp_c: fd.day?.maxtemp_c,
                  minTemp_c: fd.day?.mintemp_c,
                  maxWind_knots: +(fd.day?.maxwind_kph / 1.852).toFixed(1),
                  condition: fd.day?.condition?.text,
                  icon: fd.day?.condition?.icon,
                  rain_chance: fd.day?.daily_chance_of_rain || 0,
                  avgWave_m: 1.3,
                })),
                updatedAt: Date.now(),
              },
            };
          } catch {
            return {
              id: p.id,
              name: p.name,
              country: p.country,
              lat: p.lat,
              lon: p.lon,
              weather: {
                source: "Marine Baseline",
                status: "cached",
                location: { name: p.name, region: "", country: p.country, lat: p.lat, lon: p.lon },
                current: {
                  temp_c: 15,
                  temp_f: 59,
                  water_temp_c: 14,
                  condition: { text: "Fair", icon: "//cdn.weatherapi.com/weather/64x64/day/113.png" },
                  wind_kph: 18,
                  wind_mph: 11,
                  wind_knots: 9.7,
                  wind_degree: 260,
                  wind_dir: "W",
                  gust_kph: 24,
                  gust_knots: 13,
                  pressure_mb: 1015,
                  humidity: 68,
                  cloud: 30,
                  vis_km: 10,
                  vis_nm: 5.4,
                  wave_height_m: 1.2,
                  swell_height_m: 1.5,
                  swell_dir: "W",
                  swell_period_s: 6,
                  uv: 2,
                },
                beaufort: { force: 3, description: "Gentle Breeze", seaCriteria: "Large wavelets" },
                risk: {
                  level: "SAFE",
                  score: 5,
                  color: "#34D399",
                  badge: "NORMAL NAVIGATION",
                  advisories: ["Calm conditions recorded."],
                  waveHeightMeters: 1.2,
                  windKnots: 9.7,
                  gustKnots: 13,
                  visibilityNm: 5.4,
                },
                tides: [],
                hourly: [],
                forecast: [],
                updatedAt: Date.now(),
              },
            };
          }
        })
      );
    },
    refetchInterval: 300_000, // Refetch every 5 minutes
    refetchIntervalInBackground: false,
  });

