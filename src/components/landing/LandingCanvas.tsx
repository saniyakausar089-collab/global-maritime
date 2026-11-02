import React, { Component, useRef, useMemo, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

import { GlobeMesh } from "./GlobeMesh";
import { TradeRoutes } from "./TradeRoutes";
import { InstancedVessels } from "./InstancedVessels";
import { GeofencePolygons } from "./GeofencePolygons";
import { RealVessel3D, type RealVesselType } from "./RealVessel3D";
import { GerstnerOceanSurface } from "./GerstnerOceanSurface";
import { MeteorologicalWeather } from "./MeteorologicalWeather";
import { ShipCourseVectors, type TrackedVessel } from "./ShipCourseVectors";
import { CongestionRings } from "./CongestionRings";

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
 * Continuous 13-Scene Cinematic Camera Rig:
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

    const targetCamPos = new THREE.Vector3(0, 8, 30);
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    if (p < 0.077) {
      // Scene 01: Awakening of Earth (0.00 - 0.077)
      const u = p / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 11, 35), new THREE.Vector3(0, 7.8, 28), u);
      targetLookAt.set(0, 0, 0);
    } else if (p < 0.154) {
      // Scene 02: Global Trade Network (0.077 - 0.154)
      const u = (p - 0.077) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 7.8, 28), new THREE.Vector3(4.5, 7.2, 22.0), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 1.2, 0), u);
    } else if (p < 0.231) {
      // Scene 03: The Living Ocean (0.154 - 0.231)
      const u = (p - 0.154) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(4.5, 7.2, 22.0), new THREE.Vector3(2.0, 5.2, 10.5), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0.6, 1.2, 0), new THREE.Vector3(0, 1.0, 0), u);
    } else if (p < 0.308) {
      // Scene 04: The Vessel Reveal (0.231 - 0.308)
      const u = (p - 0.231) / 0.077;
      const orbitAngle = u * Math.PI * 0.4 + t * 0.08;
      const camDist = 6.0 - u * 0.8;
      targetCamPos.set(
        Math.sin(orbitAngle) * camDist + 0.8,
        2.2 + Math.cos(orbitAngle) * 0.4,
        Math.cos(orbitAngle) * camDist + 1.2
      );
      targetLookAt.set(0, 1.0, 0);
    } else if (p < 0.385) {
      // Scene 05: Live Fleet Tracking (0.308 - 0.385)
      const u = (p - 0.308) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(2.5, 3.2, 6.2), new THREE.Vector3(4.8, 4.0, 7.5), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(0.5, 1.0, 0), u);
    } else if (p < 0.462) {
      // Scene 06: The Port Discovery & Geofencing (0.385 - 0.462)
      const u = (p - 0.385) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(3.2, 7.2, 9.8), new THREE.Vector3(1.8, 6.2, 8.5), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0.5, 0.8, 0), new THREE.Vector3(0.2, 0.8, 0), u);
    } else if (p < 0.538) {
      // Scene 07: Port Congestion Intelligence (0.462 - 0.538)
      const u = (p - 0.462) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(1.8, 6.2, 8.5), new THREE.Vector3(1.2, 5.6, 7.5), u);
      targetLookAt.set(0.2, 0.8, 0);
    } else if (p < 0.615) {
      // Scene 08: Weather Risk Intelligence (0.538 - 0.615)
      const u = (p - 0.538) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(1.2, 5.6, 7.5), new THREE.Vector3(4.8, 3.4, 8.2), u);
      targetLookAt.lerpVectors(new THREE.Vector3(0.2, 0.8, 0), new THREE.Vector3(1.0, 0.5, -0.6), u);
    } else if (p < 0.692) {
      // Scene 09: The Temporal Digital Twin (0.615 - 0.692)
      const u = (p - 0.615) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(4.8, 3.4, 8.2), new THREE.Vector3(3.8, 6.8, 23.0), u);
      targetLookAt.lerpVectors(new THREE.Vector3(1.0, 0.5, -0.6), new THREE.Vector3(0, 0, 0), u);
    } else if (p < 0.769) {
      // Scene 10: Time Machine Intelligence Suite (0.692 - 0.769)
      const u = (p - 0.692) / 0.077;
      const angle = u * Math.PI * 0.3 + t * 0.05;
      targetCamPos.set(Math.sin(angle) * 23.0, 6.8, Math.cos(angle) * 23.0);
      targetLookAt.set(0, 0, 0);
    } else if (p < 0.846) {
      // Scene 11: Global Ripple Effect (0.769 - 0.846)
      const u = (p - 0.769) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(3.8, 6.8, 23.0), new THREE.Vector3(5.2, 8.2, 26.0), u);
      targetLookAt.set(0, 0, 0);
    } else if (p < 0.923) {
      // Scene 12: Engineering & Pipeline (0.846 - 0.923)
      const u = (p - 0.846) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(5.2, 8.2, 26.0), new THREE.Vector3(2.5, 7.5, 27.0), u);
      targetLookAt.set(0, 0, 0);
    } else {
      // Scene 13: Enter the Global Control Centre (0.923 - 1.000)
      const u = (p - 0.923) / 0.077;
      targetCamPos.lerpVectors(new THREE.Vector3(2.5, 7.5, 27.0), new THREE.Vector3(0, 8.0, 28.0), u);
      targetLookAt.set(0, 0, 0);
    }

    cameraRef.current.position.lerp(targetCamPos, 0.08);
    cameraRef.current.lookAt(targetLookAt);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={38} position={[0, 11, 35]} />;
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
  // Globe is visible in orbital scenes (Scenes 01-02, and Scenes 09-13)
  const isGlobeVisible = scrollProgress < 0.20 || scrollProgress >= 0.61;

  // Ocean surface & 3D real ships visible during sea-level scenes (Scenes 03-08)
  const isOceanScene = scrollProgress >= 0.15 && scrollProgress < 0.65;

  // Geofence polygons visible in Scenes 06 & 07 (Port approach & congestion)
  const isGeofenceVisible = scrollProgress >= 0.35 && scrollProgress < 0.54;

  // Congestion rings active in Scene 07
  const isCongestionRingsVisible = scrollProgress >= 0.44 && scrollProgress < 0.54;

  // Meteorological weather layer active in Scene 08 or if simulateStorm is toggled
  const isWeatherLayerActive = activeScene === 7 || simulateStorm;

  // Ripple effect corridor glow active in Scene 11
  const isRipplePulse = activeScene === 10;

  // Real ship type representation across vessel scenes
  const currentVesselType: RealVesselType = useMemo(() => {
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

          {/* Ambient & Directional Sun/Moon Lighting */}
          <ambientLight intensity={0.45} color="#07182A" />
          <directionalLight position={[25, 30, 20]} intensity={1.9} color="#F2F6FA" castShadow />
          <directionalLight position={[-20, 15, -20]} intensity={0.6} color="#36C5E8" />

          {/* Top-Level Suspense Boundary preventing unhandled suspension */}
          <React.Suspense fallback={null}>
            {/* --- ORBITAL SCENES: GLOBE, TRADE CORRIDORS, INSTANCED VESSELS --- */}
            {isGlobeVisible && (
              <group>
                {/* NASA Black Marble night Earth with thin cyan atmosphere */}
                <GlobeMesh radius={10} rotationSpeed={0.0006} />

                {/* Luminous Great-Circle Trade Routes */}
                <TradeRoutes
                  globeRadius={10}
                  highlightCorridors={isRipplePulse}
                />

                {/* 1-2px Luminous Vessel Points */}
                <InstancedVessels
                  globeRadius={10}
                  lowPowerMode={lowPowerMode}
                  zoomProgress={scrollProgress < 0.18 ? scrollProgress / 0.18 : 0}
                />
              </group>
            )}

            {/* --- SEA-LEVEL SCENES: TROCHOIDAL GERSTNER OCEAN & 3D VESSEL --- */}
            {isOceanScene && (
              <group>
                {/* True Trochoidal Gerstner Wave Water Shader */}
                <GerstnerOceanSurface
                  waveHeight={waveHeightMeters}
                  simulateStorm={simulateStorm || activeScene === 7}
                />

                {/* Authentic 3D Ship Model (Container / Passenger / Tanker) */}
                <RealVessel3D
                  vesselType={currentVesselType}
                  position={[0, 0, 0]}
                  waveHeight={waveHeightMeters}
                  speedKnots={currentVesselType === "cargo" ? 17.6 : currentVesselType === "passenger" ? 21.0 : 13.8}
                  showHud={activeScene >= 3 && activeScene <= 6}
                />

                {/* Kinematic Course Vectors & Track Trails */}
                {(activeScene === 3 || activeScene === 4) && (
                  <ShipCourseVectors
                    activeScene={activeScene}
                    onSelectVessel={onSelectVessel}
                    selectedVesselId={selectedVesselId}
                  />
                )}

                {/* Polygonal Geofences in Port Approach (Berth = Cyan, Anchorage = Amber) */}
                {isGeofenceVisible && (
                  <GeofencePolygons
                    globeRadius={10}
                    activePortId="rotterdam"
                    opacity={Math.min(1, (scrollProgress - 0.35) * 8)}
                  />
                )}

                {/* Pulsing Congestion Rings when CI > 1.2 */}
                {isCongestionRingsVisible && (
                  <CongestionRings
                    lat={51.92}
                    lon={4.17}
                    congestionIndex={1.34}
                    visible={true}
                  />
                )}

                {/* Serious Meteorological Weather Layer */}
                {isWeatherLayerActive && (
                  <MeteorologicalWeather
                    windSpeedKnots={windSpeedKnots}
                    waveHeightMeters={waveHeightMeters}
                    simulateStorm={simulateStorm || activeScene === 7}
                  />
                )}
              </group>
            )}
          </React.Suspense>

          {/* Cinematic Post-Processing Pipeline */}
          {!lowPowerMode && (
            <EffectComposer multisampling={0}>
              <Bloom
                intensity={0.65}
                luminanceThreshold={0.55}
                luminanceSmoothing={0.35}
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
