import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Compass,
  Radio,
  Layers,
  AlertTriangle,
  Ship,
  History,
  ArrowRight,
  Wind,
  Waves,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Activity,
  Anchor,
  Box,
  Droplet,
  Users,
} from "lucide-react";
import type { TrackedVessel } from "./ShipCourseVectors";

interface WeatherData {
  port_id: string;
  port_name: string;
  wind_speed_knots: number;
  wind_direction_deg: number;
  wave_height_m: number;
  swell_height_m: number;
  visibility_km: number;
  storm_risk: "Low" | "Elevated" | "High";
  operational_impact: string;
  data_status: {
    badge: "LIVE" | "DEMO DATA" | "OFFLINE";
    is_live: boolean;
    is_demo: boolean;
    age_seconds?: number;
  };
}

interface FleetTypeInfo {
  type_key: string;
  name: string;
  count: number;
  avg_speed_knots: number;
  avg_dwell_hours: number;
  anchorage_share_pct: number;
  typical_dimensions: string;
  carries: string;
  why_queues: string;
}

interface FleetTypesResponse {
  total_vessels: number;
  badge: "LIVE" | "DEMO DATA";
  types: {
    container?: FleetTypeInfo;
    tanker?: FleetTypeInfo;
    bulk?: FleetTypeInfo;
    other?: FleetTypeInfo;
    passenger?: FleetTypeInfo;
  };
}

interface LandingStoryUIProps {
  currentScene: number; // 0 to 9
  scrollProgress: number; // 0.0 to 1.0
  simulateStorm: boolean;
  onToggleSimulateStorm: () => void;
  lowPowerMode: boolean;
  onToggleLowPower: () => void;
  onJumpToScene: (index: number) => void;
  selectedVessel?: TrackedVessel | null;
}

export const SCENES_METADATA = [
  { id: 0, tag: "01", label: "Global Network", feature: "Global AIS Ingestion" },
  { id: 1, tag: "02", label: "Live AIS Tracking", feature: "Sea Lane Corridor" },
  { id: 2, tag: "03", label: "Geofencing", feature: "Port Jurisdictions" },
  { id: 3, tag: "04", label: "Congestion Index", feature: "Anchorage Queue" },
  { id: 4, tag: "05", label: "Single Ship Reveal", feature: "Precision Zoom" },
  { id: 5, tag: "06", label: "Cargo Ships", feature: "AIS 70-79 Container" },
  { id: 6, tag: "07", label: "Passenger Ships", feature: "AIS 60-69 Passenger" },
  { id: 7, tag: "08", label: "Tankers", feature: "AIS 80-89 Tanker" },
  { id: 8, tag: "09", label: "Weather Risk", feature: "Meteorological Risk" },
  { id: 9, tag: "10", label: "History & Validation", feature: "Validation & EO" },
];

export function LandingStoryUI({
  currentScene,
  scrollProgress,
  simulateStorm,
  onToggleSimulateStorm,
  lowPowerMode,
  onToggleLowPower,
  onJumpToScene,
  selectedVessel,
}: LandingStoryUIProps) {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [fleetData, setFleetData] = useState<FleetTypesResponse | null>(null);
  const [replayHour, setReplayHour] = useState(24);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Fetch real Open-Meteo weather
  useEffect(() => {
    fetch("/ports/rotterdam/weather")
      .then((res) => {
        if (!res.ok) throw new Error("Fallback weather");
        return res.json();
      })
      .then((data) => setWeather(data))
      .catch(() => {
        setWeather({
          port_id: "rotterdam",
          port_name: "Rotterdam",
          wind_speed_knots: 18.5,
          wind_direction_deg: 245,
          wave_height_m: 2.1,
          swell_height_m: 1.4,
          visibility_km: 14.2,
          storm_risk: "Low",
          operational_impact: "Normal commercial navigation, berthing, and pilot operations active.",
          data_status: {
            badge: "DEMO DATA",
            is_live: false,
            is_demo: true,
          },
        });
      });
  }, []);

  // Fetch fleet types data
  useEffect(() => {
    fetch("/fleet/types")
      .then((res) => {
        if (!res.ok) throw new Error("Fallback fleet");
        return res.json();
      })
      .then((data) => setFleetData(data))
      .catch(() => {
        setFleetData(null); // Will trigger "Collecting vessel types..."
      });
  }, []);

  const handleOpenOverview = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      navigate({ to: "/overview" });
    }, 450);
  };

  const statusBadge = weather?.data_status?.badge || "DEMO DATA";
  const isLive = weather?.data_status?.is_live ?? false;

  // Calculate sub-step (0, 1, 2) inside the current scene
  const sceneLocalProgress = (scrollProgress - currentScene * 0.1) / 0.1;
  const subStep = Math.min(2, Math.max(0, Math.floor(sceneLocalProgress * 3)));

  // Fallback checks for live fleet stats
  const containerStats = fleetData?.types.container;
  const tankerStats = fleetData?.types.tanker;
  const passengerStats = fleetData?.types.passenger ?? fleetData?.types.other;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 transition-all duration-500 ${
        isTransitioning ? "opacity-0 scale-105 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* --- TOP HEADER --- */}
      <header className="pointer-events-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#171513]/90 border border-[#2d2926] backdrop-blur-md shadow-lg shadow-black/40">
            <Compass className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-white tracking-wide text-sm sm:text-base">
                GLOBAL MARITIME
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#211e1b] text-amber-300 border border-[#2d2926]">
                PORT MONITOR
              </span>
            </div>
            <p className="text-[11px] text-[#9a9187] hidden sm:block">
              Photorealistic AIS Fleet & Port Congestion Intelligence
            </p>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Data Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border backdrop-blur-md shadow-sm ${
              isLive
                ? "bg-[#171513] border-emerald-500/40 text-emerald-300"
                : "bg-[#171513] border-amber-500/40 text-amber-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isLive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>{statusBadge}</span>
          </div>

          {/* Low Power Toggle */}
          <button
            onClick={onToggleLowPower}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors backdrop-blur-md ${
              lowPowerMode
                ? "bg-[#211e1b] border-amber-500/50 text-amber-300"
                : "bg-[#171513]/80 border-[#2d2926] text-[#9a9187] hover:text-[#f2ece3]"
            }`}
            title="Toggle Low Power / High Quality"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{lowPowerMode ? "Eco Mode" : "High Quality"}</span>
          </button>

          {/* Skip to Dashboard */}
          <button
            onClick={handleOpenOverview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-all backdrop-blur-md shadow-md"
          >
            <span>Skip to Overview</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* --- MIDDLE INTERACTIVE LAYER (LEFT RAIL & RIGHT FEATURE PANEL) --- */}
      <div className="pointer-events-none flex flex-1 items-center justify-between py-4">
        {/* SLIM LEFT RAIL: 10 Numbered Story Scenes with Scrubbed Progress Bar */}
        <aside className="pointer-events-auto hidden md:flex flex-col gap-2.5 bg-[#171513]/90 border border-[#2d2926] p-3 rounded-2xl backdrop-blur-xl max-w-[210px] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#2d2926] pb-2 mb-1">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#9a9187]">
              Story Navigation
            </span>
            <span className="text-[10px] font-mono text-amber-400">
              {Math.round(scrollProgress * 100)}%
            </span>
          </div>

          {/* Vertical Progress Bar */}
          <div className="relative w-full h-1 bg-[#211e1b] rounded-full overflow-hidden mb-2">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-500 to-[#7fb89a] transition-all duration-150"
              style={{ width: `${scrollProgress * 100}%` }}
            />
          </div>

          {/* 10 Scene Index Steps */}
          <div className="flex flex-col gap-1">
            {SCENES_METADATA.map((scene) => {
              const isActive = currentScene === scene.id;
              const isPast = currentScene > scene.id;

              return (
                <button
                  key={scene.id}
                  onClick={() => onJumpToScene(scene.id)}
                  className={`group flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-xs transition-all ${
                    isActive
                      ? "bg-[#211e1b] border border-amber-500/40 text-white font-medium shadow-sm"
                      : isPast
                      ? "text-[#9a9187] hover:text-[#f2ece3] hover:bg-[#211e1b]/40"
                      : "text-[#9a9187]/60 hover:text-[#9a9187] hover:bg-[#211e1b]/30"
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] w-5 text-center px-1 py-0.5 rounded ${
                      isActive
                        ? "bg-amber-500/20 text-amber-300 font-bold"
                        : "text-[#9a9187] group-hover:text-[#f2ece3]"
                    }`}
                  >
                    {scene.tag}
                  </span>
                  <span className="truncate text-[11px]">{scene.label}</span>
                  {isActive && <ChevronRight className="h-3 w-3 ml-auto text-amber-400" />}
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT FEATURE PANEL: Animated Glass Card Updating Per Scene */}
        <div className="pointer-events-auto ml-auto w-full max-w-sm sm:max-w-md lg:max-w-lg">
          <div className="relative rounded-2xl border border-[#2d2926] bg-[#171513]/90 p-5 shadow-2xl backdrop-blur-xl">
            {/* Scene Header */}
            <div className="flex items-center justify-between border-b border-[#2d2926] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-[#211e1b] border border-[#2d2926]">
                  {SCENES_METADATA[currentScene]?.tag}
                </span>
                <span className="text-xs font-mono uppercase tracking-wider text-[#9a9187]">
                  {SCENES_METADATA[currentScene]?.feature}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#9a9187]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                <span>STEP {subStep + 1} OF 3</span>
              </div>
            </div>

            {/* --- SCENE 01: GLOBAL NETWORK --- */}
            {currentScene === 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                    Global Commercial Fleet Ingestion
                  </h3>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    Planetary AIS telemetric tracking combining coastal VHF base stations and LEO
                    satellites. Ships appear as tiny points of light (amber = cargo, coral = passenger, mint = tanker).
                  </p>
                </div>

                <div className="space-y-2">
                  <div
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      subStep >= 0
                        ? "bg-[#211e1b] border-amber-500/30 text-[#f2ece3]"
                        : "bg-[#171513] border-[#2d2926] text-[#9a9187]"
                    }`}
                  >
                    <div className="font-semibold text-amber-300">01. Sub-Pixel Points of Light</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      Up to 5,000 commercial vessels rendered as delicate luminous dots with additive glow.
                    </p>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      subStep >= 1
                        ? "bg-[#211e1b] border-amber-500/30 text-[#f2ece3]"
                        : "bg-[#171513] border-[#2d2926] text-[#9a9187]"
                    }`}
                  >
                    <div className="font-semibold text-amber-300">02. Major Trade Lanes (Illustrative)</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      Translucent maritime arcs connecting key international hub ports.
                    </p>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      subStep >= 2
                        ? "bg-[#211e1b] border-amber-500/30 text-[#f2ece3]"
                        : "bg-[#171513] border-[#2d2926] text-[#9a9187]"
                    }`}
                  >
                    <div className="font-semibold text-amber-300">03. Continuous Spatial Zoom</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      Scroll to initiate smooth descent from planetary overview down to a single sea lane.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2d2926] text-xs font-mono">
                  <div className="rounded-lg bg-[#211e1b] p-2.5 border border-[#2d2926]">
                    <span className="text-[10px] text-[#9a9187]">Live Tracked Fleet</span>
                    <div className="text-base font-bold text-amber-400">
                      {fleetData?.total_vessels ?? "1,457"} Vessels
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#211e1b] p-2.5 border border-[#2d2926]">
                    <span className="text-[10px] text-[#9a9187]">Primary Trade Hubs</span>
                    <div className="text-base font-bold text-[#7fb89a]">6 Global Hubs</div>
                  </div>
                </div>
              </div>
            )}

            {/* --- SCENE 02: LIVE AIS TRACKING / SEA LANE --- */}
            {currentScene === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                    Transit Corridors & Sea Lanes
                  </h3>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    Camera glides into the European/North Sea corridor. As the zoom deepens, vessel
                    clusters organize along traffic separation schemes (TSS).
                  </p>
                </div>

                <div className="space-y-2">
                  <div
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      subStep >= 0
                        ? "bg-[#211e1b] border-amber-500/30 text-[#f2ece3]"
                        : "bg-[#171513] border-[#2d2926] text-[#9a9187]"
                    }`}
                  >
                    <div className="font-semibold text-amber-300">01. Traffic Separation Schemes</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      Vessels follow regulated directional fairways to avert collisions.
                    </p>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      subStep >= 1
                        ? "bg-[#211e1b] border-amber-500/30 text-[#f2ece3]"
                        : "bg-[#171513] border-[#2d2926] text-[#9a9187]"
                    }`}
                  >
                    <div className="font-semibold text-amber-300">02. Type-Coded Light Points</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      Amber points denote Cargo, Coral points denote Passenger, Mint points denote Tankers.
                    </p>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      subStep >= 2
                        ? "bg-[#211e1b] border-amber-500/30 text-[#f2ece3]"
                        : "bg-[#171513] border-[#2d2926] text-[#9a9187]"
                    }`}
                  >
                    <div className="font-semibold text-amber-300">03. Sub-Second Telemetry</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      Kinematic updates advance vessel vectors smoothly without jerky jumps.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#211e1b] border border-[#2d2926] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <span className="text-[#f2ece3]">Corridor Average Velocity</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400">15.4 kn Avg</span>
                </div>
              </div>
            )}

            {/* --- SCENE 03: GEOFENCING --- */}
            {currentScene === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                    Precision Port Geofencing
                  </h3>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    Camera approaches Rotterdam's Maasvlakte approach. Boundary polygons glowing on
                    water separate operational berths from outer anchorage waiting zones.
                  </p>
                </div>

                <div className="space-y-2">
                  <div
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      subStep >= 0
                        ? "bg-[#211e1b] border-amber-500/30 text-[#f2ece3]"
                        : "bg-[#171513] border-[#2d2926] text-[#9a9187]"
                    }`}
                  >
                    <div className="font-semibold text-amber-300">01. Berth Quays (Cyan Boundaries)</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      Maasvlakte I & II deep-water container terminals and Europoort oil jetties.
                    </p>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      subStep >= 1
                        ? "bg-[#211e1b] border-amber-500/30 text-[#f2ece3]"
                        : "bg-[#171513] border-[#2d2926] text-[#9a9187]"
                    }`}
                  >
                    <div className="font-semibold text-amber-300">02. Anchorage Basins (Amber Boundaries)</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      North Sea anchorages holding inbound vessels awaiting pilot boarding and berth clearance.
                    </p>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      subStep >= 2
                        ? "bg-[#211e1b] border-amber-500/30 text-[#f2ece3]"
                        : "bg-[#171513] border-[#2d2926] text-[#9a9187]"
                    }`}
                  >
                    <div className="font-semibold text-amber-300">03. Automated Raycasting</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      Point-in-polygon classification tracks entry, dwell time, and exit in real time.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                  <span className="text-[#9a9187]">Target Port Geometry:</span>
                  <span className="font-mono text-amber-300">Port of Rotterdam (NLRTM)</span>
                </div>
              </div>
            )}

            {/* --- SCENE 04: CONGESTION INDEX --- */}
            {currentScene === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                    Anchorage Queue & Congestion Index
                  </h3>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    Camera focuses on the anchorage sector. As you scroll, other vessel dots thin out
                    around ONE specific inbound ship target.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#211e1b] border border-amber-500/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#f2ece3] font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Congestion Index
                    </span>
                    <span className="font-mono font-bold text-base text-amber-400">1.42 (Elevated)</span>
                  </div>
                  <div className="relative w-full h-2 bg-[#171513] rounded-full overflow-hidden">
                    <div className="absolute left-0 top-0 h-full w-[71%] bg-gradient-to-r from-[#7fb89a] via-amber-500 to-[#e0533d]" />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-[#9a9187]">
                    <span>0.0 Calm</span>
                    <span className="text-amber-400">1.0 Baseline</span>
                    <span className="text-red-400">2.0 Critical</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                    <span className="text-[10px] text-[#9a9187]">Anchorage Queue</span>
                    <div className="text-base font-bold text-amber-400">28 Waiting</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                    <span className="text-[10px] text-[#9a9187]">Mean Dwell Time</span>
                    <div className="text-base font-bold text-[#f2ece3]">42.8 Hours</div>
                  </div>
                </div>
              </div>
            )}

            {/* --- SCENE 05: SINGLE SHIP REVEAL --- */}
            {currentScene === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                    Cinematic Reveal: Dot Resolves into Real Ship
                  </h3>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    At the final zoom, the single glowing dot resolves into a photorealistic 3D container
                    ship. Rack focus softens the horizon as the wake appears and the Gerstner ocean fades in.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-[#211e1b] border border-amber-500/30 text-xs">
                    <div className="font-semibold text-amber-300">Photoreal GLTF Architecture</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      True PBR materials, multi-tier container stacks, navigation lights, and hydrodynamic wake foam.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#211e1b] border border-amber-500/30 text-xs">
                    <div className="font-semibold text-amber-300">Navigational Course Vectors</div>
                    <p className="text-[11px] text-[#9a9187] mt-0.5">
                      Speed-scaled COG vector, fading historical track trail, and dashed dead-reckoning projected path.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#211e1b] border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>The camera now slowly orbits the hero vessel. Hover/click HUD card for telemetry.</span>
                </div>
              </div>
            )}

            {/* --- SCENE 06: CARGO SHIPS (CONTAINER) --- */}
            {currentScene === 5 && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-amber-400" />
                    <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                      Cargo Ships (AIS Type 70 to 79)
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    Ultra Large Container Vessels (ULCV) and cellular container freighters carrying
                    standardized ISO containers with manufactured goods and refrigerated food.
                  </p>
                </div>

                {containerStats ? (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Active Container Fleet</span>
                      <div className="text-base font-bold text-amber-400">
                        {containerStats.count} Vessels
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Average Transit Speed</span>
                      <div className="text-base font-bold text-[#7fb89a]">
                        {containerStats.avg_speed_knots} kn
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Anchorage Queue Share</span>
                      <div className="text-base font-bold text-amber-400">
                        {containerStats.anchorage_share_pct}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Mean Dwell Time</span>
                      <div className="text-base font-bold text-[#f2ece3]">
                        {containerStats.avg_dwell_hours} hrs
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#211e1b] border border-[#2d2926] text-xs text-amber-300/80">
                    Collecting vessel types...
                  </div>
                )}

                <div className="p-3 rounded-xl bg-[#211e1b] border border-[#2d2926] text-xs space-y-1.5">
                  <span className="font-semibold text-[#f2ece3]">What It Carries & Why It Queues:</span>
                  <p className="text-[11px] text-[#9a9187] leading-relaxed">
                    Carries finished manufactured goods, electronics, and reefer produce. Queues surge
                    when berth ship-to-shore (STS) container cranes operate at capacity, tidal draft limits
                    narrow port access, or inland rail transfers bottleneck.
                  </p>
                </div>
              </div>
            )}

            {/* --- SCENE 07: PASSENGER SHIPS (CRUISE / FERRY) --- */}
            {currentScene === 6 && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#d9694f]" />
                    <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                      Passenger Ships (AIS Type 60 to 69)
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    Ocean liners, luxury cruise vessels, and roll-on/roll-off passenger ferries (RoPax)
                    operating on strict scheduled turnaround timetables.
                  </p>
                </div>

                {passengerStats ? (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Active Passenger Fleet</span>
                      <div className="text-base font-bold text-[#d9694f]">
                        {passengerStats.count} Vessels
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Average Transit Speed</span>
                      <div className="text-base font-bold text-[#7fb89a]">
                        {passengerStats.avg_speed_knots} kn
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Anchorage Queue Share</span>
                      <div className="text-base font-bold text-[#f2ece3]">
                        {passengerStats.anchorage_share_pct}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Mean Dwell Time</span>
                      <div className="text-base font-bold text-[#f2ece3]">
                        {passengerStats.avg_dwell_hours} hrs
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#211e1b] border border-[#2d2926] text-xs text-amber-300/80">
                    Collecting vessel types...
                  </div>
                )}

                <div className="p-3 rounded-xl bg-[#211e1b] border border-[#2d2926] text-xs space-y-1.5">
                  <span className="font-semibold text-[#f2ece3]">What It Carries & Why It Queues:</span>
                  <p className="text-[11px] text-[#9a9187] leading-relaxed">
                    Carries leisure passengers and vehicles. Rarely queues at anchorage because passenger
                    terminals grant priority berthing windows. Delays occur only during dense fog, severe
                    crosswinds, or security passenger clearances.
                  </p>
                </div>
              </div>
            )}

            {/* --- SCENE 08: TANKERS --- */}
            {currentScene === 7 && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Droplet className="h-4 w-4 text-[#7fb89a]" />
                    <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                      Tankers (AIS Type 80 to 89)
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    Very Large Crude Carriers (VLCC) and chemical product tankers riding low in the water
                    with manifold pipe networks, catwalks, and explosion-proof vapor recovery.
                  </p>
                </div>

                {tankerStats ? (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Active Tanker Fleet</span>
                      <div className="text-base font-bold text-[#7fb89a]">
                        {tankerStats.count} Vessels
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Average Transit Speed</span>
                      <div className="text-base font-bold text-amber-400">
                        {tankerStats.avg_speed_knots} kn
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Anchorage Queue Share</span>
                      <div className="text-base font-bold text-amber-400">
                        {tankerStats.anchorage_share_pct}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                      <span className="text-[10px] text-[#9a9187]">Mean Dwell Time</span>
                      <div className="text-base font-bold text-[#f2ece3]">
                        {tankerStats.avg_dwell_hours} hrs
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#211e1b] border border-[#2d2926] text-xs text-amber-300/80">
                    Collecting vessel types...
                  </div>
                )}

                <div className="p-3 rounded-xl bg-[#211e1b] border border-[#2d2926] text-xs space-y-1.5">
                  <span className="font-semibold text-[#f2ece3]">What It Carries & Why It Queues:</span>
                  <p className="text-[11px] text-[#9a9187] leading-relaxed">
                    Carries crude petroleum, refined diesel, jet fuel, and chemicals. Queues at offshore
                    single-point mooring buoys and jetty manifolds awaiting refinery tank ullage, crude oil
                    blending, and gas-free safety inspection certificates.
                  </p>
                </div>
              </div>
            )}

            {/* --- SCENE 09: METEOROLOGICAL WEATHER RISK --- */}
            {currentScene === 8 && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wind className="h-4 w-4 text-amber-400" />
                      <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                        Weather Risk Management
                      </h3>
                    </div>
                    <button
                      onClick={onToggleSimulateStorm}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                        simulateStorm
                          ? "bg-red-950/80 border-red-500/60 text-red-300 font-bold shadow-sm"
                          : "bg-[#211e1b] border-[#2d2926] text-[#9a9187] hover:text-[#f2ece3]"
                      }`}
                    >
                      [SIMULATION] {simulateStorm ? "Storm Active" : "Simulate Storm"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    Photoreal ocean in heavy swell. Animated wind streamlines, wave-height heat contours,
                    and radar storm cell driven by live Open-Meteo Marine & Forecast API data.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                    <span className="text-[10px] text-[#9a9187]">Wind Speed</span>
                    <div className="text-base font-bold text-amber-400">
                      {simulateStorm ? "48.0" : weather?.wind_speed_knots ?? "18.5"} kn
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                    <span className="text-[10px] text-[#9a9187]">Wave Height</span>
                    <div className="text-base font-bold text-[#7fb89a]">
                      {simulateStorm ? "5.8" : weather?.wave_height_m ?? "2.1"} m
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                    <span className="text-[10px] text-[#9a9187]">Swell Height</span>
                    <div className="text-base font-bold text-[#f2ece3]">
                      {simulateStorm ? "4.2" : weather?.swell_height_m ?? "1.4"} m
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#211e1b] border border-[#2d2926]">
                    <span className="text-[10px] text-[#9a9187]">Storm Risk</span>
                    <div
                      className={`text-base font-bold ${
                        simulateStorm || weather?.storm_risk === "High"
                          ? "text-[#e0533d]"
                          : weather?.storm_risk === "Elevated"
                          ? "text-amber-400"
                          : "text-[#7fb89a]"
                      }`}
                    >
                      {simulateStorm ? "High (Storm)" : weather?.storm_risk ?? "Low"}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#211e1b] border border-[#2d2926] text-xs">
                  <span className="font-semibold text-[#f2ece3]">Operational Port Impact:</span>
                  <p className="text-[11px] text-[#9a9187] mt-1">
                    {simulateStorm
                      ? "Suspended pilotage; all inbound deep-draft vessels ordered to ride out swell at sea. Anchorage holding active."
                      : weather?.operational_impact ??
                        "Normal commercial navigation, berthing, and pilot operations active."}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#211e1b] border border-[#2d2926] text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Weather vs Congestion Lead-Lag
                    </span>
                    <span className="text-[10px] font-mono text-[#9a9187]">6h Lead Correl.</span>
                  </div>
                  <p className="text-[11px] text-[#9a9187] leading-relaxed">
                    Swell spikes above 2.5m cause a 40% drop in pilot boardings, leading to a
                    subsequent anchorage queue backlog peak within 8 to 12 hours.
                  </p>
                </div>
              </div>
            )}

            {/* --- SCENE 10: HISTORY & VALIDATION --- */}
            {currentScene === 9 && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-amber-400" />
                    <h3 className="text-lg font-serif font-bold text-white tracking-tight">
                      Historical Playback & Earth Observation
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-[#9a9187] leading-relaxed">
                    Scrub through temporal AIS telemetry archives and validate commercial positions
                    against Copernicus Sentinel-1 Synthetic Aperture Radar (SAR) imagery.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#211e1b] border border-[#2d2926] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#f2ece3] font-semibold">Temporal Archive Playback</span>
                    <span className="font-mono text-amber-400">
                      {replayHour === 0 ? "LIVE" : `-${replayHour} Hours`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="72"
                    step="1"
                    value={replayHour}
                    onChange={(e) => setReplayHour(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#9a9187]">
                    <span>-72h</span>
                    <span>-48h</span>
                    <span>-24h</span>
                    <span className="text-amber-400 font-bold">Now</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#211e1b] border border-[#2d2926] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#f2ece3] flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-amber-400" />
                      EO Imagery Ground-Truth
                    </span>
                    <span className="font-mono text-[11px] text-amber-400">
                      Not validated yet
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9a9187]">
                    Awaiting next Sentinel-1 SAR constellation overpass. When satellite radar captures
                    the anchorage sector, cross-referenced detection polygons display validation metrics.
                  </p>
                </div>

                {/* Open Overview Transition Button */}
                <button
                  onClick={handleOpenOverview}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-[#7fb89a] hover:from-amber-400 hover:to-[#6fa88a] text-[#0e0d0c] shadow-xl shadow-amber-500/10 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span>Open Overview</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- BOTTOM FOOTER --- */}
      <footer className="pointer-events-auto flex items-center justify-between border-t border-[#2d2926] pt-3 text-[11px] text-[#9a9187] font-mono">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">SCENE {currentScene + 1} / 10</span>
          <span>·</span>
          <span>{SCENES_METADATA[currentScene]?.label}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-[#9a9187]/60">
            Scroll to zoom from globe to ship · Click cards for details
          </span>
          <button
            onClick={handleOpenOverview}
            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <span>Overview</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
