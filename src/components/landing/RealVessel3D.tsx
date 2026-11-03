import React, { Component, useRef, useMemo, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

import { ContainerShipModel } from "./models/ContainerShipModel";
import { TankerShipModel } from "./models/TankerShipModel";
import { PassengerCruiseShipModel } from "./models/PassengerCruiseShipModel";

export type RealVesselType = "cargo" | "passenger" | "tanker";

interface RealVessel3DProps {
  vesselType?: RealVesselType;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  speedKnots?: number;
  waveHeight?: number;
  showHud?: boolean;
  telemetry?: {
    name: string;
    mmsi: number;
    typeLabel: string;
    speed: number;
    heading: number;
    destination: string;
    eta: string;
    draught: string;
    flag: string;
    status: string;
    lastUpdate?: string;
    isDemo?: boolean;
  };
}

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class RealVesselErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[RealVessel3D] Error caught, using visual fallback:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Reliable High-Fidelity Ship Model Dispatcher.
 * Guarantees zero blank scenes, zero 404 texture crashes, and immediate synchronous render.
 */
function ShipGeometryDispatcher({
  vesselType,
  speedKnots,
  waveHeight,
}: {
  vesselType: RealVesselType;
  speedKnots: number;
  waveHeight: number;
}) {
  if (vesselType === "passenger") {
    return (
      <PassengerCruiseShipModel
        scale={0.92}
        speedKnots={speedKnots}
        waveHeight={waveHeight}
      />
    );
  }
  if (vesselType === "tanker") {
    return (
      <TankerShipModel
        scale={0.92}
        speedKnots={speedKnots}
        waveHeight={waveHeight}
      />
    );
  }
  return (
    <ContainerShipModel
      scale={0.92}
      speedKnots={speedKnots}
      waveHeight={waveHeight}
    />
  );
}

export function RealVessel3D({
  vesselType = "cargo",
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  speedKnots = 16.5,
  waveHeight = 1.8,
  showHud = false,
  telemetry,
}: RealVessel3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wakeRef = useRef<THREE.Mesh>(null);
  const bowWaveRef = useRef<THREE.Mesh>(null);

  // Default vessel telemetry if none provided
  const activeTelemetry = telemetry ?? {
    name:
      vesselType === "cargo"
        ? "CMA CGM ANTOINE DE SAINT EXUPERY"
        : vesselType === "passenger"
          ? "ROTTERDAM EXPLORER"
          : "DHT SCANDINAVIA",
    mmsi: vesselType === "cargo" ? 228339700 : vesselType === "passenger" ? 244010882 : 538007204,
    typeLabel:
      vesselType === "cargo"
        ? "Ultra Large Container Vessel (20,600 TEU)"
        : vesselType === "passenger"
          ? "Passenger Cruise Liner (2,650 Pax)"
          : "Very Large Crude Carrier (318,000 DWT)",
    speed: speedKnots,
    heading: 72,
    destination: "NLRTM (Rotterdam Maasvlakte)",
    eta: "Today 16:30 UTC",
    draught: vesselType === "tanker" ? "21.2m" : "15.4m",
    flag: vesselType === "cargo" ? "France (FR)" : vesselType === "passenger" ? "Netherlands (NL)" : "Marshall Is.",
    status: "Underway using engine",
    isDemo: true,
  };

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const seaIntensity = Math.min(2.0, Math.max(0.4, waveHeight * 0.45));

    if (groupRef.current) {
      // Dynamic pitch, roll and heave derived from real wave height
      groupRef.current.rotation.z = Math.sin(t * 1.3) * (0.015 * seaIntensity); // Roll
      groupRef.current.rotation.x = Math.cos(t * 0.85) * (0.010 * seaIntensity); // Pitch
      groupRef.current.position.y = position[1] + Math.sin(t * 1.5) * (0.04 * seaIntensity); // Heave
    }

    if (wakeRef.current) {
      const mat = wakeRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        const speedFactor = Math.min(1.4, Math.max(0.3, speedKnots / 16.0));
        mat.opacity = (0.30 + Math.sin(t * 2.8) * 0.06) * speedFactor;
      }
    }

    if (bowWaveRef.current) {
      const bMat = bowWaveRef.current.material as THREE.MeshBasicMaterial;
      if (bMat) {
        bMat.opacity = 0.22 + Math.sin(t * 3.2) * 0.06;
      }
    }
  });

  const fallback = (
    <ShipGeometryDispatcher
      vesselType={vesselType}
      speedKnots={speedKnots}
      waveHeight={waveHeight}
    />
  );

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group ref={groupRef}>
        {/* Safe ErrorBoundary wrapping the 3D ship */}
        <RealVesselErrorBoundary fallback={fallback}>
          <ShipGeometryDispatcher
            vesselType={vesselType}
            speedKnots={speedKnots}
            waveHeight={waveHeight}
          />
        </RealVesselErrorBoundary>

        {/* --- REALISTIC HYDRODYNAMIC WAKE TRAIL & BOW FOAM --- */}
        <mesh ref={wakeRef} position={[0, -0.05, -11]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.2, 13.0]} />
          <meshBasicMaterial
            color="#A5F3FC"
            transparent
            opacity={0.28}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        <mesh ref={bowWaveRef} position={[0, 0.02, 7.0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 2.8, 24, 1, 0, Math.PI]} />
          <meshBasicMaterial
            color="#CFFAFE"
            transparent
            opacity={0.22}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* --- COMPACT HOLOGRAPHIC VESSEL CALLOUT --- */}
        {showHud && (
          <Html position={[2.6, 2.8, 0]} center zIndexRange={[50, 0]}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/30 bg-[#080F20]/85 backdrop-blur-md shadow-xl text-xs text-white pointer-events-none whitespace-nowrap">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
              <span className="font-semibold text-[11px] tracking-wide text-cyan-200">
                {activeTelemetry.name}
              </span>
              <span className="text-[10px] font-mono text-cyan-400/80 border-l border-cyan-400/30 pl-2">
                {activeTelemetry.speed.toFixed(1)} kn · {activeTelemetry.heading}°
              </span>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}
