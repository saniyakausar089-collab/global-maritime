import React, { Component, useRef, useMemo, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

import { GlobeMesh } from "./GlobeMesh";
import { TradeRoutes } from "./TradeRoutes";
import { InstancedVessels } from "./InstancedVessels";
import { CinematicPhotorealisticStage } from "./CinematicPhotorealisticStage";
import type { TrackedVessel } from "./ShipCourseVectors";

export interface LandingCanvasProps {
  scrollProgress: number; // 0.0 to 1.0 from GSAP ScrollTrigger
  activeScene: number; // 0 to 7
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
    console.error("[LandingCanvas] WebGL 3D Globe Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * Opening Globe Camera Rig:
 * Smooth, beloved opening orbital rotation and zoom-in toward the ocean surface.
 */
function GlobeCameraRig({
  scrollProgress,
}: {
  scrollProgress: number;
  activeScene: number;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (!cameraRef.current) return;
    const p = Math.max(0, Math.min(1, scrollProgress));

    const targetCamPos = new THREE.Vector3(0, 9.5, 30);
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    if (p < 0.125) {
      // Scene 01: Planetary Awakening (Orbit)
      const u = p / 0.125;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 9.5, 30), new THREE.Vector3(0, 7.5, 26), u);
      targetLookAt.set(0, 0, 0);
    } else if (p < 0.25) {
      // Scene 02: Global Trade Corridors Zoom-In
      const u = (p - 0.125) / 0.125;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 7.5, 26), new THREE.Vector3(3.8, 4.5, 16.0), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0.5, 0), u);
    } else {
      // Deep ocean penetration transition
      targetCamPos.set(3.8, 3.5, 12.0);
      targetLookAt.set(0.5, 0.2, 0);
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
}: LandingCanvasProps) {
  // Opening Globe is active and visible in the opening scenes (p < 0.26)
  const isGlobeVisible = scrollProgress < 0.26;
  const globeOpacity = scrollProgress < 0.20 ? 1 : Math.max(0, 1 - (scrollProgress - 0.20) / 0.06);

  return (
    <div className="absolute inset-0 h-full w-full pointer-events-auto bg-[#080F20]">
      {/* ========================================================================= */}
      {/* 1. BELOVED OPENING GLOBE: KEPT 100% INTACT AT THE START                   */}
      {/* ========================================================================= */}
      {isGlobeVisible && (
        <div
          className="absolute inset-0 h-full w-full transition-opacity duration-500 ease-out z-20 pointer-events-none"
          style={{ opacity: globeOpacity }}
        >
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
              <GlobeCameraRig scrollProgress={scrollProgress} activeScene={activeScene} />

              {/* Cinematic Lighting for Globe */}
              <ambientLight intensity={0.55} color="#08182E" />
              <directionalLight position={[28, 32, 22]} intensity={2.2} color="#F4F8FF" castShadow />
              <directionalLight position={[-20, 14, -18]} intensity={0.7} color="#22D3EE" />

              <React.Suspense fallback={null}>
                <group>
                  <GlobeMesh radius={10} rotationSpeed={0.0006} />

                  <TradeRoutes
                    globeRadius={10}
                    highlightCorridors={activeScene === 1}
                  />

                  <InstancedVessels
                    globeRadius={10}
                    lowPowerMode={lowPowerMode}
                    zoomProgress={scrollProgress < 0.24 ? scrollProgress / 0.24 : 0}
                  />
                </group>
              </React.Suspense>

              {/* Bloom & Vignette for the globe */}
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
      )}

      {/* ========================================================================= */}
      {/* 2. CINEMATIC PHOTOREALISTIC MARITIME STAGE AFTER GLOBE ZOOM              */}
      {/* Replaces childish/toy-like 3D ship models with high-res commercial imagery */}
      {/* ========================================================================= */}
      <CinematicPhotorealisticStage
        scrollProgress={scrollProgress}
        activeScene={activeScene}
        simulateStorm={simulateStorm}
      />
    </div>
  );
}
