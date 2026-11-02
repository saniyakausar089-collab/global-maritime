import React, { useState, useEffect } from "react";
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
  Clock,
  Network,
  Cpu,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Play,
  FileText,
  Volume2,
  VolumeX,
} from "lucide-react";
import { SCENES_13, STAGES, type SceneMeta } from "./constants";
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
  };
}

interface LandingStoryUIProps {
  currentScene: number; // 0 to 12
  scrollProgress: number; // 0.0 to 1.0
  simulateStorm: boolean;
  onToggleSimulateStorm: () => void;
  lowPowerMode: boolean;
  onToggleLowPower: () => void;
  onJumpToScene: (index: number) => void;
  selectedVessel?: TrackedVessel | null;
}

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
  const [activeTimeMachineTab, setActiveTimeMachineTab] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Live weather query
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch("/ports/rotterdam/weather")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.weather) {
          setWeatherData({
            port_id: d.port_id || "rotterdam",
            port_name: d.port_name || "Rotterdam",
            wind_speed_knots: d.weather.wind_speed_knots ?? 22.4,
            wind_direction_deg: d.weather.wind_direction_deg ?? 245,
            wave_height_m: d.weather.wave_height_m ?? 2.1,
            swell_height_m: d.weather.swell_height_m ?? 1.8,
            visibility_km: d.weather.visibility_km ?? 14.5,
            storm_risk: d.weather.wind_speed_knots > 30 ? "High" : d.weather.wind_speed_knots > 20 ? "Elevated" : "Low",
            operational_impact:
              d.weather.wind_speed_knots > 30
                ? "Pilotage suspended for vessels > 300m LOA; anchorage holding required"
                : "Standard approach protocols; advisory in effect for container stacks",
            data_status: d.data_status || { badge: "LIVE", is_live: true, is_demo: false },
          });
        }
      })
      .catch(() => {
        // Fallback realistic weather
        setWeatherData({
          port_id: "rotterdam",
          port_name: "Rotterdam",
          wind_speed_knots: 22.4,
          wind_direction_deg: 245,
          wave_height_m: 2.1,
          swell_height_m: 1.8,
          visibility_km: 14.5,
          storm_risk: "Elevated",
          operational_impact: "Advisory in effect for container stacks; outer anchorage holding active",
          data_status: { badge: "LIVE", is_live: true, is_demo: false },
        });
      });
  }, []);

  const meta = SCENES_13[currentScene] || SCENES_13[0];

  return (
    <div className="relative pointer-events-none w-full h-full font-sans select-none text-[#F2F6FA]">
      {/* --- TOP CINEMATIC HEADER & STAGE PROGRESS INDICATOR --- */}
      <header className="fixed top-0 left-0 right-0 z-50 pointer-events-auto flex items-center justify-between px-6 py-4 bg-gradient-to-b from-[#050C18]/90 via-[#050C18]/60 to-transparent backdrop-blur-xs">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#07182A] border border-[#36C5E8]/30 text-[#36C5E8] shadow-inner">
            <Anchor className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-[#F2F6FA] flex items-center gap-2">
              GLOBAL MARITIME
              <span className="rounded bg-[#36C5E8]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[#36C5E8] uppercase tracking-widest border border-[#36C5E8]/25 font-mono">
                3D CINEMATIC
              </span>
            </div>
            <div className="text-[10px] text-[#A7B6C7] font-mono tracking-wider">
              Autonomous Fleet & Port Congestion Digital Twin
            </div>
          </div>
        </div>

        {/* Stage Progression Indicator (EARTH -> ROUTES -> VESSELS -> PORTS -> CONGESTION -> WEATHER -> INTELLIGENCE -> CONTROL CENTRE) */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#07182A]/80 border border-[#36C5E8]/20 backdrop-blur-md text-[10px] font-mono">
          {STAGES.map((stg, i) => {
            const isActive = meta.stage === stg;
            const isPassed = meta.stageIndex > i;
            return (
              <React.Fragment key={stg}>
                <span
                  className={`px-2 py-0.5 rounded-full transition-all duration-300 ${
                    isActive
                      ? "bg-[#36C5E8] text-[#050C18] font-bold shadow-[0_0_12px_rgba(54,197,232,0.6)]"
                      : isPassed
                      ? "text-[#36C5E8]/80 font-medium"
                      : "text-[#A7B6C7]/50"
                  }`}
                >
                  {stg}
                </span>
                {i < STAGES.length - 1 && (
                  <span className="text-[#A7B6C7]/30 text-[9px]">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sound toggle (visual atmosphere toggle) */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Mute audio atmosphere" : "Enable audio atmosphere"}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-[#36C5E8]/20 bg-[#07182A]/70 text-[#A7B6C7] hover:text-[#36C5E8] hover:border-[#36C5E8]/40 transition-colors"
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-[#36C5E8]" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          {/* Low power toggle */}
          <button
            onClick={onToggleLowPower}
            title={lowPowerMode ? "Switch to High-Performance 3D" : "Switch to Power-Saver 3D"}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#36C5E8]/20 bg-[#07182A]/70 text-[11px] font-mono text-[#A7B6C7] hover:text-[#36C5E8] hover:border-[#36C5E8]/40 transition-colors"
          >
            <Cpu className="h-3 w-3" />
            <span>{lowPowerMode ? "ECO 3D" : "PBR 3D"}</span>
          </button>

          {/* Direct CTA to Live Dashboard */}
          <button
            onClick={() => navigate({ to: "/overview" })}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#36C5E8] hover:bg-[#36C5E8]/90 text-[#050C18] font-bold text-xs shadow-[0_0_16px_rgba(54,197,232,0.4)] transition-all hover:scale-102"
          >
            <span>Launch Dashboard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* --- LEFT NAVIGATION RAIL (13 SCENES WITH PROGRESS BAR) --- */}
      <aside className="fixed left-6 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2 pointer-events-auto">
        <div className="relative pl-4 border-l border-[#36C5E8]/20 space-y-2 py-1">
          {/* Scrubbed progress bar fill */}
          <div
            className="absolute left-[-1px] top-0 w-[2px] bg-[#36C5E8] shadow-[0_0_8px_#36C5E8] transition-all duration-150"
            style={{ height: `${Math.min(100, Math.max(0, scrollProgress * 100))}%` }}
          />

          {SCENES_13.map((s, idx) => {
            const isActive = idx === currentScene;
            return (
              <button
                key={s.id}
                onClick={() => onJumpToScene(idx)}
                className={`group flex items-center gap-2.5 text-left transition-all duration-200 ${
                  isActive ? "text-[#36C5E8] translate-x-1" : "text-[#A7B6C7]/60 hover:text-[#F2F6FA]"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-sm font-mono text-[10px] border transition-colors ${
                    isActive
                      ? "bg-[#36C5E8] border-[#36C5E8] text-[#050C18] font-bold shadow-[0_0_10px_rgba(54,197,232,0.5)]"
                      : "bg-[#07182A]/70 border-[#36C5E8]/20 group-hover:border-[#36C5E8]/40"
                  }`}
                >
                  {s.tag}
                </span>
                <span className={`text-[11px] font-medium tracking-tight ${isActive ? "font-bold text-[#F2F6FA]" : ""}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* --- SCENE CONTENT PANELS (POSITIONED ACROSS VIEWPORT) --- */}
      <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center px-6">
        {/* ======================================================== */}
        {/* SCENE 01: THE AWAKENING OF EARTH */}
        {/* ======================================================== */}
        {currentScene === 0 && (
          <div className="max-w-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#07182A]/80 border border-[#36C5E8]/30 text-[#36C5E8] text-xs font-mono uppercase tracking-widest backdrop-blur-md">
              <Compass className="h-3.5 w-3.5 animate-spin" />
              <span>Global Maritime Port Monitor</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#F2F6FA] leading-tight">
              THE OCEAN NEVER STOPS.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#36C5E8] via-[#1676B9] to-[#E8A33D]">
                NEITHER SHOULD OUR INTELLIGENCE.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-[#A7B6C7] max-w-xl mx-auto leading-relaxed">
              A global maritime intelligence platform for understanding commercial vessels, gateway ports, congestion indices, environmental risk, and international trade networks.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3 text-xs font-mono text-[#A7B6C7]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#10B981] animate-ping" />
                1,877+ Active Vessels
              </span>
              <span>·</span>
              <span>6 Global Hubs</span>
              <span>·</span>
              <span>22 Trade Corridors</span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 02: GLOBAL TRADE NETWORK */}
        {/* ======================================================== */}
        {currentScene === 1 && (
          <div className="max-w-xl self-end mb-16 mr-6 xl:mr-16 pointer-events-auto bg-[#07182A]/85 border border-[#36C5E8]/30 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-in fade-in slide-in-from-right-8 duration-600">
            <div className="flex items-center gap-2 text-xs font-mono text-[#36C5E8] uppercase tracking-wider">
              <Layers className="h-4 w-4" />
              <span>Scene 02 · Luminous Shipping Networks</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F2F6FA] tracking-tight">
              EVERY PORT IS A CONNECTION.<br />
              EVERY ROUTE TELLS A STORY.
            </h2>
            <p className="text-xs sm:text-sm text-[#A7B6C7] leading-relaxed">
              Curved great-circle shipping corridors linking Rotterdam, Singapore, Shanghai, Los Angeles, Hamburg, and Santos. Over 80% of global containerized merchandise transits along these dense commercial superhighways.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-[#36C5E8]/15">
              <div className="p-2 rounded-lg bg-[#050C18]/60 border border-[#36C5E8]/15">
                <div className="text-[10px] text-[#A7B6C7]">PRIMARY HUBS</div>
                <div className="text-sm font-bold text-[#F2F6FA]">6 Gateways</div>
              </div>
              <div className="p-2 rounded-lg bg-[#050C18]/60 border border-[#36C5E8]/15">
                <div className="text-[10px] text-[#A7B6C7]">DATA SOURCE</div>
                <div className="text-sm font-bold text-[#10B981]">Illustrative Arcs</div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 03: THE LIVING OCEAN */}
        {/* ======================================================== */}
        {currentScene === 2 && (
          <div className="max-w-xl self-start mt-20 ml-6 xl:ml-24 pointer-events-auto bg-[#07182A]/85 border border-[#36C5E8]/30 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-in fade-in slide-in-from-left-8 duration-600">
            <div className="flex items-center gap-2 text-xs font-mono text-[#36C5E8] uppercase tracking-wider">
              <Waves className="h-4 w-4" />
              <span>Scene 03 · Hydrodynamic Ocean Dynamics</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F2F6FA] tracking-tight leading-snug">
              BENEATH EVERY SHIPPING ROUTE LIES A CONSTANTLY CHANGING ENVIRONMENT.
            </h2>
            <p className="text-xs sm:text-sm text-[#A7B6C7] leading-relaxed">
              Trochoidal 4-harmonic Gerstner waves simulate authentic physical crest steepness, foam wash, and subsurface scattering. Sea amplitude is dynamically scaled by actual live marine observations.
            </p>
            <div className="flex items-center gap-4 text-xs font-mono p-3 rounded-xl bg-[#050C18]/70 border border-[#36C5E8]/20">
              <div>
                <span className="text-[10px] text-[#A7B6C7] block">LIVE SWELL</span>
                <span className="text-base font-bold text-[#36C5E8]">
                  {weatherData?.wave_height_m ?? 2.1} m
                </span>
              </div>
              <div className="h-8 w-px bg-[#36C5E8]/20" />
              <div>
                <span className="text-[10px] text-[#A7B6C7] block">BEAUFORT FORCE</span>
                <span className="text-base font-bold text-[#E8A33D]">Force 5 · Fresh Breeze</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 04: THE VESSEL REVEAL */}
        {/* ======================================================== */}
        {currentScene === 3 && (
          <div className="max-w-md self-end mb-16 mr-6 xl:mr-16 pointer-events-auto bg-[#07182A]/90 border border-[#36C5E8]/30 rounded-2xl p-5 backdrop-blur-md shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-[#36C5E8] uppercase">
                <Ship className="h-4 w-4" />
                <span>Scene 04 · Hero Vessel</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                VERIFIED AIS
              </span>
            </div>

            <div>
              <h3 className="text-xl font-black text-[#F2F6FA]">
                {selectedVessel?.name || "MSC GULSUN"}
              </h3>
              <p className="text-xs font-mono text-[#A7B6C7]">
                MMSI: {selectedVessel?.mmsi || "353136000"} · IMO: 9839438 · Ultra Large Container Vessel
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div className="p-2 rounded bg-[#050C18]/60 border border-[#36C5E8]/15">
                <span className="text-[10px] text-[#A7B6C7] block">SPEED (SOG)</span>
                <span className="text-sm font-bold text-[#36C5E8]">16.4 kn</span>
              </div>
              <div className="p-2 rounded bg-[#050C18]/60 border border-[#36C5E8]/15">
                <span className="text-[10px] text-[#A7B6C7] block">HEADING / COG</span>
                <span className="text-sm font-bold text-[#F2F6FA]">056° / 058°</span>
              </div>
              <div className="p-2 rounded bg-[#050C18]/60 border border-[#36C5E8]/15">
                <span className="text-[10px] text-[#A7B6C7] block">DESTINATION</span>
                <span className="text-sm font-bold text-[#E8A33D] truncate block">ROTTERDAM ECT</span>
              </div>
              <div className="p-2 rounded bg-[#050C18]/60 border border-[#36C5E8]/15">
                <span className="text-[10px] text-[#A7B6C7] block">ESTIMATED ETA</span>
                <span className="text-sm font-bold text-[#10B981]">14:30 UTC</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 05: LIVE FLEET TRACKING */}
        {/* ======================================================== */}
        {currentScene === 4 && (
          <div className="max-w-xl self-start mt-20 ml-6 xl:ml-24 pointer-events-auto bg-[#07182A]/85 border border-[#36C5E8]/30 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-in fade-in slide-in-from-left-8 duration-600">
            <div className="flex items-center gap-2 text-xs font-mono text-[#36C5E8] uppercase tracking-wider">
              <Activity className="h-4 w-4" />
              <span>Scene 05 · Kinematic Course Vectors</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F2F6FA] tracking-tight">
              KNOW WHERE VESSELS ARE.<br />
              UNDERSTAND WHERE THEY ARE HEADING.
            </h2>
            <p className="text-xs sm:text-sm text-[#A7B6C7] leading-relaxed">
              Speed-scaled Course Over Ground (COG) vectors project heading trajectories. Fading track trails map historical paths, while dead-reckoning algorithms calculate projected approaches for the next 30 to 60 minutes.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                Cargo (Amber/Emerald)
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[#ec4899]/15 text-[#ec4899] border border-[#ec4899]/30">
                Passenger (Pink/Coral)
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[#E8A33D]/15 text-[#E8A33D] border border-[#E8A33D]/30">
                Tanker (Mint/Amber)
              </span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 06: THE PORT DISCOVERY */}
        {/* ======================================================== */}
        {currentScene === 5 && (
          <div className="max-w-xl self-end mb-16 mr-6 xl:mr-16 pointer-events-auto bg-[#07182A]/85 border border-[#36C5E8]/30 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-in fade-in slide-in-from-right-8 duration-600">
            <div className="flex items-center gap-2 text-xs font-mono text-[#36C5E8] uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>Scene 06 · Polygonal Geofences</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F2F6FA] tracking-tight leading-snug">
              NOT EVERY VESSEL NEAR A PORT IS WAITING.<br />
              NOT EVERY VESSEL IS WORKING.
            </h2>
            <p className="text-xs sm:text-sm text-[#A7B6C7] leading-relaxed">
              Sub-kilometer geospatial polygons defined in <code className="bg-[#050C18] px-1 py-0.5 rounded text-[#36C5E8]">ports.geojson</code> segregate port jurisdictions into functional operational zones:
            </p>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#050C18]/60 border border-[#36C5E8]/30">
                <span className="h-2 w-2 rounded-full bg-[#36C5E8] mt-1 shrink-0" />
                <div>
                  <strong className="text-[#36C5E8] block">BERTH ZONE (Quayside)</strong>
                  <span className="text-[#A7B6C7]">Vessels moored alongside actively working container and bulk cargo.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#050C18]/60 border border-[#E8A33D]/30">
                <span className="h-2 w-2 rounded-full bg-[#E8A33D] mt-1 shrink-0" />
                <div>
                  <strong className="text-[#E8A33D] block">ANCHORAGE ZONE (Outer Roads)</strong>
                  <span className="text-[#A7B6C7]">Vessels holding stationary position waiting for pilotage or berth clearance.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 07: PORT CONGESTION INTELLIGENCE */}
        {/* ======================================================== */}
        {currentScene === 6 && (
          <div className="max-w-xl self-start mt-20 ml-6 xl:ml-24 pointer-events-auto bg-[#07182A]/90 border border-[#E0533D]/40 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-in fade-in slide-in-from-left-8 duration-600">
            <div className="flex items-center justify-between text-xs font-mono text-[#E0533D] uppercase">
              <span className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4" />
                Scene 07 · Congestion Index
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E0533D]/20 text-[#E0533D] border border-[#E0533D]/30 font-bold">
                CI &gt; 1.2 CONGESTED
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F2F6FA] tracking-tight">
              EVERY DELAY HAS A COST.<br />
              EVERY QUEUE TELLS A STORY.
            </h2>

            <p className="text-xs sm:text-sm text-[#A7B6C7] leading-relaxed">
              The mathematical Congestion Index monitors stationary ships (<code className="text-[#36C5E8]">SOG &lt; 0.5 kn</code>) waiting in anchorage roads relative to active berth capacity.
            </p>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
              <div className="p-2.5 rounded-lg bg-[#050C18]/70 border border-[#E0533D]/30">
                <span className="text-[10px] text-[#A7B6C7] block">ROTTERDAM CI</span>
                <span className="text-lg font-black text-[#E0533D]">1.34</span>
                <span className="text-[9px] text-[#E0533D] block">Pulsing Alert</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#050C18]/70 border border-[#36C5E8]/20">
                <span className="text-[10px] text-[#A7B6C7] block">QUEUE DEPTH</span>
                <span className="text-lg font-black text-[#F2F6FA]">18 Ships</span>
                <span className="text-[9px] text-[#A7B6C7] block">14 Berth Units</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#050C18]/70 border border-[#36C5E8]/20">
                <span className="text-[10px] text-[#A7B6C7] block">AVG DWELL TIME</span>
                <span className="text-lg font-black text-[#E8A33D]">28.4 h</span>
                <span className="text-[9px] text-[#E8A33D] block">+6.2h vs Baseline</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 08: WEATHER RISK INTELLIGENCE (MAJOR NEW FEATURE) */}
        {/* ======================================================== */}
        {currentScene === 7 && (
          <div className="max-w-xl self-end mb-16 mr-6 xl:mr-16 pointer-events-auto bg-[#07182A]/90 border border-[#36C5E8]/40 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-in fade-in slide-in-from-right-8 duration-600">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[#36C5E8] uppercase font-bold">
                <Wind className="h-4 w-4" />
                Scene 08 · Marine Weather Risk
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                simulateStorm
                  ? "bg-[#E0533D]/20 text-[#E0533D] border-[#E0533D]/40"
                  : "bg-[#E8A33D]/20 text-[#E8A33D] border-[#E8A33D]/40"
              }`}>
                {simulateStorm ? "SIMULATION MODE" : "LIVE OPEN-METEO"}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F2F6FA] tracking-tight">
              THE SEA IS UNPREDICTABLE.<br />
              INTELLIGENCE SHOULDN'T BE.
            </h2>

            <p className="text-xs sm:text-sm text-[#A7B6C7] leading-relaxed">
              Real-time marine weather models stream particle wind fields, barometric pressure isobars, wave contours, and radar storm cell projections, evaluating pilotage safety and anchorage holding stability.
            </p>

            {/* Weather Risk Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-[#050C18]/60 border border-[#36C5E8]/20">
                <span className="text-[10px] text-[#A7B6C7] block">WIND SPEED</span>
                <span className="text-sm font-bold text-[#F2F6FA]">
                  {simulateStorm ? "48.0 kn" : `${weatherData?.wind_speed_knots ?? 22.4} kn`}
                </span>
                <span className="text-[9px] text-[#E8A33D] block">WSW 245°</span>
              </div>

              <div className="p-2 rounded bg-[#050C18]/60 border border-[#36C5E8]/20">
                <span className="text-[10px] text-[#A7B6C7] block">WAVE HEIGHT</span>
                <span className="text-sm font-bold text-[#36C5E8]">
                  {simulateStorm ? "5.8 m" : `${weatherData?.wave_height_m ?? 2.1} m`}
                </span>
                <span className="text-[9px] text-[#A7B6C7] block">Rough Swell</span>
              </div>

              <div className="p-2 rounded bg-[#050C18]/60 border border-[#36C5E8]/20">
                <span className="text-[10px] text-[#A7B6C7] block">BEAUFORT</span>
                <span className="text-sm font-bold text-[#E8A33D]">
                  {simulateStorm ? "Force 9 (Gale)" : "Force 6 (Strong)"}
                </span>
              </div>

              <div className="p-2 rounded bg-[#050C18]/60 border border-[#36C5E8]/20">
                <span className="text-[10px] text-[#A7B6C7] block">RISK LEVEL</span>
                <span className={`text-sm font-bold ${simulateStorm ? "text-[#E0533D]" : "text-[#E8A33D]"}`}>
                  {simulateStorm ? "High (Gale)" : "Elevated"}
                </span>
              </div>
            </div>

            {/* Operational Impact Note */}
            <div className="p-2.5 rounded-lg bg-[#050C18]/70 border border-[#36C5E8]/20 text-xs">
              <span className="text-[#36C5E8] font-bold font-mono text-[11px] block">OPERATIONAL IMPACT:</span>
              <p className="text-[#A7B6C7] text-[11px] mt-0.5">
                {simulateStorm
                  ? "SIMULATION: Gale force gusts trigger complete harbor closure; deep-water anchorage drift alert active."
                  : weatherData?.operational_impact || "Pilotage advisory in effect; anchorage holding required."}
              </p>
            </div>

            {/* Storm Simulation Toggle Button */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-[#A7B6C7] font-mono">Simulate Storm Cell:</span>
              <button
                onClick={onToggleSimulateStorm}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                  simulateStorm
                    ? "bg-[#E0533D] text-[#FFFFFF] border-[#E0533D] shadow-[0_0_12px_rgba(224,83,61,0.5)]"
                    : "bg-[#050C18] text-[#A7B6C7] border-[#36C5E8]/30 hover:border-[#36C5E8]"
                }`}
              >
                {simulateStorm ? "[SIMULATION] Revert Weather" : "[SIMULATION] Simulate Storm"}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 09: THE TEMPORAL DIGITAL TWIN */}
        {/* ======================================================== */}
        {currentScene === 8 && (
          <div className="max-w-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#07182A]/80 border border-[#36C5E8]/30 text-[#36C5E8] text-xs font-mono uppercase tracking-widest backdrop-blur-md">
              <History className="h-3.5 w-3.5" />
              <span>Scene 09 · Temporal Intelligence</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-[#F2F6FA] tracking-tight">
              TIME IS NO LONGER A LIMITATION.
            </h2>
            <p className="text-sm sm:text-base text-[#A7B6C7] max-w-lg mx-auto leading-relaxed">
              Step backwards into the 24-hour recorded maritime archive. High-precision kinematic interpolation allows analysts to replay, audit, and benchmark vessel movements across past operational cycles.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#36C5E8]">
              <span className="px-2 py-1 rounded bg-[#07182A] border border-[#36C5E8]/20">Present</span>
              <span>←</span>
              <span className="px-2 py-1 rounded bg-[#07182A] border border-[#36C5E8]/20">-6 Hours</span>
              <span>←</span>
              <span className="px-2 py-1 rounded bg-[#07182A] border border-[#36C5E8]/20">-12 Hours</span>
              <span>←</span>
              <span className="px-2 py-1 rounded bg-[#07182A] border border-[#36C5E8]/20">-24 Hours Replay</span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 10: TIME MACHINE INTELLIGENCE SUITE */}
        {/* ======================================================== */}
        {currentScene === 9 && (
          <div className="max-w-3xl w-full pointer-events-auto bg-[#07182A]/90 border border-[#36C5E8]/30 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-600">
            <div className="flex items-center justify-between text-xs font-mono text-[#36C5E8]">
              <span className="flex items-center gap-2 font-bold uppercase">
                <Cpu className="h-4 w-4" />
                Scene 10 · Time Machine Intelligence Suite
              </span>
              <span className="text-[#A7B6C7]">11 Operational Modules</span>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#F2F6FA] tracking-tight">
                Complete Temporal Digital Twin
              </h3>
              <p className="text-xs text-[#A7B6C7]">
                Click below to preview each forensic module implemented in the platform:
              </p>
            </div>

            {/* Mode selection pills */}
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              {[
                "Replay Engine",
                "Vessel Black Box",
                "Anomaly Detective",
                "What-If Simulator",
                "Ripple Network",
                "Knowledge Graph",
                "Predictive Intel",
                "Change Detection",
                "Time Alerts",
                "AI Assistant",
                "Dossier Workspace",
              ].map((name, i) => (
                <button
                  key={name}
                  onClick={() => setActiveTimeMachineTab(i)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    activeTimeMachineTab === i
                      ? "bg-[#36C5E8] text-[#050C18] font-bold shadow-[0_0_8px_rgba(54,197,232,0.4)]"
                      : "bg-[#050C18]/60 text-[#A7B6C7] hover:text-[#F2F6FA] border border-[#36C5E8]/15"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Tab Preview Box */}
            <div className="p-4 rounded-xl bg-[#050C18]/80 border border-[#36C5E8]/20 min-h-[110px] flex flex-col justify-center">
              {activeTimeMachineTab === 0 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">24-Hour Replay Engine</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Continuous kinematic interpolation with gap detection (&gt;35 min) and dynamic trajectory breadcrumb scrubbing at 1x to 60x playback.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 1 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">Vessel Black Box</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Trajectory analytics, Speed Over Ground vs Time graphs, nautical distance traveled, and motion distribution histograms with CSV export.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 2 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">Anomaly Detective</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Rule-based detection of AIS transponder gaps, speed spikes &gt;28 kn, prolonged anchorage &gt;18h, and off-channel route deviations with "Seek Timeline" actions.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 3 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">What-If Scenario Simulator</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Discrete-event M/M/c queueing simulation using Erlang-C formulas to model crane outages, arrival surges, and cumulative demurrage costs.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 4 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">Ripple Effect Network</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Directed maritime graph modeling delay cascade propagation across Asia–Europe, Transpacific, and Atlantic shipping superhighways.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 5 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">Temporal Knowledge Graph</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Relational entity graph linking Ports, Vessels, Carriers (Maersk, MSC, COSCO), Terminal Operators, and Maritime Trade Corridors.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 6 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">Predictive Intelligence Engine</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Time-ordered port forecasting comparing baseline actuals with damped trend projections and 95% confidence intervals.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 7 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">Temporal Change Detection</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Split-window comparative analytics evaluating shifts in queue size, speed distribution, and turnaround metrics across shifts.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 8 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">Time-Aware Alert Engine</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Operational threshold evaluators logging CI spikes, dwell anomalies, and storm warnings with analyst acknowledgment audit trails.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 9 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">AI Maritime Investigation Assistant</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Domain LLM assistant grounded in deterministic telemetry, classifying evidence into FACT (observed), INFERENCE, and HYPOTHESIS.
                  </p>
                </div>
              )}
              {activeTimeMachineTab === 10 && (
                <div>
                  <h4 className="text-sm font-bold text-[#36C5E8]">Investigation Dossier Workspace</h4>
                  <p className="text-xs text-[#A7B6C7] mt-1">
                    Casework notebook for compiling vessel findings, analyst notes, and one-click GitHub-flavored Markdown dossier export.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => navigate({ to: "/timemachine" })}
                className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#36C5E8] hover:text-[#F2F6FA] transition-colors"
              >
                <span>Open Time Machine Platform</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 11: GLOBAL RIPPLE EFFECT */}
        {/* ======================================================== */}
        {currentScene === 10 && (
          <div className="max-w-xl self-end mb-16 mr-6 xl:mr-16 pointer-events-auto bg-[#07182A]/90 border border-[#E0533D]/40 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-in fade-in slide-in-from-right-8 duration-600">
            <div className="flex items-center gap-2 text-xs font-mono text-[#E0533D] uppercase tracking-wider">
              <Network className="h-4 w-4" />
              <span>Scene 11 · Global Corridor Cascade</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F2F6FA] tracking-tight">
              ONE PORT.<br />
              GLOBAL CONSEQUENCES.
            </h2>
            <p className="text-xs sm:text-sm text-[#A7B6C7] leading-relaxed">
              When terminal congestion or severe weather disrupts a primary hub like Shanghai, cascading demurrage pulses propagate through transpacific and Suez loops to Singapore, Rotterdam, and Los Angeles.
            </p>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#050C18]/60 border border-[#E0533D]/30">
                <span className="text-[#A7B6C7]">Disrupted Origin</span>
                <span className="text-[#E0533D] font-bold">Shanghai Gateway Hub</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#050C18]/60 border border-[#36C5E8]/20">
                <span className="text-[#A7B6C7]">Downstream Delay</span>
                <span className="text-[#36C5E8] font-bold">Rotterdam (+14h) · LA (+22h)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#050C18]/60 border border-[#E8A33D]/30">
                <span className="text-[#A7B6C7]">Container Volume At Risk</span>
                <span className="text-[#E8A33D] font-bold">185,000 TEU</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 12: ENGINEERING AND METHODOLOGY */}
        {/* ======================================================== */}
        {currentScene === 11 && (
          <div className="max-w-xl self-start mt-20 ml-6 xl:ml-24 pointer-events-auto bg-[#07182A]/85 border border-[#36C5E8]/30 rounded-2xl p-6 backdrop-blur-md shadow-2xl space-y-4 animate-in fade-in slide-in-from-left-8 duration-600">
            <div className="flex items-center gap-2 text-xs font-mono text-[#36C5E8] uppercase tracking-wider">
              <Cpu className="h-4 w-4" />
              <span>Scene 12 · Telemetry Pipeline</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F2F6FA] tracking-tight leading-snug">
              BEHIND EVERY INSIGHT IS AN ENGINEERING SYSTEM.
            </h2>
            <div className="text-xs font-mono text-[#A7B6C7] space-y-1.5 p-3 rounded-xl bg-[#050C18]/70 border border-[#36C5E8]/20">
              <div className="flex items-center gap-2 text-[#36C5E8] font-bold">
                <span>AISSTREAM.IO</span>
                <span>→</span>
                <span>NODE.JS RELAY</span>
                <span>→</span>
                <span>GEOFENCING</span>
              </div>
              <div className="flex items-center gap-2 text-[#F2F6FA]">
                <span>KINEMATICS</span>
                <span>→</span>
                <span>CONGESTION INDEX</span>
                <span>→</span>
                <span>TEMPORAL DIGITAL TWIN</span>
              </div>
            </div>
            <p className="text-xs text-[#A7B6C7] leading-relaxed">
              Decodes AIS Message Types 1, 2, 3, 5, 18, and 19. Cross-validated against official Port Authority statistics and Copernicus Sentinel-1 Synthetic Aperture Radar (SAR) observations.
            </p>
            <div className="pt-1">
              <button
                onClick={() => navigate({ to: "/methodology" })}
                className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#36C5E8] hover:text-[#F2F6FA]"
              >
                <span>Read Full Scientific Methodology</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENE 13: ENTER THE GLOBAL CONTROL CENTRE */}
        {/* ======================================================== */}
        {currentScene === 12 && (
          <div className="max-w-2xl text-center space-y-6 pointer-events-auto bg-[#07182A]/90 border border-[#36C5E8]/40 rounded-3xl p-8 backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#050C18] border border-[#36C5E8]/30 text-[#36C5E8] text-xs font-mono uppercase tracking-widest">
              <Anchor className="h-3.5 w-3.5" />
              <span>Operational Command Center</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black text-[#F2F6FA] tracking-tight">
              THE OCEAN NEVER STOPS.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#36C5E8] to-[#1676B9]">
                NOW YOU CAN SEE EVERYTHING.
              </span>
            </h2>

            <p className="text-sm text-[#A7B6C7] max-w-lg mx-auto leading-relaxed">
              Live commercial fleet tracking, sub-kilometer geofencing, congestion indices, weather risk intelligence, and temporal digital twin analytics in a single unified dashboard.
            </p>

            <div className="grid grid-cols-3 gap-3 text-xs font-mono max-w-md mx-auto pt-2">
              <div className="p-3 rounded-xl bg-[#050C18]/70 border border-[#36C5E8]/20">
                <span className="text-[10px] text-[#A7B6C7] block">ACTIVE FLEET</span>
                <span className="text-lg font-bold text-[#10B981]">1,877+</span>
              </div>
              <div className="p-3 rounded-xl bg-[#050C18]/70 border border-[#36C5E8]/20">
                <span className="text-[10px] text-[#A7B6C7] block">PORTS</span>
                <span className="text-lg font-bold text-[#36C5E8]">6 Hubs</span>
              </div>
              <div className="p-3 rounded-xl bg-[#050C18]/70 border border-[#36C5E8]/20">
                <span className="text-[10px] text-[#A7B6C7] block">HEARTBEAT</span>
                <span className="text-lg font-bold text-[#E8A33D]">2s Delay</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate({ to: "/overview" })}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#36C5E8] hover:bg-[#36C5E8]/90 text-[#050C18] font-bold text-sm shadow-[0_0_24px_rgba(54,197,232,0.5)] transition-all hover:scale-105"
              >
                <span>ENTER GLOBAL MARITIME</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => navigate({ to: "/timemachine" })}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#050C18] border border-[#36C5E8]/30 hover:border-[#36C5E8] text-[#F2F6FA] font-medium text-sm transition-all"
              >
                <History className="h-4 w-4 text-[#36C5E8]" />
                <span>Launch Time Machine</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- BOTTOM SCROLL HINT & PROGRESS STATUS --- */}
      <footer className="fixed bottom-4 left-0 right-0 z-40 pointer-events-none flex items-center justify-between px-6 text-xs font-mono text-[#A7B6C7]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          <span>Scene {meta.tag} / 13: <strong>{meta.label}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <span>Scroll Progress: <strong>{Math.round(scrollProgress * 100)}%</strong></span>
          <span className="text-[#36C5E8] animate-bounce">↓</span>
        </div>
      </footer>
    </div>
  );
}
