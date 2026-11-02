import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  type HistoricalVessel,
  type HistoricalEvent,
  type PortArea,
  MONITORED_PORTS,
  interpolateVesselPosition,
} from "@/lib/historicalData";
import {
  Compass,
  Ship,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Navigation,
  Anchor,
  Sparkles,
  AlertCircle,
  Flag,
  Radio,
} from "lucide-react";

if (typeof window !== "undefined" && typeof maplibregl.setWorkerUrl === "function") {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}

export interface HistoricalMapViewProps {
  currentTime: number;
  vessels: HistoricalVessel[];
  events: HistoricalEvent[];
  selectedVessel: HistoricalVessel | null;
  selectedPort: PortArea | null;
  onSelectVessel: (vessel: HistoricalVessel | null) => void;
  onSelectPort: (port: PortArea | null) => void;
  onSelectEvent: (event: HistoricalEvent) => void;
  showTrails?: boolean;
  showRoutes?: boolean;
  showEvents?: boolean;
  className?: string;
}

const SHIP_COLORS: Record<string, { fill: string; label: string }> = {
  cargo: { fill: "#14B8A6", label: "Cargo Vessel" },
  tanker: { fill: "#F59E0B", label: "Tanker" },
  passenger: { fill: "#EC4899", label: "Passenger" },
  tug: { fill: "#22D3EE", label: "Special Craft / Tug" },
  fishing: { fill: "#EAB308", label: "Fishing" },
  other: { fill: "#3B82F6", label: "Commercial" },
  anchored: { fill: "#64748B", label: "Anchored (<0.5 kn)" },
};

function createHistoricalShipIcon(category: string, color: string): ImageData {
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 48;
  const x = c.getContext("2d")!;
  const cx = 24;

  let bowY = 6;
  let sternY = 42;
  let hw = 7;

  if (category === "tug") {
    bowY = 10;
    sternY = 38;
    hw = 7.5;
  } else if (category === "tanker") {
    hw = 7.8;
  }

  // Wake
  if (category !== "anchored") {
    x.strokeStyle = "rgba(34, 211, 238, 0.4)";
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(cx - hw * 0.7, sternY - 2);
    x.lineTo(cx - hw * 1.4, sternY + 5);
    x.moveTo(cx + hw * 0.7, sternY - 2);
    x.lineTo(cx + hw * 1.4, sternY + 5);
    x.stroke();
  }

  // Hull
  x.beginPath();
  x.moveTo(cx, bowY);
  x.bezierCurveTo(cx + hw * 0.6, bowY + 3, cx + hw, bowY + 10, cx + hw, bowY + 15);
  x.lineTo(cx + hw, sternY - 3);
  x.quadraticCurveTo(cx + hw, sternY, cx + hw - 2, sternY);
  x.lineTo(cx - hw + 2, sternY);
  x.quadraticCurveTo(cx - hw, sternY, cx - hw, sternY - 3);
  x.lineTo(cx - hw, bowY + 15);
  x.bezierCurveTo(cx - hw, bowY + 10, cx - hw * 0.6, bowY + 3, cx, bowY);
  x.closePath();

  x.fillStyle = color;
  x.fill();

  x.lineWidth = 1.6;
  x.strokeStyle = "#FFFFFF";
  x.stroke();

  // Bridge deck
  x.fillStyle = "#FFFFFF";
  x.fillRect(cx - hw * 0.5, sternY - 12, hw, 4);

  return x.getImageData(0, 0, 48, 48);
}

function getVesselCategory(v: HistoricalVessel, isStationary: boolean): string {
  if (isStationary) return "anchored";
  const label = v.shipTypeLabel.toLowerCase();
  if (label.includes("cargo")) return "cargo";
  if (label.includes("tanker")) return "tanker";
  if (label.includes("passenger")) return "passenger";
  if (label.includes("tug") || label.includes("special")) return "tug";
  if (label.includes("fishing")) return "fishing";
  return "other";
}

export function HistoricalMapView({
  currentTime,
  vessels,
  events,
  selectedVessel,
  selectedPort,
  onSelectVessel,
  onSelectPort,
  onSelectEvent,
  showTrails = true,
  showRoutes = true,
  showEvents = true,
  className,
}: HistoricalMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const portMarkersRef = useRef<maplibregl.Marker[]>([]);
  const eventMarkersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: [20, 20],
      zoom: 2.2,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on("load", () => {
      // Register ship icon glyphs
      Object.entries(SHIP_COLORS).forEach(([key, conf]) => {
        const id = `hist_ship_${key}`;
        if (!map.hasImage(id)) {
          map.addImage(id, createHistoricalShipIcon(key, conf.fill), { pixelRatio: 2 });
        }
      });

      // 1. Vessel Positions GeoJSON Source
      if (!map.getSource("hist_ships")) {
        map.addSource("hist_ships", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // 2. Trajectories & Trails GeoJSON Source
      if (!map.getSource("hist_routes")) {
        map.addSource("hist_routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // Route lines layer
      if (!map.getLayer("hist_routes_layer")) {
        map.addLayer({
          id: "hist_routes_layer",
          type: "line",
          source: "hist_routes",
          paint: {
            "line-color": [
              "case",
              ["get", "selected"],
              "#22D3EE",
              "rgba(20, 184, 166, 0.45)",
            ],
            "line-width": [
              "case",
              ["get", "selected"],
              3.5,
              1.8,
            ],
            "line-dasharray": [
              "case",
              ["get", "selected"],
              [1, 0],
              [2, 2],
            ],
          },
        });
      }

      // Ship halo glow
      if (!map.getLayer("hist_ships_glow")) {
        map.addLayer({
          id: "hist_ships_glow",
          type: "circle",
          source: "hist_ships",
          paint: {
            "circle-radius": [
              "case",
              ["get", "selected"],
              12,
              6,
            ],
            "circle-color": [
              "case",
              ["get", "selected"],
              "#22D3EE",
              "#14B8A6",
            ],
            "circle-opacity": [
              "case",
              ["get", "selected"],
              0.65,
              0.3,
            ],
            "circle-blur": 0.6,
          },
        });
      }

      // Directional Ship symbols
      if (!map.getLayer("hist_ships_layer")) {
        map.addLayer({
          id: "hist_ships_layer",
          type: "symbol",
          source: "hist_ships",
          layout: {
            "icon-image": ["concat", "hist_ship_", ["get", "icon"]],
            "icon-rotate": ["get", "hdg"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": [
              "case",
              ["get", "selected"],
              1.2,
              0.9,
            ],
          },
        });
      }

      map.on("click", "hist_ships_layer", (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const id = Number(feat.properties?.id);
        const v = vessels.find((item) => item.id === id);
        if (v) onSelectVessel(v);
      });

      map.on("mouseenter", "hist_ships_layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "hist_ships_layer", () => {
        map.getCanvas().style.cursor = "";
      });

      setMapLoaded(true);
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [vessels, onSelectVessel]);

  // Update Vessel Positions & Routes on Replay Timestamp Change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const shipFeatures = [];
    const routeFeatures = [];

    for (const v of vessels) {
      const pos = interpolateVesselPosition(v, currentTime);
      if (!pos) continue;

      const isSel = selectedVessel?.id === v.id;
      const cat = getVesselCategory(v, pos.stationary);

      shipFeatures.push({
        type: "Feature" as const,
        properties: {
          id: v.id,
          name: v.name,
          icon: cat,
          hdg: pos.hdg || pos.cog || 0,
          sog: pos.sog,
          selected: isSel,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [pos.lon, pos.lat],
        },
      });

      // Historical Trail / Route line up to currentTime
      if (showRoutes || isSel) {
        const pastPositions = v.positions.filter((p) => p.timestamp <= currentTime);
        if (pastPositions.length >= 2) {
          routeFeatures.push({
            type: "Feature" as const,
            properties: {
              vesselId: v.id,
              selected: isSel,
            },
            geometry: {
              type: "LineString" as const,
              coordinates: [
                ...pastPositions.map((p) => [p.lon, p.lat]),
                [pos.lon, pos.lat],
              ],
            },
          });
        }
      }
    }

    const shipSrc = map.getSource("hist_ships") as maplibregl.GeoJSONSource | undefined;
    if (shipSrc) {
      shipSrc.setData({ type: "FeatureCollection", features: shipFeatures });
    }

    const routeSrc = map.getSource("hist_routes") as maplibregl.GeoJSONSource | undefined;
    if (routeSrc) {
      routeSrc.setData({ type: "FeatureCollection", features: routeFeatures });
    }
  }, [currentTime, vessels, selectedVessel, showRoutes, mapLoaded]);

  // Render Port Geofence Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    portMarkersRef.current.forEach((m) => m.remove());
    portMarkersRef.current = [];

    MONITORED_PORTS.forEach((p) => {
      const isSel = selectedPort?.id === p.id;
      const el = document.createElement("div");
      el.className = "cursor-pointer select-none group";

      el.innerHTML = `
        <div style="transform: translate(-50%, -50%); position: relative; display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 9999px; font-family: system-ui, sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); border: 1.5px solid ${isSel ? "#22D3EE" : "#14B8A6"}; background: #071B2F; color: #FFFFFF;">
          <span style="font-size: 12px;">${p.flag}</span>
          <span>${p.name}</span>
          <span style="padding: 1px 5px; border-radius: 4px; background: rgba(34, 211, 238, 0.2); color: #22D3EE; font-family: monospace; font-size: 10px;">${p.radiusKm}km</span>
        </div>
      `;

      el.onclick = () => {
        onSelectPort(isSel ? null : p);
        map.flyTo({ center: [p.lon, p.lat], zoom: 9, essential: true });
      };

      const marker = new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);
      portMarkersRef.current.push(marker);
    });
  }, [selectedPort, mapLoaded, onSelectPort]);

  // Render Historical Event Markers (Glowing Amber/Teal/Red Beacons)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    eventMarkersRef.current.forEach((m) => m.remove());
    eventMarkersRef.current = [];

    if (!showEvents) return;

    // Show events that occurred around the current window (+/- 3 hours of replay time)
    const activeEvents = events.filter(
      (evt) => Math.abs(evt.timestamp - currentTime) <= 3 * 60 * 60 * 1000,
    );

    activeEvents.forEach((evt) => {
      const el = document.createElement("div");
      el.className = "cursor-pointer select-none";

      let color = "#F59E0B"; // Amber for arrivals/anchorage
      let icon = "⚓";
      if (evt.type === "PORT_ENTRY") {
        color = "#10B981";
        icon = "🚢";
      } else if (evt.type === "PORT_DEPARTURE") {
        color = "#22D3EE";
        icon = "💨";
      }

      el.innerHTML = `
        <div style="transform: translate(-50%, -50%); position: relative; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 9999px; background: ${color}; color: #071B2F; font-size: 12px; font-weight: bold; box-shadow: 0 0 16px ${color}; border: 2px solid #FFFFFF;">
          ${icon}
        </div>
      `;

      el.onclick = () => onSelectEvent(evt);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(evt.coordinates)
        .addTo(map);

      eventMarkersRef.current.push(marker);
    });
  }, [events, currentTime, showEvents, mapLoaded, onSelectEvent]);

  // Fly to selected vessel if selection changes
  useEffect(() => {
    if (selectedVessel && mapRef.current) {
      const pos = interpolateVesselPosition(selectedVessel, currentTime);
      if (pos) {
        mapRef.current.flyTo({ center: [pos.lon, pos.lat], zoom: 9.5, essential: true });
      }
    }
  }, [selectedVessel?.id]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => mapRef.current?.flyTo({ center: [20, 20], zoom: 2.2, essential: true });

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border border-border bg-[#071B2F] shadow-lg ${
        isFullscreen ? "fixed inset-0 z-[2000] h-screen w-screen rounded-none" : className ?? "h-[540px] w-full"
      }`}
    >
      {/* MapLibre Container */}
      <div className="h-full w-full" />

      {/* Historical Mode Indicator Banner (Top Left) */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-[#071B2F]/90 px-3 py-1 font-mono text-xs backdrop-blur-md shadow-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span className="font-bold text-amber-400">HISTORICAL REPLAY — NOT LIVE</span>
          <span className="text-white/40">|</span>
          <span className="text-white/80 font-sans text-[11px]">
            {vessels.length} recorded ships
          </span>
        </div>

        {selectedPort && (
          <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-950/80 px-2.5 py-0.5 text-xs text-cyan-300">
            <span>{selectedPort.flag}</span>
            <span className="font-semibold">{selectedPort.name} Area</span>
            <button
              onClick={() => onSelectPort(null)}
              className="ml-1 text-cyan-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Internal Map Controls Toolbar (Top Right) */}
      <div className="absolute right-3 top-3 z-10 flex items-center rounded-lg border border-white/10 bg-[#071B2F]/90 p-1 backdrop-blur-md shadow-md">
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom In"
          className="flex h-7 w-7 items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom Out"
          className="flex h-7 w-7 items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="mx-1 h-4 w-px bg-white/10" />
        <button
          type="button"
          onClick={resetView}
          title="Reset Global View"
          className="flex h-7 w-7 items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Replay"}
          className="flex h-7 w-7 items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Legend & Telemetry Bar (Bottom Right Overlay) */}
      <div className="absolute bottom-3 right-3 z-10 hidden sm:flex items-center gap-3 rounded-lg border border-white/10 bg-[#071B2F]/90 px-3 py-1.5 text-[11px] backdrop-blur-md shadow-md text-white/80">
        <span className="font-semibold text-cyan-400">Recorded Categories:</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#14B8A6]" /> Cargo
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Tanker
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#EC4899]" /> Passenger
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#64748B]" /> Anchored (&lt;0.5 kn)
        </span>
      </div>
    </div>
  );
}

