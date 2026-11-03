import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
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
  selectedVessel?: LiveVessel | null;
  onSelectVessel?: (vessel: LiveVessel | null) => void;
  onSelectPort?: (port: Port) => void;
  className?: string;
};

const SHIP_COLORS: Record<string, { fill: string; label: string }> = {
  cargo: { fill: "#10b981", label: "Cargo (Container/Bulk)" },
  tanker: { fill: "#f59e0b", label: "Tanker (Oil/Gas)" },
  passenger: { fill: "#ec4899", label: "Passenger / Cruise" },
  tug: { fill: "#06b6d4", label: "Tug / Workboat" },
  fast: { fill: "#8b5cf6", label: "Fast (>14 kn)" },
  fishing: { fill: "#eab308", label: "Fishing" },
  other: { fill: "#3b82f6", label: "Commercial" },
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
  vibrant: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
  clean: "https://tiles.openfreemap.org/styles/positron",
};

function createRealisticShipIcon(type: string, color: string): ImageData {
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

  // Hydrodynamic stern wake
  if (type !== "anchored") {
    x.strokeStyle = "rgba(255, 255, 255, 0.45)";
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(cx - hw * 0.7, sternY - 2);
    x.lineTo(cx - hw * 1.5, sternY + 6);
    x.moveTo(cx + hw * 0.7, sternY - 2);
    x.lineTo(cx + hw * 1.5, sternY + 6);
    x.stroke();
  }

  // Realistic Hull Silhouette
  x.shadowColor = "rgba(0, 0, 0, 0.45)";
  x.shadowBlur = 4;
  x.shadowOffsetY = 1;

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

  x.fillStyle = color;
  x.fill();

  x.shadowBlur = 0;
  x.shadowOffsetY = 0;
  x.lineWidth = 1.8;
  x.strokeStyle = "#ffffff";
  x.stroke();

  // Inner Main Deck
  const deckHw = hw - 2.2;
  const deckBowY = bowY + 6;
  const deckSternY = sternY - 3;

  x.beginPath();
  x.moveTo(cx, deckBowY);
  x.lineTo(cx + deckHw, deckBowY + 10);
  x.lineTo(cx + deckHw, deckSternY);
  x.lineTo(cx - deckHw, deckSternY);
  x.lineTo(cx - deckHw, deckBowY + 10);
  x.closePath();
  x.fillStyle = "rgba(15, 23, 42, 0.35)";
  x.fill();

  // Superstructure bridge
  x.fillStyle = "#ffffff";
  x.fillRect(cx - deckHw * 0.7, sternY - 14, deckHw * 1.4, 5);

  return x.getImageData(0, 0, 54, 54);
}

function getShipIconKey(s: LiveVessel): string {
  if (s.sog < 0.5) return "anchored";
  if (s.sog > 14) return "fast";
  const t = Number(s.type || s.shipType || 0);
  if (t >= 70 && t <= 79) return "cargo";
  if (t >= 80 && t <= 89) return "tanker";
  if (t >= 60 && t <= 69) return "passenger";
  if (t >= 50 && t <= 59) return "tug";
  if (t === 30) return "fishing";
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
  selectedVessel,
  onSelectVessel,
  onSelectPort,
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
  const [activeStyle, setActiveStyle] = useState<"vibrant" | "dark" | "clean">("vibrant");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Map Controls State
  const [showRoutes, setShowRoutes] = useState(true);
  const [showPortLabels, setShowPortLabels] = useState(true);
  const [showAnchored, setShowAnchored] = useState(true);

  const switchStyle = (styleKey: "vibrant" | "dark" | "clean") => {
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

    const isDark =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const initialKey = isDark ? "dark" : "vibrant";
    setActiveStyle(initialKey);
    const styleUrl = MAP_STYLES[initialKey];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: toLngLat(center),
      zoom: zoom,
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
      // Register nautical vessel icons
      Object.entries(SHIP_COLORS).forEach(([key, conf]) => {
        const id = `ship_${key}`;
        if (!map.hasImage(id)) {
          map.addImage(id, createRealisticShipIcon(key, conf.fill), {
            pixelRatio: 2,
          });
        }
      });

      // 1. Vessel Positions Source
      if (!map.getSource("ships")) {
        map.addSource("ships", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // 2. Trajectory / Route Lines Source
      if (!map.getSource("routes")) {
        map.addSource("routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // Route glow layer
      if (!map.getLayer("route_glow")) {
        map.addLayer({
          id: "route_glow",
          type: "line",
          source: "routes",
          paint: {
            "line-color": "#22d3ee",
            "line-width": 5,
            "line-opacity": 0.45,
            "line-blur": 3,
          },
        });
      }

      // Route vector line layer
      if (!map.getLayer("route_line")) {
        map.addLayer({
          id: "route_line",
          type: "line",
          source: "routes",
          paint: {
            "line-color": "#14b8a6",
            "line-width": 2.2,
            "line-dasharray": [3, 2],
            "line-opacity": 0.9,
          },
        });
      }

      // Colorful vessel glow halo
      if (!map.getLayer("ships_glow")) {
        map.addLayer({
          id: "ships_glow",
          type: "circle",
          source: "ships",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1, 3.5,
              4, 5,
              8, 8,
              12, 12,
            ],
            "circle-color": [
              "match",
              ["get", "icon"],
              "cargo", "#10b981",
              "tanker", "#f59e0b",
              "passenger", "#ec4899",
              "tug", "#06b6d4",
              "fast", "#8b5cf6",
              "fishing", "#eab308",
              "anchored", "#64748b",
              "#3b82f6",
            ],
            "circle-opacity": 0.45,
            "circle-blur": 0.5,
          },
        });
      }

      // Sharp directional symbol layer
      if (!map.getLayer("ships")) {
        map.addLayer({
          id: "ships",
          type: "symbol",
          source: "ships",
          layout: {
            "icon-image": ["concat", "ship_", ["get", "icon"]],
            "icon-rotate": ["get", "hdg"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1, 0.7,
              4, 0.9,
              8, 1.1,
              12, 1.4,
            ],
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
        const s = vesselsRef.current.find((v) => v.id === id);
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

      // Dead-reckoning animation loop (~70ms)
      let last = 0;
      const frame = (ts: number) => {
        animRef.current = requestAnimationFrame(frame);
        if (ts - last < 70) return;
        last = ts;

        const now = Date.now();
        const curShips = vesselsRef.current;
        const features = [];

        for (let i = 0; i < curShips.length; i++) {
          const s = curShips[i]!;
          if (!showAnchored && s.stationary) continue;

          const p = deadReckonPos(s, now); // [lon, lat]
          if (isNaN(p[0]) || isNaN(p[1])) continue;
          const iconKey = getShipIconKey(s);
          features.push({
            type: "Feature" as const,
            properties: {
              id: s.id,
              name: s.name,
              icon: iconKey,
              sog: s.sog || 0,
              hdg: s.hdg ?? s.heading ?? s.cog ?? 0,
            },
            geometry: {
              type: "Point" as const,
              coordinates: p,
            },
          });
        }

        const src = map.getSource("ships") as maplibregl.GeoJSONSource | undefined;
        if (src) {
          src.setData({ type: "FeatureCollection", features });
        }
      };

      animRef.current = requestAnimationFrame(frame);
    });

    map.on("style.load", () => {
      setupLayers();
    });

    const observer = new MutationObserver(() => {
      const darkNow = document.documentElement.classList.contains("dark");
      const targetKey = darkNow ? "dark" : "vibrant";
      setActiveStyle(targetKey);
      if (mapRef.current) {
        mapRef.current.setStyle(MAP_STYLES[targetKey]);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
      observer.disconnect();
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [showAnchored]);

  // Update Route Layer for Selected Vessel
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const routeSrc = map.getSource("routes") as maplibregl.GeoJSONSource | undefined;
    if (!routeSrc) return;

    if (!showRoutes || !selectedVessel) {
      routeSrc.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    // Generate accurate forward heading vector for the selected vessel
    const curPos = deadReckonPos(selectedVessel, Date.now()); // [lon, lat]
    const courseRad = ((selectedVessel.cog || selectedVessel.hdg || 0) * Math.PI) / 180;
    const speedKnots = Math.max(1, selectedVessel.sog || 5);
    // Project 1.5 - 2.5 degrees forward along course
    const distDeg = Math.min(2.5, (speedKnots * 0.08));
    const projLon = curPos[0] + Math.sin(courseRad) * distDeg;
    const projLat = curPos[1] + Math.cos(courseRad) * (distDeg * 0.85);

    const routeFeature = {
      type: "Feature" as const,
      properties: {
        vesselId: selectedVessel.id,
        name: selectedVessel.name,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          curPos,
          [projLon, projLat],
        ],
      },
    };

    routeSrc.setData({
      type: "FeatureCollection",
      features: [routeFeature],
    });
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
      let statusColor = "#10b981";
      let statusBg = "rgba(16, 185, 129, 0.25)";
      if (ci != null) {
        if (ci > 1.2) {
          statusColor = "#ef4444";
          statusBg = "rgba(239, 68, 68, 0.25)";
        } else if (ci >= 0.8) {
          statusColor = "#f59e0b";
          statusBg = "rgba(245, 158, 11, 0.25)";
        }
      }

      const flag = PORT_FLAGS[p.id] || "⚓";

      el.innerHTML = `
        <div style="transform: translate(-50%, -50%); position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.4); border: 1.5px solid ${statusColor}; background: #071B2F; color: #ffffff;">
          <span style="font-size: 13px;">${flag}</span>
          <span style="letter-spacing: -0.01em;">${p.name}</span>
          <span style="padding: 1px 5px; border-radius: 4px; background: ${statusBg}; color: ${statusColor}; font-family: monospace; font-size: 10px; font-weight: 800;">CI ${ci != null ? Number(ci).toFixed(2) : "—"}</span>
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

  // Popup logic
  const showShipPopup = useCallback((s: LiveVessel) => {
    const map = mapRef.current;
    if (!map) return;

    if (popupRef.current) popupRef.current.remove();

    const p = deadReckonPos(s, Date.now());
    const coords: [number, number] = p;

    const popupNode = document.createElement("div");
    popupNode.style.fontFamily = "inherit";
    popupNode.style.fontSize = "12px";
    popupNode.style.lineHeight = "1.4";
    popupNode.style.padding = "4px 2px";
    popupNode.style.color = "#071B2F";

    popupNode.innerHTML = `
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 3px; color: #071B2F;">${s.name || "Unknown Vessel"}</div>
      <div><span style="color: #64748b;">MMSI:</span> <b>${s.id || s.mmsi}</b></div>
      <div><span style="color: #64748b;">Type:</span> ${s.shipTypeLabel || "Commercial"}</div>
      <div><span style="color: #64748b;">Speed:</span> <b>${Number(s.sog || 0).toFixed(1)} kn</b> · <span style="color: #64748b;">Course:</span> ${Math.round(s.cog || 0)}°</div>
      <button id="open-vessel-intel-popup-btn" style="margin-top: 8px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: #0D2942; color: #ffffff; border: none; border-radius: 6px; padding: 6px 10px; font-weight: 600; font-size: 11px; cursor: pointer; transition: background 0.2s;">
        ✨ Inspect Vessel Intel & Ask Gemini
      </button>
    `;

    const btn = popupNode.querySelector("#open-vessel-intel-popup-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        if (onSelectVessel) onSelectVessel(s);
      });
    }

    popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: true })
      .setLngLat(coords)
      .setDOMContent(popupNode)
      .addTo(map);
  }, [onSelectVessel]);

  // Handle selected vessel externally
  useEffect(() => {
    if (selectedVessel) {
      showShipPopup(selectedVessel);
      if (mapRef.current) {
        const p = deadReckonPos(selectedVessel, Date.now());
        mapRef.current.flyTo({ center: p, zoom: 10, essential: true });
      }
    }
  }, [selectedVessel, showShipPopup]);

  const statusConfig = {
    live: {
      label: "LIVE",
      color: "bg-[#10b981]",
      ping: true,
      text: "text-emerald-500",
      border: "border-emerald-500/40",
    },
    waking_up: {
      label: "WAKING UP SERVER",
      color: "bg-[#22d3ee]",
      ping: true,
      text: "text-cyan-400",
      border: "border-cyan-400/40",
    },
    reconnecting: {
      label: "RECONNECTING",
      color: "bg-[#f59e0b]",
      ping: true,
      text: "text-amber-500",
      border: "border-amber-500/40",
    },
    offline: {
      label: "OFFLINE",
      color: "bg-[#ef4444]",
      ping: false,
      text: "text-rose-500",
      border: "border-rose-500/40",
    },
    probing: {
      label: "CONNECTING",
      color: "bg-[#22d3ee]",
      ping: true,
      text: "text-cyan-400",
      border: "border-cyan-400/40",
    },
  }[status] || {
    label: "LIVE",
    color: "bg-[#10b981]",
    ping: true,
    text: "text-emerald-500",
    border: "border-emerald-500/40",
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border border-border bg-card shadow-sm ${
        isFullscreen ? "fixed inset-0 z-[2000] h-screen w-screen rounded-none" : className ?? "h-[560px] w-full"
      }`}
    >
      {/* MapLibre GL DOM container */}
      <div className="h-full w-full" />

      {/* Floating Status & Telemetry Header */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div
          className={`flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1 font-mono text-xs backdrop-blur-md shadow-md ${statusConfig.border}`}
          title={statusMessage || statusConfig.label}
        >
          <span className="relative flex h-2 w-2">
            {statusConfig.ping && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${statusConfig.color}`}
              />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${statusConfig.color}`} />
          </span>
          <span className={`font-bold ${statusConfig.text}`}>{statusConfig.label}</span>
          <span className="text-muted-foreground/60">|</span>
          <span className="text-muted-foreground font-sans text-[11px]">
            {vessels.length} vessels rendered
          </span>
        </div>

        {isSimulated && (
          <span className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 backdrop-blur-md shadow-sm">
            SIMULATED FLEET
          </span>
        )}
      </div>

      {/* Internal Map Controls Toolbar (Top Right) */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {/* Cartography Style Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background/90 p-1 backdrop-blur-md shadow-md text-xs">
          <button
            type="button"
            onClick={() => switchStyle("vibrant")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              activeStyle === "vibrant"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Vibrant
          </button>
          <button
            type="button"
            onClick={() => switchStyle("dark")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              activeStyle === "dark"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => switchStyle("clean")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              activeStyle === "clean"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Clean
          </button>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center rounded-lg border border-border bg-background/90 p-1 backdrop-blur-md shadow-md">
          <button
            type="button"
            onClick={zoomIn}
            title="Zoom In"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            title="Zoom Out"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={resetView}
            title="Fit to World / Reset View"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowRoutes(!showRoutes)}
            title={showRoutes ? "Hide Vessel Course Vectors" : "Show Vessel Course Vectors"}
            className={`flex h-7 w-7 items-center justify-center rounded transition ${
              showRoutes ? "text-primary bg-secondary/80 font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Navigation className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowPortLabels(!showPortLabels)}
            title={showPortLabels ? "Hide Port Hub Labels" : "Show Port Hub Labels"}
            className={`flex h-7 w-7 items-center justify-center rounded transition ${
              showPortLabels ? "text-primary bg-secondary/80" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Anchor className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowAnchored(!showAnchored)}
            title={showAnchored ? "Hide Anchored Vessels" : "Show Anchored Vessels"}
            className={`flex h-7 w-7 items-center justify-center rounded transition ${
              showAnchored ? "text-primary bg-secondary/80" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Ship className="h-3.5 w-3.5" />
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Bottom Map Legend Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs backdrop-blur-md shadow-md">
        <div className="flex flex-wrap items-center gap-3 font-medium text-foreground">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Legend:
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" /> Cargo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" /> Tanker
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ec4899]" /> Passenger
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#06b6d4]" /> Tug / Special
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" /> Fast (&gt;14 kn)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#64748b] border border-border" /> Anchored (&lt;0.5 kn)
          </span>
          {showRoutes && (
            <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
              <span className="h-0.5 w-3 bg-cyan-400 border-t border-dashed border-cyan-400" /> Vector Route
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">
          MapLibre GL · Real-Time AIS Stream
        </div>
      </div>
    </div>
  );
}
