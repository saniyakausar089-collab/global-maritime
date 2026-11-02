import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface RippleNode {
  name: string;
  pos: THREE.Vector3;
  status: "disrupted" | "cascading" | "normal";
  delayHours: number;
}

/**
 * 3D Global Ripple Effect Network.
 * Illustrates systemic disruption contagion across the global maritime supply chain:
 * - Origin Hub (Rotterdam / Red Chokepoint)
 * - Cascading Secondary Hubs (Singapore, Hamburg, Santos)
 * - Downstream Shipping Corridors pulsing with delayed vessel queues
 */
export function RippleNetwork3D() {
  const pulsesRef = useRef<THREE.Group>(null);

  const nodes: RippleNode[] = useMemo(() => [
    { name: "Rotterdam", pos: new THREE.Vector3(0, 0, 0), status: "disrupted", delayHours: 48 },
    { name: "Hamburg", pos: new THREE.Vector3(-4.5, 0, 4.0), status: "cascading", delayHours: 28 },
    { name: "Singapore", pos: new THREE.Vector3(12.0, 0, -8.0), status: "cascading", delayHours: 36 },
    { name: "Shanghai", pos: new THREE.Vector3(16.0, 0, 2.0), status: "normal", delayHours: 14 },
    { name: "Santos", pos: new THREE.Vector3(-14.0, 0, -10.0), status: "cascading", delayHours: 22 },
    { name: "Los Angeles", pos: new THREE.Vector3(-18.0, 0, 6.0), status: "normal", delayHours: 12 },
  ], []);

  // Luminous Corridors between nodes
  const corridors = useMemo(() => {
    const lines = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p1 = nodes[i]!.pos;
        const p2 = nodes[j]!.pos;
        if (p1.distanceTo(p2) < 22) {
          const mid = p1.clone().add(p2).multiplyScalar(0.5);
          mid.y += 1.8; // Subtle arch curve
          const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
          const pts = curve.getPoints(24);
          const geo = new THREE.BufferGeometry().setFromPoints(pts);

          const isDisruptedLine = nodes[i]!.status === "disrupted" || nodes[j]!.status === "disrupted";
          const mat = new THREE.LineBasicMaterial({
            color: isDisruptedLine ? 0xff5577 : 0x22d3ee,
            transparent: true,
            opacity: isDisruptedLine ? 0.75 : 0.35,
          });
          lines.push(<primitive key={`line-${i}-${j}`} object={new THREE.Line(geo, mat)} />);
        }
      }
    }
    return lines;
  }, [nodes]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (pulsesRef.current) {
      pulsesRef.current.children.forEach((child, idx) => {
        const s = 1.0 + ((t * 1.5 + idx * 0.4) % 1.5) * 1.2;
        child.scale.set(s, 1, s);
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - (s - 1.0) / 1.5);
        }
      });
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Luminous Trade Corridors */}
      <group>{corridors}</group>

      {/* 2. Port Nodes with Status Halos */}
      {nodes.map((node, idx) => {
        const isDisrupted = node.status === "disrupted";
        const isCascading = node.status === "cascading";
        const color = isDisrupted ? "#FF5577" : isCascading ? "#FFB547" : "#22D3EE";

        return (
          <group key={idx} position={node.pos}>
            {/* Core Node Marker */}
            <mesh position={[0, 0.2, 0]}>
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.8}
                metalness={0.5}
                roughness={0.2}
              />
            </mesh>
            {/* Base Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
              <ringGeometry args={[0.5, 0.65, 24]} />
              <meshBasicMaterial color={color} transparent opacity={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* 3. Concentric Ripple Waves emanating from Rotterdam */}
      <group ref={pulsesRef} position={[0, 0.08, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={`pulse-${i}`} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.2, 1.35, 32]} />
            <meshBasicMaterial
              color="#FF5577"
              transparent
              opacity={0.8}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
