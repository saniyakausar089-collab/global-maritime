import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Globe,
  Navigation2,
  Anchor,
  Activity,
  CloudLightning,
  Radio,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Compass,
} from "lucide-react";
import { SCENES_8 } from "./constants";
import type { TrackedVessel } from "./ShipCourseVectors";

interface LandingStoryUIProps {
  currentScene: number;
  scrollProgress: number;
  simulateStorm: boolean;
  onToggleSimulateStorm: () => void;
  lowPowerMode: boolean;
  onToggleLowPower: () => void;
  onJumpToScene: (index: number) => void;
  selectedVessel: TrackedVessel | null;
}

export function LandingStoryUI({
  currentScene,
  scrollProgress,
  simulateStorm,
  onToggleSimulateStorm,
  onJumpToScene,
}: LandingStoryUIProps) {
  const activeSceneConfig = SCENES_8[currentScene] ?? SCENES_8[0];

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none font-sans">
      {/* ========================================================================= */}
      {/* TOP HEADER: BRAND IDENTITY & GLOBAL HUD STATUS (NEGATIVE SPACE TOP-LEFT/RIGHT) */}
      {/* ========================================================================= */}
      <header className="flex items-start justify-between">
        {/* Top-Left: Futuristic Brand & Telemetry Badge */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#080F20]/80 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 backdrop-blur-md">
              <Anchor className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-foreground">
                  GLOBAL MARITIME
                </span>
                <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[9px] font-semibold text-cyan-400 uppercase tracking-widest border border-cyan-500/30">
                  PORT MONITOR
                </span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                Planetary Commercial Fleet &amp; Port Intelligence Digital Twin
              </p>
            </div>
          </div>
        </div>

        {/* Top-Right: Quick Controls & Scene Stage Indicator */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pointer-events-auto">
          {/* Active Stage Indicator */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-cyan-500/25 bg-[#080F20]/80 px-3.5 py-1.5 backdrop-blur-md shadow-md text-xs font-mono">
            <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-foreground">
              {activeSceneConfig?.title}
            </span>
            <span className="text-muted-foreground/50">|</span>
            <span className="text-[10px] text-cyan-400 font-bold">
              SCENE {String(currentScene + 1).padStart(2, "0")}/08
            </span>
          </div>

          {/* Storm Simulation Toggle (Scene 08 / Weather) */}
          <button
            onClick={onToggleSimulateStorm}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono font-medium transition-all backdrop-blur-md ${
              simulateStorm
                ? "border-[#FF5577] bg-[#FF5577]/20 text-[#FF5577] shadow-lg shadow-[#FF5577]/20"
                : "border-[#FFB547]/30 bg-[#080F20]/70 text-[#FFB547] hover:bg-[#FFB547]/15"
            }`}
            title="Toggle Tropical Cyclone storm overlay simulation"
          >
            <CloudLightning className="h-3.5 w-3.5" />
            <span>{simulateStorm ? "STORM [ACTIVE]" : "SIMULATE STORM"}</span>
          </button>

          {/* Direct Launch to Dashboard Button */}
          <Link
            to="/overview"
            className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/20 px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-cyan-500/30 transition-all backdrop-blur-md shadow-md"
          >
            <span>LIVE DASHBOARD</span>
            <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
          </Link>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MIDDLE ZONE: FLOATING HOLOGRAPHIC TYPOGRAPHY & SCENE TELEMETRY */}
      {/* Left-aligned in negative space with dark transparent gradients (never obscures subjects) */}
      {/* ========================================================================= */}
      <div className="my-auto flex flex-col justify-center max-w-xl pointer-events-auto">
        {currentScene === 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
              <Sparkles className="h-3 w-3" />
              <span>SCENE 01 · PLANETARY SURVEILLANCE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              The Awakening of <span className="text-cyan-400">Earth</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-lg">
              Live orbital monitoring of commercial maritime traffic across the world's oceans.
              Powered by real-time AIS telemetry, NASA Black Marble specular oceans, and neural geospatial tracking.
            </p>
            <div className="flex items-center gap-4 pt-2 text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                STREAM LIVE
              </span>
              <span>·</span>
              <span>6 MONITORED MEGA-HUBS</span>
              <span>·</span>
              <span>5,000+ INSTANCED SHIPS</span>
            </div>
          </div>
        )}

        {currentScene === 1 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-blue-400 backdrop-blur-md">
              <Globe className="h-3 w-3 text-cyan-400" />
              <span>SCENE 02 · GLOBAL TRADE NETWORK</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Arteries of <span className="text-blue-400">Global Commerce</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Luminous great-circle corridors linking Rotterdam, Singapore, Shanghai, Los Angeles, Hamburg, and Santos.
              Over 80% of global trade volume moves along these transoceanic shipping lanes.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {["Rotterdam", "Singapore", "Shanghai", "Los Angeles", "Hamburg", "Santos"].map((port) => (
                <span
                  key={port}
                  className="px-2.5 py-1 rounded-md border border-cyan-500/20 bg-[#080F20]/60 text-[11px] font-mono text-cyan-400 backdrop-blur-sm"
                >
                  {port}
                </span>
              ))}
            </div>
          </div>
        )}

        {currentScene === 2 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
              <Activity className="h-3 w-3" />
              <span>SCENE 03 · THE LIVING OCEAN</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Descent to <span className="text-cyan-400">Sea Level</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Transoceanic swells and ocean bathymetry across the Atlantic and Pacific highways.
              Vessels calibrate passage plans along great-circle arcs to optimize fuel consumption and minimize weather delay.
            </p>
            <div className="flex items-center gap-3 pt-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg border border-cyan-500/30 bg-[#080F20]/70 text-cyan-400">
                BATHYMETRY: 3,420m
              </span>
              <span className="px-2.5 py-1 rounded-lg border border-border/80 bg-[#080F20]/70 text-muted-foreground">
                SWELL HEIGHT: 1.8m
              </span>
            </div>
          </div>
        )}

        {currentScene === 3 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-amber-400 backdrop-blur-md">
              <Navigation2 className="h-3 w-3" />
              <span>SCENE 04 · HIGH-DENSITY SHIPPING LANES</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Commercial <span className="text-amber-400">Shipping Fairways</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Aerial perspective of high-density maritime transit corridors in the Strait of Malacca and English Channel.
              Dozens of commercial container carriers and bulk fleets moving in coordinated Traffic Separation Schemes.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-md border border-cyan-500/30 bg-[#080F20]/70 text-cyan-400">
                SEPARATION SCHEME: ACTIVE
              </span>
              <span className="px-2.5 py-1 rounded-md border border-amber-500/30 bg-[#080F20]/70 text-amber-400">
                LANE CAPACITY: 142 SHIPS/DAY
              </span>
            </div>
          </div>
        )}

        {currentScene === 4 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
              <Anchor className="h-3 w-3" />
              <span>SCENE 05 · COMMERCIAL CONTAINER FLEET</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Giant <span className="text-cyan-400">Triple-E Carriers</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Ultra Large Container Vessels (ULCV) loaded with over 18,000+ TEU cutting through open water at 19 knots.
              High-resolution commercial photography captures the scale and hydrodynamic bow displacement of the modern merchant fleet.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-md border border-cyan-500/30 bg-[#080F20]/70 text-cyan-400">
                18,270 TEU CAPACITY
              </span>
              <span className="px-2.5 py-1 rounded-md border border-emerald-500/30 bg-[#080F20]/70 text-emerald-400">
                19.2 KN CRUISING SPEED
              </span>
            </div>
          </div>
        )}

        {currentScene === 5 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
              <Radio className="h-3 w-3 text-emerald-400" />
              <span>SCENE 06 · LIVE AIS KINEMATICS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Kinematic <span className="text-cyan-400">Course Vectors</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Real-time transponder data: True heading vectors, Speed Over Ground (SOG), Course Over Ground (COG),
              and predictive Closest Point of Approach (CPA) corridors ensuring collision-free navigation.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-md border border-emerald-500/30 bg-[#080F20]/70 text-emerald-400">
                ● VERIFIED AIS CLASS-A
              </span>
              <span className="px-2.5 py-1 rounded-md border border-cyan-500/30 bg-[#080F20]/70 text-cyan-400">
                COG 074° · SOG 18.2 KN
              </span>
            </div>
          </div>
        )}

        {currentScene === 6 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
              <Anchor className="h-3 w-3" />
              <span>SCENE 07 · MEGA TERMINAL QUAYSIDE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Illuminated <span className="text-cyan-400">Container Hubs</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Burchardkai and Rotterdam Maasvlakte II deepwater quays. Towering Ship-to-Shore (STS) gantry cranes
              illuminated at night, executing automated container stack transfers with 24/7 turnaround efficiency.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-md border border-cyan-500/30 bg-[#080F20]/70 text-cyan-400">
                14 STS GANTRY CRANES
              </span>
              <span className="px-2.5 py-1 rounded-md border border-border/80 bg-[#080F20]/70 text-muted-foreground">
                34 MOVES / CRANE / HOUR
              </span>
            </div>
          </div>
        )}

        {currentScene === 7 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF5577]/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-[#FF5577] backdrop-blur-md">
              <ShieldAlert className="h-3 w-3" />
              <span>SCENE 08 · PORT CONGESTION &amp; ROADSTEADS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              Roadstead <span className="text-[#FF5577]">Congestion Queue</span>
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-lg">
              Aerial photography over Singapore and Rotterdam outer roadsteads reveals dozens of commercial ships
              waiting at anchor. Real-time congestion indices compute queue dwell times and optimize berthing schedules.
            </p>
            <div className="pt-2">
              <Link
                to="/overview"
                className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3.5 text-sm font-bold text-[#080F20] shadow-xl shadow-cyan-500/25 hover:opacity-95 transition-all transform hover:scale-[1.02]"
              >
                <span>ENTER GLOBAL CONTROL CENTRE</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM FOOTER: 8-SCENE NAVIGATION RAIL & SCROLL PROGRESS */}
      {/* ========================================================================= */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 pointer-events-auto">
        {/* Left: 8-Scene Segmented Mini Track Rail */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-full border border-border/60 bg-[#080F20]/80 backdrop-blur-md overflow-x-auto max-w-full">
          {SCENES_8.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => onJumpToScene(idx)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                currentScene === idx
                  ? "w-8 bg-cyan-400 shadow-sm shadow-cyan-400"
                  : "w-2.5 bg-secondary hover:bg-cyan-400/50"
              }`}
              title={`Jump to Scene ${idx + 1}: ${s.title}`}
            />
          ))}
        </div>

        {/* Right: Telemetry Percentage & Scroll Direction Prompt */}
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span>SCROLL PROGRESS:</span>
          <span className="font-bold text-cyan-400">
            {Math.round(scrollProgress * 100)}%
          </span>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-[11px] text-muted-foreground">
            {currentScene === 7 ? "OPERATIONAL READY" : "SCROLL TO DESCEND ↓"}
          </span>
        </div>
      </footer>
    </div>
  );
}
