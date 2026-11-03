import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ContainerShipModel } from "./models/ContainerShipModel";

interface TimePortalTunnel3DProps {
  progress?: number; // 0 to 1 within Scene 04
}

/**
 * 4D Temporal Portal & Relativistic Warp Tunnel
 * Features:
 * 1. Multiple layers of concentric glowing circular torus rings in counter-rotation
 * 2. High-speed warp particle vortex flowing in cyan, quantum blue, and violet
 * 3. Deep light streaks giving extreme perspective into the temporal corridor
 * 4. The camera physically travels through the tunnel (Z: +8 -> -22)
 * 5. On the other side (Z <= -16): A calm, peaceful ocean with smooth sailing ships
 *    visually communicating the transition from congestion (CI 1.84) to smooth flow (CI 0.92)
 */
export function TimePortalTunnel3D({ progress = 0.5 }: TimePortalTunnel3DProps) {
  const outerRingRef = useRef<THREE.Mesh>(null);
  const midRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const tunnelParticlesRef = useRef<THREE.Points>(null);
  const streakLinesRef = useRef<THREE.LineSegments>(null);
  const calmShipRef = useRef<THREE.Group>(null);

  // 1. Concentric Tunnel Gate Rings Spaced Along Tunnel Axis
  const tunnelZPositions = useMemo(() => [4.0, 1.0, -2.0, -5.0, -8.0, -11.0, -14.0], []);

  // 2. High-Speed Warp Stream Particles
  const particleCount = 2400;
  const { particleGeo, initParticles } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const initialData = [];

    const c1 = new THREE.Color("#22D3EE"); // Electric Cyan
    const c2 = new THREE.Color("#0284C7"); // Quantum Blue
    const c3 = new THREE.Color("#A855F7"); // Temporal Violet

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.4 + Math.random() * 4.5;
      const z = -22.0 + Math.random() * 32.0;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius + 3.2; // Elevated at portal eye level
      positions[i * 3 + 2] = z;

      initialData.push({ angle, radius, z });

      const mix = Math.random();
      const col = mix < 0.5 ? c1.clone().lerp(c2, mix * 2) : c2.clone().lerp(c3, (mix - 0.5) * 2);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return { particleGeo: geo, initParticles: initialData };
  }, [particleCount]);

  // 3. Deep Linear Relativistic Light Streaks
  const streakCount = 140;
  const { streakGeo } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(streakCount * 6);

    for (let i = 0; i < streakCount; i++) {
      const angle = (i / streakCount) * Math.PI * 2;
      const r = 2.2 + Math.random() * 4.0;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r + 3.2;
      const z1 = -24.0 + Math.random() * 28.0;
      const len = 4.0 + Math.random() * 7.0;

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z1;

      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z1 + len;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { streakGeo: geo };
  }, [streakCount]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    // Rotate Portal Rings in counter-motion
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = t * 0.9;
    }
    if (midRingRef.current) {
      midRingRef.current.rotation.z = -t * 1.35;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = t * 1.8;
    }

    // High-speed Warp particle travel along the tunnel axis toward viewer
    if (tunnelParticlesRef.current) {
      const posAttr = tunnelParticlesRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      if (posAttr && posAttr.array) {
        const arr = posAttr.array as Float32Array;
        const speed = 35.0 * delta;
        for (let i = 0; i < particleCount; i++) {
          let z = arr[i * 3 + 2] + speed;
          if (z > 10.0) {
            z = -22.0;
          }
          arr[i * 3 + 2] = z;
        }
        posAttr.needsUpdate = true;
      }
    }

    // Peaceful calm cruising ship on the other side
    if (calmShipRef.current) {
      calmShipRef.current.position.y = 0.05 + Math.sin(t * 1.0) * 0.02; // very gentle heave
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* ========================================================================= */}
      {/* 1. MAIN QUANTUM TIME PORTAL APERTURE (Z = 2.0)                           */}
      {/* ========================================================================= */}
      <group position={[0, 3.2, 2.0]}>
        {/* Core Quantum Portal Light Source */}
        <pointLight color="#22D3EE" intensity={6} distance={15} />
        <pointLight color="#A855F7" intensity={4} distance={10} position={[0, 0, -3]} />

        {/* Outer Heavy Energy Torus Ring */}
        <mesh ref={outerRingRef}>
          <torusGeometry args={[4.4, 0.18, 24, 64]} />
          <meshStandardMaterial
            color="#22D3EE"
            emissive="#22D3EE"
            emissiveIntensity={3.5}
            roughness={0.1}
          />
        </mesh>

        {/* Mid Quantum Blue Ring */}
        <mesh ref={midRingRef}>
          <torusGeometry args={[3.6, 0.14, 24, 64]} />
          <meshStandardMaterial
            color="#0284C7"
            emissive="#0284C7"
            emissiveIntensity={3.0}
            roughness={0.1}
          />
        </mesh>

        {/* Inner Violet Transition Aperture */}
        <mesh ref={innerRingRef}>
          <torusGeometry args={[2.8, 0.12, 24, 64]} />
          <meshStandardMaterial
            color="#A855F7"
            emissive="#A855F7"
            emissiveIntensity={3.2}
            roughness={0.1}
          />
        </mesh>

        {/* Translucent Event Horizon Disc */}
        <mesh position={[0, 0, -0.1]}>
          <circleGeometry args={[2.8, 48]} />
          <meshBasicMaterial
            color="#22D3EE"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* 2. CONTAINER VESSEL SAILING THROUGH THE WARP TUNNEL (Frame 4 Reference)   */}
      {/* ========================================================================= */}
      <group position={[0, 0, 2.5]} rotation={[0, Math.PI, 0]}>
        <ContainerShipModel scale={0.75} speedKnots={22.0} waveHeight={0.9} />
        {/* Luminous blue engine wake inside the tunnel */}
        <mesh position={[0, -0.04, -12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.2, 16]} />
          <meshBasicMaterial
            color="#38BDF8"
            transparent
            opacity={0.45}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* 3. RECURRING CONCENTRIC TUNNEL RINGS CREATING PHYSICAL DEPTH             */}
      {/* ========================================================================= */}
      {tunnelZPositions.map((z, idx) => (
        <group key={`gate-${idx}`} position={[0, 3.2, z]}>
          <mesh>
            <torusGeometry args={[3.8 - idx * 0.15, 0.08, 16, 48]} />
            <meshBasicMaterial
              color={idx % 2 === 0 ? "#22D3EE" : "#818CF8"}
              transparent
              opacity={0.55 - idx * 0.05}
            />
          </mesh>
        </group>
      ))}

      {/* ========================================================================= */}
      {/* 3. WARP PARTICLES & RELATIVISTIC LIGHT STREAKS                           */}
      {/* ========================================================================= */}
      <points ref={tunnelParticlesRef} geometry={particleGeo}>
        <pointsMaterial
          size={0.14}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <lineSegments ref={streakLinesRef} geometry={streakGeo}>
        <lineBasicMaterial
          color="#38BDF8"
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* ========================================================================= */}
      {/* 4. ON THE OTHER SIDE (Z <= -18): CALM PEACEFUL OCEAN & SMOOTH FLOW SHIPS */}
      {/* Visually communicates the transition from high congestion to clear flow  */}
      {/* ========================================================================= */}
      <group position={[0, 0, -26.0]}>
        {/* Serene Azure Water Floor Patch on the other side */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[45, 30]} />
          <meshStandardMaterial
            color="#0369A1"
            roughness={0.15}
            metalness={0.6}
            transparent
            opacity={0.88}
          />
        </mesh>

        {/* Gentle Ambient Warm Sunlight on the Future Side */}
        <pointLight color="#38BDF8" intensity={4} distance={25} position={[0, 8, 0]} />

        {/* Smooth Sailing Container Vessel with Zero Queue Delays */}
        <group ref={calmShipRef} position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
          <ContainerShipModel scale={0.85} speedKnots={20.5} waveHeight={0.6} />

          {/* Glowing Green Optimal Passage Vector Line */}
          <mesh position={[0, 0.15, -12]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.3, 20]} />
            <meshBasicMaterial color="#10B981" transparent opacity={0.7} />
          </mesh>

          <mesh position={[0, 3.6, 0]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshBasicMaterial color="#10B981" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
