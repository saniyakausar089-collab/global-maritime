import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface OceanSurfaceProps {
  waveHeight?: number; // Real wave height in meters from Open-Meteo
  simulateStorm?: boolean;
}

export function OceanSurface({ waveHeight = 1.8, simulateStorm = false }: OceanSurfaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const effectiveWaveHeight = simulateStorm ? 5.8 : waveHeight;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const geo = meshRef.current.geometry as THREE.PlaneGeometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;

    const count = pos.count;
    const ampScale = Math.min(1.8, Math.max(0.2, effectiveWaveHeight * 0.22));

    for (let i = 0; i < count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i);

      // Multi-spectral Trochoidal Gerstner-like wave superposition
      const wave1 =
        Math.sin(u * 0.12 + t * 1.5) *
        Math.cos(v * 0.12 + t * 1.2) *
        (0.4 * ampScale);
      const wave2 = Math.sin(u * 0.28 - t * 2.2 + v * 0.15) * (0.22 * ampScale);
      const wave3 = Math.cos(v * 0.45 + t * 1.8) * (0.1 * ampScale);

      pos.setZ(i, wave1 + wave2 + wave3);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
      <planeGeometry args={[120, 120, 56, 56]} />
      <meshStandardMaterial
        color={simulateStorm ? "#020712" : "#04132b"}
        roughness={simulateStorm ? 0.35 : 0.18}
        metalness={0.65}
        envMapIntensity={0.9}
        flatShading={false}
      />
    </mesh>
  );
}
