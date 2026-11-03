import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MONITORED_PORTS, latLonToVector3 } from "./constants";

interface PortCongestionGlobeBeaconsProps {
  globeRadius?: number;
  portsData?: Array<{ id: string; name: string; congestion_index?: number | null }>;
}

export function PortCongestionGlobeBeacons({
  globeRadius = 10,
  portsData,
}: PortCongestionGlobeBeaconsProps) {
  const ringsRef = useRef<THREE.Group>(null);

  // Compute rankings from actual data if available, or nominal project data
  const rankedPorts = useMemo(() => {
    const list = MONITORED_PORTS.map((p) => {
      const match = portsData?.find((item) => item.id.toLowerCase() === p.id.toLowerCase());
      const ci = match?.congestion_index != null ? Number(match.congestion_index) : p.ci;
      let status = "Normal";
      if (ci >= 1.4) status = "Congested";
      else if (ci >= 1.2) status = "Moderate";
      else if (ci < 1.0) status = "Clear";
      return { ...p, ci: Number(ci.toFixed(2)), status };
    });
    // Sort descending: highest CI to lowest CI
    list.sort((a, b) => b.ci - a.ci);
    return list.map((p, idx) => ({ ...p, rank: idx + 1 }));
  }, [portsData]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringsRef.current) {
      ringsRef.current.children.forEach((child, i) => {
        const s = 1.0 + Math.sin(t * 3.0 + i) * 0.25;
        child.scale.set(s, s, s);
      });
    }
  });

  return (
    <group>
      {rankedPorts.map((port) => {
        const pos = latLonToVector3(port.lat, port.lon, globeRadius);
        const normal = pos.clone().normalize();
        
        // Pillar height scaled proportionally to Congestion Index
        const pillarHeight = 1.2 + (port.ci - 0.8) * 1.5;
        const topPos = pos.clone().add(normal.clone().multiplyScalar(pillarHeight));
        const midPos = pos.clone().add(normal.clone().multiplyScalar(pillarHeight * 0.5));

        // High CI (>1.2) = Crimson/Red, Moderate (1.0-1.2) = Amber, Low (<1.0) = Cyan/Emerald
        const beaconColor =
          port.ci >= 1.4 ? "#FF4560" : port.ci >= 1.2 ? "#FFB547" : "#22D3EE";

        return (
          <group key={port.id}>
            {/* 1. Concentric Pulsing Base Ring */}
            <mesh position={pos} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)}>
              <ringGeometry args={[0.2, 0.55, 32]} />
              <meshBasicMaterial
                color={beaconColor}
                transparent
                opacity={0.75}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* 2. Vertical Light Pillar Cylinder */}
            <mesh
              position={midPos}
              quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)}
            >
              <cylinderGeometry args={[0.04, 0.09, pillarHeight, 16]} />
              <meshBasicMaterial
                color={beaconColor}
                transparent
                opacity={0.85}
              />
            </mesh>

            {/* 3. Glowing Beacon Orb atop the pillar */}
            <mesh position={topPos}>
              <sphereGeometry args={[0.22, 16, 16]} />
              <meshStandardMaterial
                color={beaconColor}
                emissive={beaconColor}
                emissiveIntensity={3.5}
              />
            </mesh>

            <pointLight color={beaconColor} intensity={3.5} distance={6} position={topPos} />
          </group>
        );
      })}
    </group>
  );
}
