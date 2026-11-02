import React, { Component, useRef, useMemo, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

import { GlobeMesh } from "./GlobeMesh";
import { TradeRoutes } from "./TradeRoutes";
import { InstancedVessels } from "./InstancedVessels";
import { GerstnerOceanSurface } from "./GerstnerOceanSurface";
import { MultiVesselCorridor3D } from "./MultiVesselCorridor3D";
import { PortEnvironment3D } from "./PortEnvironment3D";
import { MeteorologicalWeather } from "./MeteorologicalWeather";
import { ShipCourseVectors, type TrackedVessel } from "./ShipCourseVectors";
import { RippleNetwork3D } from "./RippleNetwork3D";
import { EngineeringPipeline3D } from "./EngineeringPipeline3D";
import type { RealVesselType } from "./RealVessel3D";

export interface LandingCanvasProps {
  scrollProgress: number; // 0.0 to 1.0 from GSAP ScrollTrigger
  activeScene: number; // 0 to 12
  simulateStorm: boolean;
  lowPowerMode: boolean;
  waveHeightMeters?: number;
  windSpeedKnots?: number;
  onSelectVessel?: (vessel: TrackedVessel | null) => void;
  selectedVesselId?: string | null;
}

interface CanvasErrorBoundaryProps {
  children: ReactNode;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  constructor(props: CanvasErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[LandingCanvas] WebGL 3D Scene Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * Brand-New Continuous 13-Scene Cinematic Camera Rig:
 * Coordinates smooth camera trajectory, orbital easing, and cinematic transitions
 * from Space -> Corridors -> Living Ocean -> Vessel Reveal -> Fleet -> Port ->
 * Congestion -> Weather Risk -> Digital Twin -> Suite -> Ripple -> Methodology -> Control Centre.
 */
function ZoomCameraRig({
  scrollProgress,
}: {
  scrollProgress: number;
  activeScene: number;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(({ clock }) => {
    if (!cameraRef.current) return;
    const t = clock.getElapsedTime();
    const p = Math.max(0, Math.min(1, scrollProgress));

    const targetCamPos = new THREE.Vector3(0, 10, 32);
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    if (p < 0.077) {
      // Scene 01: Awakening of Earth (0.00 - 0.077) - High Orbit, Earth Hero
      const u = p / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 9.5, 30), new THREE.Vector3(0, 7.5, 26), u);
      targetLookAt.set(0, 0, 0);
    } else if (p < 0.154) {
      // Scene 02: Global Trade Network (0.077 - 0.154) - Approaching Trade Corridors
      const u = (p - 0.077) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 7.5, 26), new THREE.Vector3(3.8, 6.5, 20.0), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 1.0, 0), u);
    } else if (p < 0.231) {
      // Scene 03: The Living Ocean (0.154 - 0.231) - Descent down to Sea Level
      const u = (p - 0.154) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(3.8, 6.5, 20.0), new THREE.Vector3(2.0, 3.8, 10.5), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0.5, 1.0, 0), new THREE.Vector3(0, 0.8, 0), u);
    } else if (p < 0.308) {
      // Scene 04: The Vessel Reveal (0.231 - 0.308) - Multi-vessel corridor reveal
      const u = (p - 0.231) / 0.077;
      const orbitAngle = u * Math.PI * 0.35 + t * 0.06;
      const camDist = 5.8 - u * 0.6;
      targetCamPos.set(
        Math.sin(orbitAngle) * camDist + 0.6,
        2.2 + Math.cos(orbitAngle) * 0.3,
        Math.cos(orbitAngle) * camDist + 1.2
      );
      targetLookAt.set(0, 1.0, 0);
    } else if (p < 0.385) {
      // Scene 05: Live Fleet Tracking (0.308 - 0.385) - Kinematic Course & Heading Vectors
      const u = (p - 0.308) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(2.2, 3.2, 5.8), new THREE.Vector3(4.5, 3.8, 7.2), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(0.4, 1.0, 0), u);
    } else if (p < 0.462) {
      // Scene 06: Port Discovery (0.385 - 0.462) - Transition to Port Quayside & Berths
      const u = (p - 0.385) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(4.5, 3.8, 7.2), new THREE.Vector3(2.5, 6.5, 11.0), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0.4, 1.0, 0), new THREE.Vector3(-4.0, 1.5, 0), u);
    } else if (p < 0.538) {
      // Scene 07: Port Congestion Intelligence (0.462 - 0.538) - Anchorage Queue & Rings
      const u = (p - 0.462) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(2.5, 6.5, 11.0), new THREE.Vector3(8.0, 7.2, 12.5), u);
      targetLookAt.lerpVectors(new THREE.Vector3(-4.0, 1.5, 0), new THREE.Vector3(12.0, 1.0, -1.0), u);
    } else if (p < 0.615) {
      // Scene 08: Weather Risk Intelligence (0.538 - 0.615) - Meteorological Wind & Storm
      const u = (p - 0.538) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(8.0, 7.2, 12.5), new THREE.Vector3(3.2, 5.4, 8.5), u);
      targetLookAt.lerpVectors(new THREE.Vector3(12.0, 1.0, -1.0), new THREE.Vector3(1.0, 0.8, -0.5), u);
    } else if (p < 0.692) {
      // Scene 09: The Temporal Digital Twin (0.615 - 0.692) - Rise back into 4D Orbit
      const u = (p - 0.615) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(3.2, 5.4, 8.5), new THREE.Vector3(3.5, 7.2, 22.0), u);
      targetLookAt.lerpVectors(new THREE.Vector3(1.0, 0.8, -0.5), new THREE.Vector3(0, 0, 0), u);
    } else if (p < 0.769) {
      // Scene 10: Time Machine Suite (0.692 - 0.769) - Orbiting Living Twin
      const u = (p - 0.692) / 0.077;
      const angle = u * Math.PI * 0.35 + t * 0.04;
      targetCamPos.set(Math.sin(angle) * 23.0, 7.0, Math.cos(angle) * 23.0);
      targetLookAt.set(0, 0, 0);
    } else if (p < 0.846) {
      // Scene 11: Global Ripple Effect (0.769 - 0.846) - Network Contagion
      const u = (p - 0.769) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(3.5, 7.2, 22.0), new THREE.Vector3(0, 14.0, 20.0), u);
      targetLookAt.set(0, 0, 0);
    } else if (p < 0.923) {
      // Scene 12: Engineering Pipeline (0.846 - 0.923) - Linear Conduit Architecture
      const u = (p - 0.846) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 14.0, 20.0), new THREE.Vector3(0, 6.0, 24.0), u);
      targetLookAt.set(0, 0, 0);
    } else {
      // Scene 13: Enter the Global Control Centre (0.923 - 1.000) - Command Bridge View
      const u = (p - 0.923) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 6.0, 24.0), new THREE.Vector3(0, 8.0, 27.0), u);
      targetLookAt.set(0, 0, 0);
    }

    cameraRef.current.position.lerp(targetCamPos, 0.08);
    cameraRef.current.lookAt(targetLookAt);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={38} position={[0, 9.5, 30]} />;
}

export function LandingCanvas({
  scrollProgress,
  activeScene,
  simulateStorm,
  lowPowerMode,
  waveHeightMeters = 1.8,
  windSpeedKnots = 18.5,
  onSelectVessel,
  selectedVesselId,
}: LandingCanvasProps) {
  // STRICT SEPARATION:
  // Globe is visible in Orbital Scenes:
  // Scene 01-02 (0.00 to 0.17) and Scene 09-10 (0.68 to 0.80) and Scene 13 (0.92 to 1.0)
  const isGlobeVisible =
    scrollProgress < 0.17 || (scrollProgress >= 0.68 && scrollProgress < 0.80) || scrollProgress >= 0.92;

  // Ocean is visible during Sea-Level Scenes (Scenes 03 to 08: 0.17 to 0.68)
  // Absolutely unmounted during orbital scenes to prevent ANY geometric collision or walls!
  const isOceanScene = scrollProgress >= 0.17 && scrollProgress < 0.68;

  // Ripple network active specifically in Scene 11 (0.80 to 0.88)
  const isRippleScene = activeScene === 10;

  // Engineering pipeline active specifically in Scene 12 (0.88 to 0.95)
  const isPipelineScene = activeScene === 11;

  // Determine hero vessel type
  const heroVesselType: RealVesselType = useMemo(() => {
    if (activeScene === 4) return "passenger";
    if (activeScene === 5) return "tanker";
    return "cargo";
  }, [activeScene]);

  return (
    <div className="absolute inset-0 h-full w-full pointer-events-auto">
      <CanvasErrorBoundary>
        <Canvas
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
            powerPreference: "high-performance",
          }}
          dpr={lowPowerMode ? 1 : [1, 2]}
        >
          <ZoomCameraRig scrollProgress={scrollProgress} activeScene={activeScene} />

          {/* Futuristic Cinematic Sun & Ambient Maritime Lighting */}
          <ambientLight intensity={0.5} color="#08182E" />
          <directionalLight position={[28, 32, 22]} intensity={2.1} color="#F4F8FF" castShadow />
          <directionalLight position={[-20, 14, -18]} intensity={0.7} color="#22D3EE" />

          {/* Top-Level Suspense Boundary preventing unhandled suspension */}
          <React.Suspense fallback={null}>
            {/* ========================================================= */}
            {/* 1. ORBITAL DOMAIN: GLOBE, TRADE CORRIDORS, INSTANCED AIS */}
            {/* ========================================================= */}
            {isGlobeVisible && (
              <group>
                <GlobeMesh radius={10} rotationSpeed={0.0006} />

                <TradeRoutes
                  globeRadius={10}
                  highlightCorridors={activeScene === 1}
                />

                <InstancedVessels
                  globeRadius={10}
                  lowPowerMode={lowPowerMode}
                  zoomProgress={scrollProgress < 0.17 ? scrollProgress / 0.17 : 0}
                />
              </group>
            )}

            {/* ========================================================= */}
            {/* 2. SEA-LEVEL DOMAIN: TROCHOIDAL OCEAN, FLEET, PORT, WEATHER */}
            {/* ========================================================= */}
            {isOceanScene && (
              <group>
                {/* Photorealistic Gerstner Ocean (Bounded at y = 0.0, no clipping) */}
                <GerstnerOceanSurface
                  waveHeight={waveHeightMeters}
                  simulateStorm={simulateStorm || activeScene === 7}
                />

                {/* Scenes 03-05: Multi-Vessel Commercial Shipping Corridor */}
                {activeScene >= 2 && activeScene <= 4 && (
                  <MultiVesselCorridor3D
                    heroVesselType={heroVesselType}
                    waveHeight={waveHeightMeters}
                    simulateStorm={simulateStorm || activeScene === 7}
                    showCorridorTraffic={true}
                  />
                )}

                {/* Scene 05: Live Kinematic Course Vectors */}
                {activeScene === 4 && (
                  <ShipCourseVectors
                    activeScene={activeScene}
                    onSelectVessel={onSelectVessel}
                    selectedVesselId={selectedVesselId}
                  />
                )}

                {/* Scenes 06-07: Port Discovery & Congestion Environment */}
                {(activeScene === 5 || activeScene === 6) && (
                  <PortEnvironment3D
                    congestionIndex={1.34}
                    showCongestionRings={activeScene === 6}
                  />
                )}

                {/* Scene 08: Serious Meteorological Weather Risk Layer */}
                {(activeScene === 7 || simulateStorm) && (
                  <MeteorologicalWeather
                    windSpeedKnots={windSpeedKnots}
                    waveHeightMeters={waveHeightMeters}
                    simulateStorm={simulateStorm || activeScene === 7}
                  />
                )}
              </group>
            )}

            {/* ========================================================= */}
            {/* 3. SCENE 11: GLOBAL RIPPLE EFFECT NETWORK */}
            {/* ========================================================= */}
            {isRippleScene && <RippleNetwork3D />}

            {/* ========================================================= */}
            {/* 4. SCENE 12: ENGINEERING & PIPELINE ARCHITECTURE */}
            {/* ========================================================= */}
            {isPipelineScene && <EngineeringPipeline3D />}
          </React.Suspense>

          {/* Cinematic Post-Processing Pipeline */}
          {!lowPowerMode && (
            <EffectComposer multisampling={0}>
              <Bloom
                intensity={0.65}
                luminanceThreshold={0.5}
                luminanceSmoothing={0.4}
                mipmapBlur
              />
              <Vignette eskil={false} offset={0.12} darkness={0.65} />
            </EffectComposer>
          )}
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
