import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MONITORED_PORTS, latLonToVector3 } from "./constants";

interface InstancedVesselsProps {
  globeRadius?: number;
  maxVessels?: number;
  lowPowerMode?: boolean;
  zoomProgress?: number; // 0.0 (globe) to 1.0 (close up to hero vessel)
}

/**
 * Renders commercial shipping vessels as TINY, delicate points of light (1 to 2 px).
 * Completely eliminates all planet-like giant spheres.
 * Type Colors:
 * - Cargo = Amber (#e8a33d)
 * - Passenger = Coral (#d9694f)
 * - Tanker = Mint (#7fb89a)
 */
export function InstancedVessels({
  globeRadius = 10,
  maxVessels = 4500,
  lowPowerMode = false,
  zoomProgress = 0.0,
}: InstancedVesselsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const actualCount = lowPowerMode ? Math.min(1500, maxVessels) : Math.min(4500, maxVessels);

  const { geometry, vesselMetadata } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(actualCount * 3);
    const colors = new Float32Array(actualCount * 3);

    // Exact required colors:
    // Cargo = Amber (#e8a33d), Passenger = Coral (#d9694f), Tanker = Mint (#7fb89a)
    const typeColors = [
      new THREE.Color("#e8a33d"), // Cargo (Amber)
      new THREE.Color("#e8a33d"), // Cargo (Amber)
      new THREE.Color("#d9694f"), // Passenger (Coral)
      new THREE.Color("#7fb89a"), // Tanker (Mint)
      new THREE.Color("#7fb89a"), // Tanker (Mint)
    ];

    const metadata: { lat: number; lon: number; speed: number; heading: number; typeIdx: number }[] = [];

    for (let i = 0; i < actualCount; i++) {
      let lat = 0;
      let lon = 0;
      let speed = 0;

      if (i === 0) {
        // Vessel 0: The HERO vessel at Port of Rotterdam approach
        lat = 51.98;
        lon = 3.92;
        speed = 16.8;
      } else if (i < actualCount * 0.55) {
        // Clustered around key global ports
        const p = MONITORED_PORTS[i % MONITORED_PORTS.length]!;
        const rAngle = Math.random() * Math.PI * 2;
        const rDist = Math.pow(Math.random(), 0.6) * 3.5;
        lat = p.lat + Math.sin(rAngle) * rDist;
        lon = p.lon + (Math.cos(rAngle) * rDist) / Math.cos((p.lat * Math.PI) / 180);
        speed = Math.random() < 0.3 ? 0.2 : 6 + Math.random() * 14;
      } else {
        // Ocean shipping corridors
        const laneSeed = Math.random();
        if (laneSeed < 0.35) {
          // Asia - Europe corridor
          const t = Math.random();
          lat = 1.0 + t * 28.0 + (Math.random() - 0.5) * 3;
          lon = 104.0 - t * 72.0 + (Math.random() - 0.5) * 4;
        } else if (laneSeed < 0.7) {
          // Trans-Pacific corridor
          const t = Math.random();
          lat = 30.0 + Math.sin(t * Math.PI) * 14 + (Math.random() - 0.5) * 3;
          lon = 125.0 + t * 115.0;
          if (lon > 180) lon -= 360;
        } else {
          // Atlantic trade corridor
          const t = Math.random();
          lat = -15.0 + t * 65.0;
          lon = -45.0 + (Math.random() - 0.5) * 8;
        }
        speed = 12 + Math.random() * 10;
      }

      const heading = Math.random() * 360;
      const typeIdx = i % typeColors.length;
      metadata.push({ lat, lon, speed, heading, typeIdx });

      const vec = latLonToVector3(lat, lon, globeRadius + 0.035);
      positions[i * 3] = vec.x;
      positions[i * 3 + 1] = vec.y;
      positions[i * 3 + 2] = vec.z;

      const c = typeColors[typeIdx]!;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return { geometry: geo, vesselMetadata: metadata };
  }, [globeRadius, actualCount]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;

    // Advance vessels along headings
    for (let i = 0; i < actualCount; i += 3) {
      const v = vesselMetadata[i];
      if (v && v.speed > 0.5) {
        v.lat += Math.cos((v.heading * Math.PI) / 180) * v.speed * delta * 0.0004;
        v.lon +=
          (Math.sin((v.heading * Math.PI) / 180) * v.speed * delta * 0.0004) /
          Math.max(0.2, Math.cos((v.lat * Math.PI) / 180));

        const vec = latLonToVector3(v.lat, v.lon, globeRadius + 0.035);
        pos.setXYZ(i, vec.x, vec.y, vec.z);
      }
    }
    pos.needsUpdate = true;
  });

  // Fade out other dots as camera zooms in toward the single hero vessel
  const opacity = Math.max(0, 1.0 - zoomProgress * 1.5);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.065} // Tiny, subtle light point (1-2px in perspective)
        vertexColors
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
