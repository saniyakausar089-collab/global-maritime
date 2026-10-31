import React from "react";
import { RealVessel3D, type RealVesselType } from "./RealVessel3D";

interface HeroShip3DProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  showHud?: boolean;
  shipType?: "container" | "tanker" | "passenger" | "bulk";
  waveHeight?: number;
  speedKnots?: number;
}

/**
 * Legacy wrapper pointing strictly to RealVessel3D (GLTF/GLB models).
 * Completely eliminates any primitive boxes or toy hulls.
 */
export function HeroShip3D({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  showHud = true,
  shipType = "container",
  waveHeight = 1.8,
  speedKnots = 17.5,
}: HeroShip3DProps) {
  const mappedType: RealVesselType =
    shipType === "passenger" ? "passenger" : shipType === "tanker" ? "tanker" : "cargo";

  return (
    <RealVessel3D
      vesselType={mappedType}
      position={position}
      rotation={rotation}
      scale={scale}
      showHud={showHud}
      waveHeight={waveHeight}
      speedKnots={speedKnots}
    />
  );
}
