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

// Premium Neon / Radar Vessel Colors
const SHIP_COLORS: Record<string, { fill: string; label: string }> = {
  cargo: { fill: "#22D3EE", label: "Cargo (Container/Bulk)" },
  tanker: { fill: "#FB923C", label: "Tanker (Oil/Gas)" },
  passenger: { fill: "#A78BFA", label: "Passenger / Cruise" },
  tug: { fill: "#FACC15", label: "Tug / Workboat" },
  fast: { fill: "#38BDF8", label: "Fast (>14 kn)" },
  fishing: { fill: "#34D399", label: "Fishing" },
  other: { fill: "#64748B", label: "Special Craft" },
  unknown: { fill: "#94A3B8", label: "Unknown / Commercial" },
  anchored: { fill: "#64748B", label: "Anchored (<0.5 kn)" },
};

// MapLibre expression for type colors across all zoom layers
const TYPE_COLOR_EXPRESSION: any = [
  "match",
  ["get", "category"],
  "cargo", "#22D3EE",
  "tanker", "#FB923C",
  "passenger", "#A78BFA",
  "tug", "#FACC15",
  "fishing", "#34D399",
  "fast", "#38BDF8",
  "anchored", "#64748B",
  "other", "#64748B",
  "#94A3B8", // Unknown / default
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

// Generates a crisp, streamlined SDF arrow/hull silhouette for GPU-colored symbol rendering
function createSdfShipIcon(): ImageData {
  const size = 32;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const x = c.getContext("2d")!;
  const cx = size / 2; // 16

  // Pure white opaque mask for SDF recoloring in MapLibre shaders
  x.fillStyle = "#ffffff";
  x.beginPath();
  x.moveTo(cx, 3);
  x.bezierCurveTo(cx + 5.5, 7.5, cx + 7.5, 17, cx + 7.5, 25);
  x.quadraticCurveTo(cx + 7.5, 29, cx + 5, 29);
  x.lineTo(cx - 5, 29);
  x.quadraticCurveTo(cx - 7.5, 29, cx - 7.5, 25);
  x.bezierCurveTo(cx - 7.5, 17, cx - 5.5, 7.5, cx, 3);
  x.closePath();
  x.fill();

  return x.getImageData(0, 0, size, size);
}

function getShipCategory(s: LiveVessel): string {
  if (s.stationary) return "anchored";
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

// Tuned basemap: Darken land (#0b0f14) & water (#05080c), reduce label opacity
function applyBasemapTuning(map: maplibregl.Map) {
  try {
    const style = map.getStyle();
    if (!style || !style.layers) return;

    for (const layer of style.layers) {
      // Water
      if (layer.id.includes("water") || layer.id.includes("ocean") || layer.id === "waterway") {
        if (layer.type === "fill") {
          try { map.setPaintProperty(layer.id, "fill-color", "#05080c"); } catch {}
        } else if (layer.type === "background") {
          try { map.setPaintProperty(layer.id, "background-color", "#05080c"); } catch {}
        }
      }
      // Land
      if (
        layer.id.includes("land") ||
        layer.id.includes("background") ||
        layer.id.includes("earth") ||
        layer.id.includes("sand")
      ) {
        if (layer.type === "fill") {
          try { map.setPaintProperty(layer.id, "fill-color", "#0b0f14"); } catch {}
        } else if (layer.type === "background") {
          try { map.setPaintProperty(layer.id, "background-color", "#0b0f14"); } catch {}
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
          map.setPaintProperty(layer.id, "text-opacity", [
            "interpolate",
            ["linear"],
            ["zoom"],
            1, 0,
            2.9, 0,
            3.5, 0.2,
            5, 0.35,
            8, 0.55,
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
    if (styleKey === activeStyleRef.current) return;
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
        // Only darken basemap in 'dark' mode. In 'vibrant' and 'clean', keep natural daylight colors!
        if (activeStyleRef.current === "dark") {
          applyBasemapTuning(map);
        }

        // Register the unified SDF ship silhouette icon (one sprite recolors dynamically via GPU)
        if (!map.hasImage("ship_sdf")) {
          map.addImage("ship_sdf", createSdfShipIcon(), { sdf: true });
        }

        // 1. Authentic Sea Lanes Source & Layers
        if (!map.getSource("sea_lanes")) {
          map.addSource("sea_lanes", {
            type: "geojson",
            data: "/api/routes",
          });
        }

        if (!map.getLayer("sea_lanes_layer")) {
          map.addLayer({
            id: "sea_lanes_layer",
            type: "line",
            source: "sea_lanes",
            paint: {
              "line-color": activeStyleRef.current === "dark" ? "#22D3EE" : "#0284C7",
              "line-width": 1.0,
              "line-opacity": activeStyleRef.current === "dark" ? 0.15 : 0.35,
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

        // 5. SMALL CIRCLE DOTS: clear at all zooms; radius grows with zoom
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
                1, 1.8,
                3, 2.4,
                6, 3.2,
                7, 3.8,
              ],
              "circle-color": TYPE_COLOR_EXPRESSION,
              "circle-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 0.95,
                6.8, 0.95,
                7.5, 0,
              ],
              "circle-stroke-width": 0.5,
              "circle-stroke-color": activeStyleRef.current === "dark" ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.8)",
            },
          });
        }

        // 6. SHIPS SYMBOL LAYER: Ship icons (SDF, icon-color by type) only at zoom >= 7
        if (!map.getLayer("ships")) {
          map.addLayer({
            id: "ships",
            type: "symbol",
            source: "ships",
            minzoom: 7.0,
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
                7, 0.45,
                9, 0.6,
                12, 0.75,
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
              "icon-color": TYPE_COLOR_EXPRESSION,
              "icon-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                7.0, 0.85,
                7.5, 1.0,
              ],
              "text-color": activeStyleRef.current === "dark" ? "#E2E8F0" : "#0F172A",
              "text-halo-color": activeStyleRef.current === "dark" ? "#05080C" : "#FFFFFF",
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

      const handleVesselClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const id = Number(feat.properties?.id);
        const s = vesselsRef.current.find((v) => (v.mmsi || v.id) === id);
        if (s) {
          if (onSelectVessel) onSelectVessel(s);
          showShipPopup(s);
        }
      };

      // Register interactions on both dot and symbol layers
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
        // No cap at world zoom so heatmap shows all vessels globally
        const MAX_SYMBOLS = currentZoom < 4 ? 25000 : currentZoom < 6 ? 15000 : 6000;

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
        mapRef.current.flyTo({ center: p, zoom: 10, essential: true });
      }
    }
  }, [selectedVessel, showShipPopup]);

  const activeSelectedPort = ports.find((p) => p.id === selectedPortId);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-[20px] md:rounded-[28px] border border-white/10 bg-[#05080c] shadow-2xl transition-all ${
        isFullscreen ? "fixed inset-0 z-[2000] h-screen w-screen rounded-none" : className ?? "h-[78vh] min-h-[580px] w-full"
      }`}
    >
      <style>{`
        .radar-hover-tooltip .maplibregl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        .radar-hover-tooltip .maplibregl-popup-tip {
          border-top-color: rgba(11, 15, 20, 0.92) !important;
        }
      `}</style>
      {/* MapLibre GL DOM container */}
      <div className="h-full w-full" />

      {/* Deep Dark Vignette Overlay - Dark style only */}
      {activeStyle === "dark" && (
        <div className="pointer-events-none absolute inset-0 z-[5] rounded-[20px] md:rounded-[28px] shadow-[inset_0_0_120px_rgba(0,0,0,0.92)]" />
      )}

      {/* Floating Status & Quick Jump Controls (Top Left) */}
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 max-w-[calc(100%-80px)] sm:max-w-md pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Unique MMSI Split Counter */}
          <div
            className="glass-pill flex items-center gap-2 px-3 py-1.5 font-mono text-xs shadow-lg"
            title={statusMessage || "Real-time AIS Telemetry"}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-[#34D399]" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34D399]" />
            </span>
            <span className="font-semibold text-ink text-[11px] tabular-nums">
              {liveCount.toLocaleString()} live · {estimatedCount.toLocaleString()} estimated
            </span>
            <span className="text-white/20">|</span>
            <span className="text-ink-2 text-[10px] uppercase tracking-wider font-semibold">
              UNIQUE FLEET
            </span>
          </div>

          {/* Demo Mode Badge */}
          {isDemoMode && (
            <span className="glass-pill px-2.5 py-1 text-[10px] font-mono font-bold text-amber-300 border-amber-500/40 bg-amber-500/20">
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
                className={`glass-pill px-2.5 py-1 text-[11px] font-sans flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? "bg-accent/20 border-accent/60 text-ink shadow-[0_0_12px_rgba(94,231,255,0.25)]"
                    : "text-ink-2 hover:text-ink hover:border-white/20"
                }`}
              >
                <span>{flag}</span>
                <span className="font-medium">{p.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Map Controls Toolbar (Top Right) */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {/* Style Selector Pill */}
        <div className="glass-pill flex items-center gap-1 p-1 shadow-lg">
          {(["dark", "vibrant", "clean"] as const).map((styleKey) => (
            <button
              key={styleKey}
              type="button"
              onClick={() => switchStyle(styleKey)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-all cursor-pointer ${
                activeStyle === styleKey
                  ? "bg-white/15 text-ink shadow-xs"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {styleKey}
            </button>
          ))}
        </div>

        {/* Action Controls Pill */}
        <div className="glass-pill flex items-center p-1 shadow-lg bg-black/40 border border-white/15">
          <button
            type="button"
            onClick={zoomIn}
            title="Zoom In"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            title="Zoom Out"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <div className="mx-1 h-3.5 w-px bg-white/15" />
          <button
            type="button"
            onClick={resetView}
            title="Fit to World / Reset View"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowRoutes(!showRoutes)}
            title={showRoutes ? "Hide Sea Corridors" : "Show Sea Corridors"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer ${
              showRoutes ? "text-accent bg-accent/20" : "text-slate-300 hover:text-white hover:bg-white/15"
            }`}
          >
            <Navigation className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowTrafficDensity(!showTrafficDensity)}
            title={showTrafficDensity ? "Hide 7-Day Observed Traffic Density" : "Show 7-Day Observed Traffic Density"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer ${
              showTrafficDensity ? "text-accent bg-accent/20" : "text-slate-300 hover:text-white hover:bg-white/15"
            }`}
          >
            <Activity className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowEstimated(!showEstimated)}
            title={showEstimated ? "Hide Estimated Open-Ocean Positions" : "Show Estimated Open-Ocean Positions"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer font-bold text-xs ${
              showEstimated ? "text-amber-400 bg-amber-400/20" : "text-slate-300 hover:text-white hover:bg-white/15"
            }`}
          >
            ~
          </button>
          <button
            type="button"
            onClick={() => setShowPortLabels(!showPortLabels)}
            title={showPortLabels ? "Hide Port Hub Labels" : "Show Port Hub Labels"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer ${
              showPortLabels ? "text-accent bg-accent/20" : "text-slate-300 hover:text-white hover:bg-white/15"
            }`}
          >
            <Anchor className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowAnchored(!showAnchored)}
            title={showAnchored ? "Hide Anchored Vessels" : "Show Anchored Vessels"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer ${
              showAnchored ? "text-accent bg-accent/20" : "text-slate-300 hover:text-white hover:bg-white/15"
            }`}
          >
            <Ship className="h-3 w-3" />
          </button>
          <div className="mx-1 h-3.5 w-px bg-white/15" />
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Floating Bottom Legend Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="glass-pill flex flex-wrap items-center gap-3 px-3.5 py-1.5 text-xs pointer-events-auto shadow-lg">
          <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
            Layer:
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#34D399]" /> Live (Coastal AIS)
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full border border-[#FBBF24] bg-transparent" /> Estimated (Open-Ocean ~)
          </span>
          {showTrafficDensity && (
            <>
              <span className="text-white/15">|</span>
              <span className="flex items-center gap-1.5 text-[11px] text-accent font-medium">
                <span className="h-2 w-2 rounded-full bg-[#5EE7FF] shadow-[0_0_6px_#5EE7FF]" /> Observed Traffic Density <span className="text-[10px] text-ink-3">(7-day history)</span>
              </span>
            </>
          )}
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#22D3EE] shadow-[0_0_6px_#22D3EE]" /> Cargo
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#FB923C] shadow-[0_0_6px_#FB923C]" /> Tanker
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#A78BFA] shadow-[0_0_6px_#A78BFA]" /> Passenger
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#FACC15] shadow-[0_0_6px_#FACC15]" /> Tug / Special
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#94A3B8]" /> Unknown
          </span>
        </div>

        {/* Small Honest Note */}
        <div className="hidden lg:flex glass-pill px-3 py-1 text-[10px] font-mono text-ink-3 pointer-events-auto">
          Free AIS covers coastal areas; open-ocean positions are estimated from last report and route.
        </div>
      </div>

      {/* Slide-In Glass Panel on Port Selection */}
      {activeSelectedPort && (
        <div className="absolute right-4 top-16 bottom-16 z-20 w-80 md:w-88 glass-panel rounded-[20px] p-5 shadow-2xl flex flex-col justify-between animate-in fade-in slide-in-from-right duration-300 pointer-events-auto border-accent/30">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{PORT_FLAGS[activeSelectedPort.id] || "⚓"}</span>
                <div>
                  <h3 className="font-semibold text-lg text-ink leading-tight">
                    {activeSelectedPort.name}
                  </h3>
                  <p className="text-[11px] font-mono text-ink-3 mt-0.5">
                    {activeSelectedPort.lat.toFixed(2)}°N, {activeSelectedPort.lon.toFixed(2)}°E
                  </p>
                </div>
              </div>
              <button
                onClick={() => onClosePort && onClosePort()}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:text-ink hover:bg-white/10 transition cursor-pointer"
                title="Close port details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Congestion Gauge Details */}
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ink-3 block">
                Congestion Index (CI)
              </span>
              <div className="mt-2 text-4xl font-semibold tabular-nums text-ink tracking-tight">
                {activeSelectedPort.congestion_index != null
                  ? activeSelectedPort.congestion_index.toFixed(2)
                  : "1.00"}
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    (activeSelectedPort.congestion_index ?? 0) > 1.2
                      ? "bg-[#FF5C70]/12 text-[#FF5C70] border border-[#FF5C70]/30"
                      : (activeSelectedPort.congestion_index ?? 0) > 1.0
                      ? "bg-[#FBBF24]/12 text-[#FBBF24] border border-[#FBBF24]/30"
                      : "bg-[#34D399]/12 text-[#34D399] border border-[#34D399]/30"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      (activeSelectedPort.congestion_index ?? 0) > 1.2
                        ? "bg-[#FF5C70]"
                        : (activeSelectedPort.congestion_index ?? 0) > 1.0
                        ? "bg-[#FBBF24]"
                        : "bg-[#34D399]"
                    }`}
                  />
                  {(activeSelectedPort.congestion_index ?? 0) > 1.2
                    ? "Congested Corridor"
                    : (activeSelectedPort.congestion_index ?? 0) > 1.0
                    ? "Moderate Watch"
                    : "Optimal Flow"}
                </span>
              </div>
              <p className="mt-3 text-[11px] text-ink-2 leading-relaxed">
                Evaluated within standard 25km tactical approach radius.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center gap-2">
            <Link
              to="/ports/$id"
              params={{ id: activeSelectedPort.id }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-black hover:bg-accent/90 transition shadow-[0_0_16px_rgba(94,231,255,0.3)] cursor-pointer"
            >
              <span>Deep dive</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
