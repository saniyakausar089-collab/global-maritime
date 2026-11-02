import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { ContainerShipModel } from "./models/ContainerShipModel";
import { TankerShipModel } from "./models/TankerShipModel";
import { BulkCarrierModel } from "./models/BulkCarrierModel";
import { RealVessel3D, type RealVesselType } from "./RealVessel3D";

interface MultiVesselCorridor3DProps {
  heroVesselType?: RealVesselType;
  waveHeight?: number;
  simulateStorm?: boolean;
  showCorridorTraffic?: boolean;
}

/**
 * Multi-Vessel Commercial Shipping Corridor.
 * Arranges realistic commercial vessels across multiple depth planes:
 * - Foreground: Hero vessel (Container, Tanker, or Passenger)
 * - Mid-distance port: Panamax Bulk Carrier steaming parallel
 * - Mid-distance starboard: Loaded Crude Oil Tanker
 * - Horizon background: General Cargo and feeder container vessels with navigation lanterns
 */
export function MultiVesselCorridor3D({
  heroVesselType = "cargo",
  waveHeight = 1.8,
  simulateStorm = false,
  showCorridorTraffic = true,
}: MultiVesselCorridor3DProps) {
  const midPortRef = useRef<THREE.Group>(null);
  const midStbdRef = useRef<THREE.Group>(null);
  const bgFeederRef = useRef<THREE.Group>(null);
  const bgCargoRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const seaMotion = Math.min(2.0, Math.max(0.4, waveHeight * 0.4));

    // Mid-distance Port Bulk Carrier: gentle surge and slow progress
    if (midPortRef.current) {
      midPortRef.current.position.y = Math.sin(t * 1.3 + 1.2) * (0.04 * seaMotion);
      midPortRef.current.rotation.z = Math.sin(t * 1.1 + 0.5) * (0.015 * seaMotion);
      midPortRef.current.rotation.x = Math.cos(t * 0.8 + 1.0) * (0.010 * seaMotion);
    }

    // Mid-distance Starboard Tanker
    if (midStbdRef.current) {
      midStbdRef.current.position.y = Math.sin(t * 1.2 + 2.5) * (0.035 * seaMotion);
      midStbdRef.current.rotation.z = Math.sin(t * 0.9 + 2.0) * (0.012 * seaMotion);
      midStbdRef.current.rotation.x = Math.cos(t * 0.7 + 0.3) * (0.008 * seaMotion);
    }

    // Background vessels: subtle pitch/heave
    if (bgFeederRef.current) {
      bgFeederRef.current.position.y = Math.sin(t * 1.4 + 3.0) * 0.03;
    }
    if (bgCargoRef.current) {
      bgCargoRef.current.position.y = Math.sin(t * 1.1 + 4.2) * 0.03;
    }
  });

  return (
    <group>
      {/* 1. FOREGROUND: Hero Vessel (PBR Container / Tanker / Passenger) */}
      <RealVessel3D
        vesselType={heroVesselType}
        position={[0, 0, 0]}
        waveHeight={waveHeight}
        speedKnots={heroVesselType === "cargo" ? 17.6 : heroVesselType === "passenger" ? 21.0 : 13.8}
        showHud={false}
      />

      {/* 2. MID-DISTANCE PORT (X = -13, Z = -14): Panamax Bulk Carrier */}
      {showCorridorTraffic && (
        <group ref={midPortRef} position={[-13.5, 0, -14]} rotation={[0, 0.08, 0]}>
          <BulkCarrierModel scale={0.72} speedKnots={12.4} waveHeight={waveHeight} />
        </group>
      )}

      {/* 3. MID-DISTANCE STARBOARD (X = +15, Z = -18): Loaded Oil Tanker */}
      {showCorridorTraffic && (
        <group ref={midStbdRef} position={[15.0, 0, -18]} rotation={[0, -0.05, 0]}>
          <TankerShipModel scale={0.75} speedKnots={13.2} waveHeight={waveHeight} />
        </group>
      )}

      {/* 4. BACKGROUND HORIZON (X = -20, Z = -38): Feeder Container Vessel */}
      {showCorridorTraffic && (
        <group ref={bgFeederRef} position={[-20.0, 0, -38]} rotation={[0, 0.12, 0]}>
          <ContainerShipModel scale={0.42} speedKnots={16.0} waveHeight={waveHeight} />
          {/* Masthead lantern for horizon visibility */}
          <mesh position={[0, 1.8, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      )}

      {/* 5. BACKGROUND HORIZON (X = +9, Z = -45): General Cargo Vessel */}
      {showCorridorTraffic && (
        <group ref={bgCargoRef} position={[9.0, 0, -45]} rotation={[0, -0.08, 0]}>
          <BulkCarrierModel scale={0.38} speedKnots={11.5} waveHeight={waveHeight} />
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      )}
    </group>
  );
}
