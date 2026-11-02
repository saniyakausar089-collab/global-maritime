import React, { Component, useRef, useMemo, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";

import { ContainerShipModel } from "./models/ContainerShipModel";
import { TankerShipModel } from "./models/TankerShipModel";
import { BulkCarrierModel } from "./models/BulkCarrierModel";

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
    console.warn("[RealVessel3D] GLTF model failed to load, switching to procedural fallback:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Procedural Fallback Component when GLTF is loading or fails
function ProceduralShipFallback({
  vesselType,
  speedKnots,
  waveHeight,
}: {
  vesselType: RealVesselType;
  speedKnots: number;
  waveHeight: number;
}) {
  if (vesselType === "tanker") {
    return <TankerShipModel scale={0.88} speedKnots={speedKnots} waveHeight={waveHeight} />;
  }
  if (vesselType === "passenger") {
    return <BulkCarrierModel scale={0.88} speedKnots={speedKnots} waveHeight={waveHeight} />;
  }
  return <ContainerShipModel scale={0.88} speedKnots={speedKnots} waveHeight={waveHeight} />;
}

// Inner GLTF loader component that triggers Suspense
function InnerGLTFModel({
  modelPath,
  vesselType,
}: {
  modelPath: string;
  vesselType: RealVesselType;
}) {
  const { scene } = useGLTF(modelPath);

  // Clone scene so multiple instances don't collide, and configure PBR materials
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => {
              if (m && typeof (m as THREE.Material).clone === "function") {
                const mat = (m as THREE.MeshStandardMaterial).clone();
                mat.roughness = Math.max(0.25, Math.min(0.7, mat.roughness ?? 0.4));
                mat.metalness = Math.max(0.15, Math.min(0.65, mat.metalness ?? 0.3));
                mat.envMapIntensity = 1.2;
                return mat;
              }
              return m;
            });
          } else if (typeof (mesh.material as THREE.Material).clone === "function") {
            const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
            mat.roughness = Math.max(0.25, Math.min(0.7, mat.roughness ?? 0.4));
            mat.metalness = Math.max(0.15, Math.min(0.65, mat.metalness ?? 0.3));
            mat.envMapIntensity = 1.2;
            mesh.material = mat;
          }
        }
      }
    });

    // Auto-scale model into canonical coordinates (~8-14 units long)
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const targetLength = vesselType === "cargo" ? 14 : vesselType === "passenger" ? 12 : 13;
      const factor = targetLength / maxDim;
      clone.scale.setScalar(factor);
    }
    return clone;
  }, [scene, vesselType]);

  if (!clonedScene) return null;
  return <primitive object={clonedScene} />;
}

export function RealVessel3D({
  vesselType = "cargo",
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  speedKnots = 16.5,
  waveHeight = 1.8,
  showHud = true,
  telemetry,
}: RealVessel3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wakeRef = useRef<THREE.Mesh>(null);
  const bowWaveRef = useRef<THREE.Mesh>(null);

  // Model file paths
  const modelPath = useMemo(() => {
    switch (vesselType) {
      case "passenger":
        return "/models/passenger_ship.glb";
      case "tanker":
        return "/models/tanker_ship.glb";
      case "cargo":
      default:
        return "/models/container_ship.glb";
    }
  }, [vesselType]);

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
    const seaIntensity = Math.min(2.5, Math.max(0.4, waveHeight * 0.5));

    if (groupRef.current) {
      // Dynamic pitch, roll and heave derived from real wave height
      groupRef.current.rotation.z = Math.sin(t * 1.4) * (0.018 * seaIntensity); // Roll
      groupRef.current.rotation.x = Math.cos(t * 0.9) * (0.012 * seaIntensity); // Pitch
      groupRef.current.position.y = position[1] + Math.sin(t * 1.6) * (0.05 * seaIntensity); // Heave
    }

    if (wakeRef.current) {
      const mat = wakeRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        const speedFactor = Math.min(1.5, Math.max(0.2, speedKnots / 16.0));
        mat.opacity = (0.35 + Math.sin(t * 3.0) * 0.08) * speedFactor;
      }
    }

    if (bowWaveRef.current) {
      const bMat = bowWaveRef.current.material as THREE.MeshBasicMaterial;
      if (bMat) {
        bMat.opacity = 0.25 + Math.sin(t * 3.4) * 0.08;
      }
    }
  });

  const navOffsets = useMemo(() => {
    return {
      portX: -2.2,
      stbdX: 2.2,
      sternZ: -6.5,
      bowZ: 7.0,
      bridgeY: 3.2,
    };
  }, []);

  const fallback = (
    <ProceduralShipFallback
      vesselType={vesselType}
      speedKnots={speedKnots}
      waveHeight={waveHeight}
    />
  );

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group ref={groupRef}>
        {/* GLTF 3D Model with safe Suspense and ErrorBoundary fallback */}
        <RealVesselErrorBoundary fallback={fallback}>
          <React.Suspense fallback={fallback}>
            <InnerGLTFModel modelPath={modelPath} vesselType={vesselType} />
          </React.Suspense>
        </RealVesselErrorBoundary>

        {/* --- NAVIGATION LIGHTS (NIGHT VISIBILITY & BLOOM) --- */}
        <mesh position={[navOffsets.stbdX, navOffsets.bridgeY, navOffsets.sternZ + 1]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
        <mesh position={[navOffsets.portX, navOffsets.bridgeY, navOffsets.sternZ + 1]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0, navOffsets.bridgeY + 0.8, navOffsets.bowZ - 1]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, navOffsets.bridgeY + 1.6, navOffsets.sternZ + 1]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* --- REALISTIC HYDRODYNAMIC WAKE TRAIL & BOW FOAM --- */}
        <mesh ref={wakeRef} position={[0, -0.15, -12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.5, 14.0]} />
          <meshBasicMaterial
            color="#d1fae5"
            transparent
            opacity={0.35}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        <mesh ref={bowWaveRef} position={[0, -0.05, 7.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.4, 3.2, 24, 1, 0, Math.PI]} />
          <meshBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={0.28}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* --- TACTICAL HUD TELEMETRY CARD --- */}
        {showHud && (
          <Html position={[3.6, 2.6, 1.8]} center zIndexRange={[100, 0]}>
            <div className="w-80 rounded-2xl border border-amber-500/40 bg-[#171513]/90 p-4 shadow-2xl backdrop-blur-xl text-xs text-[#f2ece3] pointer-events-auto font-sans">
              <div className="flex items-center justify-between border-b border-[#2d2926] pb-2.5 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <span className="font-serif font-bold text-white text-sm tracking-wide truncate max-w-[170px]">
                    {activeTelemetry.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#211e1b] border border-[#2d2926] text-amber-300">
                  MMSI {activeTelemetry.mmsi}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#9a9187]">Vessel Type:</span>
                  <span className="text-[#f2ece3] font-medium">{activeTelemetry.typeLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9a9187]">Speed / Heading:</span>
                  <span className="text-amber-400 font-semibold font-mono">
                    {activeTelemetry.speed.toFixed(1)} kn / {activeTelemetry.heading}°
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9a9187]">Draught / Flag:</span>
                  <span className="text-[#f2ece3]">
                    {activeTelemetry.draught} · {activeTelemetry.flag}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#2d2926]">
                  <span className="text-[#9a9187]">Destination:</span>
                  <span className="text-amber-300 font-medium truncate max-w-[170px]">
                    {activeTelemetry.destination}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9a9187]">Reported ETA:</span>
                  <span className="text-[#f2ece3] font-mono">{activeTelemetry.eta}</span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#2d2926] flex items-center justify-between text-[10px]">
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {activeTelemetry.status}
                </span>
                <span className="text-amber-400/90 font-mono">
                  {activeTelemetry.isDemo ? "DEMO DATA" : "VERIFIED AIS"}
                </span>
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}
