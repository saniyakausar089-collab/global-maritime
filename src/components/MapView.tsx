import { useEffect, useRef } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";

export type MapMarker = {
  key: string;
  lat: number;
  lon: number;
  color: string;
  radius?: number;
  label: string;
  onClick?: () => void;
};

/** Leaflet map; leaflet is imported dynamically so it never runs during SSR. */
export function MapView({
  markers,
  center,
  zoom,
  fitToMarkers,
  className,
}: {
  markers: MapMarker[];
  center: [number, number];
  zoom: number;
  fitToMarkers?: boolean;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const fitted = useRef(false);

  const draw = () => {
    const lib = L.current;
    if (!lib || !layer.current || !map.current) return;
    layer.current.clearLayers();
    const css = getComputedStyle(document.documentElement);
    const resolve = (c: string) => {
      const m = c.match(/var\((--[\w-]+)\)/);
      return m ? css.getPropertyValue(m[1]!).trim() || c : c;
    };
    markers.forEach((m) => {
      const color = resolve(m.color);
      const cm = lib
        .circleMarker([m.lat, m.lon], {
          radius: m.radius ?? 8,
          color,
          fillColor: color,
          fillOpacity: 0.75,
          weight: 2,
        })
        .bindTooltip(m.label);
      if (m.onClick) cm.on("click", m.onClick);
      cm.addTo(layer.current!);
    });
    if (fitToMarkers && markers.length && !fitted.current) {
      map.current.fitBounds(lib.latLngBounds(markers.map((m) => [m.lat, m.lon])), { padding: [30, 30], maxZoom: 12 });
      fitted.current = true;
    }
  };
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current) return;
      const lib = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod;
      L.current = lib;
      map.current = lib.map(el.current, { worldCopyJump: true }).setView(center, zoom);
      lib
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        })
        .addTo(map.current);
      layer.current = lib.layerGroup().addTo(map.current);
      drawRef.current();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    draw();
  });

  return <div ref={el} className={className ?? "h-[420px] w-full rounded-lg"} />;
}
