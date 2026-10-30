import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Port } from "@/lib/api";
import { deadReckonPos, type LiveVessel, type ConnectionStatus } from "@/lib/useLiveVessels";
import { Compass, Search, Ship, ZoomIn, ZoomOut, Anchor } from "lucide-react";

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
  tanker: { fill: "#f59e0b", label: "Tanker (Oil/Chemical/Gas)" },
  passenger: { fill: "#ec4899", label: "Passenger / Cruise / Ferry" },
  tug: { fill: "#06b6d4", label: "Tug / Pilot / Workboat" },
  fast: { fill: "#8b5cf6", label: "High-Speed (>14 kn)" },
  fishing: { fill: "#eab308", label: "Fishing Fleet" },
  other: { fill: "#3b82f6", label: "Moving Commercial" },
  anchored: { fill: "#64748b", label: "Anchored / Moored (<0.5 kn)" },
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

  // Custom hull dimensions based on vessel category
  let bowY = 5;
  let sternY = 47;
  let hw = 7.5; // half width (beam)

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

  // 1. Hydrodynamic stern wake when vessel is under way
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

  // 2. Realistic Hull Silhouette (hydrodynamic pointed bow + long parallel midbody + flat transom stern)
  x.shadowColor = "rgba(0, 0, 0, 0.45)";
  x.shadowBlur = 4;
  x.shadowOffsetY = 1;

  x.beginPath();
  // Bow tip
  x.moveTo(cx, bowY);
  // Starboard forward curve
  x.bezierCurveTo(cx + hw * 0.6, bowY + 3, cx + hw, bowY + 11, cx + hw, bowY + 16);
  // Starboard parallel hull down to stern
  x.lineTo(cx + hw, sternY - 4);
  // Starboard transom corner curve
  x.quadraticCurveTo(cx + hw, sternY, cx + hw - 2, sternY);
  // Transom flat stern
  x.lineTo(cx - hw + 2, sternY);
  // Port transom corner curve
  x.quadraticCurveTo(cx - hw, sternY, cx - hw, sternY - 4);
  // Port parallel hull up to forward curve
  x.lineTo(cx - hw, bowY + 16);
  // Port forward curve back to bow tip
  x.bezierCurveTo(cx - hw, bowY + 11, cx - hw * 0.6, bowY + 3, cx, bowY);
  x.closePath();

  // Primary hull color
  x.fillStyle = color;
  x.fill();

  // Crisp white hull perimeter
  x.shadowBlur = 0;
  x.shadowOffsetY = 0;
  x.lineWidth = 1.8;
  x.strokeStyle = "#ffffff";
  x.stroke();

  // 3. Inner Main Deck
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

  // 4. Authentic Top-Down Deck Equipment & Superstructure
  if (type === "cargo" || type === "other") {
    // Container bays / Cargo hold hatches
    x.fillStyle = "rgba(255, 255, 255, 0.85)";
    const hW = deckHw * 1.5;
    for (let i = 0; i < 4; i++) {
      const hy = deckBowY + 6 + i * 5;
      if (hy < sternY - 13) {
        x.fillRect(cx - hW / 2, hy, hW, 3);
      }
    }
    // Aft Navigation Bridge with bridge wings
    const brY = sternY - 11;
    x.fillStyle = "#ffffff";
    x.fillRect(cx - (deckHw + 1), brY, (deckHw + 1) * 2, 4);
    // Smokestack / Funnel
    x.fillStyle = "#0f172a";
    x.fillRect(cx - 2, brY + 4.5, 4, 2.5);
  } else if (type === "tanker") {
    // Longitudinal center pipeline
    x.strokeStyle = "rgba(255, 255, 255, 0.9)";
    x.lineWidth = 1.4;
    x.beginPath();
    x.moveTo(cx, deckBowY + 5);
    x.lineTo(cx, sternY - 11);
    x.stroke();
    // Tank dome manifolds
    x.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.arc(cx, deckBowY + 8 + i * 7, 2.2, 0, Math.PI * 2);
      x.fill();
    }
    // Aft Bridge & Funnel
    const brY = sternY - 10;
    x.fillStyle = "#ffffff";
    x.fillRect(cx - deckHw, brY, deckHw * 2, 4);
    x.fillStyle = "#0f172a";
    x.fillRect(cx - 2.5, brY + 4.5, 5, 2.5);
  } else if (type === "passenger") {
    // Multi-tier passenger decks
    x.fillStyle = "rgba(255, 255, 255, 0.92)";
    x.fillRect(cx - deckHw + 0.8, deckBowY + 5, (deckHw - 0.8) * 2, sternY - deckBowY - 11);
    // Twin funnels / radomes
    x.fillStyle = "#ec4899";
    x.fillRect(cx - 3, deckBowY + 12, 6, 2.5);
    x.fillRect(cx - 3, deckBowY + 18, 6, 2.5);
  } else if (type === "tug") {
    // Heavy rubber bow bumper fender
    x.fillStyle = "#0f172a";
    x.beginPath();
    x.arc(cx, bowY + 2, 3.5, 0, Math.PI * 2);
    x.fill();
    // Round wheelhouse
    x.fillStyle = "#ffffff";
    x.beginPath();
    x.ellipse(cx, (bowY + sternY) / 2, 4.5, 5.5, 0, 0, Math.PI * 2);
    x.fill();
  } else if (type === "fast") {
    // Slender cockpit & streamlined bridge
    x.fillStyle = "#ffffff";
    x.beginPath();
    x.moveTo(cx, bowY + 8);
    x.lineTo(cx + 3, bowY + 22);
    x.lineTo(cx - 3, bowY + 22);
    x.closePath();
    x.fill();
  }

  // 5. Anchored vessel badge overlay
  if (type === "anchored") {
    x.fillStyle = "#ffffff";
    x.beginPath();
    x.arc(cx, (bowY + sternY) / 2 - 3, 3, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "#ffffff";
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(cx, (bowY + sternY) / 2);
    x.lineTo(cx, (bowY + sternY) / 2 + 7);
    x.moveTo(cx - 4, (bowY + sternY) / 2 + 2);
    x.lineTo(cx + 4, (bowY + sternY) / 2 + 2);
    x.stroke();
    x.beginPath();
    x.arc(cx, (bowY + sternY) / 2 + 5, 4, 0, Math.PI);
    x.stroke();
  }

  return x.getImageData(0, 0, 54, 54);
}

function getShipIconKey(s: LiveVessel): string {
  if ((s.sog || 0) < 0.5) return "anchored";
  if ((s.sog || 0) > 14) return "fast";
  const t = Number(s.type || s.shipType) || 0;
  if (t >= 70 && t <= 79) return "cargo";
  if (t >= 80 && t <= 89) return "tanker";
  if (t >= 60 && t <= 69) return "passenger";
  if (t >= 50 && t <= 59) return "tug";
  if (t === 30) return "fishing";
  return "other";
}

function toLngLat(c: [number, number]): [number, number] {
  // MapLibre expects [lng, lat], where -180 <= lng <= 180 and -90 <= lat <= 90
  if (Math.abs(c[0]) > 90) {
    // c[0] cannot be latitude, so c is already [lon, lat]
    return [c[0], c[1]];
  }
  if (Math.abs(c[1]) > 90) {
    // c[1] cannot be latitude, so c[1] is longitude: [lat, lon] -> [lon, lat]
    return [c[1], c[0]];
  }
  // Default convention for props in this app: center is [lat, lon] -> return [lon, lat]
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchNotFound, setSearchNotFound] = useState(false);

  const [activeStyle, setActiveStyle] = useState<"vibrant" | "dark" | "clean">("vibrant");

  const switchStyle = (styleKey: "vibrant" | "dark" | "clean") => {
    setActiveStyle(styleKey);
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[styleKey]);
    }
  };

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const isDark =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const initialKey = isDark ? "dark" : "vibrant";
    setActiveStyle(initialKey);
    const styleUrl = MAP_STYLES[initialKey];

    // MapLibre uses [lng, lat]
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: toLngLat(center),
      zoom: zoom,
      attributionControl: { compact: true },
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("error", (e) => {
      console.warn("[MapLibre] warning/error:", e?.error?.message || e);
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);
    const resizeTimeout = setTimeout(() => map.resize(), 150);

    function setupLayers() {
      // Register all colored nautical icons
      Object.entries(SHIP_COLORS).forEach(([key, conf]) => {
        const id = `ship_${key}`;
        if (!map.hasImage(id)) {
          map.addImage(id, createRealisticShipIcon(key, conf.fill), {
            pixelRatio: 2,
          });
        }
      });

      if (!map.getSource("ships")) {
        map.addSource("ships", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // Colorful glowing halo layer
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

      // Start continuous dead-reckoning animation loop (~70ms interval)
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
          const p = deadReckonPos(s, now); // returns [lon, lat]
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
              coordinates: p, // [lon, lat] for MapLibre GeoJSON
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

    // Re-bind layers if map style is swapped (e.g. style button click or dark mode)
    map.on("style.load", () => {
      setupLayers();
    });

    // Dark mode mutation observer
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
  }, []);

  // Update port markers on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    portMarkersRef.current.forEach((m) => m.remove());
    portMarkersRef.current = [];

    ports.forEach((p) => {
      const el = document.createElement("div");
      el.className = "cursor-pointer select-none";

      const ci = p.congestion_index;
      let statusColor = "#10b981"; // emerald
      let statusBg = "rgba(16, 185, 129, 0.25)";
      if (ci != null) {
        if (ci > 1.2) {
          statusColor = "#ef4444"; // red
          statusBg = "rgba(239, 68, 68, 0.25)";
        } else if (ci >= 0.8) {
          statusColor = "#f59e0b"; // amber
          statusBg = "rgba(245, 158, 11, 0.25)";
        }
      }

      const flag = PORT_FLAGS[p.id] || "⚓";

      el.innerHTML = `
        <div style="transform: translate(-50%, -50%); position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 9999px; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 16px rgba(0,0,0,0.45); border: 1.5px solid ${statusColor}; background: linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.94) 100%); color: #ffffff;">
          <span style="font-size: 13px;">${flag}</span>
          <span style="letter-spacing: -0.01em;">${p.name}</span>
          <span style="padding: 1px 6px; border-radius: 6px; background: ${statusBg}; color: ${statusColor}; font-family: monospace; font-size: 10px; font-weight: 800;">CI ${ci != null ? Number(ci).toFixed(2) : "—"}</span>
        </div>
      `;

      el.onclick = () => {
        if (onSelectPort) onSelectPort(p);
        map.flyTo({ center: [p.lon, p.lat], zoom: 9.5, essential: true });
      };

      const marker = new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);

      portMarkersRef.current.push(marker);
    });
  }, [ports, mapLoaded, onSelectPort]);

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

    const p = deadReckonPos(s, Date.now()); // [lon, lat]
    const coords: [number, number] = p;

    const popupNode = document.createElement("div");
    popupNode.style.fontFamily = "inherit";
    popupNode.style.fontSize = "13px";
    popupNode.style.lineHeight = "1.4";
    popupNode.style.padding = "4px 2px";
    popupNode.style.color = "#04203a";

    popupNode.innerHTML = `
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #0f172a;">${s.name || "Unknown Vessel"}</div>
      <div><span style="color: #64748b;">MMSI:</span> <b>${s.id || s.mmsi}</b></div>
      <div><span style="color: #64748b;">Type:</span> ${s.shipTypeLabel || "Commercial"}</div>
      <div><span style="color: #64748b;">Speed:</span> <b>${Number(s.sog || 0).toFixed(1)} kn</b> · <span style="color: #64748b;">Course:</span> ${Math.round(s.cog || 0)}°</div>
      <div style="margin-top: 4px; font-size: 11px; color: #94a3b8;">Updated ${Math.round((Date.now() - (s.t || Date.now())) / 1000)}s ago</div>
      <button id="open-vessel-intel-popup-btn" style="margin-top: 8px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: #0284c7; color: #ffffff; border: none; border-radius: 6px; padding: 6px 10px; font-weight: 600; font-size: 11px; cursor: pointer; transition: background 0.2s;">
        ✨ View Photo & Ask Gemini
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
  }, []);

  // Handle selected vessel externally
  useEffect(() => {
    if (selectedVessel) {
      showShipPopup(selectedVessel);
      if (mapRef.current) {
        const p = deadReckonPos(selectedVessel, Date.now());
        mapRef.current.flyTo({ center: p, zoom: 11, essential: true });
      }
    }
  }, [selectedVessel, showShipPopup]);

  // Search by name or MMSI
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    const s = vesselsRef.current.find(
      (v) => String(v.id).includes(q) || (v.name || "").toLowerCase().includes(q),
    );

    if (s) {
      setSearchNotFound(false);
      if (onSelectVessel) onSelectVessel(s);
      showShipPopup(s);
      const p = deadReckonPos(s, Date.now());
      mapRef.current?.flyTo({ center: p, zoom: 11, essential: true });
    } else {
      setSearchNotFound(true);
      setTimeout(() => setSearchNotFound(false), 1200);
    }
  };

  const statusConfig = {
    live: {
      label: "LIVE",
      color: "bg-[#2ee59d]",
      ping: true,
      text: "text-emerald-500",
      border: "border-emerald-500/40",
    },
    waking_up: {
      label: "WAKING UP SERVER",
      color: "bg-[#38bdf8]",
      ping: true,
      text: "text-sky-500",
      border: "border-sky-500/40",
    },
    reconnecting: {
      label: "RECONNECTING",
      color: "bg-[#ffb020]",
      ping: true,
      text: "text-amber-500",
      border: "border-amber-500/40",
    },
    offline: {
      label: "OFFLINE",
      color: "bg-[#ff5470]",
      ping: false,
      text: "text-rose-500",
      border: "border-rose-500/40",
    },
    probing: {
      label: "CONNECTING",
      color: "bg-sky-400",
      ping: true,
      text: "text-sky-400",
      border: "border-sky-400/40",
    },
  }[status] || {
    label: "LIVE",
    color: "bg-[#2ee59d]",
    ping: true,
    text: "text-emerald-500",
    border: "border-emerald-500/40",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border shadow-sm ${className ?? "h-[560px] w-full"}`}
    >
      {/* MapLibre GL DOM container */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Floating Status & Telemetry Header */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        {/* Status Badge */}
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
          <span className="text-muted-foreground font-sans text-[11px] max-w-[200px] truncate sm:max-w-none">
            {vessels.length} vessels tracked
          </span>
        </div>

        {/* Simulation label badge */}
        {isSimulated && (
          <span className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 backdrop-blur-md shadow-sm">
            SIMULATED DATA
          </span>
        )}

        {/* Legend pill */}
        <div className="hidden sm:flex items-center gap-3 rounded-full border border-border bg-background/85 px-3 py-1 text-[11px] backdrop-blur-md shadow-md text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0b6fd6]" /> Moving
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#8a96a3]" /> Anchored / Moored (&lt;0.5
            kn)
          </span>
        </div>
      </div>

      {/* Floating Ship Search & Style Control */}
      <div className="absolute right-3 top-3 z-10 hidden sm:flex items-center gap-2">
        {/* Map Style Selector */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-background/90 p-1 backdrop-blur-md shadow-md text-xs">
          <button
            type="button"
            onClick={() => switchStyle("vibrant")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              activeStyle === "vibrant"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🎨 Vibrant
          </button>
          <button
            type="button"
            onClick={() => switchStyle("dark")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              activeStyle === "dark"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🌙 Dark
          </button>
          <button
            type="button"
            onClick={() => switchStyle("clean")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              activeStyle === "clean"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ☀️ Clean
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ship name / MMSI"
            className={`h-8 w-52 rounded-full border bg-background/90 pl-8 pr-3 text-xs backdrop-blur-md shadow-md transition outline-none focus:ring-1 focus:ring-primary ${
              searchNotFound ? "border-rose-500 ring-rose-500" : "border-border"
            }`}
          />
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
        </form>
      </div>

      {/* MapLibre attribution overlay repositioned cleanly */}
    </div>
  );
}
