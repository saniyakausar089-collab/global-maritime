import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  MAJOR_GLOBAL_HUBS,
  TRADE_LANE_PAIRS,
  latLonToVector3,
} from "./constants";

interface TradeRoutesProps {
  globeRadius?: number;
}

export function TradeRoutes({ globeRadius = 10 }: TradeRoutesProps) {
  const pulsesRef = useRef<THREE.Points>(null);

  // Generate dense bundles of great circle arcs
  const { lineGeometry, pulseCurves } = useMemo(() => {
    const hubMap = new Map(MAJOR_GLOBAL_HUBS.map((h) => [h.name, h]));
    const positions: number[] = [];
    const colors: number[] = [];
    const curves: { curve: THREE.QuadraticBezierCurve3; length: number }[] = [];

    const cyanColor = new THREE.Color("#00e5ff");
    const tealColor = new THREE.Color("#0077b6");

    TRADE_LANE_PAIRS.forEach(([p1Name, p2Name]) => {
      const h1 = hubMap.get(p1Name);
      const h2 = hubMap.get(p2Name);
      if (!h1 || !h2) return;

      [-0.4, 0, 0.4].forEach((offsetDeg) => {
        const v1 = latLonToVector3(h1.lat + offsetDeg * 0.2, h1.lon + offsetDeg, globeRadius);
        const v2 = latLonToVector3(h2.lat + offsetDeg * 0.2, h2.lon + offsetDeg, globeRadius);

        const distance = v1.distanceTo(v2);
        const altitude = globeRadius + Math.min(distance * 0.18, 1.45);
        const mid = v1.clone().add(v2).multiplyScalar(0.5).normalize().multiplyScalar(altitude);

        const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
        curves.push({ curve, length: curve.getLength() });

        const points = curve.getPoints(36);
        for (let i = 0; i < points.length - 1; i++) {
          const ptA = points[i];
          const ptB = points[i + 1];
          if (!ptA || !ptB) continue;

          positions.push(ptA.x, ptA.y, ptA.z);
          positions.push(ptB.x, ptB.y, ptB.z);

          const factor = Math.sin((i / (points.length - 1)) * Math.PI);
          const c = cyanColor.clone().lerp(tealColor, (i % 2) * 0.4);
          colors.push(c.r * factor * 0.7, c.g * factor * 0.9, c.b * factor * 1.0);
          colors.push(c.r * factor * 0.7, c.g * factor * 0.9, c.b * factor * 1.0);
        }
      });
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    return { lineGeometry: geo, pulseCurves: curves };
  }, [globeRadius]);

  const pulseCount = 180;
  const { pulseGeometry, pulseData } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(pulseCount * 3);
    const data: { curveIndex: number; speed: number; progress: number }[] = [];

    for (let i = 0; i < pulseCount; i++) {
      const curveIndex = i % Math.max(1, pulseCurves.length);
      data.push({
        curveIndex,
        speed: 0.12 + Math.random() * 0.15,
        progress: Math.random(),
      });
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { pulseGeometry: geo, pulseData: data };
  }, [pulseCurves]);

  useFrame((_, delta) => {
    if (!pulsesRef.current) return;
    const posAttr = pulseGeometry.getAttribute("position") as THREE.BufferAttribute;

    for (let i = 0; i < pulseCount; i++) {
      const p = pulseData[i];
      if (!p) continue;
      p.progress += delta * p.speed;
      if (p.progress > 1.0) p.progress -= 1.0;

      const curve = pulseCurves[p.curveIndex]?.curve;
      if (curve) {
        const point = curve.getPoint(p.progress);
        posAttr.setXYZ(i, point.x, point.y, point.z);
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      <points ref={pulsesRef} geometry={pulseGeometry}>
        <pointsMaterial
          color="#a5f3fc"
          size={0.22}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
