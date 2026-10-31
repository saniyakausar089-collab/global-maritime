import React, { useMemo, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface BulkCarrierModelProps {
  scale?: number;
  speedKnots?: number;
  waveHeight?: number;
}

/**
 * Photorealistic 3D Model of a Geared Panamax Bulk Carrier (Dry Bulk / Ore)
 * Features:
 * - High-freeboard deep-sided hull with hopper construction
 * - 5 Large raised cargo hatch coamings with side-rolling hydraulic covers
 * - 4 Electro-hydraulic deck cranes with luffing booms & wire tackle
 * - Raised forecastle mooring deck with twin anchor windlasses
 * - Tall aft superstructure castle with bridge wings and single large funnel
 * - Navigation lanterns (red port, green stbd, white masthead)
 * - Hydrodynamic wake foam and sea-state pitch/roll/heave
 */
export function BulkCarrierModel({
  scale = 1.0,
  speedKnots = 12.8,
  waveHeight = 1.7,
}: BulkCarrierModelProps) {
  const shipGroupRef = useRef<THREE.Group>(null);
  const wakeRef = useRef<THREE.Mesh>(null);
  const bowWaveRef = useRef<THREE.Mesh>(null);

  // PBR Materials
  const materials = useMemo(() => {
    return {
      hullTop: new THREE.MeshStandardMaterial({
        color: 0x1e3a5f, // Deep marine slate blue-grey
        metalness: 0.45,
        roughness: 0.5,
      }),
      hullKeel: new THREE.MeshStandardMaterial({
        color: 0x991b1b, // Rust-red antifouling underbody
        metalness: 0.3,
        roughness: 0.7,
      }),
      deck: new THREE.MeshStandardMaterial({
        color: 0x334155, // Weather-worn steel deck
        metalness: 0.5,
        roughness: 0.6,
      }),
      hatchCovers: new THREE.MeshStandardMaterial({
        color: 0x065f46, // Classic dark green painted hydraulic hatch covers
        metalness: 0.4,
        roughness: 0.45,
      }),
      hatchCoaming: new THREE.MeshStandardMaterial({
        color: 0x475569, // Steel coaming walls
        metalness: 0.6,
        roughness: 0.4,
      }),
      deckCranes: new THREE.MeshStandardMaterial({
        color: 0xf59e0b, // Amber industrial crane lacquer
        metalness: 0.55,
        roughness: 0.35,
      }),
      craneCables: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.8,
        roughness: 0.2,
      }),
      superstructure: new THREE.MeshStandardMaterial({
        color: 0xf1f5f9, // Marine white deckhouse
        metalness: 0.2,
        roughness: 0.35,
      }),
      windows: new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Reflective bridge tinted windows
        metalness: 0.95,
        roughness: 0.05,
      }),
      funnel: new THREE.MeshStandardMaterial({
        color: 0x0f172a, // Black funnel
        metalness: 0.5,
        roughness: 0.4,
      }),
      funnelInsignia: new THREE.MeshStandardMaterial({
        color: 0x38bdf8, // Cyan band
        metalness: 0.3,
        roughness: 0.3,
      }),
    };
  }, []);

  // 5 Large Cargo Hatches & 4 Deck Cranes between them
  const cargoEquipment = useMemo(() => {
    const items: ReactElement[] = [];
    const hatchZCoords = [-4.8, -2.2, 0.4, 3.0, 5.6];
    const craneZCoords = [-3.5, -0.9, 1.7, 4.3];

    // Hatch Coamings & Covers
    hatchZCoords.forEach((z, idx) => {
      // Coaming rim
      items.push(
        <mesh key={`hatch-coam-${idx}`} position={[0, 0.92, z]} material={materials.hatchCoaming}>
          <boxGeometry args={[2.5, 0.3, 1.8]} />
        </mesh>
      );
      // Top Hatch Cover (slightly raised)
      items.push(
        <mesh key={`hatch-top-${idx}`} position={[0, 1.1, z]} material={materials.hatchCovers}>
          <boxGeometry args={[2.6, 0.12, 1.9]} />
        </mesh>
      );
    });

    // 4 Centerline Luffing Cranes
    craneZCoords.forEach((z, cIdx) => {
      items.push(
        <group key={`crane-${cIdx}`} position={[0, 0.85, z]}>
          {/* Cylindrical Crane Pedestal */}
          <mesh position={[0, 0.5, 0]} material={materials.deckCranes}>
            <cylinderGeometry args={[0.26, 0.3, 1.0, 16]} />
          </mesh>
          {/* Rotating Crane Cab */}
          <mesh position={[0, 1.15, 0]} material={materials.deckCranes}>
            <boxGeometry args={[0.55, 0.5, 0.65]} />
          </mesh>
          {/* Angled Lattice Boom Jib */}
          <mesh position={[0, 1.9, 0.7]} rotation={[-0.55, 0, 0]} material={materials.deckCranes}>
            <boxGeometry args={[0.16, 1.8, 0.16]} />
          </mesh>
          {/* Wire Tackle & Clamshell Grab */}
          <mesh position={[0, 1.6, 1.3]} material={materials.craneCables}>
            <cylinderGeometry args={[0.015, 0.015, 1.0, 6]} />
          </mesh>
          <mesh position={[0, 1.05, 1.3]} material={materials.craneCables}>
            <boxGeometry args={[0.25, 0.25, 0.25]} />
          </mesh>
        </group>
      );
    });

    return items;
  }, [materials]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const seaIntensity = Math.min(2.5, Math.max(0.5, waveHeight * 0.55));

    if (shipGroupRef.current) {
      // Bulk carrier motion: steady, heavy sea-keeping
      shipGroupRef.current.rotation.z = Math.sin(t * 1.3) * (0.018 * seaIntensity); // Roll
      shipGroupRef.current.rotation.x = Math.cos(t * 0.95) * (0.011 * seaIntensity); // Pitch
      shipGroupRef.current.position.y = Math.sin(t * 1.4) * (0.055 * seaIntensity); // Heave
    }

    if (wakeRef.current) {
      const mat = wakeRef.current.material as THREE.MeshBasicMaterial;
      const speedFactor = Math.min(1.4, Math.max(0.3, speedKnots / 12.5));
      mat.opacity = (0.32 + Math.sin(t * 3.0) * 0.08) * speedFactor;
    }

    if (bowWaveRef.current) {
      const bMat = bowWaveRef.current.material as THREE.MeshBasicMaterial;
      bMat.opacity = 0.22 + Math.sin(t * 3.2) * 0.07;
    }
  });

  return (
    <group scale={scale}>
      <group ref={shipGroupRef}>
        {/* Main Bulk Carrier Hull (High Freeboard) */}
        <mesh position={[0, 0.35, 0.5]} castShadow receiveShadow material={materials.hullTop}>
          <boxGeometry args={[3.4, 1.25, 17.6]} />
        </mesh>

        {/* Keel / Underwater Hull */}
        <mesh position={[0, -0.45, 0.3]} castShadow receiveShadow material={materials.hullKeel}>
          <boxGeometry args={[3.1, 0.7, 18.2]} />
        </mesh>

        {/* Raked Flared Bow */}
        <mesh
          position={[0, 0.35, 9.7]}
          rotation={[Math.PI / 2, 0, Math.PI / 4]}
          scale={[1.28, 0.82, 1.0]}
          castShadow
          material={materials.hullTop}
        >
          <coneGeometry args={[1.9, 3.6, 4]} />
        </mesh>

        {/* Bulbous Bow */}
        <mesh position={[0, -0.45, 10.0]} scale={[0.85, 0.78, 1.7]} material={materials.hullKeel}>
          <sphereGeometry args={[0.78, 16, 16]} />
        </mesh>

        {/* Weather Deck Inset */}
        <mesh position={[0, 0.98, 0.4]} receiveShadow material={materials.deck}>
          <boxGeometry args={[3.2, 0.05, 17.0]} />
        </mesh>

        {/* Raised Forecastle Head (Mooring station) */}
        <mesh position={[0, 1.25, 8.5]} castShadow material={materials.deck}>
          <boxGeometry args={[3.1, 0.5, 2.2]} />
        </mesh>
        {/* Mooring Windlasses */}
        <mesh position={[-0.8, 1.55, 8.6]} material={materials.craneCables}>
          <cylinderGeometry args={[0.22, 0.22, 0.35, 12]} />
        </mesh>
        <mesh position={[0.8, 1.55, 8.6]} material={materials.craneCables}>
          <cylinderGeometry args={[0.22, 0.22, 0.35, 12]} />
        </mesh>
        {/* Forecastle Mast */}
        <mesh position={[0, 2.1, 9.2]} material={materials.deck}>
          <cylinderGeometry args={[0.03, 0.05, 1.6, 8]} />
        </mesh>

        {/* Hatch Coamings & Centerline Cranes */}
        {cargoEquipment}

        {/* Aft Castle Superstructure (Accommodation & Wheelhouse) */}
        <group position={[0, 1.0, -6.6]}>
          {/* Main Castle Block */}
          <mesh position={[0, 0.8, 0]} castShadow material={materials.superstructure}>
            <boxGeometry args={[3.1, 1.6, 3.2]} />
          </mesh>
          {/* Wheelhouse & Bridge Wings */}
          <mesh position={[0, 1.9, 0.3]} castShadow material={materials.superstructure}>
            <boxGeometry args={[4.2, 0.7, 1.8]} />
          </mesh>
          {/* Bridge Glazing */}
          <mesh position={[0, 1.95, 1.22]} material={materials.windows}>
            <boxGeometry args={[4.0, 0.35, 0.08]} />
          </mesh>

          {/* Tall Exhaust Funnel */}
          <mesh position={[0, 2.6, -0.6]} castShadow material={materials.funnel}>
            <cylinderGeometry args={[0.35, 0.45, 1.6, 16]} />
          </mesh>
          <mesh position={[0, 3.0, -0.6]} material={materials.funnelInsignia}>
            <cylinderGeometry args={[0.36, 0.36, 0.35, 16]} />
          </mesh>

          {/* Radar Mast & Satellite Communication Domes */}
          <mesh position={[0, 2.9, 0.4]} material={materials.superstructure}>
            <cylinderGeometry args={[0.04, 0.07, 1.4, 8]} />
          </mesh>
          <mesh position={[-0.7, 2.6, 0.3]} material={materials.superstructure}>
            <sphereGeometry args={[0.22, 12, 12]} />
          </mesh>
          <mesh position={[0.7, 2.6, 0.3]} material={materials.superstructure}>
            <sphereGeometry args={[0.22, 12, 12]} />
          </mesh>
        </group>

        {/* Navigation Lanterns */}
        {/* Starboard Green */}
        <mesh position={[2.15, 2.9, -6.3]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0x10b981} />
        </mesh>
        {/* Port Red */}
        <mesh position={[-2.15, 2.9, -6.3]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0xef4444} />
        </mesh>
        {/* Forward Masthead White */}
        <mesh position={[0, 2.9, 9.2]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0xf8fafc} />
        </mesh>
        {/* Main Masthead White */}
        <mesh position={[0, 4.2, -6.2]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={0xf8fafc} />
        </mesh>

        {/* Propeller Wash & Stern Foam */}
        <mesh ref={wakeRef} position={[0, -0.3, -13.0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.0, 11.0]} />
          <meshBasicMaterial color={0xd1fae5} transparent opacity={0.32} depthWrite={false} />
        </mesh>

        {/* Bow Wave Foam */}
        <mesh ref={bowWaveRef} position={[0, -0.2, 10.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 2.6, 16, 1, 0, Math.PI]} />
          <meshBasicMaterial color={0xe0f2fe} transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
