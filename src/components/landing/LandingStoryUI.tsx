import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Globe,
  Navigation2,
  Anchor,
  Activity,
  CloudLightning,
  History,
  GitBranch,
  Cpu,
  ChevronRight,
  Radio,
  Sliders,
  Zap,
  ShieldAlert,
  Search,
  Maximize2,
  Sparkles,
  Layers,
  ArrowRight,
  Eye,
} from "lucide-react";
import { SCENES_13, STAGES } from "./constants";
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
  lowPowerMode,
  onToggleLowPower,
  onJumpToScene,
  selectedVessel,
}: LandingStoryUIProps) {
  const [activeTmTab, setActiveTmTab] = useState<number>(0);
  const [detailsExpanded, setDetailsExpanded] = useState<boolean>(false);

  // Time Machine 11 Full Modules
  const tmModules = [
    { id: "replay", name: "01 Replay Mode", desc: "Full-fidelity 4D historical track replay" },
    { id: "blackbox", name: "02 Vessel Black Box", desc: "Kinematic incident reconstruction & log" },
    { id: "anomaly", name: "03 Anomaly Detective", desc: "Spoofing, AIS blackout & speed jumps" },
    { id: "whatif", name: "04 What-If Simulator", desc: "Canal closures & berth outage simulations" },
    { id: "ripple", name: "05 Ripple Network", desc: "Downstream delay propagation graphs" },
    { id: "graph", name: "06 Knowledge Graph", desc: "Temporal node correlations & fleet linkages" },
    { id: "predict", name: "07 Predictive AI", desc: "Machine-learning ETA & dwell forecasts" },
    { id: "change", name: "08 Change Detection", desc: "Automated baseline anomaly flagging" },
    { id: "alerts", name: "09 Time Alerts", desc: "Temporal threshold triggers & notifications" },
    { id: "assistant", name: "10 AI Assistant", desc: "Maritime LLM agent for natural queries" },
    { id: "dossier", name: "11 Dossier Workspace", desc: "Audit trail exports & incident reporting" },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none font-sans">
      {/* ========================================================================= */}
      {/* TOP HEADER: BRAND IDENTITY & GLOBAL HUD STATUS (NEGATIVE SPACE TOP-LEFT/RIGHT) */}
      {/* ========================================================================= */}
      <header className="flex items-start justify-between">
        {/* Top-Left: Futuristic Brand & Telemetry Badge */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111E36]/90 border border-[#22D3EE]/30 shadow-lg shadow-[#22D3EE]/10 backdrop-blur-md">
              <Anchor className="h-5 w-5 text-[#22D3EE]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-[#F4F8FF]">
                  GLOBAL MARITIME
                </span>
                <span className="rounded bg-[#22D3EE]/15 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#22D3EE] uppercase tracking-widest border border-[#22D3EE]/30">
                  PORT MONITOR
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#A9BAD2]">
                Planetary AIS Fleet & Port Intelligence Digital Twin
              </p>
            </div>
          </div>
        </div>

        {/* Top-Right: Quick Controls & Scene Stage Indicator */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pointer-events-auto">
          {/* Active Stage Indicator */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#22D3EE]/25 bg-[#111E36]/80 px-3.5 py-1.5 backdrop-blur-md shadow-md text-xs font-mono">
            <Radio className="h-3.5 w-3.5 text-[#22D3EE] animate-pulse" />
            <span className="text-[11px] font-semibold text-[#F4F8FF]">
              {SCENES_13[currentScene]?.title ?? "ORBITAL INTELLIGENCE"}
            </span>
            <span className="text-[#A9BAD2]/50">|</span>
            <span className="text-[10px] text-[#22D3EE] font-bold">
              SCENE {String(currentScene + 1).padStart(2, "0")}/13
            </span>
          </div>

          {/* Storm Simulation Toggle (Scene 08 / Weather) */}
          <button
            onClick={onToggleSimulateStorm}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono font-medium transition-all backdrop-blur-md ${
              simulateStorm
                ? "border-[#FF5577] bg-[#FF5577]/20 text-[#FF5577] shadow-lg shadow-[#FF5577]/20"
                : "border-[#FFB547]/30 bg-[#111E36]/70 text-[#FFB547] hover:bg-[#FFB547]/15"
            }`}
            title="Toggle Hurricane-force storm overlay simulation"
          >
            <CloudLightning className="h-3.5 w-3.5" />
            <span>{simulateStorm ? "STORM [ACTIVE]" : "SIMULATE STORM"}</span>
          </button>

          {/* Direct Launch to Dashboard Button */}
          <Link
            to="/overview"
            className="flex items-center gap-1.5 rounded-full border border-[#3978FF]/40 bg-[#3978FF]/20 px-3.5 py-1.5 text-xs font-medium text-[#F4F8FF] hover:bg-[#3978FF]/30 transition-all backdrop-blur-md shadow-md"
          >
            <span>LIVE DASHBOARD</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#22D3EE]" />
          </Link>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MIDDLE ZONE: FLOATING HOLOGRAPHIC TYPOGRAPHY & SCENE TELEMETRY */}
      {/* Strictly positioned in negative space (left-aligned) — never blocks ships */}
      {/* ========================================================================= */}
      <div className="my-auto flex flex-col justify-center max-w-xl pointer-events-auto">
        {/* Dynamic Holographic Telemetry per Scene */}
        {currentScene === 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#22D3EE] backdrop-blur-md">
              <Sparkles className="h-3 w-3" />
              <span>SCENE 01 · PLANETARY SURVEILLANCE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#F4F8FF] leading-tight">
              The Awakening of <span className="text-[#22D3EE]">Earth</span>
            </h1>
            <p className="text-sm md:text-base text-[#A9BAD2] leading-relaxed max-w-lg">
              Live orbital monitoring of commercial maritime traffic across the world's oceans.
              Powered by real-time AIS telemetry, NASA Black Marble specular oceans, and neural geospatial tracking.
            </p>
            <div className="flex items-center gap-4 pt-2 text-xs font-mono text-[#A9BAD2]">
              <span className="flex items-center gap-1.5 text-[#18D69B]">
                <span className="h-2 w-2 rounded-full bg-[#18D69B] animate-ping" />
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3978FF]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#3978FF] backdrop-blur-md">
              <Globe className="h-3 w-3 text-[#22D3EE]" />
              <span>SCENE 02 · GLOBAL TRADE NETWORK</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              Arteries of <span className="text-[#3978FF]">Global Commerce</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Luminous great-circle corridors linking Rotterdam, Singapore, Shanghai, Los Angeles, Hamburg, and Santos.
              Over 80% of global trade volume moves along these transoceanic shipping lanes.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {["Rotterdam", "Singapore", "Shanghai", "Los Angeles", "Hamburg", "Santos"].map((port) => (
                <span
                  key={port}
                  className="px-2.5 py-1 rounded-md border border-[#22D3EE]/20 bg-[#111E36]/60 text-[11px] font-mono text-[#22D3EE]"
                >
                  {port}
                </span>
              ))}
            </div>
          </div>
        )}

        {currentScene === 2 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#22D3EE] backdrop-blur-md">
              <Activity className="h-3 w-3" />
              <span>SCENE 03 · THE LIVING OCEAN</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              Descent to <span className="text-[#22D3EE]">Sea Level</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Physically-based trochoidal Gerstner waves calculated across 4 harmonic vectors.
              Zero geometric clipping, true ocean depth rendering, and dynamic wave-crest foam.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2 max-w-sm">
              <div className="p-2.5 rounded-lg border border-[#22D3EE]/20 bg-[#111E36]/70 backdrop-blur-sm">
                <div className="text-[10px] font-mono text-[#A9BAD2]">SEA SURFACE LEVEL</div>
                <div className="text-lg font-bold font-mono text-[#22D3EE]">0.00 m</div>
              </div>
              <div className="p-2.5 rounded-lg border border-[#3978FF]/20 bg-[#111E36]/70 backdrop-blur-sm">
                <div className="text-[10px] font-mono text-[#A9BAD2]">SIGNIFICANT WAVE HT</div>
                <div className="text-lg font-bold font-mono text-[#3978FF]">1.82 m</div>
              </div>
            </div>
          </div>
        )}

        {currentScene === 3 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFB547]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#FFB547] backdrop-blur-md">
              <Navigation2 className="h-3 w-3" />
              <span>SCENE 04 · MULTI-VESSEL CORRIDOR</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              Commercial <span className="text-[#FFB547]">Shipping Lane</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Multiple commercial vessels arranged across 4 realistic depth planes: Foreground ultra-large container carrier,
              mid-distance bulk carrier & crude tanker, and background feeder cargo ships on the horizon.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-[#22D3EE]/15 border border-[#22D3EE]/30 text-[#22D3EE]">
                ULCV 20,600 TEU
              </span>
              <span className="px-2 py-0.5 rounded bg-[#FFB547]/15 border border-[#FFB547]/30 text-[#FFB547]">
                VLCC TANKER 318k DWT
              </span>
              <span className="px-2 py-0.5 rounded bg-[#3978FF]/15 border border-[#3978FF]/30 text-[#3978FF]">
                PANAMAX BULK 82k DWT
              </span>
            </div>
          </div>
        )}

        {currentScene === 4 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#22D3EE] backdrop-blur-md">
              <Radio className="h-3 w-3 text-[#18D69B]" />
              <span>SCENE 05 · LIVE FLEET TRACKING</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              Kinematic <span className="text-[#22D3EE]">Course Vectors</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Real-time AIS telemetry feeds: Heading vectors, Speed Over Ground (SOG), Course Over Ground (COG),
              and dead-reckoning projected paths calculated with great-circle kinematics.
            </p>
            <div className="p-3 rounded-xl border border-[#22D3EE]/25 bg-[#111E36]/80 backdrop-blur-md space-y-2 max-w-sm text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#A9BAD2]">HERO VESSEL:</span>
                <span className="text-[#F4F8FF] font-semibold">CMA CGM ANTOINE DE ST EXUPERY</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A9BAD2]">SOG / COG:</span>
                <span className="text-[#22D3EE] font-bold">17.6 kn / 072°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A9BAD2]">TELEMETRY FEED:</span>
                <span className="text-[#18D69B] font-bold">VERIFIED AIS STREAM</span>
              </div>
            </div>
          </div>
        )}

        {currentScene === 5 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#22D3EE] backdrop-blur-md">
              <Anchor className="h-3 w-3" />
              <span>SCENE 06 · PORT DISCOVERY</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              Port of <span className="text-[#22D3EE]">Rotterdam</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Maasvlakte II deepwater container gateway. Commercial quayside with Ship-to-Shore (STS) gantry cranes,
              active berth boundaries highlighted in cyan, and outer anchorage zones marked in amber.
            </p>
            <div className="flex gap-4 pt-1 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-[#22D3EE]">
                <span className="h-2 w-2 rounded-full bg-[#22D3EE]" />
                BERTH ZONE (CYAN)
              </div>
              <div className="flex items-center gap-1.5 text-[#FFB547]">
                <span className="h-2 w-2 rounded-full bg-[#FFB547]" />
                ANCHORAGE (AMBER)
              </div>
            </div>
          </div>
        )}

        {currentScene === 6 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF5577]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#FF5577] backdrop-blur-md">
              <ShieldAlert className="h-3 w-3" />
              <span>SCENE 07 · CONGESTION INTELLIGENCE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              Congestion Index <span className="text-[#FF5577]">1.34 [CRITICAL]</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Calculated ratio of vessels awaiting berth versus operational capacity.
              Pulsing amber and red telemetry rings trigger automatically whenever CI exceeds the 1.20 threshold.
            </p>
            <div className="grid grid-cols-3 gap-2.5 pt-2 max-w-md">
              <div className="p-2.5 rounded-lg border border-[#FF5577]/30 bg-[#111E36]/80 text-center">
                <div className="text-[10px] font-mono text-[#A9BAD2]">CONGESTION INDEX</div>
                <div className="text-xl font-bold font-mono text-[#FF5577]">1.34</div>
              </div>
              <div className="p-2.5 rounded-lg border border-[#FFB547]/30 bg-[#111E36]/80 text-center">
                <div className="text-[10px] font-mono text-[#A9BAD2]">QUEUE DWELL</div>
                <div className="text-xl font-bold font-mono text-[#FFB547]">36.4h</div>
              </div>
              <div className="p-2.5 rounded-lg border border-[#22D3EE]/30 bg-[#111E36]/80 text-center">
                <div className="text-[10px] font-mono text-[#A9BAD2]">WAITING QUEUE</div>
                <div className="text-xl font-bold font-mono text-[#22D3EE]">18 Ships</div>
              </div>
            </div>
          </div>
        )}

        {currentScene === 7 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFB547]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#FFB547] backdrop-blur-md">
              <CloudLightning className="h-3 w-3" />
              <span>SCENE 08 · METEOROLOGICAL INTELLIGENCE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              Weather <span className="text-[#FFB547]">Risk Dynamics</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Live Open-Meteo marine observations: Wind streamlines, wave-height contours, and Doppler storm radar cell tracking.
              {simulateStorm ? " Simulation mode is currently ACTIVE." : " Displaying real-time calibrated marine observations."}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onToggleSimulateStorm}
                className="px-4 py-2 rounded-lg border border-[#FF5577] bg-[#FF5577]/25 text-xs font-mono font-bold text-[#F4F8FF] hover:bg-[#FF5577]/40 transition-colors shadow-lg"
              >
                {simulateStorm ? "DEACTIVATE STORM" : "SIMULATE FORCE 10 GALE"}
              </button>
            </div>
          </div>
        )}

        {currentScene === 8 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#A78BFA]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#A78BFA] backdrop-blur-md">
              <History className="h-3 w-3" />
              <span>SCENE 09 · TEMPORAL DIGITAL TWIN</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              4D Temporal <span className="text-[#A78BFA]">Intelligence</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Maritime traffic does not exist only in the present. The Time Machine records, indices, and simulates
              every transponder transmission across space and time.
            </p>
            <div className="p-3 rounded-xl border border-[#A78BFA]/30 bg-[#111E36]/80 text-xs font-mono text-[#F4F8FF] max-w-sm">
              <div className="text-[10px] text-[#A9BAD2] mb-1">RECORDED TEMPORAL WINDOW</div>
              <div>T-30 DAYS HISTORICAL · REAL-TIME · T+14 DAYS PREDICTIVE</div>
            </div>
          </div>
        )}

        {currentScene === 9 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500 max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#A78BFA]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#A78BFA] backdrop-blur-md">
              <Layers className="h-3 w-3" />
              <span>SCENE 10 · TIME MACHINE SUITE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F4F8FF]">
              11 Advanced <span className="text-[#A78BFA]">Intelligence Modules</span>
            </h2>
            <p className="text-xs text-[#A9BAD2]">
              Explore the full investigative suite. Select any module to preview its analytical capability:
            </p>
            {/* 11 Modules Horizontal Scroll / Tabs */}
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {tmModules.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setActiveTmTab(idx)}
                  className={`text-left p-2 rounded-md border text-[11px] font-mono transition-all ${
                    activeTmTab === idx
                      ? "border-[#22D3EE] bg-[#22D3EE]/20 text-[#F4F8FF] shadow-sm"
                      : "border-[#172744] bg-[#111E36]/60 text-[#A9BAD2] hover:bg-[#111E36]"
                  }`}
                >
                  <div className="font-semibold truncate">{m.name}</div>
                  <div className="text-[9px] text-[#A9BAD2] truncate">{m.desc}</div>
                </button>
              ))}
            </div>
            <Link
              to="/timemachine"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#22D3EE] hover:underline"
            >
              LAUNCH TIME MACHINE SUITE →
            </Link>
          </div>
        )}

        {currentScene === 10 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF5577]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#FF5577] backdrop-blur-md">
              <GitBranch className="h-3 w-3" />
              <span>SCENE 11 · GLOBAL RIPPLE EFFECT</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              Systemic <span className="text-[#FF5577]">Contagion Network</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Simulating canal closures and major port disruptions. Disruption originating at Rotterdam
              cascades downstream delays to Singapore (+36h), Hamburg (+28h), and Santos (+22h).
            </p>
            <div className="p-3 rounded-xl border border-[#FF5577]/30 bg-[#111E36]/80 text-xs font-mono space-y-1.5 max-w-sm">
              <div className="flex justify-between text-[#FF5577]">
                <span>ORIGIN CHOKEPOINT:</span>
                <span className="font-bold">ROTTERDAM (+48H DELAY)</span>
              </div>
              <div className="flex justify-between text-[#FFB547]">
                <span>SECONDARY CASCADE:</span>
                <span>SINGAPORE (+36H) · HAMBURG (+28H)</span>
              </div>
            </div>
          </div>
        )}

        {currentScene === 11 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#22D3EE] backdrop-blur-md">
              <Cpu className="h-3 w-3" />
              <span>SCENE 12 · ENGINEERING & PIPELINE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F4F8FF]">
              Enterprise <span className="text-[#22D3EE]">Data Architecture</span>
            </h2>
            <p className="text-sm text-[#A9BAD2] leading-relaxed max-w-lg">
              Real-time AIS ingestion over WebSocket relay → In-memory geospatial indexing → Ray-casting geofence detection →
              Congestion index calculations → Open-Meteo weather fusion → 4D Temporal storage.
            </p>
            <Link
              to="/methodology"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#22D3EE] hover:underline"
            >
              READ FULL METHODOLOGY & SPECS →
            </Link>
          </div>
        )}

        {currentScene === 12 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#18D69B]/30 bg-[#111E36]/70 px-3 py-1 text-[10px] font-mono text-[#18D69B] backdrop-blur-md">
              <Radio className="h-3 w-3 animate-ping" />
              <span>SCENE 13 · GLOBAL CONTROL CENTRE</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F4F8FF]">
              Command the <span className="text-[#22D3EE]">Seas</span>
            </h2>
            <p className="text-sm md:text-base text-[#A9BAD2] leading-relaxed max-w-lg">
              Ready to operate live maritime surveillance. Enter the operational command centre to inspect
              interactive MapLibre charts, vessel search, port deep-dives, and AI investigation tools.
            </p>
            <div className="pt-2">
              <Link
                to="/overview"
                className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#22D3EE] to-[#3978FF] px-6 py-3.5 text-sm font-bold text-[#080F20] shadow-xl shadow-[#22D3EE]/25 hover:opacity-95 transition-all transform hover:scale-[1.02]"
              >
                <span>ENTER GLOBAL CONTROL CENTRE</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM FOOTER: 13-SCENE NAVIGATION RAIL & SCROLL PROGRESS */}
      {/* ========================================================================= */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 pointer-events-auto">
        {/* Left: 13-Scene Segmented Mini Track Rail */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-full border border-[#172744] bg-[#080F20]/80 backdrop-blur-md overflow-x-auto max-w-full">
          {SCENES_13.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => onJumpToScene(idx)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                currentScene === idx
                  ? "w-8 bg-[#22D3EE] shadow-sm shadow-[#22D3EE]"
                  : "w-2 bg-[#172744] hover:bg-[#22D3EE]/50"
              }`}
              title={`Jump to Scene ${idx + 1}: ${s.title}`}
            />
          ))}
        </div>

        {/* Right: Telemetry Percentage & Scroll Direction Prompt */}
        <div className="flex items-center gap-3 text-xs font-mono text-[#A9BAD2]">
          <span>SCROLL PROGRESS:</span>
          <span className="font-bold text-[#22D3EE]">
            {Math.round(scrollProgress * 100)}%
          </span>
          <span className="text-[#A9BAD2]/40">|</span>
          <span className="text-[11px] text-[#A9BAD2]/80">
            {currentScene === 12 ? "JOURNEY COMPLETE" : "SCROLL DOWN TO DIVE ↓"}
          </span>
        </div>
      </footer>
    </div>
  );
}
