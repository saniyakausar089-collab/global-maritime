import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { ContainerShipModel } from "./models/ContainerShipModel";
import { TankerShipModel } from "./models/TankerShipModel";
import { PassengerCruiseShipModel } from "./models/PassengerCruiseShipModel";
import { RealVessel3D, type RealVesselType } from "./RealVessel3D";

interface MultiVesselCorridor3DProps {
  heroVesselType?: RealVesselType;
  waveHeight?: number;
  simulateStorm?: boolean;
  showCorridorTraffic?: boolean;
  showAllThreeVessels?: boolean;
}

/**
 * Multi-Vessel Commercial Shipping Corridor.
 * Arranges realistic commercial vessels across multiple depth planes:
 * - Scene 02: Multiple container ships, tankers, and feeders with bidirectional traffic separation
 * - Scene 06: Cargo Ship, Passenger Ship, and Tanker Ship simultaneously in ONE FRAME with distinct silhouettes
 * - Scenes 07-09: Focused individual deep-dives
 */
export function MultiVesselCorridor3D({
  heroVesselType = "cargo",
  waveHeight = 1.8,
  showCorridorTraffic = true,
  showAllThreeVessels = false,
}: MultiVesselCorridor3DProps) {
  const cargoGroupRef = useRef<THREE.Group>(null);
  const passengerGroupRef = useRef<THREE.Group>(null);
  const tankerGroupRef = useRef<THREE.Group>(null);

  const inboundVessel1Ref = useRef<THREE.Group>(null);
  const inboundVessel2Ref = useRef<THREE.Group>(null);
  const outboundVesselRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const seaMotion = Math.min(2.0, Math.max(0.4, waveHeight * 0.4));

    if (showAllThreeVessels) {
      if (cargoGroupRef.current) {
        cargoGroupRef.current.position.y = Math.sin(t * 1.3) * (0.04 * seaMotion);
        cargoGroupRef.current.rotation.z = Math.sin(t * 1.0) * (0.012 * seaMotion);
      }
      if (passengerGroupRef.current) {
        passengerGroupRef.current.position.y = Math.sin(t * 1.2 + 1.2) * (0.035 * seaMotion);
        passengerGroupRef.current.rotation.z = Math.sin(t * 0.95 + 1.0) * (0.014 * seaMotion);
      }
      if (tankerGroupRef.current) {
        tankerGroupRef.current.position.y = Math.sin(t * 1.1 + 2.4) * (0.03 * seaMotion);
        tankerGroupRef.current.rotation.z = Math.sin(t * 0.85 + 2.0) * (0.01 * seaMotion);
      }
    } else {
      // Scene 02 bidirectional traffic animation
      if (inboundVessel1Ref.current) {
        inboundVessel1Ref.current.position.y = Math.sin(t * 1.3 + 0.8) * 0.04;
      }
      if (inboundVessel2Ref.current) {
        inboundVessel2Ref.current.position.y = Math.sin(t * 1.1 + 1.9) * 0.035;
      }
      if (outboundVesselRef.current) {
        outboundVesselRef.current.position.y = Math.sin(t * 1.2 + 3.1) * 0.038;
      }
    }
  });

  if (showAllThreeVessels) {
    return (
      <group>
        {/* 1. CENTER: Cargo Container Vessel */}
        <group ref={cargoGroupRef} position={[0, 0, 0]}>
          <ContainerShipModel scale={0.92} speedKnots={18.2} waveHeight={waveHeight} />
          {/* Subtle cinematic spotlight */}
          <pointLight color="#22D3EE" intensity={4} distance={12} position={[0, 6, 0]} />

          {/* Glowing AIS Transponder Vector Line */}
          <mesh position={[0, 0.15, 12]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.25, 14]} />
            <meshBasicMaterial color="#38BDF8" transparent opacity={0.65} />
          </mesh>

          <mesh position={[0, 3.8, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color="#22D3EE" />
          </mesh>
        </group>

        {/* 2. PORT SIDE (LEFT): Luxury Passenger Cruise Ship */}
        <group ref={passengerGroupRef} position={[-9.5, 0, -5.5]} rotation={[0, 0.04, 0]}>
          <PassengerCruiseShipModel scale={0.88} speedKnots={21.4} waveHeight={waveHeight} />
          <pointLight color="#A78BFA" intensity={3.5} distance={10} position={[0, 5, 0]} />

          <mesh position={[0, 0.15, 12]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.25, 14]} />
            <meshBasicMaterial color="#A78BFA" transparent opacity={0.65} />
          </mesh>

          <mesh position={[0, 4.0, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color="#A78BFA" />
          </mesh>
        </group>

        {/* 3. STARBOARD SIDE (RIGHT): Crude Oil Tanker */}
        <group ref={tankerGroupRef} position={[9.8, 0, -5.8]} rotation={[0, -0.04, 0]}>
          <TankerShipModel scale={0.88} speedKnots={13.6} waveHeight={waveHeight} />
          <pointLight color="#FFB547" intensity={3.5} distance={10} position={[0, 5, 0]} />

          <mesh position={[0, 0.15, 12]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.25, 14]} />
            <meshBasicMaterial color="#FFB547" transparent opacity={0.65} />
          </mesh>

          <mesh position={[0, 3.6, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color="#FFB547" />
          </mesh>
        </group>
      </group>
    );
  }

  return (
    <group>
      {/* Hero Ship */}
      <RealVessel3D
        vesselType={heroVesselType}
        position={[0, 0, 0]}
        waveHeight={waveHeight}
        speedKnots={heroVesselType === "cargo" ? 17.6 : heroVesselType === "passenger" ? 21.0 : 13.8}
        showHud={false}
      />

      {/* Multi-Vessel Fleet Traffic (Different sizes & directions) */}
      {showCorridorTraffic && (
        <group>
          {/* Inbound Container Ship (Parallel) */}
          <group ref={inboundVessel1Ref} position={[-12.5, 0, -12.0]} rotation={[0, 0.05, 0]}>
            <ContainerShipModel scale={0.65} speedKnots={16.2} waveHeight={waveHeight} />
            {/* Glowing AIS Transponder Vector Line */}
            <mesh position={[0, 0.2, 8]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.08, 12]} />
              <meshBasicMaterial color="#22D3EE" transparent opacity={0.6} />
            </mesh>
          </group>

          {/* Outbound Oil Tanker (Opposite Direction) */}
          <group ref={outboundVesselRef} position={[13.5, 0, -16.0]} rotation={[0, Math.PI - 0.08, 0]}>
            <TankerShipModel scale={0.72} speedKnots={14.1} waveHeight={waveHeight} />
            <mesh position={[0, 0.2, 8]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.08, 14]} />
              <meshBasicMaterial color="#FFB547" transparent opacity={0.6} />
            </mesh>
          </group>

          {/* Background Feeder Container Ship */}
          <group ref={inboundVessel2Ref} position={[-20.0, 0, -32.0]} rotation={[0, 0.12, 0]}>
            <ContainerShipModel scale={0.42} speedKnots={15.0} waveHeight={waveHeight} />
          </group>
        </group>
      )}
    </group>
  );
}
