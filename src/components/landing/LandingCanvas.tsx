import React, { useRef, useMemo } from "react";
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

interface LandingCanvasProps {
  scrollProgress: number; // 0.0 to 1.0 from GSAP ScrollTrigger
  activeScene: number; // 0 to 9
  simulateStorm: boolean;
  lowPowerMode: boolean;
  waveHeightMeters?: number;
  windSpeedKnots?: number;
  onSelectVessel?: (vessel: TrackedVessel | null) => void;
  selectedVesselId?: string | null;
}

/**
 * Continuous Zoom Camera Rig:
 * Zoom continuously from whole globe -> region -> sea lane -> ONE specific dot ->
 * resolves into the photoreal 3D ship with rack focus, bloom, and wake reveal!
 */
function ZoomCameraRig({
  scrollProgress,
  activeScene,
}: {
  scrollProgress: number;
  activeScene: number;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(({ clock }) => {
    if (!cameraRef.current) return;
    const t = clock.getElapsedTime();
    const p = Math.max(0, Math.min(1, scrollProgress));

    let targetCamPos = new THREE.Vector3(0, 8, 30);
    let targetLookAt = new THREE.Vector3(0, 0, 0);

    if (p < 0.10) {
      // Scene 01: Whole Globe (0.00 - 0.10)
      const tScene = p / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 8, 30), new THREE.Vector3(0, 6.8, 25), tScene);
      targetLookAt.set(0, 0, 0);
    } else if (p < 0.20) {
      // Scene 02: Zoom to European/North Sea Region (0.10 - 0.20)
      const tScene = (p - 0.10) / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(0, 6.8, 25), new THREE.Vector3(2.2, 8.8, 16.0), tScene);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.8, 4.5, 4.0), tScene);
    } else if (p < 0.30) {
      // Scene 03: Zoom to Sea Lane / Rotterdam Approach (0.20 - 0.30)
      const tScene = (p - 0.20) / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(2.2, 8.8, 16.0), new THREE.Vector3(1.6, 9.2, 10.5), tScene);
      targetLookAt.lerpVectors(new THREE.Vector3(0.8, 4.5, 4.0), new THREE.Vector3(0.45, 7.87, 6.15), tScene);
    } else if (p < 0.40) {
      // Scene 04: Anchorage & Thinning Dots around the ONE Hero Vessel (0.30 - 0.40)
      const tScene = (p - 0.30) / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(1.6, 9.2, 10.5), new THREE.Vector3(1.0, 8.5, 7.8), tScene);
      targetLookAt.set(0.45, 7.87, 6.15);
    } else if (p < 0.50) {
      // Scene 05: Cinematic Reveal - Dot resolves into Photoreal 3D Ship & Ocean (0.40 - 0.50)
      const tScene = (p - 0.40) / 0.10;
      // Rack focus & orbit transition around the ship
      const orbitAngle = tScene * Math.PI * 0.4 + t * 0.08;
      const camDist = 6.2 - tScene * 1.4;
      targetCamPos.set(
        Math.sin(orbitAngle) * camDist + 1.2,
        2.2 + Math.cos(orbitAngle) * 0.6,
        Math.cos(orbitAngle) * camDist + 1.5
      );
      targetLookAt.set(0, 0.9, 0);
    } else if (p < 0.60) {
      // Scene 06: Cargo Ship (Container) - Slow Orbit
      const orbitAngle = (p - 0.50) * Math.PI * 1.5 + t * 0.12;
      targetCamPos.set(Math.sin(orbitAngle) * 5.4, 2.0, Math.cos(orbitAngle) * 5.4);
      targetLookAt.set(0, 1.0, 0);
    } else if (p < 0.70) {
      // Scene 07: Passenger Ship (Cruise / Ferry) - Slow Tracking Shot
      const orbitAngle = (p - 0.60) * Math.PI * 1.5 + t * 0.12;
      targetCamPos.set(Math.sin(orbitAngle) * 5.8, 2.4, Math.cos(orbitAngle) * 5.8);
      targetLookAt.set(0, 1.2, 0);
    } else if (p < 0.80) {
      // Scene 08: Tanker - Midships Low Angle
      const orbitAngle = (p - 0.70) * Math.PI * 1.5 + t * 0.1;
      targetCamPos.set(Math.sin(orbitAngle) * 5.5, 1.8, Math.cos(orbitAngle) * 5.5);
      targetLookAt.set(0, 0.8, 0);
    } else if (p < 0.90) {
      // Scene 09: Meteorological Weather Risk - Cinematic Elevation Shot
      const tScene = (p - 0.80) / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(4.8, 3.2, 6.2), new THREE.Vector3(5.5, 4.6, 8.5), tScene);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(1.2, 0.4, -0.5), tScene);
    } else {
      // Scene 10: History & Validation - Overview Angle
      const tScene = (p - 0.90) / 0.10;
      targetCamPos.lerpVectors(new THREE.Vector3(5.5, 4.6, 8.5), new THREE.Vector3(3.8, 3.2, 7.2), tScene);
      targetLookAt.set(0, 0.8, 0);
    }

    cameraRef.current.position.lerp(targetCamPos, 0.08);
    cameraRef.current.lookAt(targetLookAt);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={38} position={[0, 8, 30]} />;
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
  // Globe is visible in Scenes 01 to 04 (0.00 to 0.42)
  const isGlobeVisible = scrollProgress < 0.45;
  // Geofence polygons visible in Scenes 03, 04 (0.20 to 0.45)
  const isGeofenceVisible = scrollProgress >= 0.18 && scrollProgress < 0.45;

  // Ocean surface & 3D real ships visible in Scenes 05 to 10 (0.40 to 1.0)
  const isOceanScene = scrollProgress >= 0.38;

  // Ocean surface opacity fades in smoothly during the Scene 05 reveal (0.38 - 0.46)
  const oceanFade = Math.min(1.0, Math.max(0.0, (scrollProgress - 0.38) / 0.08));

  // Determine current vessel type based on active scene:
  // Scene 05 (hero reveal) -> cargo
  // Scene 06 (cargo scene) -> cargo
  // Scene 07 (passenger scene) -> passenger
  // Scene 08 (tanker scene) -> tanker
  // Scene 09 (weather) -> cargo
  // Scene 10 (history) -> cargo
  const currentVesselType: RealVesselType = useMemo(() => {
    if (activeScene === 6) return "passenger";
    if (activeScene === 7) return "tanker";
    return "cargo";
  }, [activeScene]);

  // Is meteorological weather layer active in Scene 09 or if simulateStorm is toggled
  const isWeatherLayerActive = activeScene === 8 || simulateStorm;

  return (
    <div className="absolute inset-0 h-full w-full pointer-events-auto">
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
        <ambientLight intensity={0.4} color="#0c1726" />
        <directionalLight position={[25, 30, 20]} intensity={1.9} color="#fff8e7" castShadow />
        <directionalLight position={[-20, 15, -20]} intensity={0.5} color="#e8a33d" />

        {/* --- SCENES 01 to 04: GLOBE & TINY INSTANCED VESSELS --- */}
        {isGlobeVisible && (
          <group>
            {/* Dark Earth with NASA Black Marble & specular oceans */}
            <GlobeMesh radius={10} rotationSpeed={0.0006} />

            {/* Glowing Trade Corridors */}
            <TradeRoutes globeRadius={10} />

            {/* Tiny Points of Light (1-2px, amber/coral/mint) */}
            <InstancedVessels
              globeRadius={10}
              lowPowerMode={lowPowerMode}
              zoomProgress={Math.max(0, (scrollProgress - 0.2) / 0.22)}
            />

            {/* Geofence Polygons on Water in Rotterdam Approach */}
            {isGeofenceVisible && (
              <GeofencePolygons
                globeRadius={10}
                activePortId="rotterdam"
                opacity={Math.min(1, (scrollProgress - 0.18) * 8)}
              />
            )}
          </group>
        )}

        {/* --- SCENES 05 to 10: GERSTNER OCEAN SURFACE & REAL 3D SHIP REVEAL --- */}
        {isOceanScene && (
          <group>
            {/* True Trochoidal Gerstner Wave Ocean */}
            <GerstnerOceanSurface
              waveHeight={waveHeightMeters}
              simulateStorm={simulateStorm}
            />

            {/* Real GLTF 3D Vessel with PBR materials, wake foam, and navigation lights */}
            <RealVessel3D
              vesselType={currentVesselType}
              position={[0, 0, 0]}
              waveHeight={waveHeightMeters}
              showHud={activeScene >= 4 && activeScene <= 7}
              speedKnots={currentVesselType === "cargo" ? 17.6 : currentVesselType === "passenger" ? 21.0 : 13.8}
            />

            {/* Scene 05: Course vectors, COG, fading historical tracks, and dead-reckoning projected paths */}
            {activeScene === 4 && (
              <ShipCourseVectors
                activeScene={activeScene}
                onSelectVessel={onSelectVessel}
                selectedVesselId={selectedVesselId}
              />
            )}

            {/* Scene 09: Meteorological Weather Visualization */}
            {isWeatherLayerActive && (
              <MeteorologicalWeather
                windSpeedKnots={windSpeedKnots}
                waveHeightMeters={waveHeightMeters}
                simulateStorm={simulateStorm}
              />
            )}
          </group>
        )}

        {/* Filmic ACES Post-Processing & Bloom */}
        <EffectComposer multisampling={lowPowerMode ? 0 : 4}>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.4}
            luminanceSmoothing={0.85}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.12} darkness={0.88} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
