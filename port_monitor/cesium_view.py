"""Cesium 3D Globe visualization component for Streamlit with animated vessel tracks.

Renders an interactive 3D CesiumJS globe with:
- SVG ship icons oriented by vessel heading (orange for stationary <0.5 kn, cyan for moving)
- Interpolated movement tracks via Cesium.SampledPositionProperty
- Fading motion trails for underway vessels
- Time animation controls (Play/Pause, 1x, 10x, 60x)
- Pulsing red congestion ring for congested ports (Congestion Index > 1.2)
- Performance capping at 1,000 animated vessels
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv
import streamlit as st
import streamlit.components.v1 as components

from config import CESIUM_ION_TOKEN

# Inline SVG Data URIs for ship symbols (oriented North / 0 degrees)
# Orange for stationary/waiting (< 0.5 kn), Cyan for moving/underway
SHIP_SVG_ORANGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M16 2 L26 12 L23 28 L9 28 L6 12 Z' fill='%23f97316' stroke='%23ffffff' stroke-width='2'/></svg>"
SHIP_SVG_CYAN = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M16 2 L26 12 L23 28 L9 28 L6 12 Z' fill='%2306b6d4' stroke='%23ffffff' stroke-width='2'/></svg>"


def render_cesium_globe(
    port_name: str,
    center_lat: float,
    center_lon: float,
    vessels_with_tracks: Optional[List[Dict[str, Any]]] = None,
    congestion_index: Optional[float] = None,
    height: int = 580,
) -> None:
    """Render an interactive 3D Cesium globe with animated vessel tracks and heading rotation."""
    token = CESIUM_ION_TOKEN or os.getenv("CESIUM_ION_TOKEN", "").strip()
    vessels = vessels_with_tracks or []

    # Cap at 1,000 vessels for browser WebGL rendering performance
    if len(vessels) > 1000:
        vessels = vessels[:1000]

    is_congested = bool(congestion_index is not None and congestion_index > 1.2)
    vessels_json = json.dumps(vessels)

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <script src="https://cesium.com/downloads/cesiumjs/releases/1.119/Build/Cesium/Cesium.js"></script>
      <link href="https://cesium.com/downloads/cesiumjs/releases/1.119/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
      <style>
        html, body, #cesiumContainer {{
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #020617;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }}
        .control-panel {{
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 99;
          background: rgba(15, 23, 42, 0.88);
          color: #f8fafc;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(6px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }}
        .btn-group {{
          margin-top: 8px;
          display: flex;
          gap: 6px;
        }}
        .btn-ctl {{
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f8fafc;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: background 0.15s;
        }}
        .btn-ctl:hover {{
          background: #334155;
        }}
        .legend-indicator {{
          display: inline-block;
          width: 10px;
          height: 10px;
          margin-right: 4px;
          vertical-align: middle;
        }}
        .congested-badge {{
          color: #f87171;
          font-weight: bold;
          margin-left: 6px;
        }}
      </style>
    </head>
    <body>
      <div class="control-panel">
        <strong>{port_name} Port</strong> &bull; {len(vessels)} vessels
        {f'<span class="congested-badge">⚠️ CONGESTED ({congestion_index:.2f})</span>' if is_congested else ''}
        <br>
        <span class="legend-indicator" style="background: #f97316; border-radius: 2px;"></span> Stationary (&lt; 0.5 kn) &nbsp;&nbsp;
        <span class="legend-indicator" style="background: #06b6d4; border-radius: 2px;"></span> Moving
        <div class="btn-group">
          <button class="btn-ctl" id="btnPlayPause">⏸ Pause</button>
          <button class="btn-ctl" onclick="setSpeed(1)">1x</button>
          <button class="btn-ctl" onclick="setSpeed(10)">10x</button>
          <button class="btn-ctl" onclick="setSpeed(60)">60x</button>
        </div>
      </div>
      <div id="cesiumContainer"></div>

      <script>
        const ionToken = "{token}";
        if (ionToken) {{
          Cesium.Ion.defaultAccessToken = ionToken;
        }}

        const viewer = new Cesium.Viewer('cesiumContainer', {{
          terrainProvider: ionToken ? Cesium.createWorldTerrain() : undefined,
          animation: false,
          timeline: true,
          fullscreenButton: false,
          homeButton: true,
          navigationHelpButton: false,
          baseLayerPicker: false,
          geocoder: false,
          sceneModePicker: false,
        }});

        // Center camera over port with a slight dynamic pitch
        viewer.camera.flyTo({{
          destination: Cesium.Cartesian3.fromDegrees({center_lon}, {center_lat}, 28000.0),
          orientation: {{
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-60.0),
            roll: 0.0
          }},
          duration: 1.5
        }});

        // Port Center Anchor Marker
        viewer.entities.add({{
          name: "{port_name} Port Center",
          position: Cesium.Cartesian3.fromDegrees({center_lon}, {center_lat}),
          point: {{
            pixelSize: 10,
            color: Cesium.Color.GOLD,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
          }},
          label: {{
            text: "{port_name}",
            font: "12px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -9)
          }}
        }});

        // Pulsing Congestion Ring if Congestion Index > 1.2
        const isCongested = {str(is_congested).lower()};
        if (isCongested) {{
          let pulseAlpha = 0.5;
          let delta = 0.01;
          viewer.entities.add({{
            name: "Congestion Alert Ring",
            position: Cesium.Cartesian3.fromDegrees({center_lon}, {center_lat}),
            ellipse: {{
              semiMajorAxis: 9000.0,
              semiMinorAxis: 9000.0,
              material: new Cesium.ColorMaterialProperty(
                new Cesium.CallbackProperty(() => {{
                  pulseAlpha += delta;
                  if (pulseAlpha > 0.65 || pulseAlpha < 0.25) delta = -delta;
                  return Cesium.Color.RED.withAlpha(pulseAlpha);
                }}, false)
              ),
              height: 50.0,
              outline: true,
              outlineColor: Cesium.Color.ORANGERED,
              outlineWidth: 3
            }}
          }});
        }}

        // Process vessel animated tracks
        const vessels = {vessels_json};
        const svgOrange = "{SHIP_SVG_ORANGE}";
        const svgCyan = "{SHIP_SVG_CYAN}";

        let minJulian = null;
        let maxJulian = null;

        vessels.forEach(v => {{
          const isStationary = v.stationary;
          const iconUrl = isStationary ? svgOrange : svgCyan;
          const track = v.track || [];

          if (track.length > 1) {{
            const positionProp = new Cesium.SampledPositionProperty();
            track.forEach(pt => {{
              try {{
                const julian = Cesium.JulianDate.fromIso8601(pt.iso);
                if (!minJulian || Cesium.JulianDate.lessThan(julian, minJulian)) minJulian = julian;
                if (!maxJulian || Cesium.JulianDate.greaterThan(julian, maxJulian)) maxJulian = julian;
                const cart = Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, 10.0);
                positionProp.addSample(julian, cart);
              }} catch (err) {{}}
            }});
            positionProp.setInterpolationOptions({{
              interpolationDegree: 1,
              interpolationAlgorithm: Cesium.LinearApproximation
            }});

            const entity = viewer.entities.add({{
              name: v.name + " (" + v.mmsi + ")",
              position: positionProp,
              billboard: {{
                image: iconUrl,
                width: 22,
                height: 22,
                rotation: Cesium.Math.toRadians(-((v.heading || 0))),
                alignedAxis: Cesium.Cartesian3.UNIT_Z
              }},
              // Fading trail for moving vessels
              path: !isStationary ? {{
                resolution: 1,
                material: new Cesium.PolylineGlowMaterialProperty({{
                  glowPower: 0.15,
                  color: Cesium.Color.CYAN.withAlpha(0.6)
                }}),
                width: 3,
                leadTime: 0,
                trailTime: 1800
              }} : undefined,
              description: `<div style="font-size:12px;">
                <b>Ship:</b> ${{v.name}}<br>
                <b>MMSI:</b> ${{v.mmsi}}<br>
                <b>Speed:</b> ${{v.sog}} knots<br>
                <b>Heading:</b> ${{v.heading}}°<br>
                <b>Status:</b> ${{isStationary ? 'Stationary (Waiting/Berth)' : 'Underway'}}
              </div>`
            }});
          }} else {{
            // Static single-point representation
            viewer.entities.add({{
              name: v.name + " (" + v.mmsi + ")",
              position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 10.0),
              billboard: {{
                image: iconUrl,
                width: 20,
                height: 20,
                rotation: Cesium.Math.toRadians(-((v.heading || 0))),
                alignedAxis: Cesium.Cartesian3.UNIT_Z
              }},
              description: `<b>Ship:</b> ${{v.name}}<br><b>Speed:</b> ${{v.sog}} kn`
            }});
          }}
        }});

        // Configure Animation Clock
        if (minJulian && maxJulian) {{
          viewer.clock.startTime = minJulian.clone();
          viewer.clock.stopTime = maxJulian.clone();
          viewer.clock.currentTime = minJulian.clone();
          viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
          viewer.clock.multiplier = 10;
          viewer.timeline.zoomTo(minJulian, maxJulian);
        }}

        // Controls
        let isPlaying = true;
        const btnPlay = document.getElementById('btnPlayPause');
        btnPlay.addEventListener('click', () => {{
          isPlaying = !isPlaying;
          viewer.clock.shouldAnimate = isPlaying;
          btnPlay.innerText = isPlaying ? '⏸ Pause' : '▶ Play';
        }});

        window.setSpeed = function(multiplier) {{
          viewer.clock.multiplier = multiplier;
          viewer.clock.shouldAnimate = true;
          isPlaying = true;
          btnPlay.innerText = '⏸ Pause';
        }};
      </script>
    </body>
    </html>
    """

    components.html(html_content, height=height, scrolling=False)
