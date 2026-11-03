import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { ContainerShipModel } from "./models/ContainerShipModel";
import { TankerShipModel } from "./models/TankerShipModel";

interface MeteorologicalWeatherProps {
  windSpeedKnots?: number;
  waveHeightMeters?: number;
  windDirectionDeg?: number;
  simulateStorm?: boolean;
}

/**
 * Photorealistic 3D Volumetric Cyclone & Severe Weather Risk Intelligence
 * Implements:
 * 1. Volumetric tiered spiral storm clouds with rotating rain bands and atmospheric depth
 * 2. High-speed wind circulation vortex particles spiraling inward toward the cyclone eye
 * 3. Dynamic intra-cloud lightning flashes illuminating the rotating cloud formations
 * 4. Realistic commercial ships navigating in heavy storm seas near danger perimeter
 * 5. Dynamic route avoidance divergence vectors guiding vessels away from the gale zone
 * 6. Darkened tempest ocean floor patch and diagonal squall rain streaks
 */
export function MeteorologicalWeather({
  windSpeedKnots = 18.5,
  waveHeightMeters = 2.1,
  simulateStorm = true,
}: MeteorologicalWeatherProps) {
  const cycloneGroupRef = useRef<THREE.Group>(null);
  const spiralArm1Ref = useRef<THREE.Mesh>(null);
  const spiralArm2Ref = useRef<THREE.Mesh>(null);
  const eyeWallRef = useRef<THREE.Mesh>(null);
  const windVortexRef = useRef<THREE.Points>(null);
  const rainStreaksRef = useRef<THREE.LineSegments>(null);
  const lightningLightRef = useRef<THREE.PointLight>(null);

  const ship1Ref = useRef<THREE.Group>(null);
  const ship2Ref = useRef<THREE.Group>(null);

  const stormCenter = useMemo(() => new THREE.Vector3(3.5, 0, -2.0), []);

  // 1. High-Speed Cyclone Wind Circulation Particles (Spiraling inward)
  const particleCount = 2200;
  const { vortexGeo, initialAngles, initialRadii, initialY } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const angles = new Float32Array(particleCount);
    const radii = new Float32Array(particleCount);
    const yVals = new Float32Array(particleCount);

    const cyanCol = new THREE.Color("#22D3EE");
    const amberCol = new THREE.Color("#FFB547");
    const redCol = new THREE.Color("#FF4560");

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Distribution denser towards the eyewall (radius 3 to 18)
      const r = 2.5 + Math.pow(Math.random(), 1.5) * 15.5;
      const y = 0.4 + Math.random() * 4.2;

      angles[i] = angle;
      radii[i] = r;
      yVals[i] = y;

      positions[i * 3] = stormCenter.x + Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = stormCenter.z + Math.sin(angle) * r;

      // Color depends on wind speed gradient (inner core = severe red/amber)
      const c = r < 5.5 ? redCol : r < 10.0 ? amberCol : cyanCol;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return { vortexGeo: geo, initialAngles: angles, initialRadii: radii, initialY: yVals };
  }, [particleCount, stormCenter]);

  // 2. Torrential Squall Rain Streaks
  const rainCount = 1800;
  const { rainGeo, rainSpeeds } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 6);
    const speeds = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      const r = 1.0 + Math.random() * 18.0;
      const th = Math.random() * Math.PI * 2;
      const x = stormCenter.x + Math.cos(th) * r;
      const z = stormCenter.z + Math.sin(th) * r;
      const y = 2.0 + Math.random() * 16.0;

      // Wind tilt angle ~35 degrees
      const slantX = 0.4;
      const slantZ = -0.3;
      const len = 0.8 + Math.random() * 1.2;

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;

      positions[i * 6 + 3] = x + slantX;
      positions[i * 6 + 4] = y - len;
      positions[i * 6 + 5] = z + slantZ;

      speeds[i] = 26 + Math.random() * 14;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { rainGeo: geo, rainSpeeds: speeds };
  }, [rainCount, stormCenter]);

  // 3. Dynamic Avoidance Course Lines for Ships Near Cyclone
  const avoidanceVectors = useMemo(() => {
    // Ship 1 (Cargo) diverging safely away to port side
    const pts1 = [
      new THREE.Vector3(4.5, 0.1, 7.5),
      new THREE.Vector3(6.2, 0.1, 4.0),
      new THREE.Vector3(8.5, 0.1, 0.5),
      new THREE.Vector3(11.0, 0.1, -4.0),
    ];
    const curve1 = new THREE.CatmullRomCurve3(pts1);
    const geo1 = new THREE.BufferGeometry().setFromPoints(curve1.getPoints(36));

    // Ship 2 (Tanker) holding safe standby outside 45kn wind radius
    const pts2 = [
      new THREE.Vector3(-6.5, 0.1, 2.5),
      new THREE.Vector3(-7.5, 0.1, -1.0),
      new THREE.Vector3(-8.2, 0.1, -5.0),
    ];
    const curve2 = new THREE.CatmullRomCurve3(pts2);
    const geo2 = new THREE.BufferGeometry().setFromPoints(curve2.getPoints(24));

    return { geo1, geo2 };
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    // 1. Rotate Cyclone Cloud Formations
    if (cycloneGroupRef.current) {
      cycloneGroupRef.current.rotation.y = -t * 0.45;
    }
    if (spiralArm1Ref.current) {
      spiralArm1Ref.current.rotation.z = -t * 0.35;
    }
    if (spiralArm2Ref.current) {
      spiralArm2Ref.current.rotation.z = -t * 0.28;
    }
    if (eyeWallRef.current) {
      eyeWallRef.current.rotation.y = -t * 0.65;
    }

    // 2. Intra-Cloud Lightning Flashes (Stochastic pulses)
    if (lightningLightRef.current) {
      const flashChance = Math.sin(t * 8.0) * Math.cos(t * 13.0);
      if (flashChance > 0.88) {
        lightningLightRef.current.intensity = 8.0 + Math.random() * 12.0;
      } else {
        lightningLightRef.current.intensity = THREE.MathUtils.lerp(
          lightningLightRef.current.intensity,
          0.3,
          0.2
        );
      }
    }

    // 3. Spiral Wind Vortex Particle Movement
    if (windVortexRef.current) {
      const posAttr = vortexGeo.getAttribute("position") as THREE.BufferAttribute;
      if (posAttr && posAttr.array) {
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          initialAngles[i] += delta * (2.8 / (0.4 + initialRadii[i] * 0.15));
          const r = initialRadii[i];
          const angle = initialAngles[i];

          arr[i * 3] = stormCenter.x + Math.cos(angle) * r;
          arr[i * 3 + 2] = stormCenter.z + Math.sin(angle) * r;
        }
        posAttr.needsUpdate = true;
      }
    }

    // 4. Fall Rain Streaks
    if (rainStreaksRef.current) {
      const rPos = rainGeo.getAttribute("position") as THREE.BufferAttribute;
      if (rPos && rPos.array) {
        for (let i = 0; i < rainCount; i++) {
          let yTop = rPos.getY(i * 2);
          let yBot = rPos.getY(i * 2 + 1);
          const spd = (rainSpeeds[i] ?? 28) * delta;

          yTop -= spd;
          yBot -= spd;

          if (yBot < 0) {
            const resetY = 14 + Math.random() * 4;
            const len = 0.8 + Math.random() * 1.2;
            yTop = resetY;
            yBot = resetY - len;
          }

          rPos.setY(i * 2, yTop);
          rPos.setY(i * 2 + 1, yBot);
        }
        rPos.needsUpdate = true;
      }
    }

    // 5. Heavy Storm Heave & Roll for Ships near Danger Zone
    if (ship1Ref.current) {
      ship1Ref.current.position.y = Math.sin(t * 2.2) * 0.14;
      ship1Ref.current.rotation.z = Math.sin(t * 1.8) * 0.08;
      ship1Ref.current.rotation.x = Math.cos(t * 1.4) * 0.06;
    }
    if (ship2Ref.current) {
      ship2Ref.current.position.y = Math.sin(t * 1.9 + 1.2) * 0.12;
      ship2Ref.current.rotation.z = Math.sin(t * 1.6 + 1.0) * 0.07;
      ship2Ref.current.rotation.x = Math.cos(t * 1.3 + 0.8) * 0.05;
    }
  });

  return (
    <group>
      {/* ========================================================================= */}
      {/* 1. DARKENED OCEAN TEMPEST PATCH UNDER THE CYCLONE                        */}
      {/* ========================================================================= */}
      <mesh position={[stormCenter.x, 0.04, stormCenter.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[22, 48]} />
        <meshBasicMaterial
          color="#030c18"
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </mesh>

      {/* ========================================================================= */}
      {/* 2. TIERED VOLUMETRIC ROTATING CLOUD FORMATIONS & EYEWALL                 */}
      {/* ========================================================================= */}
      <group position={[stormCenter.x, 0, stormCenter.z]}>
        {/* Internal Lightning Flash Light Source */}
        <pointLight
          ref={lightningLightRef}
          color="#E0F2FE"
          intensity={0.5}
          distance={28}
          position={[0, 4.5, 0]}
        />

        {/* Ambient storm core glow */}
        <pointLight color="#0284C7" intensity={2.5} distance={18} position={[0, 3.0, 0]} />

        {/* Eyewall Cloud Disc (Dense inner ring) */}
        <mesh ref={eyeWallRef} position={[0, 3.6, 0]}>
          <cylinderGeometry args={[2.8, 3.4, 2.8, 32, 1, true]} />
          <meshStandardMaterial
            color="#1e293b"
            roughness={0.9}
            metalness={0.1}
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        <group ref={cycloneGroupRef} position={[0, 4.8, 0]}>
          {/* Main Upper Spiral Arm Cloud Deck */}
          <mesh ref={spiralArm1Ref} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.5, 16.0, 48, 8]} />
            <meshStandardMaterial
              color="#334155"
              roughness={0.95}
              metalness={0.05}
              transparent
              opacity={0.62}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Secondary Low-Level Inflow Spiral Deck */}
          <mesh ref={spiralArm2Ref} position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0.6]}>
            <ringGeometry args={[3.2, 12.5, 36, 6]} />
            <meshStandardMaterial
              color="#0f172a"
              roughness={0.95}
              metalness={0.05}
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      {/* ========================================================================= */}
      {/* 3. HIGH-SPEED CYCLONE WIND VORTEX PARTICLES                              */}
      {/* ========================================================================= */}
      <points ref={windVortexRef} geometry={vortexGeo}>
        <pointsMaterial
          size={0.16}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* ========================================================================= */}
      {/* 4. SQUALL RAIN STREAKS ALONG WIND VECTORS                                */}
      {/* ========================================================================= */}
      <lineSegments ref={rainStreaksRef} geometry={rainGeo}>
        <lineBasicMaterial
          color="#94a3b8"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* ========================================================================= */}
      {/* 5. GLOWING DANGER ZONE CONTOURS & RED TRIANGULAR RISK PROJECTION          */}
      {/* ========================================================================= */}
      <group position={[stormCenter.x, 0.12, stormCenter.z]}>
        {/* Gale Force Boundary Ring (Radius 11.5) - Amber */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[11.3, 11.6, 64]} />
          <meshBasicMaterial
            color="#FFB547"
            transparent
            opacity={0.65}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Hurricane Eye Wall Ring (Radius 4.2) - Pulsing Crimson */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.1, 4.4, 48]} />
          <meshBasicMaterial
            color="#FF4560"
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Luminous Red Risk Zone Sector Cone (As seen in Reference Frame 3) */}
        <mesh position={[-1.2, 0.02, 5.8]} rotation={[-Math.PI / 2, 0, 0.35]}>
          <ringGeometry args={[0, 9.5, 32, 1, -Math.PI / 6, Math.PI / 3]} />
          <meshBasicMaterial
            color="#FF2255"
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Sector Boundary Laser Guidelines */}
        <mesh position={[-1.2, 0.03, 5.8]} rotation={[-Math.PI / 2, 0, 0.35]}>
          <ringGeometry args={[9.4, 9.6, 32, 1, -Math.PI / 6, Math.PI / 3]} />
          <meshBasicMaterial
            color="#FF3366"
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* 6. REAL COMMERCIAL SHIPS NAVIGATING HEAVY SEAS WITH SAFE PASSAGE VECTORS */}
      {/* ========================================================================= */}
      {/* Ship 1: Ultra Large Container Vessel actively diverting away to Port (+14°) */}
      <group ref={ship1Ref} position={[4.5, 0, 7.5]} rotation={[0, -0.35, 0]}>
        <ContainerShipModel scale={0.72} speedKnots={14.2} waveHeight={5.2} />
        {/* Warning Hazard Beacon Light */}
        <pointLight color="#FFB547" intensity={4} distance={6} position={[0, 3.2, 0]} />
        <Html position={[0, 3.8, 0]} center zIndexRange={[40, 0]}>
          <div className="px-2.5 py-1 rounded-md border border-amber-400/50 bg-[#080F20]/90 backdrop-blur-md shadow-lg text-[10px] font-mono text-amber-300 whitespace-nowrap">
            ⚠ DIVERGING COURSE: +14° · 14.2 KN
          </div>
        </Html>
      </group>

      {/* Ship 2: Crude Tanker on Outer Standby Corridor */}
      <group ref={ship2Ref} position={[-6.8, 0, 2.5]} rotation={[0, 0.25, 0]}>
        <TankerShipModel scale={0.68} speedKnots={11.0} waveHeight={4.8} />
        <pointLight color="#22D3EE" intensity={3.5} distance={6} position={[0, 3.0, 0]} />
        <Html position={[0, 3.6, 0]} center zIndexRange={[40, 0]}>
          <div className="px-2.5 py-1 rounded-md border border-cyan-400/50 bg-[#080F20]/90 backdrop-blur-md shadow-lg text-[10px] font-mono text-cyan-300 whitespace-nowrap">
            ● SAFE PASSAGE STANDBY · 32 NM FROM EYE
          </div>
        </Html>
      </group>

      {/* Glowing Safe Divergence Corridor Lines on Water Surface */}
      <line geometry={avoidanceVectors.geo1}>
        <lineDashedMaterial
          color="#FFB547"
          dashSize={0.4}
          gapSize={0.2}
          transparent
          opacity={0.8}
        />
      </line>

      <line geometry={avoidanceVectors.geo2}>
        <lineDashedMaterial
          color="#22D3EE"
          dashSize={0.4}
          gapSize={0.2}
          transparent
          opacity={0.7}
        />
      </line>
    </group>
  );
}
