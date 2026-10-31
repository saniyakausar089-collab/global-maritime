import React, { useMemo, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface TankerShipModelProps {
  scale?: number;
  speedKnots?: number;
  waveHeight?: number;
}

/**
 * Photorealistic 3D Model of a Suezmax / VLCC Crude Tanker
 * Features:
 * - Low freeboard loaded hull in dark iron and antifouling oxide
 * - Central pipe rack with manifold piping, valves, and manifold cranes
 * - Longitudinal crew catwalk over pipe runs
 * - Cargo tank hatches & PV relief valves
 * - Aft accommodation block with twin funnels and bridge wings
 * - Navigation lanterns (red port, green stbd, white masthead)
 * - Hydrodynamic wake foam and sea-state pitch/roll/heave
 */
export function TankerShipModel({
  scale = 1.0,
  speedKnots = 13.5,
  waveHeight = 1.6,
}: TankerShipModelProps) {
  const shipGroupRef = useRef<THREE.Group>(null);
  const wakeRef = useRef<THREE.Mesh>(null);
  const bowWaveRef = useRef<THREE.Mesh>(null);

  // PBR Materials
  const materials = useMemo(() => {
    return {
      hullTop: new THREE.MeshStandardMaterial({
        color: 0x11161d, // Dark industrial charcoal/iron
        metalness: 0.5,
        roughness: 0.45,
      }),
      hullKeel: new THREE.MeshStandardMaterial({
        color: 0x7c2d12, // Deep oxidized maritime red
        metalness: 0.25,
        roughness: 0.75,
      }),
      deck: new THREE.MeshStandardMaterial({
        color: 0x242d38, // Non-skid weather deck
        metalness: 0.4,
        roughness: 0.6,
      }),
      manifoldPipe: new THREE.MeshStandardMaterial({
        color: 0xd97706, // Amber/yellow marine fuel & crude cargo piping
        metalness: 0.6,
        roughness: 0.35,
      }),
      manifoldValves: new THREE.MeshStandardMaterial({
        color: 0xdc2626, // Red emergency shut-off valves
        metalness: 0.5,
        roughness: 0.4,
      }),
      catwalk: new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // Galvanized steel grating
        metalness: 0.8,
        roughness: 0.3,
      }),
      cranes: new THREE.MeshStandardMaterial({
        color: 0xeab308, // Marine safety yellow
        metalness: 0.5,
        roughness: 0.4,
      }),
      superstructure: new THREE.MeshStandardMaterial({
        color: 0xf8fafc, // Pure marine white accommodation block
        metalness: 0.2,
        roughness: 0.3,
      }),
      windows: new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Reflective bridge tinted glazing
        metalness: 0.95,
        roughness: 0.05,
      }),
      funnel: new THREE.MeshStandardMaterial({
        color: 0x1e293b, // Dark charcoal twin funnels with red band
        metalness: 0.4,
        roughness: 0.5,
      }),
      funnelBand: new THREE.MeshStandardMaterial({
        color: 0xef4444, // Red fleet identification stripe
        metalness: 0.3,
        roughness: 0.4,
      }),
      hatchCovers: new THREE.MeshStandardMaterial({
        color: 0x334155, // Tank inspection dome covers
        metalness: 0.6,
        roughness: 0.45,
      }),
    };
  }, []);

  // Generate cargo tank hatches and PV relief valves along deck
  const deckEquipment = useMemo(() => {
    const items: ReactElement[] = [];
    const tankPositions = [-5.5, -3.5, -1.5, 0.5, 2.5, 4.5, 6.5];

    tankPositions.forEach((z, idx) => {
      // Port and Starboard inspection domes
      items.push(
        <mesh key={`hatch-p-${idx}`} position={[-1.0, 0.65, z]} material={materials.hatchCovers}>
          <cylinderGeometry args={[0.32, 0.35, 0.2, 16]} />
        </mesh>
      );
      items.push(
        <mesh key={`hatch-s-${idx}`} position={[1.0, 0.65, z]} material={materials.hatchCovers}>
          <cylinderGeometry args={[0.32, 0.35, 0.2, 16]} />
        </mesh>
      );

      // Pressure-vacuum relief riser masts
      if (idx % 2 === 0) {
        items.push(
          <group key={`pv-riser-${idx}`} position={[-0.4, 1.2, z]}>
            <mesh material={materials.catwalk}>
              <cylinderGeometry args={[0.04, 0.04, 1.3, 8]} />
            </mesh>
            <mesh position={[0, 0.7, 0]} material={materials.manifoldValves}>
              <sphereGeometry args={[0.09, 8, 8]} />
            </mesh>
          </group>
        );
      }
    });

    return items;
  }, [materials]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const seaIntensity = Math.min(2.5, Math.max(0.5, waveHeight * 0.5));

    if (shipGroupRef.current) {
      // Tankers have high inertia: sluggish, deep-heaving roll & pitch
      shipGroupRef.current.rotation.z = Math.sin(t * 1.1) * (0.016 * seaIntensity); // Sluggish roll
      shipGroupRef.current.rotation.x = Math.cos(t * 0.85) * (0.009 * seaIntensity); // Pitch
      shipGroupRef.current.position.y = Math.sin(t * 1.3) * (0.05 * seaIntensity); // Heave
    }

    if (wakeRef.current) {
      const mat = wakeRef.current.material as THREE.MeshBasicMaterial;
      const speedFactor = Math.min(1.4, Math.max(0.3, speedKnots / 13.0));
      mat.opacity = (0.32 + Math.sin(t * 2.8) * 0.07) * speedFactor;
    }

    if (bowWaveRef.current) {
      const bMat = bowWaveRef.current.material as THREE.MeshBasicMaterial;
      bMat.opacity = 0.25 + Math.sin(t * 3.5) * 0.08;
    }
  });

  return (
    <group scale={scale}>
      <group ref={shipGroupRef}>
        {/* Main Tanker Hull (Low Freeboard when laden) */}
        <mesh position={[0, 0.25, 0.8]} castShadow receiveShadow material={materials.hullTop}>
          <boxGeometry args={[3.6, 1.1, 18.4]} />
        </mesh>

        {/* Keel / Antifouling Underbody */}
        <mesh position={[0, -0.45, 0.6]} castShadow receiveShadow material={materials.hullKeel}>
          <boxGeometry args={[3.4, 0.7, 19.0]} />
        </mesh>

        {/* Blunt Cylindrical Tanker Bow (Full block coefficient) */}
        <mesh
          position={[0, 0.25, 10.1]}
          rotation={[Math.PI / 2, 0, Math.PI / 4]}
          scale={[1.35, 0.85, 1.0]}
          castShadow
          material={materials.hullTop}
        >
          <coneGeometry args={[2.0, 3.4, 4]} />
        </mesh>

        {/* Bulbous Bow (Immersed) */}
        <mesh position={[0, -0.45, 10.4]} scale={[0.9, 0.8, 1.8]} material={materials.hullKeel}>
          <sphereGeometry args={[0.8, 16, 16]} />
        </mesh>

        {/* Weather Deck Inset */}
        <mesh position={[0, 0.81, 0.5]} receiveShadow material={materials.deck}>
          <boxGeometry args={[3.45, 0.05, 17.6]} />
        </mesh>

        {/* Forecastle Head (Raised Forward Platform) */}
        <mesh position={[0, 1.1, 8.8]} castShadow material={materials.superstructure}>
          <boxGeometry args={[3.2, 0.55, 2.2]} />
        </mesh>
        {/* Forecastle Jackstaff / Forward Mast */}
        <mesh position={[0, 2.0, 9.6]} material={materials.superstructure}>
          <cylinderGeometry args={[0.03, 0.06, 1.5, 8]} />
        </mesh>

        {/* Elevated Catwalk Running Over Main Deck */}
        <mesh position={[0, 1.15, 0.5]} castShadow material={materials.catwalk}>
          <boxGeometry args={[0.35, 0.06, 15.2]} />
        </mesh>
        {/* Catwalk Support Pillars */}
        {[-6, -4, -2, 0, 2, 4, 6].map((z, idx) => (
          <mesh key={`cw-post-${idx}`} position={[0, 0.98, z]} material={materials.catwalk}>
            <boxGeometry args={[0.05, 0.32, 0.05]} />
          </mesh>
        ))}

        {/* Central Cargo Manifold (Midships Pipeline Network) */}
        <group position={[0, 0.95, 0.5]}>
          {/* Main Transverse Manifold Headers */}
          {[-0.6, -0.2, 0.2, 0.6].map((offsetZ, pIdx) => (
            <mesh key={`manifold-p-${pIdx}`} position={[0, 0.15, offsetZ]} rotation={[0, 0, Math.PI / 2]} material={materials.manifoldPipe}>
              <cylinderGeometry args={[0.1, 0.1, 3.3, 16]} />
            </mesh>
          ))}
          {/* Longitudinal Fuel Feed Line */}
          <mesh position={[-0.45, 0.12, 0]} material={materials.manifoldPipe}>
            <cylinderGeometry args={[0.08, 0.08, 14.8, 12]} />
          </mesh>
          {/* Manifold Shutoff Control Valves */}
          {[-1.3, -0.7, 0.7, 1.3].map((valvX, vIdx) => (
            <mesh key={`valv-${vIdx}`} position={[valvX, 0.35, 0.2]} material={materials.manifoldValves}>
              <sphereGeometry args={[0.11, 10, 10]} />
            </mesh>
          ))}
          {/* Manifold Hose Handling Crane (Port & Starboard) */}
          <group position={[-1.2, 0, -1.1]}>
            <mesh position={[0, 0.8, 0]} material={materials.cranes}>
              <cylinderGeometry args={[0.1, 0.12, 1.6, 12]} />
            </mesh>
            <mesh position={[0.4, 1.6, 0.3]} rotation={[0.4, -0.3, 0.4]} material={materials.cranes}>
              <boxGeometry args={[0.1, 1.4, 0.1]} />
            </mesh>
          </group>
          <group position={[1.2, 0, -1.1]}>
            <mesh position={[0, 0.8, 0]} material={materials.cranes}>
              <cylinderGeometry args={[0.1, 0.12, 1.6, 12]} />
            </mesh>
            <mesh position={[-0.4, 1.6, 0.3]} rotation={[0.4, 0.3, -0.4]} material={materials.cranes}>
              <boxGeometry args={[0.1, 1.4, 0.1]} />
            </mesh>
          </group>
        </group>

        {/* Deck Tank Equipment */}
        {deckEquipment}

        {/* Aft Poop Deck & Superstructure Block (Living Quarters) */}
        <group position={[0, 0.85, -6.8]}>
          {/* Level 1 Accommodations */}
          <mesh position={[0, 0.6, 0]} castShadow material={materials.superstructure}>
            <boxGeometry args={[3.2, 1.15, 3.4]} />
          </mesh>
          {/* Level 2 Officer Deck */}
          <mesh position={[0, 1.5, 0.1]} castShadow material={materials.superstructure}>
            <boxGeometry args={[3.0, 0.8, 3.0]} />
          </mesh>
          {/* Navigation Bridge with Flying Wings */}
          <mesh position={[0, 2.25, 0.4]} castShadow material={materials.superstructure}>
            <boxGeometry args={[4.2, 0.7, 2.0]} />
          </mesh>
          {/* Bridge Windows (Panoramic) */}
          <mesh position={[0, 2.32, 1.42]} material={materials.windows}>
            <boxGeometry args={[4.0, 0.38, 0.08]} />
          </mesh>

          {/* Twin Modern Exhaust Funnels (Aft) */}
          <mesh position={[-0.75, 2.8, -0.7]} castShadow material={materials.funnel}>
            <cylinderGeometry args={[0.22, 0.28, 1.4, 16]} />
          </mesh>
          <mesh position={[-0.75, 3.2, -0.7]} material={materials.funnelBand}>
            <cylinderGeometry args={[0.23, 0.23, 0.3, 16]} />
          </mesh>
          <mesh position={[0.75, 2.8, -0.7]} castShadow material={materials.funnel}>
            <cylinderGeometry args={[0.22, 0.28, 1.4, 16]} />
          </mesh>
          <mesh position={[0.75, 3.2, -0.7]} material={materials.funnelBand}>
            <cylinderGeometry args={[0.23, 0.23, 0.3, 16]} />
          </mesh>

          {/* Main Radar & Comms Mast */}
          <mesh position={[0, 3.1, 0.3]} material={materials.superstructure}>
            <cylinderGeometry args={[0.04, 0.08, 1.6, 8]} />
          </mesh>
          <mesh position={[0, 3.9, 0.3]} material={materials.superstructure}>
            <sphereGeometry args={[0.24, 12, 12]} />
          </mesh>

          {/* Enclosed Freefall Lifeboat (Aft Transom) */}
          <mesh position={[0, 1.1, -1.9]} rotation={[0.4, 0, 0]} material={materials.manifoldValves}>
            <capsuleGeometry args={[0.24, 0.8, 8, 12]} />
          </mesh>
        </group>

        {/* Navigation Lanterns */}
        {/* Starboard Green */}
        <mesh position={[2.15, 3.2, -6.4]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0x10b981} />
        </mesh>
        {/* Port Red */}
        <mesh position={[-2.15, 3.2, -6.4]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0xef4444} />
        </mesh>
        {/* Forward Masthead White */}
        <mesh position={[0, 2.8, 9.6]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={0xf8fafc} />
        </mesh>
        {/* Main Masthead White */}
        <mesh position={[0, 4.4, -6.5]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={0xf8fafc} />
        </mesh>

        {/* Propeller Wash & Stern Foam Turbulence */}
        <mesh ref={wakeRef} position={[0, -0.3, -13.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.2, 12.0]} />
          <meshBasicMaterial color={0xd1fae5} transparent opacity={0.35} depthWrite={false} />
        </mesh>

        {/* Bow Wave Foam Sprays */}
        <mesh ref={bowWaveRef} position={[0, -0.2, 10.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.6, 2.8, 16, 1, 0, Math.PI]} />
          <meshBasicMaterial color={0xe0f2fe} transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
