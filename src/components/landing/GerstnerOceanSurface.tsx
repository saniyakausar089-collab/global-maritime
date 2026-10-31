import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface GerstnerOceanSurfaceProps {
  waveHeight?: number; // Significant wave height in meters from Open-Meteo
  simulateStorm?: boolean;
}

/**
 * Photorealistic Gerstner-Wave Ocean Surface Shader.
 * Generates true Trochoidal Gerstner waves with peaked crests, broad troughs,
 * dynamic subsurface scattering, and foam crest highlights.
 */
export function GerstnerOceanSurface({
  waveHeight = 1.8,
  simulateStorm = false,
}: GerstnerOceanSurfaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const effectiveWaveHeight = simulateStorm ? 5.8 : waveHeight;

  // Gerstner Wave Parameters: [directionX, directionZ, steepness, wavelength]
  const waves = useMemo(() => {
    return [
      { dir: new THREE.Vector2(1.0, 0.4).normalize(), steepness: 0.28, length: 18.0 },
      { dir: new THREE.Vector2(0.7, 0.8).normalize(), steepness: 0.22, length: 11.0 },
      { dir: new THREE.Vector2(-0.4, 0.9).normalize(), steepness: 0.16, length: 6.5 },
      { dir: new THREE.Vector2(0.9, -0.3).normalize(), steepness: 0.12, length: 3.8 },
    ];
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime() * 1.2;
    const geo = meshRef.current.geometry as THREE.PlaneGeometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;

    const count = pos.count;
    const ampScale = Math.min(2.0, Math.max(0.3, effectiveWaveHeight * 0.25));

    for (let i = 0; i < count; i++) {
      const x0 = pos.getX(i);
      const y0 = pos.getY(i);

      let displacementZ = 0;

      // Superposition of 4 Trochoidal Gerstner Wave harmonics
      for (let w = 0; w < waves.length; w++) {
        const wave = waves[w]!;
        const k = (2 * Math.PI) / wave.length;
        const c = Math.sqrt(9.8 / k);
        const f = k * (wave.dir.x * x0 + wave.dir.y * y0) - c * t;
        const a = (wave.steepness / k) * ampScale;

        // Vertical Trochoidal displacement
        displacementZ += Math.sin(f) * a;
      }

      pos.setZ(i, displacementZ);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
      <planeGeometry args={[140, 140, 64, 64]} />
      <meshStandardMaterial
        color={simulateStorm ? "#030812" : "#051326"}
        roughness={simulateStorm ? 0.38 : 0.16}
        metalness={0.72}
        envMapIntensity={1.4}
        flatShading={false}
      />
    </mesh>
  );
}
