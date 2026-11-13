import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Link } from "@tanstack/react-router";
import type { Port } from "@/lib/api";
import { deadReckonPos, type LiveVessel, type ConnectionStatus } from "@/lib/useLiveVessels";
import {
  Compass,
  Ship,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Navigation,
  Eye,
  EyeOff,
  Layers,
  Anchor,
  Sparkles,
  X,
  ExternalLink,
  Radio,
  Activity,
} from "lucide-react";

if (typeof window !== "undefined" && typeof maplibregl.setWorkerUrl === "function") {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}

export type MapViewProps = {
  center?: [number, number]; // [lat, lon]
  zoom?: number;
  ports?: Port[];
  vessels?: LiveVessel[];
  status?: ConnectionStatus;
  statusMessage?: string;
  isSimulated?: boolean;
  isDemoMode?: boolean;
  selectedVessel?: LiveVessel | null;
  onSelectVessel?: (vessel: LiveVessel | null) => void;
  onSelectPort?: (port: Port) => void;
  selectedPortId?: string | null;
  onClosePort?: () => void;
  className?: string;
};

// Premium Radar / AIS Vessel Colors (Optimized for both Tactical Dark and Elegant Light themes)
const SHIP_COLORS: Record<string, { fill: string; fillLight: string; label: string }> = {
  cargo: { fill: "#FACC15", fillLight: "#B45309", label: "Cargo (Container/Bulk)" },
  tanker: { fill: "#FB923C", fillLight: "#C2410C", label: "Tanker (Oil/Gas)" },
  passenger: { fill: "#38BDF8", fillLight: "#0284C7", label: "Passenger / Cruise" },
  fast: { fill: "#60A5FA", fillLight: "#1D4ED8", label: "Fast (>14 kn)" },
  fishing: { fill: "#34D399", fillLight: "#047857", label: "Fishing" },
  tug: { fill: "#C084FC", fillLight: "#7E22CE", label: "Tug / Workboat" },
  other: { fill: "#FDE047", fillLight: "#D97706", label: "Commercial" },
  unknown: { fill: "#E2E8F0", fillLight: "#64748B", label: "Unknown / Commercial" },
  anchored: { fill: "#64748B", fillLight: "#475569", label: "Anchored (<0.5 kn)" },
};

// MapLibre expressions for type colors
const DARK_TYPE_COLORS: any = [
  "match",
  ["get", "category"],
  "cargo", "#FACC15",
  "tanker", "#FB923C",
  "passenger", "#38BDF8",
  "fast", "#60A5FA",
  "fishing", "#34D399",
  "tug", "#C084FC",
  "anchored", "#64748B",
  "other", "#FDE047",
  "#FACC15",
];

const LIGHT_TYPE_COLORS: any = [
  "match",
  ["get", "category"],
  "cargo", "#B45309",
  "tanker", "#C2410C",
  "passenger", "#0284C7",
  "fast", "#1D4ED8",
  "fishing", "#047857",
  "tug", "#7E22CE",
  "anchored", "#475569",
  "other", "#D97706",
  "#B45309",
];

const PORT_FLAGS: Record<string, string> = {
  rotterdam: "🇳🇱",
  singapore: "🇸🇬",
  shanghai: "🇨🇳",
  "los-angeles": "🇺🇸",
  hamburg: "🇩🇪",
  santos: "🇧🇷",
};

const MAP_STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  vibrant: "https://tiles.openfreemap.org/styles/liberty",
  clean: "https://tiles.openfreemap.org/styles/positron",
};

// Generates a crisp, streamlined directional chevron / delta arrowhead for GPU-colored symbol rendering
function createSdfShipIcon(): ImageData {
  const size = 32;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const x = c.getContext("2d")!;
  const cx = size / 2; // 16

  // Crisp directional arrowhead / chevron matching professional vessel radar displays
  x.fillStyle = "#ffffff";
  x.beginPath();
  x.moveTo(cx, 1.5); // Sharp bow tip
  x.lineTo(cx + 9.5, 27); // Starboard aft fin
  x.lineTo(cx, 19.5); // Stern notch / keel recess
  x.lineTo(cx - 9.5, 27); // Port aft fin
  x.closePath();
  x.fill();

  return x.getImageData(0, 0, size, size);
}

// Generates a crisp circular radar target / anchor beacon for stationary/anchored vessels
function createSdfAnchorIcon(): ImageData {
  const size = 32;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const x = c.getContext("2d")!;
  const cx = size / 2; // 16
  const cy = size / 2; // 16

  x.fillStyle = "#ffffff";
  // Outer radar beacon ring
  x.beginPath();
  x.arc(cx, cy, 9.5, 0, Math.PI * 2);
  x.arc(cx, cy, 6.5, 0, Math.PI * 2, true);
  x.fill();

  // Solid center target core
  x.beginPath();
  x.arc(cx, cy, 3.5, 0, Math.PI * 2);
  x.fill();

  return x.getImageData(0, 0, size, size);
}

function getShipCategory(s: LiveVessel): string {
  if (s.stationary || (s.sog != null && s.sog < 0.5)) return "anchored";
  const t = s.type || s.shipType || 0;
  if (t >= 70 && t <= 79) return "cargo";
  if (t >= 80 && t <= 89) return "tanker";
  if (t >= 60 && t <= 69) return "passenger";
  if (t >= 50 && t <= 59) return "tug";
  if (t === 30 || t === 31 || t === 32) return "fishing";
  if ((s.sog || 0) > 14) return "fast";
  if (t > 0) return "other";
  return "unknown";
}

// Tuned basemap: Precision ocean & land coloring for both Dark Command and Light Nautical themes
function applyBasemapTuning(map: maplibregl.Map, isDark: boolean) {
  try {
    const style = map.getStyle();
    if (!style || !style.layers) return;

    for (const layer of style.layers) {
      // Water & Ocean: Deep cinematic bathymetric contrast
      if (layer.id.includes("water") || layer.id.includes("ocean") || layer.id === "waterway") {
        const waterColor = isDark ? "#050912" : "#D2E2F0";
        if (layer.type === "fill") {
          try { map.setPaintProperty(layer.id, "fill-color", waterColor); } catch {}
        } else if (layer.type === "background") {
          try { map.setPaintProperty(layer.id, "background-color", waterColor); } catch {}
        }
      }
      // Land & Coastlines: Clean contrasting landmass
      if (
        layer.id.includes("land") ||
        layer.id.includes("background") ||
        layer.id.includes("earth") ||
        layer.id.includes("sand")
      ) {
        const landColor = isDark ? "#0c1219" : "#F8FAFC";
        if (layer.type === "fill") {
          try { map.setPaintProperty(layer.id, "fill-color", landColor); } catch {}
        } else if (layer.type === "background") {
          try { map.setPaintProperty(layer.id, "background-color", landColor); } catch {}
        }
      }
      // Country & place labels: subtle at low zoom, fade in smoothly at high zoom
      if (
        layer.type === "symbol" &&
        (layer.id.includes("label") ||
          layer.id.includes("place") ||
          layer.id.includes("country") ||
          layer.id.includes("continent"))
      ) {
        try {
          map.setPaintProperty(layer.id, "text-color", isDark ? "#94A3B8" : "#334155");
          map.setPaintProperty(layer.id, "text-halo-color", isDark ? "rgba(5, 8, 12, 0.95)" : "rgba(255, 255, 255, 0.95)");
          map.setPaintProperty(layer.id, "text-opacity", [
            "interpolate",
            ["linear"],
            ["zoom"],
            1, 0,
            2.9, 0,
            3.5, 0.25,
            5, 0.45,
            8, 0.70,
          ]);
        } catch {}
      }
    }
  } catch (err) {
    console.warn("[MapLibre] Basemap tuning notice:", err);
  }
}

function toLngLat(c: [number, number]): [number, number] {
  if (Math.abs(c[0]) > 90) return [c[0], c[1]];
  if (Math.abs(c[1]) > 90) return [c[1], c[0]];
  return [c[1], c[0]];
}

export function MapView({
  center = [20, 10],
  zoom = 2,
  ports = [],
  vessels = [],
  status = "live",
  statusMessage,
  isSimulated = false,
  isDemoMode = false,
  selectedVessel,
  onSelectVessel,
  onSelectPort,
  selectedPortId,
  onClosePort,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const portMarkersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const animRef = useRef<number | null>(null);

  const vesselsRef = useRef<LiveVessel[]>(vessels);
  vesselsRef.current = vessels;

  const portsRef = useRef<Port[]>(ports);
  portsRef.current = ports;

  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeStyle, setActiveStyle] = useState<"dark" | "vibrant" | "clean">("dark");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Map Controls State
  const [showRoutes, setShowRoutes] = useState(true);
  const [showPortLabels, setShowPortLabels] = useState(true);
  const [showAnchored, setShowAnchored] = useState(true);
  const [showEstimated, setShowEstimated] = useState(true);
  const [showTrafficDensity, setShowTrafficDensity] = useState(true);

  // Deduplicate and split counts: unique MMSIs, live vs estimated
  const { uniqueVessels, liveCount, estimatedCount } = useMemo(() => {
    const seen = new Set<number>();
    const list: LiveVessel[] = [];
    let live = 0;
    let est = 0;

    for (const v of vessels) {
      const id = v.mmsi || v.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      list.push(v);
      if (v.source === "estimated") est++;
      else live++;
    }

    return { uniqueVessels: list, liveCount: live, estimatedCount: est };
  }, [vessels]);

  const activeStyleRef = useRef<"dark" | "vibrant" | "clean">("dark");
  activeStyleRef.current = activeStyle;
  const updateGeoJsonRef = useRef<() => void>(() => {});
  const setupLayersRef = useRef<() => void>(() => {});

  const switchStyle = (styleKey: "dark" | "vibrant" | "clean") => {
    if (styleKey === activeStyleRef.current && mapRef.current?.isStyleLoaded()) return;
    setActiveStyle(styleKey);
    activeStyleRef.current = styleKey;
    const map = mapRef.current;
    if (map) {
      map.setStyle(MAP_STYLES[styleKey]);
      map.once("style.load", () => {
        setupLayersRef.current();
        updateGeoJsonRef.current();
      });
    }
  };

  // Synchronize Map basemap and styling with global application theme (dark/light)
  useEffect(() => {
    const checkTheme = () => {
      const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
      const targetStyle: "dark" | "clean" = isDark ? "dark" : "clean";
      if (activeStyleRef.current !== targetStyle) {
        switchStyle(targetStyle);
      }
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const resetView = () => {
    mapRef.current?.flyTo({
      center: [10, 20],
      zoom: 2,
      essential: true,
    });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => mapRef.current?.resize(), 100);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const styleUrl = MAP_STYLES.dark;

    // MAP OPTIONS: renderWorldCopies: false, maxBounds clamped, minZoom: 1.5
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: toLngLat(center),
      zoom: zoom,
      minZoom: 1.5,
      renderWorldCopies: false,
      maxBounds: [
        [-179.9, -85],
        [179.9, 85],
      ],
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on("error", (e) => {
      console.warn("[MapLibre] warning/error:", e?.error?.message || e);
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);
    const resizeTimeout = setTimeout(() => map.resize(), 150);

    let isSettingUp = false;
    function setupLayers() {
      if (isSettingUp) return;
      isSettingUp = true;
      try {
        const isDark = activeStyleRef.current === "dark";
        applyBasemapTuning(map, isDark);
        const typeColors = isDark ? DARK_TYPE_COLORS : LIGHT_TYPE_COLORS;

        // Register the unified SDF ship silhouette icon (directional underway chevron)
        if (!map.hasImage("ship_sdf")) {
          map.addImage("ship_sdf", createSdfShipIcon(), { sdf: true });
        }
        // Register the unified SDF anchor / radar target icon for stationary vessels
        if (!map.hasImage("anchor_sdf")) {
          map.addImage("anchor_sdf", createSdfAnchorIcon(), { sdf: true });
        }

        // 1. Authentic Sea Lanes Source & Layers (Backdrop Glow + Tactical Fairway Centerline)
        if (!map.getSource("sea_lanes")) {
          map.addSource("sea_lanes", {
            type: "geojson",
            data: "/api/routes",
          });
        }

        if (!map.getLayer("sea_lanes_glow")) {
          map.addLayer({
            id: "sea_lanes_glow",
            type: "line",
            source: "sea_lanes",
            paint: {
              "line-color": activeStyleRef.current === "dark" ? "#06B6D4" : "#0284C7",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 2.8,
                4, 4.2,
                8, 6.5,
              ],
              "line-opacity": activeStyleRef.current === "dark" ? 0.28 : 0.40,
              "line-blur": 2.5,
            },
          });
        }

        if (!map.getLayer("sea_lanes_layer")) {
          map.addLayer({
            id: "sea_lanes_layer",
            type: "line",
            source: "sea_lanes",
            paint: {
              "line-color": activeStyleRef.current === "dark" ? "#38BDF8" : "#0369A1",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 1.2,
                4, 1.8,
                8, 2.4,
              ],
              "line-opacity": activeStyleRef.current === "dark" ? 0.65 : 0.80,
              "line-dasharray": [3, 2],
            },
          });
        }

        // 1b. Observed Traffic Density Source & Heatmap Layer (Last 7 Days)
        if (!map.getSource("traffic_density")) {
          map.addSource("traffic_density", {
            type: "geojson",
            data: "/api/traffic-density",
          });
        }

        if (!map.getLayer("traffic_density_layer")) {
          map.addLayer(
            {
              id: "traffic_density_layer",
              type: "heatmap",
              source: "traffic_density",
              layout: {
                visibility: showTrafficDensity ? "visible" : "none",
              },
              paint: {
                "heatmap-weight": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 6, 1.0],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 1, 0.5, 6, 1.0],
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0, "rgba(0, 0, 0, 0)",
                  0.2, "rgba(14, 116, 144, 0.15)",
                  0.5, "rgba(6, 182, 212, 0.3)",
                  0.8, "rgba(34, 211, 238, 0.5)",
                  1.0, "rgba(34, 211, 238, 0.8)",
                ],
                "heatmap-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  1, 4,
                  4, 10,
                  8, 20,
                ],
                "heatmap-opacity": 0.2,
              },
            },
            "vessel_breadcrumbs"
          );
        }

        // 2. Selected Vessel Track & Breadcrumbs Source
        if (!map.getSource("vessel_track")) {
          map.addSource("vessel_track", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }

        if (!map.getLayer("vessel_breadcrumbs")) {
          map.addLayer({
            id: "vessel_breadcrumbs",
            type: "line",
            source: "vessel_track",
            filter: ["==", ["get", "type"], "breadcrumb"],
            minzoom: 7,
            paint: {
              "line-color": "#38BDF8",
              "line-width": 1.0,
              "line-opacity": 0.5,
            },
          });
        }

        if (!map.getLayer("vessel_estimated_route")) {
          map.addLayer({
            id: "vessel_estimated_route",
            type: "line",
            source: "vessel_track",
            filter: ["==", ["get", "type"], "route"],
            paint: {
              "line-color": "#FBBF24",
              "line-width": 1.8,
              "line-dasharray": [3, 2],
              "line-opacity": 0.6,
            },
          });
        }

        // 3. Vessel Positions Source
        if (!map.getSource("ships")) {
          map.addSource("ships", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }

        // 4. UNDERNEATH: Vessel Heatmap Layer
        if (!map.getLayer("vessels_heatmap")) {
          map.addLayer({
            id: "vessels_heatmap",
            type: "heatmap",
            source: "ships",
            maxzoom: 6,
            paint: {
              "heatmap-weight": 1,
              "heatmap-intensity": 0.85,
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 7,
                4, 14,
                6, 20,
              ],
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0, "rgba(0, 0, 0, 0)",
                0.2, "#0b3a5c",
                0.5, "#0ea5e9",
                0.8, "#22d3ee",
                1.0, "#e0f2fe",
              ],
              "heatmap-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 0.85,
                5, 0.7,
                6, 0,
              ],
            },
          });
        }

        // 4b. High-Precision Pointer Hit-Box for instant vessel selection at any zoom level
        if (!map.getLayer("vessels_hitbox")) {
          map.addLayer({
            id: "vessels_hitbox",
            type: "circle",
            source: "ships",
            minzoom: 1.0,
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 14,
                4, 16,
                8, 20,
                12, 24,
              ],
              "circle-color": "#ffffff",
              "circle-opacity": 0.001,
            },
          });
        }

        // 5. UNDERNEATH BLOOM / SOFT GLOW LAYER beneath the directional ship arrows
        if (!map.getLayer("vessels_dot")) {
          map.addLayer({
            id: "vessels_dot",
            type: "circle",
            source: "ships",
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 2.0,
                3, 2.8,
                6, 3.6,
                7, 4.4,
              ],
              "circle-color": typeColors,
              "circle-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 0.35,
                4, 0.45,
                7, 0.55,
              ],
              "circle-blur": 0.8,
              "circle-stroke-width": 0,
            },
          });
        }

        // 6. SHIPS SYMBOL LAYER: Crisp Directional Ship Arrowheads AT ALL ZOOM LEVELS (Matches Global Vessel Monitor)
        if (!map.getLayer("ships")) {
          map.addLayer({
            id: "ships",
            type: "symbol",
            source: "ships",
            minzoom: 1.0, // SHOWN AT ALL ZOOMS, INCLUDING WORLD OVERVIEW!
            layout: {
              "icon-image": "ship_sdf",
              "icon-rotate": ["get", "hdg"],
              "icon-rotation-alignment": "map",
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 0.36,
                2, 0.44,
                4, 0.54,
                6, 0.68,
                9, 0.88,
                12, 1.15,
              ],
              "text-field": [
                "step",
                ["zoom"],
                "",
                10, ["get", "name"],
              ],
              "text-size": 10,
              "text-offset": [0, 1.3],
              "text-anchor": "top",
              "text-allow-overlap": false,
              "text-optional": true,
            },
            paint: {
              "icon-color": typeColors,
              "icon-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1.0, 0.92,
                3.0, 0.96,
                7.0, 1.0,
              ],
              "text-color": isDark ? "#E2E8F0" : "#0F172A",
              "text-halo-color": isDark ? "#05080C" : "#FFFFFF",
              "text-halo-width": 1.5,
              "text-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                9.8, 0,
                10.5, 0.9,
              ],
            },
          });
        }

        // 7. Strategic Maritime Chokepoints (Malacca, Suez, Panama, Hormuz, Bab-el-Mandeb, Gibraltar, Dover)
        if (!map.getSource("maritime_chokepoints")) {
          map.addSource("maritime_chokepoints", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [
                { type: "Feature", properties: { name: "Malacca Strait", tag: "TSS CHOKEPOINT" }, geometry: { type: "Point", coordinates: [103.0, 1.43] } },
                { type: "Feature", properties: { name: "Suez Canal", tag: "CANAL CHOKEPOINT" }, geometry: { type: "Point", coordinates: [32.35, 30.7] } },
                { type: "Feature", properties: { name: "Panama Canal", tag: "LOCK CHOKEPOINT" }, geometry: { type: "Point", coordinates: [-79.7, 9.1] } },
                { type: "Feature", properties: { name: "Strait of Hormuz", tag: "CRUDE CHOKEPOINT" }, geometry: { type: "Point", coordinates: [56.45, 26.6] } },
                { type: "Feature", properties: { name: "Bab-el-Mandeb", tag: "GATEWAY CHOKEPOINT" }, geometry: { type: "Point", coordinates: [43.35, 12.6] } },
                { type: "Feature", properties: { name: "Strait of Gibraltar", tag: "TRANSIT CHOKEPOINT" }, geometry: { type: "Point", coordinates: [-5.6, 35.95] } },
                { type: "Feature", properties: { name: "Dover Strait", tag: "TSS GATEWAY" }, geometry: { type: "Point", coordinates: [1.45, 51.15] } },
              ],
            },
          });
        }

        if (!map.getLayer("chokepoints_halo")) {
          map.addLayer({
            id: "chokepoints_halo",
            type: "circle",
            source: "maritime_chokepoints",
            minzoom: 2.0,
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2, 3.5,
                6, 6.0,
              ],
              "circle-color": "#38BDF8",
              "circle-opacity": 0.45,
              "circle-stroke-width": 1.0,
              "circle-stroke-color": "#E0F2FE",
            },
          });
        }

        if (!map.getLayer("chokepoints_label")) {
          map.addLayer({
            id: "chokepoints_label",
            type: "symbol",
            source: "maritime_chokepoints",
            minzoom: 3.5,
            layout: {
              "text-field": ["get", "name"],
              "text-size": 10,
              "text-font": ["literal", ["Open Sans Bold", "Arial Unicode MS Bold"]],
              "text-offset": [0, -1.2],
              "text-anchor": "bottom",
              "text-optional": true,
            },
            paint: {
              "text-color": isDark ? "#38BDF8" : "#0369A1",
              "text-halo-color": isDark ? "rgba(5, 9, 18, 0.95)" : "rgba(255, 255, 255, 0.95)",
              "text-halo-width": 1.5,
            },
          });
        }
      } catch (err) {
        console.warn("[MapLibre] setupLayers notice:", err);
      } finally {
        isSettingUp = false;
      }
    }
    setupLayersRef.current = setupLayers;

    map.on("load", () => {
      setupLayers();

      // Tooltip for vessel hover at any zoom level
      const hoverTooltip = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: "radar-hover-tooltip",
      });

      const handleVesselHover = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const feat = e.features?.[0];
        if (!feat || !feat.properties) {
          map.getCanvas().style.cursor = "";
          hoverTooltip.remove();
          return;
        }

        map.getCanvas().style.cursor = "pointer";
        const props = feat.properties;
        const name = props.name || "Unknown Vessel";
        const cat = props.category || "commercial";
        const sog = Number(props.sog || 0).toFixed(1);
        const sourceLabel = props.source === "estimated" ? "Estimated (~)" : "Live AIS";
        const catColor = SHIP_COLORS[cat]?.fill || "#94A3B8";

        const coords = (feat.geometry as any).coordinates;
        if (coords && coords.length >= 2) {
          hoverTooltip
            .setLngLat(coords as [number, number])
            .setHTML(`
              <div style="background: rgba(11, 15, 20, 0.92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 6px 10px; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.6); pointer-events: none;">
                <div style="font-weight: 600; color: ${catColor}; font-size: 12px; white-space: nowrap;">
                  ${name}
                </div>
                <div style="display: flex; gap: 6px; margin-top: 3px; font-size: 10px; color: #94A3B8; font-family: monospace; white-space: nowrap;">
                  <span style="text-transform: capitalize; color: ${catColor}; font-weight: 600;">${cat}</span>
                  <span>·</span>
                  <span>${sog} kn</span>
                  <span>·</span>
                  <span style="color: ${props.source === 'estimated' ? '#FBBF24' : '#34D399'}; font-weight: 600;">${sourceLabel}</span>
                </div>
              </div>
            `)
            .addTo(map);
        }
      };

      const handleVesselLeave = () => {
        map.getCanvas().style.cursor = "";
        hoverTooltip.remove();
      };

      const queryVesselAtPoint = (point: maplibregl.Point): LiveVessel | null => {
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [point.x - 14, point.y - 14],
          [point.x + 14, point.y + 14],
        ];
        const activeLayers = ["vessels_hitbox", "ships", "vessels_dot"].filter((id) => map.getLayer(id));
        if (activeLayers.length === 0) return null;
        const features = map.queryRenderedFeatures(bbox, { layers: activeLayers });
        if (!features || features.length === 0) return null;
        const feat = features[0];
        const id = Number(feat.properties?.id);
        if (!id) return null;
        return vesselsRef.current.find((v) => Number(v.mmsi || v.id) === id) || null;
      };

      const handleVesselClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        let feat = e.features?.[0];
        let s: LiveVessel | null = null;
        if (feat) {
          const id = Number(feat.properties?.id);
          s = vesselsRef.current.find((v) => Number(v.mmsi || v.id) === id) || null;
        }
        if (!s) {
          s = queryVesselAtPoint(e.point);
        }
        if (s) {
          if (onSelectVessel) onSelectVessel(s);
          showShipPopup(s);
          const p = deadReckonPos(s, Date.now());
          map.flyTo({ center: p, zoom: Math.max(map.getZoom(), 9), essential: true });
        }
      };

      const handleMapClick = (e: maplibregl.MapMouseEvent) => {
        const s = queryVesselAtPoint(e.point);
        if (s) {
          if (onSelectVessel) onSelectVessel(s);
          showShipPopup(s);
          const p = deadReckonPos(s, Date.now());
          map.flyTo({ center: p, zoom: Math.max(map.getZoom(), 9), essential: true });
        }
      };

      // Register click and hover listeners across map and individual vessel layers
      map.on("click", handleMapClick);

      map.on("mouseenter", "vessels_hitbox", handleVesselHover);
      map.on("mousemove", "vessels_hitbox", handleVesselHover);
      map.on("mouseleave", "vessels_hitbox", handleVesselLeave);
      map.on("click", "vessels_hitbox", handleVesselClick);

      map.on("mouseenter", "vessels_dot", handleVesselHover);
      map.on("mousemove", "vessels_dot", handleVesselHover);
      map.on("mouseleave", "vessels_dot", handleVesselLeave);
      map.on("click", "vessels_dot", handleVesselClick);

      map.on("mouseenter", "ships", handleVesselHover);
      map.on("mousemove", "ships", handleVesselHover);
      map.on("mouseleave", "ships", handleVesselLeave);
      map.on("click", "ships", handleVesselClick);

      setMapLoaded(true);

      // Throttled high-efficiency GeoJSON sync (at most 1x per second)
      const updateGeoJson = () => {
        const src = map.getSource("ships") as maplibregl.GeoJSONSource | undefined;
        if (!src) return;

        const now = Date.now();
        const curShips = vesselsRef.current;
        const currentZoom = map.getZoom();
        const bounds = currentZoom >= 5 ? map.getBounds() : null;

        const minLon = bounds ? bounds.getWest() - 0.5 : -180;
        const maxLon = bounds ? bounds.getEast() + 0.5 : 180;
        const minLat = bounds ? bounds.getSouth() - 0.5 : -85;
        const maxLat = bounds ? bounds.getNorth() + 0.5 : 85;

        const features: any[] = [];
        const seenMmsi = new Set<number>();
        let count = 0;
        // World zoom: render up to 75,000 vessels across all global shipping lanes simultaneously
        const MAX_SYMBOLS = currentZoom < 4 ? 75000 : currentZoom < 6 ? 45000 : 18000;

        for (let i = 0; i < curShips.length; i++) {
          const s = curShips[i]!;
          const mmsi = s.mmsi || s.id;
          if (!mmsi || seenMmsi.has(mmsi)) continue;
          seenMmsi.add(mmsi);

          if (!showAnchored && s.stationary) continue;
          if (!showEstimated && s.source === "estimated") continue;

          // Viewport culling at zoom >= 5
          if (bounds) {
            if (s.lon < minLon || s.lon > maxLon || s.lat < minLat || s.lat > maxLat) {
              continue;
            }
          }

          // Compute dead reckoning only for vessels in view
          const p = bounds ? deadReckonPos(s, now) : [s.lon, s.lat];
          if (isNaN(p[0]) || isNaN(p[1])) continue;

          const clampedLon = Math.max(-180, Math.min(180, p[0]));
          const clampedLat = Math.max(-85, Math.min(85, p[1]));
          const cat = s.category || getShipCategory(s);

          features.push({
            type: "Feature",
            properties: {
              id: mmsi,
              name: s.name || `VESSEL-${mmsi}`,
              category: cat,
              source: s.source || "live",
              confidence: s.confidence ?? 1.0,
              sog: s.sog || 0,
              cog: s.cog || 0,
              hdg: s.hdg ?? s.heading ?? s.cog ?? 0,
              isDemo: isDemoMode,
            },
            geometry: {
              type: "Point",
              coordinates: [clampedLon, clampedLat],
            },
          });

          count++;
          if (bounds && count >= MAX_SYMBOLS) break;
        }

        src.setData({
          type: "FeatureCollection",
          features,
        });
      };

      // Run on initial load and movement completion
      updateGeoJsonRef.current = updateGeoJson;
      updateGeoJson();
      map.on("moveend", updateGeoJson);

      // Throttled interval for real-time vessel updates (1 second)
      const dataSyncInterval = setInterval(updateGeoJson, 1000);

      // Store cleanup handler in map object
      (map as any)._cleanupCustom = () => {
        clearInterval(dataSyncInterval);
        map.off("moveend", updateGeoJson);
        hoverTooltip.remove();
      };
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (popupRef.current) popupRef.current.remove();
      if ((map as any)?._cleanupCustom) (map as any)._cleanupCustom();
      map.remove();
      mapRef.current = null;
    };
  }, [showAnchored, showEstimated]);

  // Immediate sync when vessels prop updates
  useEffect(() => {
    updateGeoJsonRef.current();
  }, [vessels]);

  // Toggle traffic density heatmap visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (map.getLayer("traffic_density_layer")) {
      map.setLayoutProperty(
        "traffic_density_layer",
        "visibility",
        showTrafficDensity ? "visible" : "none"
      );
    }
  }, [showTrafficDensity, mapLoaded]);

  // Fetch and draw real breadcrumbs & destination track for selected vessel
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const trackSrc = map.getSource("vessel_track") as maplibregl.GeoJSONSource | undefined;
    if (!trackSrc) return;

    if (!selectedVessel || !showRoutes) {
      trackSrc.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const mmsi = selectedVessel.mmsi || selectedVessel.id;
    fetch(`/api/vessels/${mmsi}/track`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const curPos = deadReckonPos(selectedVessel, Date.now());
        const features: any[] = [];

        // Historic real breadcrumbs (chronological order up to current position, max 6 points at zoom >= 7)
        if (Array.isArray(data.breadcrumbs) && data.breadcrumbs.length > 0) {
          const trimmedBreadcrumbs = data.breadcrumbs.slice(-6);
          features.push({
            type: "Feature",
            properties: { type: "breadcrumb" },
            geometry: {
              type: "LineString",
              coordinates: [...trimmedBreadcrumbs, curPos],
            },
          });
        }

        // Authentic nautical sea corridor toward destination (NEVER a straight line fallback)
        if (Array.isArray(data.routeCoordinates) && data.routeCoordinates.length > 1) {
          features.push({
            type: "Feature",
            properties: { type: "route" },
            geometry: {
              type: "LineString",
              coordinates: data.routeCoordinates,
            },
          });
        }

        trackSrc.setData({
          type: "FeatureCollection",
          features,
        });
      })
      .catch(() => {});
  }, [selectedVessel, showRoutes, mapLoaded]);

  // Update Port Markers on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    portMarkersRef.current.forEach((m) => m.remove());
    portMarkersRef.current = [];

    if (!showPortLabels) return;

    ports.forEach((p) => {
      const el = document.createElement("div");
      el.className = "cursor-pointer select-none group";

      const ci = p.congestion_index;
      let statusColor = "#34D399";
      let statusBg = "rgba(52, 211, 153, 0.18)";
      let statusGlow = "rgba(52, 211, 153, 0.25)";
      if (ci != null) {
        if (ci > 1.6) {
          statusColor = "#FF5C70";
          statusBg = "rgba(255, 92, 112, 0.18)";
          statusGlow = "rgba(255, 92, 112, 0.35)";
        } else if (ci >= 1.2) {
          statusColor = "#FBBF24";
          statusBg = "rgba(251, 191, 36, 0.18)";
          statusGlow = "rgba(251, 191, 36, 0.3)";
        }
      }

      const flag = PORT_FLAGS[p.id] || "⚓";

      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; pointer-events: auto;">
          <!-- Glassmorphism Pill -->
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 8px;
            border-radius: 9999px;
            background: rgba(11, 15, 20, 0.78);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid ${statusColor};
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6), 0 0 10px ${statusGlow};
            color: #F4F4F6;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          ">
            <span style="font-size: 11px;">${flag}</span>
            <span style="letter-spacing: -0.01em;">${p.name.split(" ")[0]}</span>
            <span style="
              padding: 1px 4px;
              border-radius: 3px;
              background: ${statusBg};
              color: ${statusColor};
              font-family: ui-monospace, monospace;
              font-size: 9px;
              font-weight: 700;
            ">CI ${ci != null ? Number(ci).toFixed(2) : "—"}</span>
          </div>

          <!-- Small leader stem pointing directly down to port coord -->
          <div style="
            width: 1px;
            height: 10px;
            background: ${statusColor};
            opacity: 0.75;
          "></div>
          <!-- Exact port anchor dot -->
          <div style="
            width: 5px;
            height: 5px;
            margin-top: -1px;
            border-radius: 50%;
            background: ${statusColor};
            box-shadow: 0 0 6px ${statusColor};
          "></div>
        </div>
      `;

      el.onclick = (e) => {
        e.stopPropagation();
        if (onSelectPort) onSelectPort(p);
        map.flyTo({ center: [p.lon, p.lat], zoom: 9.5, essential: true });
      };

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([p.lon, p.lat])
        .addTo(map);
      portMarkersRef.current.push(marker);
    });
  }, [ports, mapLoaded, onSelectPort, showPortLabels]);

  // Center / Zoom sync
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      mapRef.current.flyTo({
        center: toLngLat(center),
        zoom: zoom,
        essential: true,
      });
    }
  }, [center, zoom, mapLoaded]);

  // Honest Tooltip popup logic
  const showShipPopup = useCallback(
    (s: LiveVessel) => {
      const map = mapRef.current;
      if (!map) return;

      if (popupRef.current) popupRef.current.remove();

      const p = deadReckonPos(s, Date.now());
      const isEst = s.source === "estimated";
      const lastSeenMs = s.last_report_at || s.lastSeen || s.seen;
      const elapsedMin = lastSeenMs ? Math.max(0, Math.round((Date.now() - lastSeenMs) / 60000)) : 0;
      const confidencePercent = Math.round((s.confidence ?? 1.0) * 100);

      const popupNode = document.createElement("div");
      popupNode.style.fontFamily = "inherit";
      popupNode.style.fontSize = "12px";
      popupNode.style.lineHeight = "1.4";
      popupNode.style.padding = "4px 2px";
      popupNode.style.color = "#F4F4F6";

      popupNode.innerHTML = `
        <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #ffffff;">${s.name || "Unknown Vessel"}</div>
        <div style="margin-bottom: 6px;">
          ${
            isEst
              ? `<span style="display: inline-block; padding: 2px 7px; border-radius: 999px; background: rgba(251, 191, 36, 0.15); color: #FBBF24; font-size: 10px; font-weight: 700; border: 1px solid rgba(251, 191, 36, 0.3);">ESTIMATED (~) · Route Dead Reckoning</span>`
              : `<span style="display: inline-block; padding: 2px 7px; border-radius: 999px; background: rgba(52, 211, 153, 0.15); color: #34D399; font-size: 10px; font-weight: 700; border: 1px solid rgba(52, 211, 153, 0.3);">LIVE AIS REPORT</span>`
          }
        </div>
        <div><span style="color: #8E8E93;">MMSI:</span> <b style="color: #ffffff;">${s.mmsi || s.id}</b></div>
        <div><span style="color: #8E8E93;">Category:</span> ${s.shipTypeLabel || "Commercial"}</div>
        <div><span style="color: #8E8E93;">Speed:</span> <b>${Number(s.sog || 0).toFixed(1)} kn</b> · <span style="color: #8E8E93;">Course:</span> ${Math.round(s.cog || 0)}°</div>
        ${s.destination ? `<div><span style="color: #8E8E93;">Destination:</span> <b style="color: #5EE7FF;">${s.destination}</b></div>` : ""}
        <div><span style="color: #8E8E93;">Last AIS report:</span> <b style="color: #ffffff;">${elapsedMin === 0 ? "Just now" : `${elapsedMin} min ago`}</b></div>
        ${isEst ? `<div><span style="color: #8E8E93;">Route Confidence:</span> <b style="color: #FBBF24;">${confidencePercent}%</b></div>` : ""}
        <button id="open-vessel-intel-popup-btn" style="margin-top: 8px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: #5EE7FF; color: #09090b; border: none; border-radius: 999px; padding: 6px 10px; font-weight: 700; font-size: 11px; cursor: pointer; transition: opacity 0.2s;">
          ✨ Inspect Vessel Intel &amp; Ask Gemini
        </button>
      `;

      const btn = popupNode.querySelector("#open-vessel-intel-popup-btn");
      if (btn) {
        btn.addEventListener("click", () => {
          if (onSelectVessel) onSelectVessel(s);
        });
      }

      popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: true, className: "apple-dark-popup" })
        .setLngLat(p)
        .setDOMContent(popupNode)
        .addTo(map);
    },
    [onSelectVessel],
  );

  useEffect(() => {
    if (selectedVessel) {
      showShipPopup(selectedVessel);
      if (mapRef.current) {
        const p = deadReckonPos(selectedVessel, Date.now());
        mapRef.current.flyTo({ center: p, zoom: Math.max(mapRef.current.getZoom(), 8.5), essential: true });
      }
    } else {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    }
  }, [selectedVessel, showShipPopup]);

  const activeSelectedPort = ports.find((p) => p.id === selectedPortId);
  const isDark = activeStyle === "dark";

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl md:rounded-3xl border transition-all ${
        isDark
          ? "border-cyan-500/30 bg-[#050608] shadow-[0_24px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(0,243,255,0.1)]"
          : "border-slate-300 bg-[#DCE8F2] shadow-[0_16px_40px_rgba(0,0,0,0.12)] text-slate-900"
      } ${
        isFullscreen ? "fixed inset-0 z-[2000] h-screen w-screen rounded-none" : className ?? "h-[78vh] min-h-[580px] w-full"
      }`}
    >
      {/* Tactical HUD Corner Brackets - Dark theme command center */}
      {isDark && (
        <>
          <div className="pointer-events-none absolute top-2 left-2 z-[6] text-cyan-400 font-mono text-xs select-none opacity-80">┌</div>
          <div className="pointer-events-none absolute top-2 right-2 z-[6] text-cyan-400 font-mono text-xs select-none opacity-80">┐</div>
          <div className="pointer-events-none absolute bottom-2 left-2 z-[6] text-cyan-400 font-mono text-xs select-none opacity-80">└</div>
          <div className="pointer-events-none absolute bottom-2 right-2 z-[6] text-cyan-400 font-mono text-xs select-none opacity-80">┘</div>
        </>
      )}

      <style>{`
        .radar-hover-tooltip .maplibregl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        .radar-hover-tooltip .maplibregl-popup-tip {
          border-top-color: rgba(11, 14, 20, 0.95) !important;
        }
      `}</style>
      {/* MapLibre GL DOM container */}
      <div className="h-full w-full" />

      {/* Deep Dark Vignette Overlay - Dark style only */}
      {isDark && (
        <div className="pointer-events-none absolute inset-0 z-[5] rounded-2xl md:rounded-3xl shadow-[inset_0_0_140px_rgba(0,0,0,0.95)]" />
      )}

      {/* Floating Status & Quick Jump Controls (Top Left) */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 max-w-[calc(100%-80px)] sm:max-w-md pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Unique MMSI Split Counter */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 font-mono text-xs rounded-xl backdrop-blur-xl transition-colors ${
              isDark
                ? "bg-[#0B0E14]/90 border border-cyan-500/30 text-white shadow-[0_8px_20px_rgba(0,0,0,0.7),0_0_15px_rgba(0,243,255,0.15)]"
                : "bg-white/95 border border-slate-300 text-slate-800 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
            }`}
            title={statusMessage || "Real-time AIS Telemetry"}
          >
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-80 ${isDark ? "bg-[#00ffc6]" : "bg-emerald-500"}`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${isDark ? "bg-[#00ffc6]" : "bg-emerald-500"}`} />
            </span>
            <span className={`font-semibold text-[11px] tabular-nums ${isDark ? "text-white" : "text-slate-800"}`}>
              {liveCount.toLocaleString()} <span className={isDark ? "text-cyan-300" : "text-cyan-700 font-bold"}>live</span> · {estimatedCount.toLocaleString()} <span className={isDark ? "text-amber-300" : "text-amber-700 font-bold"}>estimated</span>
            </span>
            <span className={isDark ? "text-cyan-500/40" : "text-slate-300"}>|</span>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-cyan-400" : "text-cyan-700"}`}>
              AIS-NET
            </span>
          </div>

          {/* Demo Mode Badge */}
          {isDemoMode && (
            <span className="px-2.5 py-1 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/40 bg-amber-500/20 rounded-xl shadow-sm">
              DEMO DATA
            </span>
          )}
        </div>

        {/* Port Quick-Jump Pills */}
        <div className="hidden sm:flex flex-wrap items-center gap-1.5 pointer-events-auto pt-0.5">
          {ports.map((p) => {
            const isSelected = selectedPortId === p.id;
            const flag = PORT_FLAGS[p.id] || "⚓";
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (onSelectPort) onSelectPort(p);
                  mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 9.5, essential: true });
                }}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-lg flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xl ${
                  isSelected
                    ? isDark
                      ? "bg-cyan-500/25 border border-cyan-500/60 text-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.3)] font-semibold"
                      : "bg-cyan-600/20 border border-cyan-600/50 text-cyan-800 font-bold shadow-sm"
                    : isDark
                    ? "bg-[#0B0E14]/85 border border-white/10 text-slate-300 hover:text-white hover:border-cyan-500/30 hover:bg-cyan-500/10"
                    : "bg-white/90 border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <span>{flag}</span>
                <span>{p.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Map Controls Toolbar (Top Right) */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {/* Style Selector Pill */}
        <div className={`flex items-center gap-1 p-1 rounded-xl shadow-lg backdrop-blur-xl ${
          isDark
            ? "bg-[#0B0E14]/90 border border-cyan-500/25"
            : "bg-white/95 border border-slate-300 shadow-md"
        }`}>
          {(["dark", "vibrant", "clean"] as const).map((styleKey) => (
            <button
              key={styleKey}
              type="button"
              onClick={() => switchStyle(styleKey)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                activeStyle === styleKey
                  ? isDark
                    ? "bg-cyan-500/20 border border-cyan-500/50 text-[#00f3ff] shadow-sm font-semibold"
                    : "bg-cyan-600/15 border border-cyan-600/40 text-cyan-800 shadow-sm font-bold"
                  : isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {styleKey}
            </button>
          ))}
        </div>

        {/* Action Controls Pill */}
        <div className={`flex items-center p-1 rounded-xl shadow-lg backdrop-blur-xl ${
          isDark
            ? "bg-[#0B0E14]/90 border border-cyan-500/25"
            : "bg-white/95 border border-slate-300 shadow-md"
        }`}>
          <button
            type="button"
            onClick={zoomIn}
            title="Zoom In"
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
              isDark ? "text-slate-300 hover:text-[#00f3ff] hover:bg-cyan-500/15" : "text-slate-600 hover:text-cyan-700 hover:bg-slate-100"
            }`}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            title="Zoom Out"
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
              isDark ? "text-slate-300 hover:text-[#00f3ff] hover:bg-cyan-500/15" : "text-slate-600 hover:text-cyan-700 hover:bg-slate-100"
            }`}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <div className={`mx-1 h-3.5 w-px ${isDark ? "bg-cyan-500/20" : "bg-slate-300"}`} />
          <button
            type="button"
            onClick={resetView}
            title="Fit to World / Reset View"
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
              isDark ? "text-slate-300 hover:text-[#00f3ff] hover:bg-cyan-500/15" : "text-slate-600 hover:text-cyan-700 hover:bg-slate-100"
            }`}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowRoutes(!showRoutes)}
            title={showRoutes ? "Hide Sea Corridors" : "Show Sea Corridors"}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
              showRoutes
                ? isDark
                  ? "bg-cyan-500/25 text-[#00f3ff] border border-cyan-500/40"
                  : "bg-cyan-600/20 text-cyan-800 border border-cyan-600/40 font-bold"
                : isDark
                ? "text-slate-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Navigation className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowTrafficDensity(!showTrafficDensity)}
            title={showTrafficDensity ? "Hide 7-Day Observed Traffic Density" : "Show 7-Day Observed Traffic Density"}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
              showTrafficDensity
                ? isDark
                  ? "text-[#00f3ff] bg-cyan-500/20 shadow-[0_0_8px_rgba(0,243,255,0.3)]"
                  : "text-cyan-800 bg-cyan-600/20 font-bold"
                : isDark
                ? "text-slate-300 hover:text-white hover:bg-white/10"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowEstimated(!showEstimated)}
            title={showEstimated ? "Hide Estimated Open-Ocean Positions" : "Show Estimated Open-Ocean Positions"}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer font-bold text-xs ${
              showEstimated
                ? "text-amber-500 bg-amber-500/20"
                : isDark
                ? "text-slate-300 hover:text-white hover:bg-white/10"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ~
          </button>
          <button
            type="button"
            onClick={() => setShowPortLabels(!showPortLabels)}
            title={showPortLabels ? "Hide Port Hub Labels" : "Show Port Hub Labels"}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
              showPortLabels
                ? isDark
                  ? "text-[#00f3ff] bg-cyan-500/20 shadow-[0_0_8px_rgba(0,243,255,0.3)]"
                  : "text-cyan-800 bg-cyan-600/20 font-bold"
                : isDark
                ? "text-slate-300 hover:text-white hover:bg-white/10"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Anchor className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowAnchored(!showAnchored)}
            title={showAnchored ? "Hide Anchored Vessels" : "Show Anchored Vessels"}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
              showAnchored
                ? isDark
                  ? "text-[#00f3ff] bg-cyan-500/20 shadow-[0_0_8px_rgba(0,243,255,0.3)]"
                  : "text-cyan-800 bg-cyan-600/20 font-bold"
                : isDark
                ? "text-slate-300 hover:text-white hover:bg-white/10"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Ship className="h-3 w-3" />
          </button>
          <div className={`mx-1 h-3.5 w-px ${isDark ? "bg-cyan-500/20" : "bg-slate-300"}`} />
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer ${
              isDark ? "text-slate-300 hover:text-[#00f3ff] hover:bg-cyan-500/15" : "text-slate-600 hover:text-cyan-700 hover:bg-slate-100"
            }`}
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Floating Bottom Legend Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className={`flex flex-wrap items-center gap-3 px-4 py-2 text-xs rounded-xl pointer-events-auto shadow-2xl backdrop-blur-xl ${
          isDark
            ? "bg-[#0B0E14]/90 border border-cyan-500/25"
            : "bg-white/95 border border-slate-300 shadow-lg text-slate-800"
        }`}>
          <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${isDark ? "text-cyan-400" : "text-cyan-800"}`}>
            RADAR LAYERS:
          </span>
          <span className={`flex items-center gap-1.5 text-[11px] font-mono ${isDark ? "text-slate-300" : "text-slate-700"}`}>
            <span className="h-2 w-2 rounded-full bg-[#00ffc6] shadow-[0_0_8px_#00ffc6]" /> Live (Coastal AIS)
          </span>
          <span className={`flex items-center gap-1.5 text-[11px] font-mono ${isDark ? "text-slate-300" : "text-slate-700"}`}>
            <span className="h-2 w-2 rounded-full border border-amber-400 bg-transparent" /> Estimated (Ocean ~)
          </span>
          {showTrafficDensity && (
            <>
              <span className="text-cyan-500/30">|</span>
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#00f3ff] font-medium">
                <span className="h-2 w-2 rounded-full bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]" /> Traffic Density <span className="text-[10px] text-slate-400">(7-Day)</span>
              </span>
            </>
          )}
          <span className="text-cyan-500/30">|</span>
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
            <span className="h-2 w-2 rounded-full bg-[#00f3ff] shadow-[0_0_6px_#00f3ff]" /> Cargo
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
            <span className="h-2 w-2 rounded-full bg-[#fb923c] shadow-[0_0_6px_#fb923c]" /> Tanker
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
            <span className="h-2 w-2 rounded-full bg-[#a78bfa] shadow-[0_0_6px_#a78bfa]" /> Passenger
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
            <span className="h-2 w-2 rounded-full bg-[#facc15] shadow-[0_0_6px_#facc15]" /> Tug / Special
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#64748b]" /> Anchored
          </span>
        </div>

        {/* Small Tactical Note */}
        <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 text-[10px] font-mono text-slate-400 rounded-xl bg-[#0B0E14]/90 border border-cyan-500/20 pointer-events-auto backdrop-blur-xl">
          <span className="text-[#00ffc6]">●</span>
          <span>WGS-84 Geodetic Radar · 25km Tactical Chokepoint Grid</span>
        </div>
      </div>

      {/* Slide-In Glass Panel on Port Selection */}
      {activeSelectedPort && (
        <div className="absolute right-4 top-16 bottom-16 z-20 w-80 md:w-92 rounded-2xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(0,243,255,0.2)] flex flex-col justify-between animate-in fade-in slide-in-from-right duration-300 pointer-events-auto border border-cyan-500/40 bg-[#07090E]/95 backdrop-blur-2xl">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30">{PORT_FLAGS[activeSelectedPort.id] || "⚓"}</span>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 block font-semibold">
                    TACTICAL PORT NODE
                  </span>
                  <h3 className="font-bold text-xl text-white leading-tight font-sans mt-0.5">
                    {activeSelectedPort.name}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {activeSelectedPort.lat.toFixed(3)}°N, {activeSelectedPort.lon.toFixed(3)}°E
                  </p>
                </div>
              </div>
              <button
                onClick={() => onClosePort && onClosePort()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-cyan-500/15 border border-transparent hover:border-cyan-500/30 transition cursor-pointer"
                title="Close port details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Congestion Gauge Details */}
            <div className="mt-6 rounded-xl border border-cyan-500/25 bg-[#0B0E14]/90 p-4 text-center relative overflow-hidden shadow-inner">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00f3ff] to-transparent opacity-60" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                CONGESTION INDEX (CI)
              </span>
              <div className="mt-2 text-4xl font-bold tabular-nums text-white tracking-tight font-mono">
                {activeSelectedPort.congestion_index != null
                  ? activeSelectedPort.congestion_index.toFixed(2)
                  : "1.00"}
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-mono font-semibold ${
                    (activeSelectedPort.congestion_index ?? 0) > 1.2
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/40 shadow-[0_0_10px_rgba(255,59,92,0.2)]"
                      : (activeSelectedPort.congestion_index ?? 0) > 1.0
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                      : "bg-[#00ffc6]/15 text-[#00ffc6] border border-[#00ffc6]/40 shadow-[0_0_10px_rgba(0,255,198,0.2)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                      (activeSelectedPort.congestion_index ?? 0) > 1.2
                        ? "bg-rose-400"
                        : (activeSelectedPort.congestion_index ?? 0) > 1.0
                        ? "bg-amber-300"
                        : "bg-[#00ffc6]"
                    }`}
                  />
                  {(activeSelectedPort.congestion_index ?? 0) > 1.2
                    ? "Congested Corridor Queue"
                    : (activeSelectedPort.congestion_index ?? 0) > 1.0
                    ? "Moderate Watch Rate"
                    : "Optimal Corridor Flow"}
                </span>
              </div>
              <p className="mt-3 text-[11px] font-mono text-slate-400 leading-relaxed border-t border-white/5 pt-2">
                25km tactical radii anchorage and approach sector.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-cyan-500/20 flex items-center gap-2">
            <Link
              to="/ports/$id"
              params={{ id: activeSelectedPort.id }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00f3ff] to-[#0284c7] px-4 py-2.5 text-xs font-mono font-bold text-black hover:opacity-95 transition shadow-[0_0_20px_rgba(0,243,255,0.4)] cursor-pointer tracking-wider"
            >
              <span>ACCESS RADAR DOSSIER</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
