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
import { RealVessel3D, type RealVesselType } from "./RealVessel3D";
import { MeteorologicalWeather } from "./MeteorologicalWeather";
import { TimePortalTunnel3D } from "./TimePortalTunnel3D";
import { PortCongestionGlobeBeacons } from "./PortCongestionGlobeBeacons";
import type { TrackedVessel } from "./ShipCourseVectors";

export interface LandingCanvasProps {
  scrollProgress: number; // 0.0 to 1.0 from GSAP ScrollTrigger
  activeScene: number; // 0 to 9
  simulateStorm: boolean;
  lowPowerMode: boolean;
  waveHeightMeters?: number;
  windSpeedKnots?: number;
  onSelectVessel?: (vessel: TrackedVessel | null) => void;
  selectedVesselId?: string | null;
  portsData?: Array<{ id: string; name: string; congestion_index?: number | null }>;
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
    console.warn("[LandingCanvas] 3D Canvas Error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * Permanent Ambient Sky / Space Environment Dome
 * Guarantees that the canvas background is NEVER a black void, even if sub-assets load.
 */
function AmbientMaritimeEnvironment() {
  const starsRef = useRef<THREE.Points>(null);

  const starGeo = useMemo(() => {
    const count = 600;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 60 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 5; // keep above horizon
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (starsRef.current) {
      starsRef.current.rotation.y = clock.getElapsedTime() * 0.005;
    }
  });

  return (
    <group>
      <points ref={starsRef} geometry={starGeo}>
        <pointsMaterial
          size={0.6}
          color="#38BDF8"
          transparent
          opacity={0.45}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/**
 * 10-Scene Cinematic Camera Rig with Physical Continuous Travel:
 * 1. Slow globe orbit in deep space (Earth fills the frame)
 * 2. Smooth zoom and dive through atmosphere down to commercial shipping lanes
 * 3. Cinematic storm orbit around the cyclone, sweeping near affected vessels
 * 4. Portal entry and physical flight through the relativistic time warp tunnel to calm ocean
 * 5. Global map pullback to planetary orbit showing the 6 illuminated port congestion beacons
 * 6. Ocean dive displaying Cargo, Passenger, and Tanker ships simultaneously in ONE FRAME
 * 7. Close-up inspection of the Cargo container carrier
 * 8. Low-angle track across the Passenger cruise liner with visible walking passengers
 * 9. Close-up inspection of the Tanker ship manifold and industrial piping
 * 10. Final cinematic pullback as routes converge to a brilliant point of light
 */
function Cinematic10SceneCameraRig({
  scrollProgress,
}: {
  scrollProgress: number;
  activeScene: number;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (!cameraRef.current) return;
    const p = Math.max(0, Math.min(1, Number.isFinite(scrollProgress) ? scrollProgress : 0));

    const targetCamPos = new THREE.Vector3(0, 5.5, 22.0);
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    if (p < 0.10) {
      // Scene 00: The Awakening of Earth (0.00 - 0.10) - Slow Majestic Planetary Orbit
      const u = p / 0.10;
      const angle = 0.22 + u * 0.32;
      const radius = 22.5 - u * 1.5;
      targetCamPos.set(Math.sin(angle) * radius, 4.5 + Math.cos(u * Math.PI) * 0.8, Math.cos(angle) * radius);
      targetLookAt.set(0, 0, 0);
    } else if (p < 0.20) {
      // Scene 01: Global Shipping Network (0.10 - 0.20) - Smooth Dive from Orbit to Fairway
      const u = (p - 0.10) / 0.10;
      const startPos = new THREE.Vector3(Math.sin(0.54) * 21.0, 5.3, Math.cos(0.54) * 21.0);
      const endPos = new THREE.Vector3(2.5, 3.6, 9.5);
      targetCamPos.lerpVectors(startPos, endPos, u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.2, 0), u);
    } else if (p < 0.30) {
      // Scene 02: Weather Risk Intelligence (0.20 - 0.30) - Cinematic Cyclone Orbit
      const u = (p - 0.20) / 0.10;
      const startPos = new THREE.Vector3(2.5, 3.6, 9.5);
      const endPos = new THREE.Vector3(8.2, 4.8, 5.2);
      targetCamPos.lerpVectors(startPos, endPos, u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(3.5, 1.8, -2.0), u);
    } else if (p < 0.40) {
      // Scene 03: The Time Machine (0.30 - 0.40) - Physical Portal Entry & Transit to Calm Ocean
      const u = (p - 0.30) / 0.10;
      const startPos = new THREE.Vector3(8.2, 4.8, 5.2);
      const tunnelEntry = new THREE.Vector3(0, 3.2, 7.5);
      const tunnelExit = new THREE.Vector3(0, 2.6, -18.5);

      if (u < 0.35) {
        // Approach and line up with portal ring
        const subU = u / 0.35;
        targetCamPos.lerpVectors(startPos, tunnelEntry, subU);
        targetLookAt.lerpVectors(new THREE.Vector3(3.5, 1.8, -2.0), new THREE.Vector3(0, 3.2, -10.0), subU);
      } else {
        // Fly directly through tunnel into calm future ocean
        const subU = (u - 0.35) / 0.65;
        targetCamPos.lerpVectors(tunnelEntry, tunnelExit, subU);
        targetLookAt.lerpVectors(new THREE.Vector3(0, 3.2, -10.0), new THREE.Vector3(0, 2.2, -26.0), subU);
      }
    } else if (p < 0.50) {
      // Scene 04: Global Port Congestion Comparison (0.40 - 0.50) - Global Map Pullback
      const u = (p - 0.40) / 0.10;
      const startPos = new THREE.Vector3(0, 2.6, -18.5);
      const orbitPos = new THREE.Vector3(3.2, 8.0, 22.5);
      targetCamPos.lerpVectors(startPos, orbitPos, u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 2.2, -26.0), new THREE.Vector3(0, 0, 0), u);
    } else if (p < 0.60) {
      // Scene 05: Three Types of Ships (0.50 - 0.60) - Ocean Dive to All 3 Vessels
      const u = (p - 0.50) / 0.10;
      const orbitPos = new THREE.Vector3(3.2, 8.0, 22.5);
      const fleetWidePos = new THREE.Vector3(0, 5.2, 19.5);
      targetCamPos.lerpVectors(orbitPos, fleetWidePos, u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.4, 0), u);
    } else if (p < 0.70) {
      // Scene 06: Cargo Ship (0.60 - 0.70) - Close-up Sweep of Container Carrier
      const u = (p - 0.60) / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 5.2, 19.5), new THREE.Vector3(3.5, 2.6, 6.5), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.4, 0), u);
    } else if (p < 0.80) {
      // Scene 07: Passenger Ship (0.70 - 0.80) - Track to Cruise Liner with Visible Passengers
      const u = (p - 0.70) / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(3.5, 2.6, 6.5), new THREE.Vector3(-6.8, 2.8, -1.8), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(-9.5, 1.8, -5.5), u);
    } else if (p < 0.90) {
      // Scene 08: Tanker Ship (0.80 - 0.90) - Track to Crude Tanker Manifold
      const u = (p - 0.80) / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(-6.8, 2.8, -1.8), new THREE.Vector3(7.2, 2.8, -2.2), u);
      targetLookAt.lerpVectors(new THREE.Vector3(-9.5, 1.8, -5.5), new THREE.Vector3(9.8, 1.6, -5.8), u);
    } else {
      // Scene 09: Final Cinematic Experience (0.90 - 1.00) - Pullback & Route Convergence
      const u = (p - 0.90) / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(7.2, 2.8, -2.2), new THREE.Vector3(0, 14.0, 34.0), u);
      targetLookAt.lerpVectors(new THREE.Vector3(9.8, 1.6, -5.8), new THREE.Vector3(0, 1.0, 0), u);
    }

    cameraRef.current.position.lerp(targetCamPos, 0.08);
    cameraRef.current.lookAt(targetLookAt);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={38} position={[0, 5.5, 22.0]} />;
}

export function LandingCanvas({
  scrollProgress,
  activeScene,
  simulateStorm,
  lowPowerMode,
  waveHeightMeters = 1.8,
  portsData,
}: LandingCanvasProps) {
  // Canonical Scene Domain Visibility:
  // Orbital Globe: Scene 0 (Awakening) & Scene 4 (Port Congestion)
  // Sea-Level Ocean: Scenes 1, 2, 3, 5, 6, 7, 8
  // Finale: Scene 9 (Mission Control Convergence)
  const isGlobeVisible = activeScene === 0 || activeScene === 4;
  const isOceanVisible = activeScene >= 1 && activeScene <= 8;
  const isFinaleVisible = activeScene === 9;

  return (
    <div className="absolute inset-0 h-full w-full pointer-events-auto bg-[#080F20]">
      <CanvasErrorBoundary>
        <Canvas
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.25,
            powerPreference: "high-performance",
          }}
          dpr={lowPowerMode ? 1 : [1, 2]}
        >
          <Cinematic10SceneCameraRig scrollProgress={scrollProgress} activeScene={activeScene} />

          {/* Futuristic Cinematic Sun & Ambient Maritime Lighting */}
          <ambientLight intensity={0.65} color="#08182E" />
          <directionalLight position={[28, 32, 22]} intensity={2.6} color="#F4F8FF" castShadow />
          <directionalLight position={[-20, 14, -18]} intensity={0.9} color="#22D3EE" />

          {/* Permanent Ambient Maritime Environment (Never a black void) */}
          <AmbientMaritimeEnvironment />

          {/* ========================================================= */}
          {/* 1. GLOBE DOMAIN: Scenes 00 & 04                           */}
          {/* ========================================================= */}
          {isGlobeVisible && (
            <group>
              <GlobeMesh radius={10} rotationSpeed={0.0006} />

              <TradeRoutes
                globeRadius={10}
                highlightCorridors={activeScene === 4}
              />

              <InstancedVessels
                globeRadius={10}
                lowPowerMode={lowPowerMode}
                zoomProgress={scrollProgress < 0.12 ? scrollProgress / 0.12 : 0}
              />

              {/* Scene 04: Global Port Congestion Illuminated Beacons */}
              {activeScene === 4 && (
                <PortCongestionGlobeBeacons globeRadius={10} portsData={portsData} />
              )}
            </group>
          )}

          {/* ========================================================= */}
          {/* 2. SEA-LEVEL DOMAIN: Scenes 01, 02, 03, 05, 06, 07, 08    */}
          {/* ========================================================= */}
          {isOceanVisible && (
            <group>
              {/* Photorealistic Gerstner Ocean Surface */}
              <GerstnerOceanSurface
                waveHeight={activeScene === 2 || simulateStorm ? 4.5 : waveHeightMeters}
                simulateStorm={simulateStorm || activeScene === 2}
              />

              {/* Scene 01: Global Shipping Network (Multiple ships in motion) */}
              {activeScene === 1 && (
                <MultiVesselCorridor3D
                  heroVesselType="cargo"
                  waveHeight={waveHeightMeters}
                  showCorridorTraffic={true}
                />
              )}

              {/* Scene 02: Weather Risk Intelligence (Rotating Cyclone, Rain, Danger Zones) */}
              {activeScene === 2 && (
                <MeteorologicalWeather
                  windSpeedKnots={48.0}
                  waveHeightMeters={5.8}
                  simulateStorm={true}
                />
              )}

              {/* Scene 03: The Time Machine (Warp Tunnel & Portal to Calm Ocean) */}
              {activeScene === 3 && (
                <TimePortalTunnel3D progress={0.5} />
              )}

              {/* Scene 05: Three Types of Ships (Cargo, Passenger, Tanker in ONE Frame) */}
              {activeScene === 5 && (
                <MultiVesselCorridor3D
                  showAllThreeVessels={true}
                  waveHeight={waveHeightMeters}
                />
              )}

              {/* Scene 06: Cargo Ship Individual Deep-Dive */}
              {activeScene === 6 && (
                <RealVessel3D
                  vesselType="cargo"
                  position={[0, 0, 0]}
                  waveHeight={waveHeightMeters}
                  speedKnots={18.4}
                />
              )}

              {/* Scene 07: Passenger Luxury Cruise Ship (Visible People on Deck) */}
              {activeScene === 7 && (
                <RealVessel3D
                  vesselType="passenger"
                  position={[-9.5, 0, -5.5]}
                  waveHeight={waveHeightMeters}
                  speedKnots={21.4}
                />
              )}

              {/* Scene 08: Massive Crude Oil Tanker */}
              {activeScene === 8 && (
                <RealVessel3D
                  vesselType="tanker"
                  position={[9.8, 0, -5.8]}
                  waveHeight={waveHeightMeters}
                  speedKnots={13.6}
                />
              )}
            </group>
          )}

          {/* ========================================================= */}
          {/* 3. FINALE DOMAIN: Scene 09 (Hero Horizon & Trade Nexus)   */}
          {/* ========================================================= */}
          {isFinaleVisible && (
            <group position={[0, 0, 0]}>
              {/* Dramatic Curved Earth Horizon in Lower Viewport */}
              <group position={[0, -13.5, 8.0]}>
                <GlobeMesh radius={15} rotationSpeed={0.0003} />
                <TradeRoutes globeRadius={15.02} highlightCorridors={true} />
              </group>

              {/* Converging Luminous Trade Nexus */}
              <pointLight color="#22D3EE" intensity={25} distance={55} position={[0, 6.5, 5]} />
              <pointLight color="#818CF8" intensity={15} distance={35} position={[0, 4.0, 5]} />

              <mesh position={[0, 5.0, 4]}>
                <sphereGeometry args={[0.65, 32, 32]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  emissive="#22D3EE"
                  emissiveIntensity={4.8}
                />
              </mesh>

              {/* Radial Energy Wave Rings */}
              <mesh position={[0, 2.2, 4]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.5, 14.0, 48]} />
                <meshBasicMaterial
                  color="#22D3EE"
                  transparent
                  opacity={0.35}
                  side={THREE.DoubleSide}
                />
              </mesh>

              <mesh position={[0, 2.3, 4]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[14.0, 26.0, 48]} />
                <meshBasicMaterial
                  color="#818CF8"
                  transparent
                  opacity={0.2}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          )}

          {/* Post-Processing Bloom & Vignette */}
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
