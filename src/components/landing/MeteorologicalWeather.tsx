import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface MeteorologicalWeatherProps {
  windSpeedKnots?: number;
  waveHeightMeters?: number;
  windDirectionDeg?: number;
  simulateStorm?: boolean;
}

/**
 * Photorealistic Meteorological Weather Layer
 * Implements:
 * 1. Animated wind field streamlines: thousands of flowing particles colored teal -> amber -> crimson
 * 2. Wave-height heat contour layer & barometric pressure isobars
 * 3. Radar storm cell overlay with reflectivity gradients
 * 4. Ships avoiding storm cell with diverted course vectors and warning rings
 * 5. Sea spray & rain streaks along wind vectors (no cartoon clouds or icons)
 */
export function MeteorologicalWeather({
  windSpeedKnots = 18.5,
  waveHeightMeters = 2.1,
  windDirectionDeg = 245,
  simulateStorm = false,
}: MeteorologicalWeatherProps) {
  const effectiveWind = simulateStorm ? 48.0 : windSpeedKnots;
  const effectiveWaves = simulateStorm ? 5.8 : waveHeightMeters;

  const windParticlesRef = useRef<THREE.Points>(null);
  const stormRadarRef = useRef<THREE.Group>(null);
  const rainStreaksRef = useRef<THREE.LineSegments>(null);

  // 1. Wind field particle streamlines
  const streamCount = simulateStorm ? 2400 : 1200;
  const { windGeo } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(streamCount * 3);
    const colors = new Float32Array(streamCount * 3);

    const tealColor = new THREE.Color("#06b6d4"); // Gentle < 15 kn
    const amberColor = new THREE.Color("#f59e0b"); // Moderate 20-30 kn
    const crimsonColor = new THREE.Color("#ef4444"); // Storm > 35 kn

    for (let i = 0; i < streamCount; i++) {
      const x = (Math.random() - 0.5) * 50;
      const z = (Math.random() - 0.5) * 50;
      const y = 0.5 + Math.random() * 2.8;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      let c = tealColor;
      if (effectiveWind > 35) {
        c = crimsonColor;
      } else if (effectiveWind > 20) {
        c = amberColor;
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return { windGeo: geo };
  }, [streamCount, effectiveWind]);

  // 2. Barometric pressure isobars (Memoized lines)
  const isobarLines = useMemo(() => {
    const radii = [4.5, 7.0, 9.8, 13.0];
    const center = new THREE.Vector2(3.5, -2.0);

    return radii.map((r, idx) => {
      const pts: THREE.Vector3[] = [];
      const steps = 48;
      for (let s = 0; s <= steps; s++) {
        const theta = (s / steps) * Math.PI * 2;
        const rx = r * (1.0 + Math.sin(theta * 2) * 0.12);
        const rz = r * 0.85 * (1.0 + Math.cos(theta * 3) * 0.08);
        pts.push(
          new THREE.Vector3(
            center.x + Math.cos(theta) * rx,
            0.15,
            center.y + Math.sin(theta) * rz
          )
        );
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.35 + idx * 0.08,
        })
      );
    });
  }, []);

  // 3. Ships navigating near storm showing rerouting vectors
  const stormShips = useMemo(() => {
    return [
      {
        id: "v-storm-1",
        pos: [2.0, 0.2, 5.0] as [number, number, number],
        name: "ATLANTIC VOYAGER",
        normalHeading: 340,
        avoidanceHeading: 300,
        inRiskZone: true,
      },
      {
        id: "v-storm-2",
        pos: [-5.0, 0.2, -1.0] as [number, number, number],
        name: "NORDIC BREEZE",
        normalHeading: 80,
        avoidanceHeading: 80,
        inRiskZone: false,
      },
    ];
  }, []);

  // Pre-generate storm ship paths with computed line distances
  const stormShipLines = useMemo(() => {
    return stormShips.map((ship) => {
      const radAvoid = (ship.avoidanceHeading * Math.PI) / 180;
      const dx = Math.sin(radAvoid) * 2.2;
      const dz = Math.cos(radAvoid) * 2.2;

      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(dx * 0.4, 0, dz * 0.3),
        new THREE.Vector3(dx, 0, dz),
      ]);
      const line = new THREE.Line(
        geo,
        new THREE.LineDashedMaterial({
          color: ship.inRiskZone ? 0xf59e0b : 0x38bdf8,
          dashSize: 0.1,
          gapSize: 0.08,
          transparent: true,
          opacity: 0.85,
        })
      );
      line.computeLineDistances();
      return { id: ship.id, line };
    });
  }, [stormShips]);

  // 4. Rain & sea spray streaks along wind vector
  const rainStreakCount = simulateStorm ? 2000 : 800;
  const { rainGeo, rainSpeeds } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainStreakCount * 6);
    const speeds = new Float32Array(rainStreakCount);

    const rad = (windDirectionDeg * Math.PI) / 180;
    const dx = Math.sin(rad) * 0.35;
    const dz = Math.cos(rad) * 0.35;

    for (let i = 0; i < rainStreakCount; i++) {
      const x = (Math.random() - 0.5) * 45;
      const y = Math.random() * 20 + 2;
      const z = (Math.random() - 0.5) * 45;
      const length = 0.5 + Math.random() * 0.8;

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;

      positions[i * 6 + 3] = x + dx;
      positions[i * 6 + 4] = y - length;
      positions[i * 6 + 5] = z + dz;

      speeds[i] = 22 + Math.random() * 15;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { rainGeo: geo, rainSpeeds: speeds };
  }, [rainStreakCount, windDirectionDeg, simulateStorm]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    // 1. Move wind particle streamlines
    if (windParticlesRef.current) {
      const pos = windGeo.getAttribute("position") as THREE.BufferAttribute;
      if (pos && pos.array) {
        const rad = (windDirectionDeg * Math.PI) / 180;
        const speed = effectiveWind * 0.08 * delta;
        const vx = Math.sin(rad) * speed;
        const vz = Math.cos(rad) * speed;

        for (let i = 0; i < streamCount; i++) {
          let x = pos.getX(i) + vx;
          let z = pos.getZ(i) + vz;

          if (x > 25) x = -25;
          if (x < -25) x = 25;
          if (z > 25) z = -25;
          if (z < -25) z = 25;

          pos.setX(i, x);
          pos.setZ(i, z);
        }
        pos.needsUpdate = true;
      }
    }

    // 2. Pulse radar storm cell
    if (stormRadarRef.current) {
      stormRadarRef.current.rotation.y = t * 0.4;
    }

    // 3. Fall rain streaks
    if (rainStreaksRef.current) {
      const rPos = rainGeo.getAttribute("position") as THREE.BufferAttribute;
      if (rPos && rPos.array) {
        for (let i = 0; i < rainStreakCount; i++) {
          let yTop = rPos.getY(i * 2);
          let yBot = rPos.getY(i * 2 + 1);
          const spd = (rainSpeeds[i] ?? 25) * delta;

          yTop -= spd;
          yBot -= spd;

          if (yBot < 0) {
            const resetY = 18 + Math.random() * 5;
            const len = 0.5 + Math.random() * 0.8;
            yTop = resetY;
            yBot = resetY - len;
          }

          rPos.setY(i * 2, yTop);
          rPos.setY(i * 2 + 1, yBot);
        }
        rPos.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* 1. Animated Wind Field Streamlines */}
      <points ref={windParticlesRef} geometry={windGeo}>
        <pointsMaterial
          size={0.12}
          vertexColors
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 2. Wave-Height Heat Contour Floor Overlay */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 70]} />
        <meshBasicMaterial
          color={effectiveWaves > 4.0 ? 0x7f1d1d : effectiveWaves > 2.5 ? 0xb45309 : 0x0284c7}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Barometric Pressure Isobars */}
      {isobarLines.map((lineObj, idx) => (
        <primitive key={`isobar-${idx}`} object={lineObj} />
      ))}

      {/* 4. Radar Storm Cell Overlay (Drifting & Sweeping) */}
      <group position={[3.5, 0.12, -2.0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 3.2, 32]} />
          <meshBasicMaterial
            color={0xdc2626}
            transparent
            opacity={simulateStorm ? 0.45 : 0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.2, 5.5, 32]} />
          <meshBasicMaterial
            color={0xf59e0b}
            transparent
            opacity={simulateStorm ? 0.35 : 0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.5, 8.5, 32]} />
          <meshBasicMaterial
            color={0x0284c7}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Radar Sweep Line */}
        <group ref={stormRadarRef}>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0, 8.5, 32, 1, 0, 0.5]} />
            <meshBasicMaterial
              color={0x38bdf8}
              transparent
              opacity={0.28}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      {/* 5. Ships Navigating around Storm with Warning Rings & Bending Paths */}
      {stormShips.map((ship, idx) => {
        const lineObj = stormShipLines[idx]?.line;
        return (
          <group key={ship.id} position={ship.pos}>
            <mesh>
              <sphereGeometry args={[0.12, 12, 12]} />
              <meshBasicMaterial color={ship.inRiskZone ? 0xef4444 : 0x10b981} />
            </mesh>

            {ship.inRiskZone && (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.22, 0.32, 24]} />
                <meshBasicMaterial
                  color={0xef4444}
                  transparent
                  opacity={0.75}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            )}

            {lineObj && <primitive object={lineObj} />}
          </group>
        );
      })}

      {/* 6. Rain streaks & high-velocity spray along wind vector */}
      <lineSegments ref={rainStreaksRef} geometry={rainGeo}>
        <lineBasicMaterial
          color="#93c5fd"
          transparent
          opacity={simulateStorm ? 0.55 : 0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
