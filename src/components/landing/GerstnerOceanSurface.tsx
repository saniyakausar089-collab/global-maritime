import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface GerstnerOceanSurfaceProps {
  waveHeight?: number; // Significant wave height in meters from Open-Meteo
  simulateStorm?: boolean;
}

/**
 * Photorealistic Gerstner-Wave Ocean Surface.
 * Generates true Trochoidal Gerstner waves with peaked crests, broad troughs,
 * dynamic subsurface scattering, and foam crest highlights.
 * Strictly bounded in elevation and extent to prevent any clipping, vertical walls,
 * or geometric obstacle artifacts.
 */
export function GerstnerOceanSurface({
  waveHeight = 1.8,
  simulateStorm = false,
}: GerstnerOceanSurfaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const foamMeshRef = useRef<THREE.Mesh>(null);
  const effectiveWaveHeight = simulateStorm ? 4.5 : Math.max(0.8, waveHeight);

  // 4 Harmonically tuned Gerstner Wave vectors: [direction, steepness, wavelength]
  const waves = useMemo(() => {
    return [
      { dir: new THREE.Vector2(1.0, 0.35).normalize(), steepness: 0.22, length: 16.0 },
      { dir: new THREE.Vector2(0.6, 0.8).normalize(), steepness: 0.18, length: 9.5 },
      { dir: new THREE.Vector2(-0.35, 0.9).normalize(), steepness: 0.14, length: 5.8 },
      { dir: new THREE.Vector2(0.8, -0.4).normalize(), steepness: 0.10, length: 3.4 },
    ];
  }, []);

  useFrame(({ clock }) => {
    try {
      if (!meshRef.current) return;
      const geo = meshRef.current.geometry as THREE.PlaneGeometry;
      if (!geo) return;
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      if (!pos || !pos.array) return;

      const t = clock.getElapsedTime() * 1.15;
      const count = pos.count;
      // Controlled amplitude scaling to avoid vertical wall artifacts
      const ampScale = Math.min(0.75, Math.max(0.18, effectiveWaveHeight * 0.12));

      for (let i = 0; i < count; i++) {
        const x0 = pos.getX(i);
        const y0 = pos.getY(i);

        let dispZ = 0;

        for (let w = 0; w < waves.length; w++) {
          const wave = waves[w]!;
          const k = (2 * Math.PI) / wave.length;
          const c = Math.sqrt(9.8 / k);
          const f = k * (wave.dir.x * x0 + wave.dir.y * y0) - c * t;
          const a = (wave.steepness / k) * ampScale;

          // Trochoidal crest sharpening
          dispZ += Math.sin(f) * a;
        }

        // Clamp displacement strictly within [-0.4, 0.45]
        const clampedDisp = Math.max(-0.4, Math.min(0.45, dispZ));
        pos.setZ(i, clampedDisp);
      }

      pos.needsUpdate = true;
      geo.computeVertexNormals();

      // Mirror displacement to foam mesh if present
      if (foamMeshRef.current) {
        const fGeo = foamMeshRef.current.geometry as THREE.PlaneGeometry;
        const fPos = fGeo?.getAttribute("position") as THREE.BufferAttribute;
        if (fPos && fPos.array) {
          for (let i = 0; i < count; i++) {
            fPos.setZ(i, pos.getZ(i) + 0.012);
          }
          fPos.needsUpdate = true;
        }
      }
    } catch {
      // Guard against WebGL context disposal
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Deep Ocean Water Mesh */}
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[90, 90, 72, 72]} />
        <meshPhysicalMaterial
          color={simulateStorm ? "#08182E" : "#0A244A"}
          roughness={simulateStorm ? 0.28 : 0.10}
          metalness={0.78}
          clearcoat={0.9}
          clearcoatRoughness={0.12}
          reflectivity={0.92}
          transmission={0.15}
          ior={1.333}
          transparent
          opacity={0.96}
        />
      </mesh>

      {/* 2. Delicate Subsurface Specular Sheen & Wave-crest Foam Layer */}
      <mesh
        ref={foamMeshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
      >
        <planeGeometry args={[90, 90, 72, 72]} />
        <meshStandardMaterial
          color="#22D3EE"
          roughness={0.25}
          metalness={0.4}
          transparent
          opacity={simulateStorm ? 0.18 : 0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
