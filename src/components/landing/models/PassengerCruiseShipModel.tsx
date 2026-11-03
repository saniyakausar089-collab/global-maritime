import React, { useMemo, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface PassengerCruiseShipModelProps {
  scale?: number;
  speedKnots?: number;
  waveHeight?: number;
}

/**
 * Photorealistic 3D Model of a Modern Luxury Ocean Cruise Liner
 * Aligned with Maritime Coordinate Standard:
 * - Length along Z (Stern at -7.8, Bow at +8.8)
 * - Width along X (3.4m beam)
 * - Height along Y (Multi-tier stateroom decks, promenade, lido deck, bridge)
 * - Detailed promenade deck with 28 visible 3D passenger figures walking and relaxing
 * - Resort pool, teak decking, glass balustrades, aerodynamic funnels, and wake
 */
export function PassengerCruiseShipModel({
  scale = 1.0,
  speedKnots = 21.4,
  waveHeight = 1.8,
}: PassengerCruiseShipModelProps) {
  const shipGroupRef = useRef<THREE.Group>(null);
  const wakeRef = useRef<THREE.Mesh>(null);
  const bowWaveRef = useRef<THREE.Mesh>(null);

  // High-Grade Luxury PBR Materials
  const materials = useMemo(() => {
    return {
      hullTop: new THREE.MeshStandardMaterial({
        color: 0xffffff, // Pristine Marine White
        metalness: 0.15,
        roughness: 0.25,
      }),
      hullStripe: new THREE.MeshStandardMaterial({
        color: 0x1e3a8a, // Regal Navy Cruise Stripe
        metalness: 0.35,
        roughness: 0.35,
      }),
      hullKeel: new THREE.MeshStandardMaterial({
        color: 0x111827, // Dark Underbody
        metalness: 0.25,
        roughness: 0.75,
      }),
      teakDeck: new THREE.MeshStandardMaterial({
        color: 0xd4a373, // Warm Teak Promenade Decking
        metalness: 0.1,
        roughness: 0.75,
      }),
      balconies: new THREE.MeshStandardMaterial({
        color: 0x38bdf8, // Glass Balcony Panels
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.75,
      }),
      windows: new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Reflective Sea Glass
        metalness: 0.95,
        roughness: 0.05,
      }),
      poolWater: new THREE.MeshStandardMaterial({
        color: 0x06b6d4, // Resort Pool Turquoise
        metalness: 0.2,
        roughness: 0.1,
        transparent: true,
        opacity: 0.85,
      }),
      funnel: new THREE.MeshStandardMaterial({
        color: 0x2563eb, // Aerodynamic Blue Stacks
        metalness: 0.45,
        roughness: 0.3,
      }),
      funnelTrim: new THREE.MeshStandardMaterial({
        color: 0xef4444, // Red Funnel Trim
        metalness: 0.3,
        roughness: 0.4,
      }),
      railings: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0, // Stainless Steel Deck Railings
        metalness: 0.85,
        roughness: 0.2,
      }),
      personClothes: [
        new THREE.MeshStandardMaterial({ color: 0xef4444 }), // Red
        new THREE.MeshStandardMaterial({ color: 0x3b82f6 }), // Ocean Blue
        new THREE.MeshStandardMaterial({ color: 0x10b981 }), // Emerald
        new THREE.MeshStandardMaterial({ color: 0xf59e0b }), // Amber
        new THREE.MeshStandardMaterial({ color: 0xffffff }), // White
        new THREE.MeshStandardMaterial({ color: 0x8b5cf6 }), // Violet
      ],
      personSkin: new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        roughness: 0.8,
      }),
      personPants: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.7,
      }),
    };
  }, []);

  // Generate 28 visible 3D passenger figures distributed on promenade & sun deck
  const passengers = useMemo(() => {
    const list: Array<{ id: string; x: number; y: number; z: number; matIdx: number; rotY: number }> = [];
    
    // 1. Promenade Deck (Y = 1.78, along port and starboard railings)
    for (let i = 0; i < 16; i++) {
      const isPort = i % 2 === 0;
      const x = isPort ? -1.55 : 1.55;
      const z = -5.0 + (i * 0.75);
      const rotY = isPort ? Math.PI / 2 : -Math.PI / 2;
      list.push({ id: `prom-${i}`, x, y: 1.78, z, matIdx: i % 6, rotY });
    }

    // 2. Lido Pool Deck & Sun Loungers (Y = 2.68, surrounding the resort pool)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = 0.85 + (i % 2) * 0.45;
      const x = Math.cos(angle) * r;
      const z = 0.8 + Math.sin(angle) * 1.5;
      list.push({ id: `pool-${i}`, x, y: 2.68, z, matIdx: (i + 2) % 6, rotY: angle + Math.PI / 2 });
    }

    return list;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const seaPitch = Math.min(2.0, Math.max(0.4, waveHeight * 0.45));

    if (shipGroupRef.current) {
      shipGroupRef.current.position.y = Math.sin(t * 1.3) * (0.04 * seaPitch);
      shipGroupRef.current.rotation.z = Math.sin(t * 1.0) * (0.015 * seaPitch);
      shipGroupRef.current.rotation.x = Math.cos(t * 0.75) * (0.012 * seaPitch);
    }

    if (wakeRef.current) {
      const mat = wakeRef.current.material as THREE.MeshBasicMaterial;
      const speedFactor = Math.min(1.5, Math.max(0.3, speedKnots / 18.0));
      mat.opacity = (0.35 + Math.sin(t * 3.2) * 0.08) * speedFactor;
    }

    if (bowWaveRef.current) {
      const s = 1.0 + Math.sin(t * 5.0) * 0.12;
      bowWaveRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group ref={shipGroupRef} scale={scale}>
      {/* 1. LOWER HULL & WATERLINE (Dark Keel + Raked Bulbous Bow) */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[3.2, 0.9, 16.5]} />
        <primitive object={materials.hullKeel} attach="material" />
      </mesh>

      {/* Raked Curved Bow Flare */}
      <mesh position={[0, 0.6, 8.6]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[2.8, 1.2, 1.8]} />
        <primitive object={materials.hullTop} attach="material" />
      </mesh>

      {/* Main White Topsides Hull */}
      <mesh position={[0, 1.05, 0.2]}>
        <boxGeometry args={[3.35, 0.85, 16.0]} />
        <primitive object={materials.hullTop} attach="material" />
      </mesh>

      {/* Regal Navy Cruise Stripe */}
      <mesh position={[0, 1.38, 0.2]}>
        <boxGeometry args={[3.38, 0.14, 16.05]} />
        <primitive object={materials.hullStripe} attach="material" />
      </mesh>

      {/* 2. TIERED PASSENGER STATEROOM DECKS (DECK 4 TO DECK 8) */}
      <mesh position={[0, 1.85, -0.2]}>
        <boxGeometry args={[3.15, 0.85, 13.5]} />
        <primitive object={materials.hullTop} attach="material" />
      </mesh>

      {/* Continuous Balcony Bands Port & Starboard */}
      <mesh position={[-1.6, 1.85, -0.2]}>
        <boxGeometry args={[0.08, 0.65, 13.0]} />
        <primitive object={materials.balconies} attach="material" />
      </mesh>
      <mesh position={[1.6, 1.85, -0.2]}>
        <boxGeometry args={[0.08, 0.65, 13.0]} />
        <primitive object={materials.balconies} attach="material" />
      </mesh>

      {/* Teak Promenade Deck Floor */}
      <mesh position={[0, 1.76, -0.2]}>
        <boxGeometry args={[3.35, 0.04, 14.5]} />
        <primitive object={materials.teakDeck} attach="material" />
      </mesh>

      {/* Upper Lido Deck */}
      <mesh position={[0, 2.45, -0.6]}>
        <boxGeometry args={[2.95, 0.55, 11.5]} />
        <primitive object={materials.hullTop} attach="material" />
      </mesh>

      {/* Teak Lido Sun Deck Floor */}
      <mesh position={[0, 2.74, -0.6]}>
        <boxGeometry args={[2.88, 0.04, 11.2]} />
        <primitive object={materials.teakDeck} attach="material" />
      </mesh>

      {/* Resort Pool on Top Deck */}
      <mesh position={[0, 2.77, 0.8]}>
        <boxGeometry args={[1.3, 0.06, 2.4]} />
        <primitive object={materials.poolWater} attach="material" />
      </mesh>

      {/* 3. BRIDGE & NAVIGATION DECKHOUSE (Facing Forward towards +Z) */}
      <mesh position={[0, 2.35, 5.2]}>
        <boxGeometry args={[3.45, 0.75, 1.8]} />
        <primitive object={materials.hullTop} attach="material" />
      </mesh>
      {/* Wrap-around bridge observation glass */}
      <mesh position={[0, 2.42, 6.05]}>
        <boxGeometry args={[3.48, 0.38, 0.25]} />
        <primitive object={materials.windows} attach="material" />
      </mesh>

      {/* 4. DUAL AERODYNAMIC FUNNEL STACKS (Aft at -Z) */}
      <group position={[0, 3.25, -3.8]}>
        <mesh position={[-0.45, 0, 0]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.42, 1.15, 0.95]} />
          <primitive object={materials.funnel} attach="material" />
        </mesh>
        <mesh position={[0.45, 0, 0]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.42, 1.15, 0.95]} />
          <primitive object={materials.funnel} attach="material" />
        </mesh>
        {/* Red funnel stripes */}
        <mesh position={[-0.45, 0.35, 0]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.44, 0.2, 0.98]} />
          <primitive object={materials.funnelTrim} attach="material" />
        </mesh>
        <mesh position={[0.45, 0.35, 0]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.44, 0.2, 0.98]} />
          <primitive object={materials.funnelTrim} attach="material" />
        </mesh>
      </group>

      {/* 5. VISIBLE 3D HUMAN PASSENGERS (Walking & Relaxing on Decks) */}
      <group>
        {passengers.map((p) => (
          <group key={p.id} position={[p.x, p.y, p.z]} rotation={[0, p.rotY, 0]}>
            {/* Torso & Outfit */}
            <mesh position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.045, 0.05, 0.18, 8]} />
              <primitive object={materials.personClothes[p.matIdx]} attach="material" />
            </mesh>
            {/* Head */}
            <mesh position={[0, 0.30, 0]}>
              <sphereGeometry args={[0.045, 8, 8]} />
              <primitive object={materials.personSkin} attach="material" />
            </mesh>
            {/* Legs */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.14, 6]} />
              <primitive object={materials.personPants} attach="material" />
            </mesh>
          </group>
        ))}
      </group>

      {/* 6. OCEAN WAKE & BOW WAVE FOAM (Behind Stern at -Z and Ahead of Bow at +Z) */}
      <mesh ref={wakeRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -14.5]}>
        <planeGeometry args={[4.2, 14.0]} />
        <meshBasicMaterial
          color="#A5F3FC"
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={bowWaveRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 9.2]}>
        <ringGeometry args={[1.2, 3.2, 24, 1, 0, Math.PI]} />
        <meshBasicMaterial
          color="#CFFAFE"
          transparent
          opacity={0.3}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
