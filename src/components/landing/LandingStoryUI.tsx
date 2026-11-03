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
  Clock,
  Layers,
  Ship,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { SCENES_10 } from "./constants";
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
  portsData?: Array<{ id: string; name: string; congestion_index?: number | null }>;
}

export function LandingStoryUI({
  currentScene,
  scrollProgress,
  simulateStorm,
  onToggleSimulateStorm,
  onJumpToScene,
  portsData,
}: LandingStoryUIProps) {
  const activeSceneConfig = SCENES_10[currentScene] ?? SCENES_10[0];

  // Helper for live port congestion ranking
  const rankedPorts = React.useMemo(() => {
    const defaultPorts = [
      { id: "singapore", name: "Singapore", ci: 1.42, status: "Congested" },
      { id: "rotterdam", name: "Rotterdam", ci: 1.34, status: "Moderate" },
      { id: "santos", name: "Santos", ci: 1.29, status: "Moderate" },
      { id: "shanghai", name: "Shanghai", ci: 1.18, status: "Normal" },
      { id: "hamburg", name: "Hamburg", ci: 1.08, status: "Normal" },
      { id: "los-angeles", name: "Los Angeles", ci: 0.95, status: "Clear" },
    ];

    if (!portsData || portsData.length === 0) return defaultPorts;

    const matched = defaultPorts.map((p) => {
      const live = portsData.find((lp) => lp.id.toLowerCase() === p.id.toLowerCase());
      const ci = live && live.congestion_index != null ? Number(live.congestion_index) : p.ci;
      let status = "Normal";
      if (ci >= 1.4) status = "Congested";
      else if (ci >= 1.2) status = "Moderate";
      else if (ci < 1.0) status = "Clear";
      return { ...p, ci: Number(ci.toFixed(2)), status };
    });

    return matched.sort((a, b) => b.ci - a.ci);
  }, [portsData]);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none font-sans">
      {/* ========================================================================= */}
      {/* TOP HEADER: BRAND IDENTITY & GLOBAL HUD STATUS */}
      {/* ========================================================================= */}
      <header className="flex items-start justify-between">
        {/* Top-Left: Brand & Telemetry Badge */}
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
              SCENE {String(currentScene + 1).padStart(2, "0")}/10
            </span>
          </div>

          {/* Storm Simulation Toggle (Scene 03 / Weather) */}
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
      {/* MIDDLE ZONE: 10-SCENE CINEMATIC STORYBOARD OVERLAYS */}
      {/* ========================================================================= */}
      <div className="my-auto flex flex-col justify-center max-w-xl pointer-events-auto">
        {/* SCENE 01: The Awakening of Earth */}
        {currentScene === 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
              <Sparkles className="h-3 w-3" />
              <span>SCENE 01 · PLANETARY SURVEILLANCE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              THE WORLD NEVER <span className="text-cyan-400">STOPS MOVING.</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-lg">
              Explore the intelligence connecting global maritime operations. Continuous orbital surveillance tracking commercial trade corridors, specular oceans, and thousands of live transponders.
            </p>
            <div className="flex items-center gap-4 pt-2 text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                STREAM LIVE
              </span>
              <span>·</span>
              <span>6 MONITORED MEGA-HUBS</span>
              <span>·</span>
              <span>1,870+ ACTIVE AIS VESSELS</span>
            </div>
          </div>
        )}

        {/* SCENE 02: Global Shipping Network */}
        {currentScene === 1 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-blue-400 backdrop-blur-md">
              <Globe className="h-3 w-3 text-cyan-400" />
              <span>SCENE 02 · GLOBAL SHIPPING NETWORK</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Synchronized <span className="text-blue-400">Commercial Corridors</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Descent to oceanic shipping lanes. Commercial cargo, passenger, and tanker fleets traveling in synchronized bidirectional corridors under active AIS traffic management.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="rounded-lg border border-cyan-500/25 bg-[#080F20]/70 p-2 backdrop-blur-md">
                <div className="text-muted-foreground text-[10px]">EASTBOUND TRANSIT</div>
                <div className="text-cyan-400 font-bold">19.4 KN · SOG STABLE</div>
              </div>
              <div className="rounded-lg border border-cyan-500/25 bg-[#080F20]/70 p-2 backdrop-blur-md">
                <div className="text-muted-foreground text-[10px]">WESTBOUND SEPARATION</div>
                <div className="text-emerald-400 font-bold">3.2 NM SEPARATION</div>
              </div>
            </div>
          </div>
        )}

        {/* SCENE 03: Weather Risk Intelligence */}
        {currentScene === 2 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF5577]/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-[#FF5577] backdrop-blur-md">
              <CloudLightning className="h-3 w-3" />
              <span>SCENE 03 · METEOROLOGICAL INTELLIGENCE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
              THE OCEAN IS UNPREDICTABLE. <span className="text-[#FF5577]">YOUR DECISIONS SHOULDN'T BE.</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              High-resolution Doppler cyclone simulation tracking spiral rain bands, hurricane-force wind circulation, and dynamic voyage divergence routing vessels safely away from critical gale zones.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
              <span className="px-2.5 py-1 rounded-md border border-[#FF5577]/40 bg-[#FF5577]/15 text-[#FF5577]">
                CYCLONE ALERT: CATEGORY 3
              </span>
              <span className="px-2.5 py-1 rounded-md border border-amber-500/30 bg-[#080F20]/70 text-amber-400">
                SUSTAINED WINDS: 54 KN
              </span>
              <span className="px-2.5 py-1 rounded-md border border-emerald-500/30 bg-[#080F20]/70 text-emerald-400">
                SAFE ROUTE: DIVERGING +14°
              </span>
            </div>
          </div>
        )}

        {/* SCENE 04: The Time Machine */}
        {currentScene === 3 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-purple-400 backdrop-blur-md">
              <Clock className="h-3 w-3 text-cyan-400" />
              <span>SCENE 04 · 4D TEMPORAL TIME MACHINE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Temporal <span className="text-purple-400">Digital Twin Warp</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Pass through the temporal portal to explore maritime conditions across time. Inspect historical bottleneck patterns, real-time queues, and 24-hour predictive congestion indices.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-2 font-mono text-[10px]">
              <div className="rounded-lg border border-purple-500/30 bg-[#080F20]/75 p-2 backdrop-blur-md text-center">
                <div className="text-muted-foreground flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3 text-purple-400" /> T-24h
                </div>
                <div className="text-purple-300 font-bold text-xs mt-0.5">CI 1.84</div>
                <div className="text-[9px] text-muted-foreground">Severe Queue</div>
              </div>
              <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/30 p-2 backdrop-blur-md text-center shadow-lg shadow-cyan-500/10">
                <div className="text-cyan-400 flex items-center justify-center gap-1 font-bold">
                  <Activity className="h-3 w-3" /> T-0h (NOW)
                </div>
                <div className="text-cyan-300 font-bold text-xs mt-0.5">CI 1.34</div>
                <div className="text-[9px] text-cyan-400/80">Active Dwell</div>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-[#080F20]/75 p-2 backdrop-blur-md text-center">
                <div className="text-muted-foreground flex items-center justify-center gap-1">
                  <TrendingDown className="h-3 w-3 text-emerald-400" /> T+24h
                </div>
                <div className="text-emerald-400 font-bold text-xs mt-0.5">CI 0.92</div>
                <div className="text-[9px] text-muted-foreground">Optimal Clear</div>
              </div>
            </div>
          </div>
        )}

        {/* SCENE 05: Port Intelligence & Congestion Comparison (Frame 5 Reference) */}
        {currentScene === 4 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
              <Layers className="h-3 w-3" />
              <span>SCENE 05 · GLOBAL PORT INTELLIGENCE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Strategic Gateway <span className="text-cyan-400">Congestion Intelligence</span>
            </h2>

            {/* Port Congestion Ranking Glass HUD Panel (Direct Reference Frame 5) */}
            <div className="w-80 rounded-2xl border border-cyan-500/40 bg-[#081226]/85 p-4 backdrop-blur-xl shadow-2xl shadow-cyan-500/20">
              <div className="text-sm font-bold text-cyan-200 tracking-wide pb-2.5 border-b border-cyan-500/20 flex items-center justify-between">
                <span>Port Congestion Ranking</span>
                <span className="text-[10px] font-mono text-cyan-400/80">LIVE AIS</span>
              </div>
              <div className="space-y-2 pt-3 font-mono text-xs">
                {rankedPorts.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between py-0.5">
                    <span className="text-slate-300 font-semibold">{idx + 1}. {p.name}</span>
                    <span className="text-cyan-300 font-bold">{Math.round((p.ci / 1.5) * 92)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCENE 06: Three Types of Ships */}
        {currentScene === 5 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
              <Ship className="h-3 w-3" />
              <span>SCENE 06 · THE MERCHANT FLEET IN ONE FRAME</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Three Pillars of <span className="text-cyan-400">Ocean Logistics</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Viewed simultaneously in one coordinated corridor: Container Carriers, Luxury Passenger Liners, and Crude Tankers orchestrating world maritime trade.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10px]">
              <div className="rounded-lg border border-amber-500/30 bg-[#080F20]/75 p-2 backdrop-blur-md">
                <div className="text-amber-400 font-bold">1. CARGO SHIP</div>
                <div className="text-muted-foreground text-[9px] mt-0.5">High-Density TEU Containers</div>
              </div>
              <div className="rounded-lg border border-cyan-500/30 bg-[#080F20]/75 p-2 backdrop-blur-md">
                <div className="text-cyan-400 font-bold">2. PASSENGER SHIP</div>
                <div className="text-muted-foreground text-[9px] mt-0.5">Cruise Liners &amp; Guests</div>
              </div>
              <div className="rounded-lg border border-rose-500/30 bg-[#080F20]/75 p-2 backdrop-blur-md">
                <div className="text-rose-400 font-bold">3. TANKER SHIP</div>
                <div className="text-muted-foreground text-[9px] mt-0.5">Liquid Energy Manifolds</div>
              </div>
            </div>
          </div>
        )}

        {/* SCENE 07: Cargo Ship */}
        {currentScene === 6 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-amber-400 backdrop-blur-md">
              <Anchor className="h-3 w-3" />
              <span>SCENE 07 · CONTAINERIZED COMMERCE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Ultra Large <span className="text-amber-400">Cargo Carrier</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Cargo vessels transport international goods and commodities across transoceanic supply chains. Cellular container guides hold thousands of TEU boxes with hydrodynamic bulbous bow efficiency.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-md border border-amber-500/30 bg-[#080F20]/70 text-amber-400">
                18,270 TEU CAPACITY
              </span>
              <span className="px-2.5 py-1 rounded-md border border-cyan-500/30 bg-[#080F20]/70 text-cyan-400">
                19.4 KN CRUISING SPEED
              </span>
              <span className="px-2.5 py-1 rounded-md border border-emerald-500/30 bg-[#080F20]/70 text-emerald-400">
                DUAL-FUEL PROPULSION
              </span>
            </div>
          </div>
        )}

        {/* SCENE 08: Passenger Ship */}
        {currentScene === 7 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
              <Navigation2 className="h-3 w-3" />
              <span>SCENE 08 · MARITIME PASSENGER MOBILITY</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Luxury Ocean <span className="text-cyan-400">Passenger Cruise Liner</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Passenger vessels transport people across oceans, connecting ports through cruise and ferry services. Detailed observation decks, staterooms, pool deck, and visible passenger figures walking the promenade.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-md border border-cyan-500/30 bg-[#080F20]/70 text-cyan-400">
                5,400 PASSENGER CAPACITY
              </span>
              <span className="px-2.5 py-1 rounded-md border border-emerald-500/30 bg-[#080F20]/70 text-emerald-400">
                14 PASSENGER DECKS
              </span>
              <span className="px-2.5 py-1 rounded-md border border-purple-500/30 bg-[#080F20]/70 text-purple-300">
                AZIPOD ZERO-EMISSION MANEUVERING
              </span>
            </div>
          </div>
        )}

        {/* SCENE 09: Tanker Ship */}
        {currentScene === 8 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-[#080F20]/75 px-3 py-1 text-[10px] font-mono text-rose-400 backdrop-blur-md">
              <Activity className="h-3 w-3" />
              <span>SCENE 09 · CRITICAL ENERGY INFRASTRUCTURE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Crude &amp; Chemical <span className="text-rose-400">Tanker Vessel</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Tankers transport liquid cargo such as crude oil and petroleum products vital for global energy security. Featuring heavy deck manifolds, industrial piping, inert gas pressure systems, and double-hull construction.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-md border border-rose-500/30 bg-[#080F20]/70 text-rose-400">
                318,000 DWT CAPACITY
              </span>
              <span className="px-2.5 py-1 rounded-md border border-amber-500/30 bg-[#080F20]/70 text-amber-400">
                DOUBLE-HULL PROTECTED
              </span>
              <span className="px-2.5 py-1 rounded-md border border-cyan-500/30 bg-[#080F20]/70 text-cyan-400">
                CARGO PIPING MANIFOLD
              </span>
            </div>
          </div>
        )}

        {/* SCENE 10: Final Hero Screen */}
        {currentScene === 9 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-950/40 px-3.5 py-1.5 text-[11px] font-mono text-cyan-400 backdrop-blur-md shadow-lg shadow-cyan-500/20">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              <span>SCENE 10 · OPERATIONAL LAUNCH</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-none">
              GLOBAL <span className="text-cyan-400">MARITIME</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-cyan-100 font-semibold tracking-wide">
              One ocean. Connected intelligence.
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-lg">
              Live commercial fleet tracking and global port congestion monitoring system powered by real-time AIS telemetry.
            </p>

            {/* Premium, Interactive High-Impact Action Button */}
            <div className="pt-3">
              <Link
                to="/overview"
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-8 py-4 text-base font-extrabold text-[#080F20] shadow-2xl shadow-cyan-500/40 hover:shadow-cyan-400/60 transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <span className="relative z-10 tracking-wide font-black">ENTER THE EXPERIENCE</span>
                <ArrowRight className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM FOOTER: 10-SCENE NAVIGATION RAIL & SCROLL PROGRESS */}
      {/* ========================================================================= */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 pointer-events-auto">
        {/* Left: 10-Scene Segmented Mini Track Rail */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-full border border-border/60 bg-[#080F20]/80 backdrop-blur-md overflow-x-auto max-w-full">
          {SCENES_10.map((s, idx) => (
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
            {currentScene === 9 ? "OPERATIONAL READY" : "SCROLL TO EXPLORE ↓"}
          </span>
        </div>
      </footer>
    </div>
  );
}
