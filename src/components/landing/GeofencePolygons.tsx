import React, { useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { latLonToVector3 } from "./constants";

interface GeofencePolygonsProps {
  globeRadius?: number;
  activePortId?: string;
  opacity?: number;
}

interface GeoFeature {
  type: string;
  properties: {
    port_id: string;
    port_name: string;
    zone_type: "berth" | "anchorage" | "port_boundary";
    description?: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

export function GeofencePolygons({
  globeRadius = 10,
  activePortId = "rotterdam",
  opacity = 1.0,
}: GeofencePolygonsProps) {
  const [features, setFeatures] = useState<GeoFeature[]>([]);

  useEffect(() => {
    fetch("/data/ports.geojson")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.features) {
          setFeatures(data.features);
        }
      })
      .catch((err) => console.warn("Could not load ports.geojson:", err));
  }, []);

  const polygonObjects = useMemo(() => {
    if (!features.length) return [];

    const objects: THREE.Line[] = [];
    const portFeatures = features.filter((f) => f.properties.port_id === activePortId);

    portFeatures.forEach((feat) => {
      const coords = feat.geometry.coordinates[0];
      if (!coords || coords.length < 3) return;

      const positions: number[] = [];
      const zoneType = feat.properties.zone_type;

      let color = "#00e5ff";
      if (zoneType === "anchorage") color = "#f59e0b";
      else if (zoneType === "port_boundary") color = "#38bdf8";

      const alt = zoneType === "berth" ? 0.08 : zoneType === "anchorage" ? 0.07 : 0.06;

      for (let i = 0; i < coords.length; i++) {
        const pt = coords[i];
        if (!pt || pt.length < 2) continue;
        const [lon, lat] = pt;
        if (typeof lat !== "number" || typeof lon !== "number") continue;
        const v = latLonToVector3(lat, lon, globeRadius + alt);
        positions.push(v.x, v.y, v.z);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2,
        transparent: true,
        opacity: 0.9 * opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      objects.push(new THREE.Line(geo, mat));
    });

    return objects;
  }, [features, activePortId, globeRadius, opacity]);

  if (!polygonObjects.length) return null;

  return (
    <group>
      {polygonObjects.map((obj, idx) => (
        <primitive key={idx} object={obj} />
      ))}
    </group>
  );
}
