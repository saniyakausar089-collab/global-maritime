import React, { useMemo, useState, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

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
  activeScene: number; // 0 to 9
  onSelectVessel?: (vessel: TrackedVessel | null) => void;
  selectedVesselId?: string | null;
}

export function ShipCourseVectors({
  activeScene,
  onSelectVessel,
  selectedVesselId,
}: ShipCourseVectorsProps) {
  const [hoveredVessel, setHoveredVessel] = useState<TrackedVessel | null>(null);
  const pulseRef = useRef<number>(0);

  // Representative realistic tracked vessels around port approaches
  const vessels: TrackedVessel[] = useMemo(() => {
    return [
      {
        id: "vessel-1",
        name: "MAERSK MC-KINNEY MOLLER",
        mmsi: 219018271,
        shipType: "Ultra Large Container Vessel",
        pos: [0.65, 8.05, 6.35],
        heading: 68,
        speedKnots: 16.4,
        destination: "NLRTM (Rotterdam Maasvlakte)",
        eta: "2026-11-01 04:30 UTC",
        status: "Underway using engine",
        history: [
          [0.15, 7.82, 6.12],
          [0.28, 7.88, 6.18],
          [0.42, 7.95, 6.25],
          [0.54, 8.01, 6.30],
          [0.65, 8.05, 6.35],
        ],
      },
      {
        id: "vessel-2",
        name: "FRONT ALTAIR",
        mmsi: 538006932,
        shipType: "VLCC Crude Oil Tanker",
        pos: [0.32, 8.22, 6.15],
        heading: 142,
        speedKnots: 11.8,
        destination: "NLRTM (Europoort Jetty 6)",
        eta: "2026-11-01 08:15 UTC",
        status: "Underway using engine",
        history: [
          [0.18, 8.35, 6.02],
          [0.22, 8.31, 6.06],
          [0.27, 8.26, 6.11],
          [0.32, 8.22, 6.15],
        ],
      },
      {
        id: "vessel-3",
        name: "BERGE KANGCHENJUNGA",
        mmsi: 235113942,
        shipType: "Capesize Bulk Carrier (Ore)",
        pos: [0.95, 7.78, 6.45],
        heading: 215,
        speedKnots: 0.2,
        destination: null, // "Destination not reported"
        eta: null,
        status: "At anchor (Outer Anchorage 4)",
        history: [
          [0.96, 7.77, 6.44],
          [0.95, 7.78, 6.45],
        ],
      },
      {
        id: "vessel-4",
        name: "MSC TESSA",
        mmsi: 636021876,
        shipType: "Container Ship (24,116 TEU)",
        pos: [1.35, 8.38, 6.08],
        heading: 85,
        speedKnots: 18.2,
        destination: "BEANR (Antwerp Gateway)",
        eta: "2026-11-01 14:00 UTC",
        status: "Underway using engine",
        history: [
          [0.92, 8.25, 5.92],
          [1.06, 8.30, 5.97],
          [1.21, 8.34, 6.02],
          [1.35, 8.38, 6.08],
        ],
      },
      {
        id: "vessel-5",
        name: "NORDIC PASSAT",
        mmsi: 256819000,
        shipType: "Chemical / Product Tanker",
        pos: [-0.15, 8.12, 6.42],
        heading: 320,
        speedKnots: 0.1,
        destination: "NLRTM (Botlek)",
        eta: "2026-11-01 02:00 UTC",
        status: "Awaiting pilot / bunkering",
        history: [
          [-0.14, 8.13, 6.41],
          [-0.15, 8.12, 6.42],
        ],
      },
    ];
  }, []);

  const activeVessel = hoveredVessel || vessels.find((v) => v.id === selectedVesselId) || vessels[0]!;

  useFrame(({ clock }) => {
    pulseRef.current = (Math.sin(clock.getElapsedTime() * 3.5) + 1.0) * 0.5;
  });

  // Build 3D geometries for tracks, COG vectors, projected lines, and destination arcs
  return (
    <group>
      {vessels.map((v) => {
        const rad = (v.heading * Math.PI) / 180;
        // Direction vector along heading
        const dirX = Math.sin(rad);
        const dirY = Math.cos(rad) * 0.5;
        const dirZ = Math.cos(rad) * 0.8;

        const isHovered = hoveredVessel?.id === v.id;
        const isSelected = selectedVesselId === v.id;
        const isFocus = isHovered || isSelected;

        // 1. Heading & Course Over Ground (COG) Vector
        // Length scaled by speed (e.g. 18 kn = ~0.65 units in local space)
        const cogLength = Math.max(0.15, (v.speedKnots / 20) * 0.65);
        const cogEnd: [number, number, number] = [
          v.pos[0] + dirX * cogLength,
          v.pos[1] + dirY * cogLength,
          v.pos[2] + dirZ * cogLength,
        ];

        // 2. Projected Dead-Reckoning Path (Dashed forward projection for next 30-60 mins)
        const projLength = Math.max(0.3, (v.speedKnots / 20) * 1.6);
        const projEnd: [number, number, number] = [
          v.pos[0] + dirX * projLength,
          v.pos[1] + dirY * projLength,
          v.pos[2] + dirZ * projLength,
        ];

        // 3. Historical Spline Trail
        const historyCurve =
          v.history.length >= 2
            ? new THREE.CatmullRomCurve3(v.history.map((pt) => new THREE.Vector3(...pt)))
            : null;
        const historyPoints = historyCurve ? historyCurve.getPoints(24) : [];

        // 4. Destination Arc (Great circle curve if destination exists)
        const destCurve = useMemo(() => {
          if (!v.destination) return null;
          // Destination anchor point
          const destEnd = new THREE.Vector3(v.pos[0] + dirX * 3.5, v.pos[1] + 0.3, v.pos[2] - 2.8);
          const start = new THREE.Vector3(...v.pos);
          const mid = start.clone().lerp(destEnd, 0.5).add(new THREE.Vector3(0, 0.6, 0));
          return new THREE.QuadraticBezierCurve3(start, mid, destEnd).getPoints(32);
        }, [v, dirX, dirZ]);

        return (
          <group key={v.id}>
            {/* Vessel Position Marker (Interactive) */}
            <mesh
              position={v.pos}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredVessel(v);
                onSelectVessel?.(v);
              }}
              onPointerOut={() => {
                setHoveredVessel(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectVessel?.(v);
              }}
            >
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial
                color={isFocus ? 0x00f0ff : v.speedKnots > 0.5 ? 0x10b981 : 0xf59e0b}
                emissive={isFocus ? 0x00f0ff : v.speedKnots > 0.5 ? 0x10b981 : 0xf59e0b}
                emissiveIntensity={isFocus ? 1.4 : 0.8}
              />
            </mesh>

            {/* Glowing Ring around active/focused vessel */}
            {isFocus && (
              <mesh position={v.pos} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.12, 0.16, 24]} />
                <meshBasicMaterial color={0x00f0ff} transparent opacity={0.8} side={THREE.DoubleSide} />
              </mesh>
            )}

            {/* Heading & COG Vector Line */}
            {v.speedKnots > 0.5 && (
              <primitive
                object={
                  new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints([
                      new THREE.Vector3(...v.pos),
                      new THREE.Vector3(...cogEnd),
                    ]),
                    new THREE.LineBasicMaterial({
                      color: isFocus ? 0x38bdf8 : 0x06b6d4,
                      linewidth: 2,
                    })
                  )
                }
              />
            )}

            {/* Historical Track Trail (Fading with age) */}
            {historyPoints.length > 0 && (
              <primitive
                object={
                  new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(historyPoints),
                    new THREE.LineBasicMaterial({
                      color: 0x0284c7,
                      transparent: true,
                      opacity: isFocus ? 0.9 : 0.45,
                    })
                  )
                }
              />
            )}

            {/* Projected Dead-Reckoning Path (Dashed) */}
            {v.speedKnots > 0.5 && (
              <primitive
                object={
                  new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints([
                      new THREE.Vector3(...cogEnd),
                      new THREE.Vector3(...projEnd),
                    ]),
                    new THREE.LineDashedMaterial({
                      color: 0x38bdf8,
                      dashSize: 0.1,
                      gapSize: 0.08,
                      transparent: true,
                      opacity: isFocus ? 0.85 : 0.4,
                    })
                  )
                }
              />
            )}

            {/* Destination Arc (When reported) */}
            {isFocus && destCurve && (
              <primitive
                object={
                  new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(destCurve),
                    new THREE.LineBasicMaterial({
                      color: 0xfacc15,
                      transparent: true,
                      opacity: 0.75,
                    })
                  )
                }
              />
            )}
          </group>
        );
      })}

      {/* Floating HUD Card for Selected or Hovered Vessel in Scene 05 */}
      {activeScene === 4 && activeVessel && (
        <Html position={[activeVessel.pos[0] + 0.35, activeVessel.pos[1] + 0.3, activeVessel.pos[2]]} zIndexRange={[100, 0]}>
          <div className="w-80 rounded-xl border border-cyan-500/40 bg-slate-950/85 p-3.5 shadow-2xl backdrop-blur-md text-xs font-mono text-slate-200 pointer-events-auto">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2">
              <span className="font-semibold text-cyan-400 truncate max-w-[190px]">
                {activeVessel.name}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                MMSI {activeVessel.mmsi}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Vessel Class:</span>
                <span className="text-slate-200 font-sans font-medium">{activeVessel.shipType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Speed / COG:</span>
                <span className="text-emerald-400 font-semibold">
                  {activeVessel.speedKnots.toFixed(1)} kn / {activeVessel.heading}°
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-slate-300">{activeVessel.status}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Destination:</span>
                <span className={activeVessel.destination ? "text-cyan-300 font-medium" : "text-amber-400/90 italic"}>
                  {activeVessel.destination || "Destination not reported"}
                </span>
              </div>
              {activeVessel.eta && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Reported ETA:</span>
                  <span className="text-slate-200">{activeVessel.eta}</span>
                </div>
              )}
            </div>

            <div className="mt-2.5 pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-0.5 bg-cyan-400"></span>
                <span>Projected (dead reckoning)</span>
              </span>
              <span className="text-cyan-400/80">30-60m vector</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
