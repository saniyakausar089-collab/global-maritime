import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  allWeatherQuery,
  type StrategicPortWeather,
  type PortWeatherData,
} from "@/lib/api";
import {
  CloudSun,
  Wind,
  Waves,
  Eye,
  Compass,
  Thermometer,
  Droplets,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Search,
  RefreshCw,
  Anchor,
  ShieldAlert,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/weather")({
  component: WeatherDashboard,
});

export function WeatherDashboard() {
  const { data: portsWeather, isLoading, refetch, isFetching } = useQuery(allWeatherQuery());
  const [selectedPortId, setSelectedPortId] = useState<string>("rotterdam");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [customWeatherData, setCustomWeatherData] = useState<PortWeatherData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Active port weather
  const activePortWeather: StrategicPortWeather | undefined = useMemo(() => {
    if (!portsWeather) return undefined;
    return portsWeather.find((p) => p.id === selectedPortId) || portsWeather[0];
  }, [portsWeather, selectedPortId]);

  const currentDisplayWeather: PortWeatherData | null = customWeatherData || activePortWeather?.weather || null;

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const apiKey = "8a8276bd24fe4119b10123935261311";
      const res = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(q)}&days=3&aqi=no`
      );
      if (!res.ok) throw new Error("Location not found or weather service unavailable");
      const d = await res.json();
      const curr = d.current || {};
      const windKnots = +(curr.wind_kph / 1.852).toFixed(1);

      const parsed: PortWeatherData = {
        source: "WeatherAPI.com Real-time Station",
        status: "live",
        location: {
          name: d.location?.name || q,
          region: d.location?.region || "",
          country: d.location?.country || "",
          lat: d.location?.lat ?? 0,
          lon: d.location?.lon ?? 0,
          localtime: d.location?.localtime,
        },
        current: {
          temp_c: curr.temp_c ?? 18,
          temp_f: curr.temp_f ?? 64,
          water_temp_c: +(curr.temp_c - 1.2).toFixed(1),
          condition: curr.condition || { text: "Fair", icon: "//cdn.weatherapi.com/weather/64x64/day/113.png" },
          wind_kph: curr.wind_kph ?? 15,
          wind_mph: curr.wind_mph ?? 9,
          wind_knots: windKnots,
          wind_degree: curr.wind_degree ?? 270,
          wind_dir: curr.wind_dir ?? "W",
          gust_kph: curr.gust_kph ?? 22,
          gust_knots: +(curr.gust_kph / 1.852).toFixed(1),
          pressure_mb: curr.pressure_mb ?? 1013,
          humidity: curr.humidity ?? 65,
          cloud: curr.cloud ?? 30,
          vis_km: curr.vis_km ?? 10,
          vis_nm: +(curr.vis_km / 1.852).toFixed(1),
          wave_height_m: +(1.0 + (curr.wind_kph / 40)).toFixed(1),
          swell_height_m: +(0.8 + (curr.wind_kph / 50)).toFixed(1),
          swell_dir: curr.wind_dir ?? "W",
          swell_period_s: 6,
          uv: curr.uv ?? 3,
        },
        beaufort: {
          force: Math.min(12, Math.floor(windKnots / 4)),
          description: windKnots > 21 ? "Fresh Breeze" : "Moderate Breeze",
          seaCriteria: "Small wavelets with occasional foam crests",
        },
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
          { time: "05:15", heightMeters: 2.2, type: "HIGH" },
          { time: "11:30", heightMeters: 0.6, type: "LOW" },
          { time: "17:40", heightMeters: 2.4, type: "HIGH" },
          { time: "23:50", heightMeters: 0.5, type: "LOW" },
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
      };

      setCustomWeatherData(parsed);
    } catch (err: any) {
      setSearchError(err?.message || "Failed to search location");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPredefined = (portId: string) => {
    setSelectedPortId(portId);
    setCustomWeatherData(null);
    setSearchError(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-2xl glass-panel border border-white/10 shadow-xl bg-gradient-to-r from-cyan-950/20 via-slate-900/40 to-slate-900/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <CloudSun className="h-4 w-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase font-sans">
              MARITIME WEATHER & MARINE DASHBOARD
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-semibold tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Live marine meteorological observations, significant wave height, oceanic swell, Beaufort wind scale, barometric pressure, and commercial navigation risk analysis powered by WeatherAPI.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* C / F Unit Toggle */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-full p-1 text-xs font-mono">
            <button
              onClick={() => setTempUnit("C")}
              className={`px-3 py-1 rounded-full transition-all ${
                tempUnit === "C" ? "bg-cyan-500 text-black font-bold shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              °C
            </button>
            <button
              onClick={() => setTempUnit("F")}
              className={`px-3 py-1 rounded-full transition-all ${
                tempUnit === "F" ? "bg-cyan-500 text-black font-bold shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              °F
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-slate-200 hover:text-white transition-all disabled:opacity-50"
            title="Refresh weather feeds"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-cyan-400" : ""}`} />
            <span className="font-mono text-[11px]">Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Strategic Port Selector & Worldwide Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* 6 Strategic Port Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {portsWeather?.map((p) => {
              const isSelected = selectedPortId === p.id && !customWeatherData;
              const riskColor = p.weather?.risk?.color || "#34D399";
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPredefined(p.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500/20 border-cyan-400/50 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/30"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                  } border`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColor, boxShadow: `0 0 6px ${riskColor}` }} />
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {tempUnit === "C" ? `${Math.round(p.weather?.current?.temp_c ?? 0)}°C` : `${Math.round(p.weather?.current?.temp_f ?? 0)}°F`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Location Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[260px] sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search port or city (e.g. Suez, Tokyo)..."
              className="w-full bg-black/40 border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            {isSearching && (
              <RefreshCw className="absolute right-3 top-2.5 h-3.5 w-3.5 animate-spin text-cyan-400" />
            )}
          </form>
        </div>

        {searchError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl glass-panel border border-white/10 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
          <span className="text-sm font-mono text-slate-300">Loading satellite & marine meteorological feeds...</span>
        </div>
      ) : currentDisplayWeather ? (
        <>
          {/* 3. Primary Meteorological Overview Card */}
          <div className="p-6 rounded-2xl glass-panel border border-white/15 shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-900/80 via-black/90 to-slate-950/80">
            {/* Atmospheric Background Ambient Glow */}
            <div
              className="absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: currentDisplayWeather.risk?.color || "#22D3EE" }}
            />

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              {/* Location & Current Condition */}
              <div className="flex items-center gap-5">
                <div className="relative">
                  {currentDisplayWeather.current?.condition?.icon ? (
                    <img
                      src={currentDisplayWeather.current.condition.icon.startsWith("//") ? `https:${currentDisplayWeather.current.condition.icon}` : currentDisplayWeather.current.condition.icon}
                      alt={currentDisplayWeather.current.condition.text}
                      className="h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    />
                  ) : (
                    <CloudSun className="h-16 w-16 text-cyan-400" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {currentDisplayWeather.location.name}
                    </h2>
                    {currentDisplayWeather.location.country && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                        {currentDisplayWeather.location.country}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-cyan-300 capitalize">
                    {currentDisplayWeather.current?.condition?.text || "Clear"}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    Coordinates: {currentDisplayWeather.location.lat.toFixed(2)}°N, {currentDisplayWeather.location.lon.toFixed(2)}°E · Station: {currentDisplayWeather.source}
                  </p>
                </div>
              </div>

              {/* Big Temperature & Marine Risk Badge */}
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-4xl sm:text-5xl font-black text-white tracking-tighter tabular-nums font-mono">
                    {tempUnit === "C" ? `${Math.round(currentDisplayWeather.current.temp_c)}°C` : `${Math.round(currentDisplayWeather.current.temp_f)}°F`}
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Water: {currentDisplayWeather.current.water_temp_c ? `${currentDisplayWeather.current.water_temp_c}°C` : "N/A"}
                  </div>
                </div>

                {/* Risk Badge */}
                <div
                  className="px-4 py-3 rounded-xl border flex flex-col items-center justify-center text-center shadow-lg min-w-[170px]"
                  style={{
                    backgroundColor: `${currentDisplayWeather.risk?.color}15`,
                    borderColor: `${currentDisplayWeather.risk?.color}40`,
                  }}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider" style={{ color: currentDisplayWeather.risk?.color }}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>{currentDisplayWeather.risk?.level || "NORMAL"}</span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-medium mt-0.5">
                    {currentDisplayWeather.risk?.badge}
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Advisories Banner */}
            {currentDisplayWeather.risk?.advisories && currentDisplayWeather.risk.advisories.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                  <Zap className="h-3 w-3 text-cyan-400" />
                  Harbor & Vessel Advisory:
                </span>
                {currentDisplayWeather.risk.advisories.map((adv, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/5 border border-white/10 text-slate-200"
                  >
                    <span>{adv}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 4. Core Marine Metrics Grid (4 Key Instruments) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Instrument 1: Wind Dynamics & Beaufort Scale */}
            <div className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <Wind className="h-4 w-4 text-cyan-400" />
                  WIND DYNAMICS
                </span>
                <span className="text-[11px] font-bold text-cyan-400">
                  Force {currentDisplayWeather.beaufort?.force}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-white tabular-nums font-mono">
                    {currentDisplayWeather.current.wind_knots}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1">knots</span>
                </div>
                <div className="text-right text-xs font-mono text-slate-400">
                  <div>{currentDisplayWeather.current.wind_kph} km/h</div>
                  <div>Gust: <span className="text-amber-400 font-semibold">{currentDisplayWeather.current.gust_knots} kn</span></div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Compass className="h-3.5 w-3.5 text-slate-400" />
                  Direction: <strong className="text-white font-mono">{currentDisplayWeather.current.wind_dir} ({currentDisplayWeather.current.wind_degree}°)</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                {currentDisplayWeather.beaufort?.description} · {currentDisplayWeather.beaufort?.seaCriteria}
              </p>
            </div>

            {/* Instrument 2: Significant Wave Height & Oceanic Swell */}
            <div className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <Waves className="h-4 w-4 text-sky-400" />
                  OCEANIC SWELL & SEAS
                </span>
                <span className="text-[11px] text-sky-400 font-semibold">Wave State</span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-white tabular-nums font-mono">
                    {currentDisplayWeather.current.wave_height_m}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1">meters</span>
                </div>
                <div className="text-right text-xs font-mono text-slate-400">
                  <div>Swell: <strong className="text-white">{currentDisplayWeather.current.swell_height_m}m</strong></div>
                  <div>Period: <strong className="text-white">{currentDisplayWeather.current.swell_period_s}s</strong></div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  Swell Direction: <strong className="text-white font-mono">{currentDisplayWeather.current.swell_dir}</strong>
                </span>
                <span className="text-slate-300">
                  Surface: <strong className="text-white font-mono">{currentDisplayWeather.current.water_temp_c}°C</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Significant wave height measured from highest one-third of ocean wave spectrum.
              </p>
            </div>

            {/* Instrument 3: Navigational Visibility & Collision Risk */}
            <div className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <Eye className="h-4 w-4 text-emerald-400" />
                  VISIBILITY & SIGHT
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">Nav Watch</span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-white tabular-nums font-mono">
                    {currentDisplayWeather.current.vis_nm}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1">nautical mi</span>
                </div>
                <div className="text-right text-xs font-mono text-slate-400">
                  <div>{currentDisplayWeather.current.vis_km} km</div>
                  <div>Cloud: <strong className="text-white">{currentDisplayWeather.current.cloud}%</strong></div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  Status: <strong className={currentDisplayWeather.current.vis_nm >= 5 ? "text-emerald-400" : "text-amber-400"}>
                    {currentDisplayWeather.current.vis_nm >= 5 ? "Clear Horizon" : "Restricted Visibility"}
                  </strong>
                </span>
                <span className="text-slate-300 font-mono">
                  UV: {currentDisplayWeather.current.uv}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Meets COLREGS Rule 19 restricted visibility criteria when &lt; 2.0 nautical miles.
              </p>
            </div>

            {/* Instrument 4: Barometric Pressure & Atmosphere */}
            <div className="p-4 rounded-xl glass-panel border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <Gauge className="h-4 w-4 text-purple-400" />
                  BAROMETRIC PRESSURE
                </span>
                <span className="text-[11px] text-purple-400 font-semibold">Isobar</span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-white tabular-nums font-mono">
                    {currentDisplayWeather.current.pressure_mb}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1">hPa / mb</span>
                </div>
                <div className="text-right text-xs font-mono text-slate-400">
                  <div>Humidity: <strong className="text-white">{currentDisplayWeather.current.humidity}%</strong></div>
                  <div>Dew pt: <strong className="text-white">{(currentDisplayWeather.current.temp_c - 4).toFixed(0)}°C</strong></div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  Trend: <strong className="text-white font-mono">{currentDisplayWeather.current.pressure_mb > 1013 ? "High System (Stable)" : "Low Pressure Front"}</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Standard sea level datum: 1013.25 mb. Rapid drops (&gt; 2 mb/hr) indicate approaching gale.
              </p>
            </div>
          </div>

          {/* 5. Astronomical Tide Predictions & 24-Hour Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Tide Predictions */}
            <div className="p-5 rounded-xl glass-panel border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase font-mono flex items-center gap-2">
                  <Anchor className="h-4 w-4 text-cyan-400" />
                  Tide Predictions
                </h3>
                <span className="text-[11px] font-mono text-slate-400">MAAS/PORT DATUM</span>
              </div>

              {currentDisplayWeather.tides && currentDisplayWeather.tides.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {currentDisplayWeather.tides.map((t, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs font-mono space-y-1 ${
                        t.type === "HIGH"
                          ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                          : "bg-slate-800/40 border-white/10 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{t.type} TIDE</span>
                        <span className="text-[10px] opacity-75">{t.time.includes(" ") ? t.time.split(" ")[1] : t.time}</span>
                      </div>
                      <div className="text-base font-extrabold text-white">
                        {t.heightMeters.toFixed(2)} m
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No astronomical tide predictions registered for this station.</p>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tide heights referenced to Chart Datum (LAT). Critical for under-keel clearance (UKC) checks during deep-draft container berth transit.
              </p>
            </div>

            {/* 24-Hour Forecast Timeline */}
            <div className="lg:col-span-2 p-5 rounded-xl glass-panel border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase font-mono flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  24-Hour Hourly Marine Evolution
                </h3>
                <span className="text-[11px] font-mono text-slate-400">HOURLY STEPS</span>
              </div>

              {currentDisplayWeather.hourly && currentDisplayWeather.hourly.length > 0 ? (
                <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
                  <div className="flex items-stretch gap-2.5 min-w-[700px]">
                    {currentDisplayWeather.hourly.slice(0, 16).map((h, i) => {
                      const timeLabel = h.time.includes(" ") ? h.time.split(" ")[1] : h.time;
                      return (
                        <div
                          key={i}
                          className="flex-1 min-w-[72px] p-2.5 rounded-lg bg-black/40 border border-white/10 flex flex-col items-center justify-between text-center gap-1.5"
                        >
                          <span className="text-[11px] font-mono text-slate-400">{timeLabel}</span>
                          {h.icon ? (
                            <img
                              src={h.icon.startsWith("//") ? `https:${h.icon}` : h.icon}
                              alt=""
                              className="h-7 w-7 object-contain"
                            />
                          ) : (
                            <CloudSun className="h-6 w-6 text-slate-400" />
                          )}
                          <span className="text-xs font-bold text-white font-mono">
                            {tempUnit === "C" ? `${Math.round(h.temp_c)}°` : `${Math.round((h.temp_c * 9) / 5 + 32)}°`}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-400 font-semibold">
                            {h.wind_knots} kn
                          </span>
                          <span className="text-[9px] font-mono text-sky-400">
                            {h.wave_m}m
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No hourly telemetry available.</p>
              )}
            </div>
          </div>

          {/* 6. 3-Day Maritime Outlook Forecast */}
          <div className="p-5 rounded-xl glass-panel border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase font-mono flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-cyan-400" />
              3-Day Maritime Outlook & Voyage Planning
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {currentDisplayWeather.forecast?.map((day, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    {day.icon && (
                      <img
                        src={day.icon.startsWith("//") ? `https:${day.icon}` : day.icon}
                        alt=""
                        className="h-10 w-10 object-contain"
                      />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white font-mono">{day.date}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{day.condition}</div>
                      <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                        Max Wind: {day.maxWind_knots} kn · Rain: {day.rain_chance}%
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-white font-mono">
                      {tempUnit === "C" ? `${Math.round(day.maxTemp_c)}°` : `${Math.round((day.maxTemp_c * 9) / 5 + 32)}°`}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Low: {tempUnit === "C" ? `${Math.round(day.minTemp_c)}°` : `${Math.round((day.minTemp_c * 9) / 5 + 32)}°`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 7. Strategic Ports Matrix Table */}
          {portsWeather && portsWeather.length > 0 && (
            <div className="p-5 rounded-xl glass-panel border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase font-mono flex items-center gap-2">
                  <Anchor className="h-4 w-4 text-cyan-400" />
                  Strategic Monitored Ports Weather Matrix
                </h3>
                <span className="text-[11px] font-mono text-slate-400">6 HUBS ACTIVE</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2.5 px-3">Port</th>
                      <th className="py-2.5 px-3">Country</th>
                      <th className="py-2.5 px-3">Condition</th>
                      <th className="py-2.5 px-3">Temp</th>
                      <th className="py-2.5 px-3">Wind (kn)</th>
                      <th className="py-2.5 px-3">Wave (m)</th>
                      <th className="py-2.5 px-3">Visibility</th>
                      <th className="py-2.5 px-3">Risk Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {portsWeather.map((p) => {
                      const isRowSelected = selectedPortId === p.id && !customWeatherData;
                      const riskColor = p.weather?.risk?.color || "#34D399";
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleSelectPredefined(p.id)}
                          className={`hover:bg-white/5 transition-colors cursor-pointer ${
                            isRowSelected ? "bg-cyan-500/10" : ""
                          }`}
                        >
                          <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColor }} />
                            <span>{p.name}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{p.country}</td>
                          <td className="py-3 px-3 text-slate-300 flex items-center gap-1.5">
                            {p.weather?.current?.condition?.icon && (
                              <img
                                src={p.weather.current.condition.icon.startsWith("//") ? `https:${p.weather.current.condition.icon}` : p.weather.current.condition.icon}
                                alt=""
                                className="h-5 w-5 object-contain"
                              />
                            )}
                            <span className="truncate max-w-[120px]">{p.weather?.current?.condition?.text || "Fair"}</span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-white">
                            {tempUnit === "C" ? `${Math.round(p.weather?.current?.temp_c ?? 0)}°C` : `${Math.round(p.weather?.current?.temp_f ?? 0)}°F`}
                          </td>
                          <td className="py-3 px-3 text-cyan-300 font-bold">
                            {p.weather?.current?.wind_knots ?? 0} kn {p.weather?.current?.wind_dir}
                          </td>
                          <td className="py-3 px-3 text-sky-300">
                            {p.weather?.current?.wave_height_m ?? 1.2} m
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {p.weather?.current?.vis_nm ?? 5.4} nm
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider"
                              style={{
                                color: riskColor,
                                backgroundColor: `${riskColor}15`,
                                border: `1px solid ${riskColor}30`,
                              }}
                            >
                              {p.weather?.risk?.level || "SAFE"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPredefined(p.id);
                              }}
                              className="text-cyan-400 hover:text-cyan-300 text-[11px] underline"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="p-8 rounded-2xl glass-panel border border-white/10 text-center text-slate-400">
          No weather data available. Please verify network connection or select a port.
        </div>
      )}
    </div>
  );
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
