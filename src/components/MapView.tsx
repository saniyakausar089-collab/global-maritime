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

const SHIP_COLORS: Record<string, { fill: string; label: string }> = {
  cargo: { fill: "#5EE7FF", label: "Cargo (Container/Bulk)" },
  tanker: { fill: "#FFB547", label: "Tanker (Oil/Gas)" },
  passenger: { fill: "#A78BFA", label: "Passenger / Cruise" },
  tug: { fill: "#FBBF24", label: "Tug / Workboat" },
  fast: { fill: "#38BDF8", label: "Fast (>14 kn)" },
  fishing: { fill: "#34D399", label: "Fishing" },
  other: { fill: "#94A3B8", label: "Commercial" },
  anchored: { fill: "#64748b", label: "Anchored (<0.5 kn)" },
};

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

// Generates both solid (live) and hollow/dimmer with '~' (estimated) ship icons
function createRealisticShipIcon(type: string, color: string, isEstimated = false): ImageData {
  const c = document.createElement("canvas");
  c.width = 54;
  c.height = 54;
  const x = c.getContext("2d")!;
  const cx = 27;

  let bowY = 5;
  let sternY = 47;
  let hw = 7.5;

  if (type === "tug") {
    bowY = 12;
    sternY = 42;
    hw = 8.5;
  } else if (type === "fast") {
    bowY = 4;
    sternY = 48;
    hw = 6.2;
  } else if (type === "tanker") {
    bowY = 6;
    sternY = 48;
    hw = 8.2;
  } else if (type === "passenger") {
    bowY = 5;
    sternY = 48;
    hw = 7.2;
  }

  // Hydrodynamic wake for moving ships
  if (type !== "anchored") {
    x.strokeStyle = isEstimated ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.45)";
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(cx - hw * 0.7, sternY - 2);
    x.lineTo(cx - hw * 1.5, sternY + 6);
    x.moveTo(cx + hw * 0.7, sternY - 2);
    x.lineTo(cx + hw * 1.5, sternY + 6);
    x.stroke();
  }

  // Hull Silhouette
  x.beginPath();
  x.moveTo(cx, bowY);
  x.bezierCurveTo(cx + hw * 0.6, bowY + 3, cx + hw, bowY + 11, cx + hw, bowY + 16);
  x.lineTo(cx + hw, sternY - 4);
  x.quadraticCurveTo(cx + hw, sternY, cx + hw - 2, sternY);
  x.lineTo(cx - hw + 2, sternY);
  x.quadraticCurveTo(cx - hw, sternY, cx - hw, sternY - 4);
  x.lineTo(cx - hw, bowY + 16);
  x.bezierCurveTo(cx - hw, bowY + 11, cx - hw * 0.6, bowY + 3, cx, bowY);
  x.closePath();

  if (isEstimated) {
    // Hollow dimmer icon for estimated positions
    x.fillStyle = "rgba(20, 20, 24, 0.6)";
    x.fill();
    x.lineWidth = 2.0;
    x.strokeStyle = color;
    x.stroke();

    // Small '~' symbol indicating dead-reckoned estimation
    x.font = "bold 13px system-ui, -apple-system, sans-serif";
    x.fillStyle = color;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("~", cx, (bowY + sternY) / 2 + 1);
  } else {
    // Solid filled glowing icon for live vessels
    x.shadowColor = "rgba(0, 0, 0, 0.5)";
    x.shadowBlur = 4;
    x.fillStyle = color;
    x.fill();

    x.shadowBlur = 0;
    x.lineWidth = 1.6;
    x.strokeStyle = "#ffffff";
    x.stroke();

    // Inner Bridge
    const deckHw = hw - 2.2;
    x.fillStyle = "#ffffff";
    x.fillRect(cx - deckHw * 0.7, sternY - 14, deckHw * 1.4, 4);
  }

  return x.getImageData(0, 0, 54, 54);
}

function getShipIconKey(s: LiveVessel): string {
  if (s.stationary) return "anchored";
  if ((s.sog || 0) > 14) return "fast";
  const t = s.type || s.shipType || 0;
  if (t >= 70 && t <= 79) return "cargo";
  if (t >= 80 && t <= 89) return "tanker";
  if (t >= 60 && t <= 69) return "passenger";
  if (t >= 50 && t <= 59) return "tug";
  if (t === 30 || t === 31 || t === 32) return "fishing";
  return "other";
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

  const switchStyle = (styleKey: "dark" | "vibrant" | "clean") => {
    setActiveStyle(styleKey);
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[styleKey]);
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

    function setupLayers() {
      // Register both solid (live) and hollow (estimated) vessel icons
      Object.entries(SHIP_COLORS).forEach(([key, conf]) => {
        const liveId = `ship_${key}_live`;
        const estId = `ship_${key}_est`;

        if (!map.hasImage(liveId)) {
          map.addImage(liveId, createRealisticShipIcon(key, conf.fill, false), {
            pixelRatio: 2,
          });
        }
        if (!map.hasImage(estId)) {
          map.addImage(estId, createRealisticShipIcon(key, conf.fill, true), {
            pixelRatio: 2,
          });
        }
      });

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
            "line-color": "#5EE7FF",
            "line-width": 1.2,
            "line-opacity": 0.18,
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
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 1, 0.7, 6, 1.2],
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0, "rgba(4, 7, 13, 0)",
                0.2, "rgba(34, 211, 238, 0.1)",
                0.5, "rgba(94, 231, 255, 0.28)",
                0.8, "rgba(56, 189, 248, 0.55)",
                1.0, "rgba(94, 231, 255, 0.85)",
              ],
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1, 4,
                4, 10,
                8, 20,
              ],
              "heatmap-opacity": 0.22,
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
          paint: {
            "line-color": "#38BDF8",
            "line-width": 2.2,
            "line-opacity": 0.65,
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
            "line-width": 2.0,
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

      // Symbol layer for vessels (switches between live solid & estimated hollow)
      if (!map.getLayer("ships")) {
        map.addLayer({
          id: "ships",
          type: "symbol",
          source: "ships",
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
              1, ["*", 0.7, ["coalesce", ["get", "iconScale"], 1.0]],
              4, ["*", 0.9, ["coalesce", ["get", "iconScale"], 1.0]],
              8, ["*", 1.15, ["coalesce", ["get", "iconScale"], 1.0]],
              12, ["*", 1.45, ["coalesce", ["get", "iconScale"], 1.0]],
            ],
          },
          paint: {
            "icon-opacity": ["get", "opacity"],
          },
        });
      }
    }

    map.on("load", () => {
      setupLayers();

      map.on("click", "ships", (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const id = Number(feat.properties?.id);
        const s = vesselsRef.current.find((v) => (v.mmsi || v.id) === id);
        if (s) {
          if (onSelectVessel) onSelectVessel(s);
          showShipPopup(s);
        }
      });

      map.on("mouseenter", "ships", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "ships", () => {
        map.getCanvas().style.cursor = "";
      });

      setMapLoaded(true);

      // Animation loop with MMSI deduplication & coordinate clamping
      let last = 0;
      const frame = (ts: number) => {
        animRef.current = requestAnimationFrame(frame);
        if (ts - last < 75) return;
        last = ts;

        const now = Date.now();
        const curShips = vesselsRef.current;
        const features = [];
        const seenMmsi = new Set<number>();

        for (let i = 0; i < curShips.length; i++) {
          const s = curShips[i]!;
          const mmsi = s.mmsi || s.id;
          // MMSI deduplication
          if (!mmsi || seenMmsi.has(mmsi)) continue;
          seenMmsi.add(mmsi);

          if (!showAnchored && s.stationary) continue;
          if (!showEstimated && s.source === "estimated") continue;

          const p = deadReckonPos(s, now); // [lon, lat]
          if (isNaN(p[0]) || isNaN(p[1])) continue;

          // Clamp longitudes to [-180, 180] and latitudes to [-85, 85]
          const clampedLon = Math.max(-180, Math.min(180, p[0]));
          const clampedLat = Math.max(-85, Math.min(85, p[1]));

          const isEst = s.source === "estimated";
          const elapsedHours = s.last_report_at ? (now - s.last_report_at) / 3600000 : 0;
          const isOld = isEst && elapsedHours > 6.0;
          const iconKey = getShipIconKey(s);
          const iconImage = `ship_${iconKey}_${isEst ? "est" : "live"}`;
          const opacity = isEst ? Math.max(0.2, (s.confidence ?? 0.8) * (isOld ? 0.6 : 1.0)) : 1.0;
          const iconScale = isOld ? 0.72 : (isEst ? 0.88 : 1.0);

          features.push({
            type: "Feature" as const,
            properties: {
              id: mmsi,
              name: s.name,
              iconImage,
              sog: s.sog || 0,
              hdg: s.hdg ?? s.heading ?? s.cog ?? 0,
              source: s.source,
              opacity,
              iconScale,
            },
            geometry: {
              type: "Point" as const,
              coordinates: [clampedLon, clampedLat],
            },
          });
        }

        const src = map.getSource("ships") as maplibregl.GeoJSONSource | undefined;
        if (src) {
          src.setData({
            type: "FeatureCollection",
            features,
          });
        }
      };

      animRef.current = requestAnimationFrame(frame);
    });

    map.on("styledata", () => {
      setupLayers();
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [showAnchored, showEstimated]);

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

        // Historic real breadcrumbs (chronological order up to current position)
        if (Array.isArray(data.breadcrumbs) && data.breadcrumbs.length > 0) {
          features.push({
            type: "Feature",
            properties: { type: "breadcrumb" },
            geometry: {
              type: "LineString",
              coordinates: [...data.breadcrumbs, curPos],
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
      el.className = "cursor-pointer select-none";

      const ci = p.congestion_index;
      let statusColor = "#34D399";
      let statusBg = "rgba(52, 211, 153, 0.2)";
      if (ci != null) {
        if (ci > 1.2) {
          statusColor = "#FF5C70";
          statusBg = "rgba(255, 92, 112, 0.2)";
        } else if (ci >= 0.8) {
          statusColor = "#FBBF24";
          statusBg = "rgba(251, 191, 36, 0.2)";
        }
      }

      const flag = PORT_FLAGS[p.id] || "⚓";

      el.innerHTML = `
        <div style="transform: translate(-50%, -50%); position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 16px rgba(0,0,0,0.6); border: 1.5px solid ${statusColor}; background: #121215; color: #F4F4F6;">
          <span style="font-size: 13px;">${flag}</span>
          <span style="letter-spacing: -0.01em;">${p.name}</span>
          <span style="padding: 1px 5px; border-radius: 4px; background: ${statusBg}; color: ${statusColor}; font-family: monospace; font-size: 10px; font-weight: 700;">CI ${ci != null ? Number(ci).toFixed(2) : "—"}</span>
        </div>
      `;

      el.onclick = () => {
        if (onSelectPort) onSelectPort(p);
        map.flyTo({ center: [p.lon, p.lat], zoom: 9.5, essential: true });
      };

      const marker = new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);
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
      className={`relative overflow-hidden rounded-[20px] md:rounded-[28px] border border-white/10 bg-[#09090b] shadow-2xl transition-all ${
        isFullscreen ? "fixed inset-0 z-[2000] h-screen w-screen rounded-none" : className ?? "h-[78vh] min-h-[580px] w-full"
      }`}
    >
      {/* MapLibre GL DOM container */}
      <div className="h-full w-full" />

      {/* Deep Dark Vignette Overlay */}
      <div className="pointer-events-none absolute inset-0 z-[5] rounded-[20px] md:rounded-[28px] shadow-[inset_0_0_120px_rgba(0,0,0,0.92)]" />

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
        <div className="glass-pill flex items-center p-1 shadow-lg">
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
          <div className="mx-1 h-3.5 w-px bg-white/10" />
          <button
            type="button"
            onClick={resetView}
            title="Fit to World / Reset View"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-white/10 transition cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowRoutes(!showRoutes)}
            title={showRoutes ? "Hide Sea Corridors" : "Show Sea Corridors"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer ${
              showRoutes ? "text-accent bg-accent/15" : "text-ink-2 hover:text-ink hover:bg-white/10"
            }`}
          >
            <Navigation className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowTrafficDensity(!showTrafficDensity)}
            title={showTrafficDensity ? "Hide 7-Day Observed Traffic Density" : "Show 7-Day Observed Traffic Density"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer ${
              showTrafficDensity ? "text-accent bg-accent/15" : "text-ink-2 hover:text-ink hover:bg-white/10"
            }`}
          >
            <Activity className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowEstimated(!showEstimated)}
            title={showEstimated ? "Hide Estimated Open-Ocean Positions" : "Show Estimated Open-Ocean Positions"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer font-bold text-xs ${
              showEstimated ? "text-amber-400 bg-amber-400/15" : "text-ink-2 hover:text-ink hover:bg-white/10"
            }`}
          >
            ~
          </button>
          <button
            type="button"
            onClick={() => setShowPortLabels(!showPortLabels)}
            title={showPortLabels ? "Hide Port Hub Labels" : "Show Port Hub Labels"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer ${
              showPortLabels ? "text-accent bg-accent/15" : "text-ink-2 hover:text-ink hover:bg-white/10"
            }`}
          >
            <Anchor className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowAnchored(!showAnchored)}
            title={showAnchored ? "Hide Anchored Vessels" : "Show Anchored Vessels"}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition cursor-pointer ${
              showAnchored ? "text-accent bg-accent/15" : "text-ink-2 hover:text-ink hover:bg-white/10"
            }`}
          >
            <Ship className="h-3 w-3" />
          </button>
          <div className="mx-1 h-3.5 w-px bg-white/10" />
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-white/10 transition cursor-pointer"
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
            <span className="h-2 w-2 rounded-full bg-[#5EE7FF]" /> Cargo
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#FFB547]" /> Tanker
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#A78BFA]" /> Passenger
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-[#FBBF24]" /> Tug
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
