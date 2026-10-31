import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { latLonToVector3 } from "./constants";

interface CongestionRingsProps {
  globeRadius?: number;
  lat?: number;
  lon?: number;
  congestionIndex?: number;
  visible?: boolean;
}

export function CongestionRings({
  globeRadius = 10,
  lat = 51.98,
  lon = 3.90,
  congestionIndex = 1.34,
  visible = true,
}: CongestionRingsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  const centerPos = latLonToVector3(lat, lon, globeRadius + 0.08);
  const normal = centerPos.clone().normalize();

  // Create orientation quaternion aligning Z to normal
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal
  );

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.getElapsedTime();

    // Pulse 3 concentric rings when index > 1.2
    const isCongested = congestionIndex > 1.2;
    const speed = isCongested ? 1.4 : 0.8;

    if (ring1Ref.current) {
      const p1 = (t * speed) % 1.0;
      const s1 = 0.2 + p1 * 1.8;
      ring1Ref.current.scale.set(s1, s1, 1);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = (1.0 - p1) * 0.85;
    }

    if (ring2Ref.current) {
      const p2 = (t * speed + 0.33) % 1.0;
      const s2 = 0.2 + p2 * 1.8;
      ring2Ref.current.scale.set(s2, s2, 1);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = (1.0 - p2) * 0.85;
    }

    if (ring3Ref.current) {
      const p3 = (t * speed + 0.66) % 1.0;
      const s3 = 0.2 + p3 * 1.8;
      ring3Ref.current.scale.set(s3, s3, 1);
      (ring3Ref.current.material as THREE.MeshBasicMaterial).opacity = (1.0 - p3) * 0.85;
    }
  });

  if (!visible) return null;

  const ringColor = congestionIndex > 1.2 ? "#ef4444" : "#f59e0b";

  return (
    <group ref={groupRef} position={centerPos} quaternion={quaternion}>
      {/* Central Pulsing Target Ring */}
      <mesh ref={ring1Ref}>
        <ringGeometry args={[0.3, 0.34, 48]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ring2Ref}>
        <ringGeometry args={[0.3, 0.34, 48]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ring3Ref}>
        <ringGeometry args={[0.3, 0.34, 48]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Core Warning Beacon Point */}
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.08, 24]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
