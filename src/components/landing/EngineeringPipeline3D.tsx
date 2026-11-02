import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface PipelineStage {
  title: string;
  subtitle: string;
  pos: [number, number, number];
  color: string;
}

/**
 * 3D Data Pipeline and System Architecture Visualization.
 * Depicts the live engineering pipeline of Global Maritime:
 * 1. AIS Ingestion (WebSocket / AISStream.io)
 * 2. In-Memory Temporal Buffer & Dead-Reckoning
 * 3. Geospatial Geofence Engine (Ray-casting point-in-polygon)
 * 4. Port Congestion Analytics & CI Scoring
 * 5. Open-Meteo Marine Weather Overlay
 * 6. Temporal Time Machine & Digital Twin Store
 */
export function EngineeringPipeline3D() {
  const particlesRef = useRef<THREE.Points>(null);

  const stages: PipelineStage[] = useMemo(() => [
    { title: "AIS Ingestion", subtitle: "AISStream.io WebSocket", pos: [-15, 0, 0], color: "#22D3EE" },
    { title: "Stream Relay", subtitle: "Node.js WebSocket Hub", pos: [-9, 0, 0], color: "#3978FF" },
    { title: "Dead-Reckoning", subtitle: "Kinematic Extrapolation", pos: [-3, 0, 0], color: "#A78BFA" },
    { title: "Geofence Engine", subtitle: "Ray-casting In-Polygon", pos: [3, 0, 0], color: "#18D69B" },
    { title: "Congestion Index", subtitle: "Capacity Ratio Engine", pos: [9, 0, 0], color: "#FFB547" },
    { title: "Time Machine", subtitle: "4D Temporal Store", pos: [15, 0, 0], color: "#22D3EE" },
  ], []);

  // Animated data particles streaming through pipeline
  const particleCount = 48;
  const particlePositions = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      arr[i * 3] = -15 + (i / particleCount) * 30;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 8.0;
    if (particlesRef.current) {
      const geo = particlesRef.current.geometry;
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      if (pos && pos.array) {
        for (let i = 0; i < particleCount; i++) {
          let x = -15 + ((i * 0.65 + t) % 30);
          pos.setX(i, x);
        }
        pos.needsUpdate = true;
      }
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Conduit Pipeline Spine */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 32, 16]} />
        <meshStandardMaterial
          color="#172744"
          metalness={0.8}
          roughness={0.2}
          emissive="#22D3EE"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* 2. Pipeline Stage Hubs */}
      {stages.map((stage, idx) => (
        <group key={idx} position={stage.pos}>
          {/* Central Processor Node */}
          <mesh>
            <cylinderGeometry args={[0.6, 0.6, 0.35, 24]} />
            <meshStandardMaterial
              color="#111E36"
              metalness={0.8}
              roughness={0.2}
              emissive={stage.color}
              emissiveIntensity={0.6}
            />
          </mesh>

          {/* Luminous Core Ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.75, 0.9, 32]} />
            <meshBasicMaterial
              color={stage.color}
              transparent
              opacity={0.85}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}

      {/* 3. Fast Data Stream Particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.25}
          color="#22D3EE"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
