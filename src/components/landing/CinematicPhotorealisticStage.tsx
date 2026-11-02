import React, { useMemo } from "react";
import {
  Compass,
  Radio,
  Navigation,
  Anchor,
  ShieldAlert,
  Wind,
  Activity,
  Crosshair,
  Maximize2,
  Waves,
} from "lucide-react";

interface CinematicPhotorealisticStageProps {
  scrollProgress: number; // 0.0 to 1.0
  activeScene: number; // 0 to 7
  simulateStorm: boolean;
}

interface SceneVisualData {
  imageUrl: string;
  alt: string;
  sectorTag: string;
  location: string;
  coordinates: string;
  focalSubject: string;
}

const SCENE_VISUALS: Record<number, SceneVisualData> = {
  2: {
    imageUrl: "/images/landing/scene-ocean.jpg",
    alt: "Deep Atlantic Ocean Swells - Transoceanic Corridors",
    sectorTag: "SECTOR: NORTH ATLANTIC CORRIDOR",
    location: "Global Ocean Transit Route",
    coordinates: "48°12'N, 22°45'W",
    focalSubject: "Deep Ocean Bathymetry & Great-Circle Routing",
  },
  3: {
    imageUrl: "/images/landing/scene-shipping-lanes.jpg",
    alt: "Commercial shipping lane aerial showing multiple vessels navigating maritime corridor",
    sectorTag: "MARITIME CORRIDOR: MAJOR SHIPPING FAIRWAY",
    location: "Strait of Malacca Transit Scheme",
    coordinates: "02°30'N, 101°45'E",
    focalSubject: "High-Density Commercial Shipping Lanes",
  },
  4: {
    imageUrl: "/images/landing/scene-container-ship.jpg",
    alt: "Giant commercial container ship cutting through open ocean swells",
    sectorTag: "VESSEL PROFILE: TRIPLE-E CLASS CONTAINER SHIP",
    location: "English Channel TSS Corridors",
    coordinates: "50°34'N, 01°12'E",
    focalSubject: "Ultra Large Container Carrier (ULCV) Fleet",
  },
  5: {
    imageUrl: "/images/landing/scene-tanker-fleet.jpg",
    alt: "Commercial supertanker underway with kinematic vector tracking",
    sectorTag: "RADAR TELEMETRY: SATELLITE & COASTAL AIS",
    location: "Europort Approaches",
    coordinates: "51°58'N, 03°52'E",
    focalSubject: "Kinematic Vectors, SOG/COG & Collision Avoidance",
  },
  6: {
    imageUrl: "/images/landing/scene-port-terminal-night.jpg",
    alt: "Spectacular illuminated container terminal at night with massive cranes and docked ships",
    sectorTag: "TERMINAL DISCOVERY: ROTTERDAM & HAMBURG HUBS",
    location: "Burchardkai & Maasvlakte II Deepwater Quay",
    coordinates: "53°32'N, 09°58'E",
    focalSubject: "Illuminated Quayside & Automated STS Cranes",
  },
  7: {
    imageUrl: "/images/landing/scene-singapore-anchorage.jpg",
    alt: "Commercial vessels anchored in outer roadstead awaiting berth allocation",
    sectorTag: "ROADSTEAD QUEUE: ANCHORAGE CONGESTION",
    location: "Singapore Eastern Roads & Rotterdam Anchorage",
    coordinates: "01°16'N, 103°53'E",
    focalSubject: "Congestion Index 1.34 & Anchorage Dwell Analytics",
  },
};

const STORM_VISUAL: SceneVisualData = {
  imageUrl: "/images/landing/scene-storm-weather.jpg",
  alt: "NASA Satellite imagery of Category 5 Tropical Cyclone spinning over ocean",
  sectorTag: "METEOROLOGICAL RISK: SEVERE TROPICAL CYCLONE",
  location: "Indian Ocean Cyclone Track",
  coordinates: "14°20'S, 85°40'E",
  focalSubject: "Beaufort 9 Gale · Significant Wave Height 6.2m",
};

export function CinematicPhotorealisticStage({
  scrollProgress,
  activeScene,
  simulateStorm,
}: CinematicPhotorealisticStageProps) {
  // Only show photographic stage once the opening globe zoom transitions in (progress >= 0.20)
  const isVisible = scrollProgress >= 0.20;
  const stageOpacity = Math.min(1, Math.max(0, (scrollProgress - 0.20) / 0.05));

  const visual = useMemo(() => {
    if (simulateStorm) return STORM_VISUAL;
    return SCENE_VISUALS[activeScene] ?? SCENE_VISUALS[3];
  }, [activeScene, simulateStorm]);

  if (!isVisible) return null;

  return (
    <div
      className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none transition-opacity duration-700 ease-out z-10"
      style={{ opacity: stageOpacity }}
    >
      {/* 1. CINEMATIC MARITIME BACKGROUND IMAGERY */}
      <div className="absolute inset-0">
        {Object.entries(SCENE_VISUALS).map(([sceneIdStr, data]) => {
          const sId = Number(sceneIdStr);
          const isCurrent = !simulateStorm && activeScene === sId;
          return (
            <div
              key={sId}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isCurrent ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                src={data.imageUrl}
                alt={data.alt}
                className="h-full w-full object-cover object-center transform transition-transform duration-[4000ms] ease-out will-change-transform"
                style={{
                  transform: isCurrent ? "scale(1.0) translateY(0px)" : "scale(1.06) translateY(-8px)",
                }}
                loading="eager"
              />
            </div>
          );
        })}

        {/* Storm Cyclone satellite imagery when storm is active */}
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            simulateStorm ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <img
            src={STORM_VISUAL.imageUrl}
            alt={STORM_VISUAL.alt}
            className="h-full w-full object-cover object-center transform scale-105"
            loading="eager"
          />
        </div>

        {/* Atmospheric maritime gradients (preserves full image visibility while guaranteeing high text legibility) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080F20] via-transparent to-[#080F20]/75" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080F20]/90 via-[#080F20]/30 to-transparent" />
        <div className="absolute inset-0 bg-[#08182E]/25 mix-blend-multiply" />
      </div>

      {/* 2. REFINED FLOATING MARITIME HUD OVERLAYS */}
      <div className="absolute inset-0 p-6 md:p-10 flex flex-col justify-between select-none">
        {/* Top-Right Optical Reconnaissance Tag */}
        <div className="self-end flex flex-col items-end gap-1 font-mono text-[11px]">
          <div className="flex items-center gap-2 rounded-full border border-cyan-500/40 bg-[#080F20]/75 px-3 py-1 backdrop-blur-md shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <span className="text-cyan-400 font-bold tracking-wider">{visual.sectorTag}</span>
          </div>
          <span className="text-[10px] text-muted-foreground bg-[#080F20]/60 px-2 py-0.5 rounded border border-border/40 backdrop-blur-sm">
            {visual.coordinates} · {visual.location}
          </span>
        </div>

        {/* Scene Contextual Telemetry Callouts (Situated in Negative Space) */}
        <div className="relative w-full h-full my-auto pointer-events-none">
          {/* SCENE 03: COMMERCIAL SHIPPING LANES */}
          {activeScene === 3 && !simulateStorm && (
            <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-80 space-y-2.5 font-mono text-xs">
              <div className="rounded-xl border border-cyan-500/30 bg-[#080F20]/80 p-3.5 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
                  <span className="text-cyan-400 font-bold text-[11px] flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5" />
                    TRANSIT SEPARATION SCHEME
                  </span>
                  <span className="text-[10px] rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 border border-emerald-500/30">
                    FLOW ACTIVE
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Traffic Density:</span>
                    <span className="text-foreground font-semibold">142 Vessels / 24h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lane Separation:</span>
                    <span className="text-cyan-400 font-bold">2.0 NM Inbound / Outbound</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Speed Regulation:</span>
                    <span className="text-foreground font-semibold">Max 20.0 kn</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 04: GIANT CONTAINER SHIP & TANKER FLEET */}
          {activeScene === 4 && !simulateStorm && (
            <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-84 space-y-2.5 font-mono text-xs">
              <div className="rounded-xl border border-cyan-500/30 bg-[#080F20]/80 p-3.5 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
                  <span className="text-cyan-400 font-bold text-[11px] flex items-center gap-1.5">
                    <Anchor className="h-3.5 w-3.5" />
                    MAERSK MC-KINNEY MØLLER
                  </span>
                  <span className="text-[10px] rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 border border-emerald-500/30">
                    TRIPLE-E
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capacity:</span>
                    <span className="text-foreground font-semibold">18,270 TEU</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deadweight:</span>
                    <span className="text-foreground font-semibold">194,849 DWT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Operating Draught:</span>
                    <span className="text-cyan-400 font-bold">16.0 m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cruising Velocity (SOG):</span>
                    <span className="text-emerald-400 font-bold">19.2 kn</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 05: AIS SATELLITE KINEMATICS & COURSE VECTORS */}
          {activeScene === 5 && !simulateStorm && (
            <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-84 space-y-2.5 font-mono text-xs">
              <div className="rounded-xl border border-cyan-500/30 bg-[#080F20]/80 p-3.5 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
                  <span className="text-cyan-400 font-bold text-[11px] flex items-center gap-1.5">
                    <Crosshair className="h-3.5 w-3.5" />
                    KINEMATIC VECTOR RADAR
                  </span>
                  <span className="text-[10px] rounded bg-cyan-500/20 text-cyan-400 px-1.5 py-0.2 border border-cyan-500/30">
                    LIVE FIX
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Course Over Ground (COG):</span>
                    <span className="text-cyan-400 font-bold">074.2° True</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rate of Turn (ROT):</span>
                    <span className="text-foreground font-semibold">0.0°/min (Steady)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closest Approach (CPA):</span>
                    <span className="text-emerald-400 font-bold">&gt; 3.2 NM (Nominal)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 06: ILLUMINATED CONTAINER TERMINAL & QUAYSIDE */}
          {activeScene === 6 && !simulateStorm && (
            <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-84 space-y-2.5 font-mono text-xs">
              <div className="rounded-xl border border-cyan-500/30 bg-[#080F20]/80 p-3.5 backdrop-blur-md shadow-2xl">
                <div className="flex items-center gap-2 text-cyan-400 font-bold border-b border-border/60 pb-2 mb-2">
                  <Anchor className="h-3.5 w-3.5" />
                  <span>MEGA TERMINAL LOGISTICS</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Berth Boundary:</span>
                    <span className="text-cyan-400 font-bold">Deepwater 1,960m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">STS Gantry Cranes:</span>
                    <span className="text-foreground font-semibold">14 Super-Post-Panamax</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quayside Throughput:</span>
                    <span className="text-foreground font-semibold">34.2 Moves / Crane / Hr</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 07: ANCHORAGE QUEUE & CONGESTION DWELL */}
          {activeScene === 7 && !simulateStorm && (
            <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-88 space-y-2.5 font-mono text-xs">
              <div className="rounded-xl border border-[#FF5577]/40 bg-[#080F20]/85 p-4 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2.5">
                  <span className="text-[#FF5577] font-bold flex items-center gap-1.5 text-xs">
                    <ShieldAlert className="h-4 w-4" />
                    CONGESTION THREAT: ELEVATED
                  </span>
                  <span className="rounded bg-[#FF5577]/20 text-[#FF5577] px-2 py-0.5 text-[10px] font-bold border border-[#FF5577]/40">
                    CI 1.34
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ships Anchored in Roads:</span>
                    <span className="text-foreground font-bold">18 Vessels (&lt;0.5 kn)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Average Roadstead Dwell:</span>
                    <span className="text-amber-400 font-bold">36.4 Hours Wait</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Queue Surcharge Risk:</span>
                    <span className="text-[#FF5577] font-semibold">+18.2% Demurrage</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STORM MODE SATELLITE OVERLAY */}
          {simulateStorm && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="rounded-2xl border border-[#FF5577]/50 bg-[#080F20]/90 p-5 backdrop-blur-xl max-w-md w-full shadow-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <span className="text-[#FF5577] font-bold flex items-center gap-2 text-sm">
                    <Wind className="h-4 w-4 animate-spin" />
                    SEVERE TROPICAL CYCLONE ALERT
                  </span>
                  <span className="text-[10px] font-bold bg-[#FF5577]/20 text-[#FF5577] px-2 py-0.5 rounded border border-[#FF5577]/30">
                    BEAUFORT 9
                  </span>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Significant Wave Height ($H_s$):</span>
                    <span className="text-[#FF5577] font-bold">6.2 meters</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sustained Gale Winds:</span>
                    <span className="text-amber-400 font-bold">47.8 knots</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tactical Divert Scheme:</span>
                    <span className="text-cyan-400 font-bold">Active Rerouting via Safe Waypoints</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Tactical Coordinate Crosshair */}
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border/40 pt-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <Crosshair className="h-3 w-3" />
              <span>RADAR SYNCHRONIZED</span>
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">REAL COMMERCIAL AIS FLEET TELEMETRY</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">● LIVE AIS ENGINE</span>
            <span>| 1,877 ACTIVE TRANSPONDERS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
