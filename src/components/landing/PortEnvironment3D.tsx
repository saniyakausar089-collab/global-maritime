import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ContainerShipModel } from "./models/ContainerShipModel";
import { TankerShipModel } from "./models/TankerShipModel";
import { CongestionRings } from "./CongestionRings";

interface PortEnvironment3DProps {
  congestionIndex?: number;
  showCongestionRings?: boolean;
}

/**
 * 3D Commercial Port Infrastructure Environment.
 * Represents Rotterdam Maasvlakte II / Gateway Terminal:
 * - Container quay with concrete pavement and container stacking blocks
 * - Ship-to-shore (STS) container gantry cranes with boom arms
 * - Moored container ship at berth (cyan geofence perimeter)
 * - Waiting vessels in outer anchorage (amber geofence perimeter)
 * - Pulsing Congestion Index telemetry rings
 */
export function PortEnvironment3D({
  congestionIndex = 1.34,
  showCongestionRings = false,
}: PortEnvironment3DProps) {
  const craneGroupRef = useRef<THREE.Group>(null);
  const anchorShipRef = useRef<THREE.Group>(null);

  // Materials
  const materials = useMemo(() => {
    return {
      quayConcrete: new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.8,
        metalness: 0.2,
      }),
      quayFender: new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.9,
        metalness: 0.1,
      }),
      craneStructure: new THREE.MeshStandardMaterial({
        color: 0xe11d48, // Maritime safety red crane steel
        roughness: 0.4,
        metalness: 0.6,
      }),
      craneBoomWhite: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.35,
        metalness: 0.4,
      }),
      containerCyan: new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        roughness: 0.5,
        metalness: 0.3,
      }),
      containerOrange: new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.5,
        metalness: 0.3,
      }),
      containerGreen: new THREE.MeshStandardMaterial({
        color: 0x10b981,
        roughness: 0.5,
        metalness: 0.3,
      }),
      containerBlue: new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.5,
        metalness: 0.3,
      }),
      berthGlow: new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        linewidth: 2,
        transparent: true,
        opacity: 0.85,
      }),
      anchorageGlow: new THREE.LineBasicMaterial({
        color: 0xffb547,
        linewidth: 2,
        transparent: true,
        opacity: 0.85,
      }),
    };
  }, []);

  // 4 Ship-to-Shore (STS) Container Cranes
  const cranes = useMemo(() => {
    const craneSpans = [-10, -4, 2, 8];
    return craneSpans.map((z, idx) => (
      <group key={`crane-${idx}`} position={[-14.5, 0, z]}>
        {/* Crane Legs */}
        <mesh position={[-2.5, 3.5, -1.2]} material={materials.craneStructure}>
          <boxGeometry args={[0.4, 7.0, 0.4]} />
        </mesh>
        <mesh position={[-2.5, 3.5, 1.2]} material={materials.craneStructure}>
          <boxGeometry args={[0.4, 7.0, 0.4]} />
        </mesh>
        <mesh position={[2.0, 3.5, -1.2]} material={materials.craneStructure}>
          <boxGeometry args={[0.4, 7.0, 0.4]} />
        </mesh>
        <mesh position={[2.0, 3.5, 1.2]} material={materials.craneStructure}>
          <boxGeometry args={[0.4, 7.0, 0.4]} />
        </mesh>

        {/* Crane Upper Machine House & Tower */}
        <mesh position={[-0.5, 7.2, 0]} material={materials.craneStructure}>
          <boxGeometry args={[5.2, 1.4, 3.2]} />
        </mesh>

        {/* Crane Boom arm reaching over ship berth */}
        <mesh position={[4.5, 7.5, 0]} material={materials.craneBoomWhite}>
          <boxGeometry args={[8.5, 0.5, 0.8]} />
        </mesh>

        {/* Boom Red/White Aviation Warning Light */}
        <mesh position={[8.7, 7.8, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#FF5577" />
        </mesh>
      </group>
    ));
  }, [materials]);

  // Container Stacks along Quay Yard
  const containerYard = useMemo(() => {
    const stacks = [];
    const colors = [
      materials.containerCyan,
      materials.containerOrange,
      materials.containerGreen,
      materials.containerBlue,
    ];
    let colIdx = 0;

    for (let x = -26; x <= -20; x += 2.2) {
      for (let z = -14; z <= 12; z += 3.6) {
        const height = 2 + (Math.abs(x * 3 + z) % 3);
        for (let h = 0; h < height; h++) {
          const mat = colors[(colIdx++) % colors.length]!;
          stacks.push(
            <mesh
              key={`stack-${x}-${z}-${h}`}
              position={[x, 0.4 + h * 0.62, z]}
              material={mat}
            >
              <boxGeometry args={[1.8, 0.58, 3.2]} />
            </mesh>
          );
        }
      }
    }
    return stacks;
  }, [materials]);

  // Berth Boundary Geofence Line (Cyan)
  const berthBorder = useMemo(() => {
    const pts = [
      new THREE.Vector3(-14, 0.05, -16),
      new THREE.Vector3(-6, 0.05, -16),
      new THREE.Vector3(-6, 0.05, 16),
      new THREE.Vector3(-14, 0.05, 16),
      new THREE.Vector3(-14, 0.05, -16),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, materials.berthGlow);
  }, [materials]);

  // Anchorage Boundary Geofence Line (Amber)
  const anchorageBorder = useMemo(() => {
    const pts = [
      new THREE.Vector3(10, 0.05, -14),
      new THREE.Vector3(26, 0.05, -14),
      new THREE.Vector3(26, 0.05, 14),
      new THREE.Vector3(10, 0.05, 14),
      new THREE.Vector3(10, 0.05, -14),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, materials.anchorageGlow);
  }, [materials]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (anchorShipRef.current) {
      // Anchored vessel gentle bobbing
      anchorShipRef.current.position.y = Math.sin(t * 1.1) * 0.03;
      anchorShipRef.current.rotation.z = Math.sin(t * 0.8) * 0.008;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Terminal Quay Concrete Apron (X: -14 to -34) */}
      <mesh position={[-24, 0.2, 0]} material={materials.quayConcrete} receiveShadow>
        <boxGeometry args={[20, 0.4, 40]} />
      </mesh>

      {/* 2. Quay Fender Edge */}
      <mesh position={[-14.05, 0.15, 0]} material={materials.quayFender}>
        <boxGeometry args={[0.3, 0.5, 40]} />
      </mesh>

      {/* 3. Container Yard Stacks */}
      <group>{containerYard}</group>

      {/* 4. Ship-to-Shore (STS) Gantry Cranes */}
      <group ref={craneGroupRef}>{cranes}</group>

      {/* 5. Moored Container Ship at Berth (X = -10, Z = 0) */}
      <group position={[-9.8, 0, 0]}>
        <ContainerShipModel scale={0.7} speedKnots={0} waveHeight={0.4} />
      </group>

      {/* 6. Berth Geofence Boundary (Glowing Cyan) */}
      <primitive object={berthBorder} />

      {/* 7. Anchorage Geofence Boundary (Glowing Amber) */}
      <primitive object={anchorageBorder} />

      {/* 8. Waiting Vessel in Outer Anchorage (X = 18, Z = -2) */}
      <group ref={anchorShipRef} position={[18, 0, -2]} rotation={[0, 0.2, 0]}>
        <TankerShipModel scale={0.65} speedKnots={0.1} waveHeight={0.8} />
        {/* Anchor Light (All-round white light) */}
        <mesh position={[0, 2.2, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color="#FFB547" />
        </mesh>
      </group>

      {/* 9. Pulsing Congestion Rings if Congestion Scene or CI > 1.2 */}
      {showCongestionRings && (
        <group position={[18, 0.1, -2]}>
          <CongestionRings
            lat={51.92}
            lon={4.17}
            congestionIndex={congestionIndex}
            visible={true}
          />
        </group>
      )}
    </group>
  );
}
