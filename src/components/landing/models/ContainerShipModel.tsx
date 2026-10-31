import React, { useMemo, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface ContainerShipModelProps {
  scale?: number;
  speedKnots?: number;
  waveHeight?: number;
}

export function ContainerShipModel({
  scale = 1.0,
  speedKnots = 18.4,
  waveHeight = 1.8,
}: ContainerShipModelProps) {
  const shipGroupRef = useRef<THREE.Group>(null);
  const wakeRef = useRef<THREE.Mesh>(null);
  const bowWaveRef = useRef<THREE.Mesh>(null);

  // PBR Materials
  const materials = useMemo(() => {
    return {
      hullTop: new THREE.MeshStandardMaterial({
        color: 0x0a1626, // Deep maritime midnight navy
        metalness: 0.45,
        roughness: 0.4,
      }),
      hullKeel: new THREE.MeshStandardMaterial({
        color: 0x82241d, // Antifouling red oxide with subtle rust
        metalness: 0.25,
        roughness: 0.7,
      }),
      deck: new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        metalness: 0.55,
        roughness: 0.65,
      }),
      superstructure: new THREE.MeshStandardMaterial({
        color: 0xf1f5f9, // Marine white
        metalness: 0.2,
        roughness: 0.35,
      }),
      windows: new THREE.MeshStandardMaterial({
        color: 0x0f2b48,
        metalness: 0.95,
        roughness: 0.05,
      }),
      funnel: new THREE.MeshStandardMaterial({
        color: 0x1d4ed8, // Vibrant blue carrier stack
        metalness: 0.4,
        roughness: 0.4,
      }),
      cellGuides: new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.7,
        roughness: 0.4,
      }),
    };
  }, []);

  const containerColors = [
    0x38bdf8, // Maersk Ice Blue
    0x15803d, // Evergreen Forest Green
    0xf97316, // Hapag-Lloyd Orange
    0x1e3a8a, // CMA CGM Deep Navy
    0xdb2777, // ONE Cherry Magenta
    0xeab308, // MSC Goldenrod
    0xb91c1c, // Hamburg Carmine Red
    0x2563eb, // Cosco Blue
  ];

  // Generate 8 cargo bays of colorful container stacks
  const containerStacks = useMemo(() => {
    const meshes: ReactElement[] = [];
    const bayZCoords = [6.2, 4.6, 3.0, 1.4, -0.2, -1.8, -3.4, -5.0];
    let colIdx = 0;

    bayZCoords.forEach((z, bIdx) => {
      for (let row = -1; row <= 1; row++) {
        const stackHeight = 2 + ((bIdx + row + 3) % 3);
        for (let h = 0; h < stackHeight; h++) {
          const color = containerColors[(colIdx++) % containerColors.length] ?? 0x38bdf8;
          meshes.push(
            <mesh
              key={`c-${bIdx}-${row}-${h}`}
              position={[row * 0.98, 0.94 + h * 0.52, z]}
              castShadow
            >
              <boxGeometry args={[0.85, 0.48, 1.42]} />
              <meshStandardMaterial
                color={color}
                metalness={0.35}
                roughness={0.55}
              />
            </mesh>
          );
        }
      }
    });

    return meshes;
  }, [containerColors]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const seaIntensity = Math.min(2.5, Math.max(0.5, waveHeight * 0.55));

    if (shipGroupRef.current) {
      // Dynamic pitch, roll and heave derived from real sea state wave height
      shipGroupRef.current.rotation.z = Math.sin(t * 1.5) * (0.02 * seaIntensity); // Roll
      shipGroupRef.current.rotation.x = Math.cos(t * 1.0) * (0.012 * seaIntensity); // Pitch
      shipGroupRef.current.position.y = Math.sin(t * 1.7) * (0.06 * seaIntensity); // Heave
    }

    if (wakeRef.current) {
      const mat = wakeRef.current.material as THREE.MeshBasicMaterial;
      const speedFactor = Math.min(1.5, Math.max(0.3, speedKnots / 16.0));
      mat.opacity = (0.35 + Math.sin(t * 3.2) * 0.08) * speedFactor;
    }
  });

  return (
    <group scale={scale}>
      <group ref={shipGroupRef}>
        {/* Main Hull Topside */}
        <mesh position={[0, 0.35, 0.6]} castShadow receiveShadow material={materials.hullTop}>
          <boxGeometry args={[3.3, 1.25, 17.2]} />
        </mesh>

        {/* Lower Antifouling Keel */}
        <mesh position={[0, -0.45, 0.4]} castShadow receiveShadow material={materials.hullKeel}>
          <boxGeometry args={[3.0, 0.65, 18.2]} />
        </mesh>

        {/* Flared Bow Section */}
        <mesh
          position={[0, 0.35, 9.8]}
          rotation={[Math.PI / 2, 0, Math.PI / 4]}
          scale={[1.25, 0.8, 1.0]}
          castShadow
          material={materials.hullTop}
        >
          <coneGeometry args={[1.9, 3.8, 4]} />
        </mesh>

        {/* Bulbous Bow (Underwater) */}
        <mesh position={[0, -0.42, 10.2]} scale={[0.85, 0.75, 1.7]} material={materials.hullKeel}>
          <sphereGeometry args={[0.75, 16, 16]} />
        </mesh>

        {/* Stern Transom */}
        <mesh position={[0, 0.4, -8.2]} material={materials.hullTop}>
          <boxGeometry args={[3.2, 1.35, 1.4]} />
        </mesh>

        {/* Main Cargo Deck Plate */}
        <mesh position={[0, 0.98, 0.6]} material={materials.deck}>
          <boxGeometry args={[3.25, 0.08, 17.6]} />
        </mesh>

        {/* Container Cell Stacks */}
        {containerStacks}

        {/* Aft Navigation Bridge Superstructure */}
        <mesh position={[0, 2.3, -6.6]} castShadow material={materials.superstructure}>
          <boxGeometry args={[2.9, 2.4, 2.3]} />
        </mesh>

        {/* Bridge Wings (Wheelhouse) */}
        <mesh position={[0, 3.7, -6.6]} castShadow material={materials.superstructure}>
          <boxGeometry args={[3.9, 0.7, 1.7]} />
        </mesh>

        {/* Navigation Ribbon Windows */}
        <mesh position={[0, 3.8, -5.74]} material={materials.windows}>
          <boxGeometry args={[3.7, 0.3, 0.08]} />
        </mesh>

        {/* Exhaust Funnel with Carrier Banding */}
        <mesh position={[0, 4.0, -8.0]} material={materials.funnel}>
          <cylinderGeometry args={[0.42, 0.52, 1.8, 8]} />
        </mesh>

        {/* Radar Mast & Antenna */}
        <mesh position={[0, 4.8, -6.6]} material={materials.cellGuides}>
          <cylinderGeometry args={[0.06, 0.09, 1.6, 6]} />
        </mesh>

        {/* Navigation Port Red & Starboard Green Lanterns */}
        <pointLight position={[-1.95, 3.7, -6.6]} color="#ef4444" intensity={2.0} distance={4} />
        <pointLight position={[1.95, 3.7, -6.6]} color="#22c55e" intensity={2.0} distance={4} />
        {/* Masthead White Steaming Light */}
        <pointLight position={[0, 5.4, -6.6]} color="#f8fafc" intensity={2.5} distance={7} />
      </group>

      {/* Speed-Scaled Trailing Wake Foam */}
      <mesh
        ref={wakeRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.28, -15]}
      >
        <planeGeometry args={[6.5, 30, 16, 32]} />
        <meshBasicMaterial
          color="#cffafe"
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Bow Wave Foam Splashes */}
      <mesh
        ref={bowWaveRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.25, 9.8]}
      >
        <ringGeometry args={[1.5, 2.6, 32]} />
        <meshBasicMaterial
          color="#e0f2fe"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
