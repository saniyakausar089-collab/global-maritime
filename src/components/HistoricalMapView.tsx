import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
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
  Camera,
  X,
  ExternalLink,
} from "lucide-react";

if (typeof window !== "undefined" && typeof maplibregl.setWorkerUrl === "function") {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}

export interface ReplayVesselRecord {
  mmsi: number;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  hdg: number;
  type: number;
  status: string;
  confidence: number;
  source: string;
  isGap: number;
  isInterpolated: number;
  name: string;
  destination: string;
  eta: string;
  haloRadius: number;
}

export interface HistoricalMapViewProps {
  currentTime: number;
  vessels: ReplayVesselRecord[];
  mode: "replay" | "live" | "forecast";
  selectedVessel: ReplayVesselRecord | null;
  selectedPortId: string | null;
  onSelectVessel: (vessel: ReplayVesselRecord | null) => void;
  onSelectPort: (portId: string | null) => void;
  showRoutes?: boolean;
  className?: string;
}

const SHIP_COLORS: Record<string, { fill: string; label: string }> = {
  cargo: { fill: "#5EE7FF", label: "Cargo Vessel" },
  tanker: { fill: "#FFB547", label: "Tanker" },
  passenger: { fill: "#A78BFA", label: "Passenger" },
  tug: { fill: "#FBBF24", label: "Special Craft / Tug" },
  fishing: { fill: "#34D399", label: "Fishing" },
  other: { fill: "#94A3B8", label: "Commercial" },
  anchored: { fill: "#64748B", label: "Anchored (<0.5 kn)" },
  forecast: { fill: "#C084FC", label: "Forecast Position" },
};

const MONITORED_PORTS = [
  { id: "rotterdam", name: "Rotterdam", flag: "🇳🇱", lat: 51.92, lon: 4.17 },
  { id: "singapore", name: "Singapore", flag: "🇸🇬", lat: 1.26, lon: 103.84 },
  { id: "shanghai", name: "Shanghai", flag: "🇨🇳", lat: 31.23, lon: 121.8 },
  { id: "los-angeles", name: "Los Angeles", flag: "🇺🇸", lat: 33.73, lon: -118.26 },
  { id: "hamburg", name: "Hamburg", flag: "🇩🇪", lat: 53.54, lon: 9.97 },
  { id: "santos", name: "Santos", flag: "🇧🇷", lat: -23.98, lon: -46.3 },
];

function getCategoryFromType(typeNum: number, sog: number, isForecast: boolean): string {
  if (isForecast) return "forecast";
  if (sog < 0.5) return "anchored";
  const t = Number(typeNum) || 0;
  if (t >= 70 && t <= 79) return "cargo";
  if (t >= 80 && t <= 89) return "tanker";
  if (t >= 60 && t <= 69) return "passenger";
  if (t >= 50 && t <= 59) return "tug";
  if (t === 30 || t === 31 || t === 32) return "fishing";
  return "other";
}

function createHistoricalShipIcon(category: string, color: string, isHollow = false): ImageData {
  const c = document.createElement("canvas");
  c.width = 50;
  c.height = 50;
  const x = c.getContext("2d")!;
  const cx = 25;

  let bowY = 6;
  let sternY = 44;
  let hw = 7.5;

  if (category === "tug") {
    bowY = 10;
    sternY = 40;
    hw = 8.5;
  } else if (category === "tanker") {
    hw = 8.2;
  }

  // Wake
  if (category !== "anchored" && !isHollow) {
    x.strokeStyle = "rgba(94, 231, 255, 0.4)";
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

  if (isHollow) {
    x.fillStyle = "rgba(10, 16, 25, 0.7)";
    x.fill();
    x.lineWidth = 2.0;
    x.strokeStyle = color;
    x.stroke();
    // Tilde marker for estimated / forecast
    x.fillStyle = color;
    x.font = "bold 14px monospace";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("~", cx, (bowY + sternY) / 2);
  } else {
    x.fillStyle = color;
    x.fill();
    x.lineWidth = 1.4;
    x.strokeStyle = "rgba(255, 255, 255, 0.7)";
    x.stroke();
    // Bridge deck
    x.fillStyle = "#FFFFFF";
    x.fillRect(cx - hw * 0.5, sternY - 12, hw, 4);
  }

  return x.getImageData(0, 0, 50, 50);
}

export function HistoricalMapView({
  currentTime,
  vessels,
  mode,
  selectedVessel,
  selectedPortId,
  onSelectVessel,
  onSelectPort,
  showRoutes = true,
  className = "",
}: HistoricalMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const portMarkersRef = useRef<maplibregl.Marker[]>([]);

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
      minZoom: 1.5,
      maxBounds: [
        [-180, -85],
        [180, 85],
      ],
      renderWorldCopies: false,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on("load", () => {
      // Register ship icon glyphs (both solid and hollow forecast)
      Object.entries(SHIP_COLORS).forEach(([key, conf]) => {
        const idSolid = `hist_ship_${key}`;
        const idHollow = `hist_ship_${key}_hollow`;
        if (!map.hasImage(idSolid)) {
          map.addImage(idSolid, createHistoricalShipIcon(key, conf.fill, false), { pixelRatio: 2 });
        }
        if (!map.hasImage(idHollow)) {
          map.addImage(idHollow, createHistoricalShipIcon(key, conf.fill, true), { pixelRatio: 2 });
        }
      });

      // 1. Sea corridors overlay
      if (!map.getSource("hist_sea_lanes")) {
        map.addSource("hist_sea_lanes", {
          type: "geojson",
          data: "/api/routes",
        });
      }
      if (!map.getLayer("hist_sea_lanes_layer")) {
        map.addLayer({
          id: "hist_sea_lanes_layer",
          type: "line",
          source: "hist_sea_lanes",
          paint: {
            "line-color": "#5EE7FF",
            "line-width": 1.0,
            "line-opacity": 0.15,
          },
        });
      }

      // 2. Trajectories & Trails GeoJSON Source
      if (!map.getSource("hist_routes")) {
        map.addSource("hist_routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // Route lines layer (solid recorded, dashed forecast)
      if (!map.getLayer("hist_routes_solid")) {
        map.addLayer({
          id: "hist_routes_solid",
          type: "line",
          source: "hist_routes",
          filter: ["==", ["get", "type"], "solid"],
          paint: {
            "line-color": "#5EE7FF",
            "line-width": 2.5,
            "line-opacity": 0.85,
          },
        });
      }

      if (!map.getLayer("hist_routes_dashed")) {
        map.addLayer({
          id: "hist_routes_dashed",
          type: "line",
          source: "hist_routes",
          filter: ["==", ["get", "type"], "dashed"],
          paint: {
            "line-color": "#C084FC",
            "line-width": 2.0,
            "line-dasharray": [3, 2],
            "line-opacity": 0.75,
          },
        });
      }

      // 3. Vessel Positions GeoJSON Source
      if (!map.getSource("hist_ships")) {
        map.addSource("hist_ships", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // 4. Uncertainty Halos Layer (For Forecast positions)
      if (!map.getLayer("hist_ships_halo")) {
        map.addLayer({
          id: "hist_ships_halo",
          type: "circle",
          source: "hist_ships",
          filter: [">", ["get", "haloRadius"], 0],
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1, ["*", 0.6, ["get", "haloRadius"]],
              5, ["*", 1.0, ["get", "haloRadius"]],
              10, ["*", 1.5, ["get", "haloRadius"]],
            ],
            "circle-color": "rgba(192, 132, 252, 0.12)",
            "circle-stroke-color": "rgba(192, 132, 252, 0.35)",
            "circle-stroke-width": 1.2,
          },
        });
      }

      // 5. Directional Ship symbols
      if (!map.getLayer("hist_ships_layer")) {
        map.addLayer({
          id: "hist_ships_layer",
          type: "symbol",
          source: "hist_ships",
          layout: {
            "icon-image": ["get", "iconImage"],
            "icon-rotate": ["get", "hdg"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1, 0.65,
              4, 0.85,
              8, 1.1,
              12, 1.35,
            ],
          },
          paint: {
            "icon-opacity": ["get", "opacity"],
          },
        });
      }

      map.on("click", "hist_ships_layer", (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const mmsi = Number(feat.properties?.mmsi);
        const v = vessels.find((item) => item.mmsi === mmsi);
        if (v) {
          onSelectVessel(v);
        }
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
  }, []);

  // Update Vessel Positions on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const shipSrc = map.getSource("hist_ships") as maplibregl.GeoJSONSource | undefined;
    if (!shipSrc) return;

    const isFuture = mode === "forecast";
    const features: any[] = [];

    for (const v of vessels) {
      if (v.isGap) continue; // Skip gaps

      const isSel = selectedVessel?.mmsi === v.mmsi;
      const cat = getCategoryFromType(v.type, v.sog, isFuture);
      const isHollow = isFuture || v.source === "estimated";
      const iconKey = `hist_ship_${cat}${isHollow ? "_hollow" : ""}`;

      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [v.lon, v.lat],
        },
        properties: {
          mmsi: v.mmsi,
          name: v.name,
          hdg: v.hdg ?? v.cog ?? 0,
          sog: v.sog,
          cog: v.cog,
          type: v.type,
          iconImage: iconKey,
          opacity: Math.max(0.25, v.confidence ?? 1.0),
          haloRadius: isFuture ? (v.haloRadius || 8) : 0,
          selected: isSel,
        },
      });
    }

    shipSrc.setData({
      type: "FeatureCollection",
      features,
    });
  }, [vessels, mode, selectedVessel, mapLoaded]);

  // Update Selected Vessel Tracks (Solid recorded breadcrumbs up to currentTime + Dashed forecast if in future)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const routeSrc = map.getSource("hist_routes") as maplibregl.GeoJSONSource | undefined;
    if (!routeSrc) return;

    if (!selectedVessel || !showRoutes) {
      routeSrc.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    fetch(`/api/vessels/${selectedVessel.mmsi}/track`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const features: any[] = [];

        // Solid line for past recorded breadcrumbs up to vessel position
        if (Array.isArray(data.breadcrumbs) && data.breadcrumbs.length > 0) {
          features.push({
            type: "Feature",
            properties: { type: "solid" },
            geometry: {
              type: "LineString",
              coordinates: [...data.breadcrumbs, [selectedVessel.lon, selectedVessel.lat]],
            },
          });
        }

        // Dashed line if vessel has a future sea route
        if (Array.isArray(data.routeCoordinates) && data.routeCoordinates.length > 1) {
          features.push({
            type: "Feature",
            properties: { type: "dashed" },
            geometry: {
              type: "LineString",
              coordinates: data.routeCoordinates,
            },
          });
        }

        routeSrc.setData({
          type: "FeatureCollection",
          features,
        });
      })
      .catch(() => {});
  }, [selectedVessel, showRoutes, mapLoaded, currentTime]);

  // Update Port Markers with Collision Safety
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    portMarkersRef.current.forEach((m) => m.remove());
    portMarkersRef.current = [];

    MONITORED_PORTS.forEach((p) => {
      const isSelected = selectedPortId === p.id;
      const el = document.createElement("div");
      el.className = `cursor-pointer transition-transform hover:scale-110 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-bold backdrop-blur-md shadow-lg ${
        isSelected
          ? "bg-accent text-black border-white shadow-[0_0_12px_#5EE7FF]"
          : "bg-[#0A1019]/85 text-ink border-white/20 hover:border-accent"
      }`;

      // Offset Hamburg slightly right-up to prevent collision with Rotterdam
      let anchorPos: maplibregl.PositionAnchor = "center";
      let offset: [number, number] = [0, 0];
      if (p.id === "hamburg") {
        offset = [22, -14];
      } else if (p.id === "rotterdam") {
        offset = [-18, 12];
      }

      el.innerHTML = `<span>${p.flag}</span><span>${p.name}</span>`;
      el.onclick = (e) => {
        e.stopPropagation();
        onSelectPort(p.id === selectedPortId ? null : p.id);
      };

      const marker = new maplibregl.Marker({ element: el, anchor: anchorPos, offset })
        .setLngLat([p.lon, p.lat])
        .addTo(map);

      portMarkersRef.current.push(marker);
    });
  }, [selectedPortId, mapLoaded, onSelectPort]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => mapRef.current?.flyTo({ center: [20, 20], zoom: 2.2, pitch: 0, bearing: 0 });

  return (
    <div className={`relative w-full h-[65vh] min-h-[500px] overflow-hidden rounded-2xl ${className}`}>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Floating Toolbar Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 glass-pill px-2 py-1 shadow-xl">
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom In"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-white/10 transition cursor-pointer"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom Out"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-white/10 transition cursor-pointer"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-3.5 w-px bg-white/10" />
        <button
          type="button"
          onClick={resetView}
          title="Fit to World / Reset View"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-white/10 transition cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      {/* Floating Bottom Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-3 pointer-events-none">
        <div className="glass-pill flex flex-wrap items-center gap-3 px-3.5 py-1.5 text-xs pointer-events-auto shadow-lg">
          <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider font-mono">
            Layer:
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#5EE7FF]" /> Recorded
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full border border-[#C084FC] bg-purple-500/20" /> Forecast (~)
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#34D399]" /> Active Live
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#64748B]" /> Anchored
          </span>
        </div>
      </div>
    </div>
  );
}
