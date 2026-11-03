import React, { useMemo, useState, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export interface TrackedVessel {
  id: string;
  name: string;
  mmsi: number;
  shipType: string;
  pos: [number, number, number];
  heading: number; // degrees
  speedKnots: number;
  destination: string | null;
  eta: string | null;
  status: string;
  history: [number, number, number][];
}

interface ShipCourseVectorsProps {
  activeScene: number;
  onSelectVessel?: (vessel: TrackedVessel | null) => void;
  selectedVesselId?: string | null;
}

interface TrackedVesselVectorProps {
  v: TrackedVessel;
  isHovered: boolean;
  isSelected: boolean;
  onSelect?: (v: TrackedVessel) => void;
  onHover?: (v: TrackedVessel | null) => void;
}

function TrackedVesselVector({
  v,
  isHovered,
  isSelected,
  onSelect,
  onHover,
}: TrackedVesselVectorProps) {
  const isFocus = isHovered || isSelected;
  const rad = (v.heading * Math.PI) / 180;
  const dirX = Math.sin(rad);
  const dirY = Math.cos(rad) * 0.5;
  const dirZ = Math.cos(rad) * 0.8;

  const cogLength = Math.max(0.15, (v.speedKnots / 20) * 0.65);
  const cogEnd = useMemo<[number, number, number]>(() => {
    return [
      v.pos[0] + dirX * cogLength,
      v.pos[1] + dirY * cogLength,
      v.pos[2] + dirZ * cogLength,
    ];
  }, [v.pos, dirX, dirY, dirZ, cogLength]);

  const projLength = Math.max(0.3, (v.speedKnots / 20) * 1.6);
  const projEnd = useMemo<[number, number, number]>(() => {
    return [
      v.pos[0] + dirX * projLength,
      v.pos[1] + dirY * projLength,
      v.pos[2] + dirZ * projLength,
    ];
  }, [v.pos, dirX, dirY, dirZ, projLength]);

  // 1. Heading COG line geometry
  const cogLineGeo = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...v.pos),
      new THREE.Vector3(...cogEnd),
    ]);
  }, [v.pos, cogEnd]);

  // 2. Projected dead-reckoning dashed line geometry
  const projLineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...cogEnd),
      new THREE.Vector3(...projEnd),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineDashedMaterial({
        color: 0x22d3ee,
        dashSize: 0.1,
        gapSize: 0.08,
        transparent: true,
        opacity: isFocus ? 0.9 : 0.45,
      })
    );
    line.computeLineDistances();
    return line;
  }, [cogEnd, projEnd, isFocus]);

  // 3. Historical spline trail
  const historyLineObj = useMemo(() => {
    if (v.history.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(v.history.map((pt) => new THREE.Vector3(...pt)));
    const points = curve.getPoints(24);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0x3978ff,
        transparent: true,
        opacity: isFocus ? 0.75 : 0.35,
      })
    );
  }, [v.history, isFocus]);

  const markerColor =
    v.shipType === "cargo"
      ? "#22D3EE"
      : v.shipType === "tanker"
      ? "#FFB547"
      : "#A78BFA";

  return (
    <group>
      {/* Historical Track */}
      {historyLineObj && <primitive object={historyLineObj} />}

      {/* Solid COG Vector Arrow */}
      <primitive
        object={
          new THREE.Line(
            cogLineGeo,
            new THREE.LineBasicMaterial({
              color: isFocus ? 0x22d3ee : new THREE.Color(markerColor),
              linewidth: isFocus ? 2 : 1,
            })
          )
        }
      />

      {/* Dashed Projected Vector */}
      <primitive object={projLineObj} />

      {/* Vessel Position Marker */}
      <mesh
        position={v.pos}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(v);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover?.(v);
        }}
        onPointerOut={() => onHover?.(null)}
      >
        <sphereGeometry args={[isFocus ? 0.12 : 0.07, 16, 16]} />
        <meshBasicMaterial color={isFocus ? "#FFFFFF" : markerColor} />
      </mesh>

      {/* Compact Tactical HUD Tooltip */}
      
    </group>
  );
}

export function ShipCourseVectors({
  activeScene,
  onSelectVessel,
  selectedVesselId,
}: ShipCourseVectorsProps) {
  const [hoveredVessel, setHoveredVessel] = useState<TrackedVessel | null>(null);

  // Realistic vessel positions around North Sea / Rotterdam approaches
  const vessels: TrackedVessel[] = useMemo(() => [
    {
      id: "v-1",
      name: "EVER GIVEN",
      mmsi: 353136000,
      shipType: "cargo",
      pos: [0.8, 7.85, 6.2],
      heading: 68,
      speedKnots: 16.4,
      destination: "NLRTM",
      eta: "14:30 UTC",
      status: "Underway",
      history: [
        [0.4, 7.7, 6.5],
        [0.6, 7.78, 6.35],
        [0.8, 7.85, 6.2],
      ],
    },
    {
      id: "v-2",
      name: "FRONT ALTAIR",
      mmsi: 538008123,
      shipType: "tanker",
      pos: [0.2, 7.95, 6.05],
      heading: 110,
      speedKnots: 11.8,
      destination: "NLRTM ANCHORAGE",
      eta: "18:00 UTC",
      status: "Awaiting Berth",
      history: [
        [-0.1, 8.05, 5.95],
        [0.05, 8.0, 6.0],
        [0.2, 7.95, 6.05],
      ],
    },
    {
      id: "v-3",
      name: "MAERSK MC-KINNEY MOLLER",
      mmsi: 219018271,
      shipType: "cargo",
      pos: [1.3, 7.72, 6.38],
      heading: 52,
      speedKnots: 18.2,
      destination: "DEHAM",
      eta: "Tomorrow 06:00",
      status: "Underway",
      history: [
        [0.9, 7.55, 6.6],
        [1.1, 7.64, 6.48],
        [1.3, 7.72, 6.38],
      ],
    },
    {
      id: "v-4",
      name: "QUEEN MARY 2",
      mmsi: 310627000,
      shipType: "passenger",
      pos: [0.6, 7.65, 6.55],
      heading: 42,
      speedKnots: 21.0,
      destination: "GBSOU",
      eta: "Today 20:00",
      status: "Underway",
      history: [
        [0.2, 7.5, 6.8],
        [0.4, 7.58, 6.68],
        [0.6, 7.65, 6.55],
      ],
    },
  ], []);

  return (
    <group>
      {vessels.map((v) => (
        <TrackedVesselVector
          key={v.id}
          v={v}
          isHovered={hoveredVessel?.id === v.id}
          isSelected={selectedVesselId === v.id}
          onSelect={(sel) => onSelectVessel?.(sel)}
          onHover={setHoveredVessel}
        />
      ))}
    </group>
  );
}
