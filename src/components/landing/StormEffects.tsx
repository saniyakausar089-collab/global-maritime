import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface StormEffectsProps {
  intensity?: number;
  simulateStorm?: boolean;
}

export function StormEffects({ intensity = 0.6, simulateStorm = false }: StormEffectsProps) {
  const actualIntensity = simulateStorm ? 1.0 : intensity;

  const rainRef = useRef<THREE.LineSegments>(null);
  const lightningLightRef = useRef<THREE.PointLight>(null);
  const flashTimer = useRef(0);
  const nextFlashTime = useRef(2.5);

  const rainStreakCount = Math.round(1800 * actualIntensity);
  const { rainGeometry, rainSpeeds } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainStreakCount * 6);
    const speeds = new Float32Array(rainStreakCount);

    for (let i = 0; i < rainStreakCount; i++) {
      const x = (Math.random() - 0.5) * 45;
      const y = Math.random() * 25 + 2;
      const z = (Math.random() - 0.5) * 45;
      const length = 0.6 + Math.random() * 0.9;

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;

      positions[i * 6 + 3] = x - 0.25;
      positions[i * 6 + 4] = y - length;
      positions[i * 6 + 5] = z;

      speeds[i] = 24 + Math.random() * 16;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { rainGeometry: geo, rainSpeeds: speeds };
  }, [rainStreakCount, actualIntensity]);

  useFrame((_, delta) => {
    if (rainRef.current) {
      const pos = rainGeometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < rainStreakCount; i++) {
        let yTop = pos.getY(i * 2);
        let yBot = pos.getY(i * 2 + 1);
        const spd = (rainSpeeds[i] ?? 28) * delta;

        yTop -= spd;
        yBot -= spd;

        if (yBot < -1.0) {
          const resetY = 22 + Math.random() * 6;
          const length = 0.6 + Math.random() * 0.9;
          yTop = resetY;
          yBot = resetY - length;
        }

        pos.setY(i * 2, yTop);
        pos.setY(i * 2 + 1, yBot);
      }
      pos.needsUpdate = true;
    }

    flashTimer.current += delta;
    if (flashTimer.current > nextFlashTime.current) {
      if (lightningLightRef.current) {
        lightningLightRef.current.intensity = 8.0 * actualIntensity;
        setTimeout(() => {
          if (lightningLightRef.current) lightningLightRef.current.intensity = 0;
        }, 60);
        setTimeout(() => {
          if (lightningLightRef.current) lightningLightRef.current.intensity = 12.0 * actualIntensity;
        }, 120);
        setTimeout(() => {
          if (lightningLightRef.current) lightningLightRef.current.intensity = 0;
        }, 220);
      }
      flashTimer.current = 0;
      nextFlashTime.current = 3.0 + Math.random() * 5.0;
    }
  });

  return (
    <group>
      <lineSegments ref={rainRef} geometry={rainGeometry}>
        <lineBasicMaterial
          color="#93c5fd"
          transparent
          opacity={0.45 * actualIntensity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      <pointLight
        ref={lightningLightRef}
        position={[0, 16, -10]}
        color="#e0f2fe"
        intensity={0}
        distance={90}
      />

      <mesh position={[0, 18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial
          color="#040914"
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
