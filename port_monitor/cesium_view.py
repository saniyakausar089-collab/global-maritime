"""Cesium 3D Globe visualization component for Streamlit with animated vessel tracks.

Renders an interactive 3D CesiumJS globe with:
- True 3D animated ship bodies (procedural hull geometry + high-contrast SVG vessel icons)
- Heading rotation matching vessel transponder course
- Interpolated movement glide via Cesium.SampledPositionProperty
- Dynamic 3D orientation via Cesium.VelocityOrientationProperty
- Fading motion trails for underway vessels
- Time animation controls (Play/Pause, 30x, 120x, 600x, 1800x replay speeds)
- Auto-animating playback on load
- Pulsing red congestion ring for congested ports (Congestion Index > 1.2)
- Capped at 1,000 animated vessels for WebGL performance
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

# High-contrast inline SVG Data URIs for ship symbols (oriented North / 0 degrees)
# Amber/Orange for stationary/waiting (< 0.5 kn), Electric Cyan for moving/underway
SHIP_SVG_ORANGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' width='40' height='40'><polygon points='20,2 34,14 30,38 10,38 6,14' fill='%23f97316' stroke='%23ffffff' stroke-width='2'/><polygon points='20,8 28,18 12,18' fill='%23ffffff' opacity='0.9'/><rect x='17' y='22' width='6' height='10' fill='%237c2d12'/></svg>"
SHIP_SVG_CYAN = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' width='40' height='40'><polygon points='20,2 34,14 30,38 10,38 6,14' fill='%2306b6d4' stroke='%23ffffff' stroke-width='2'/><polygon points='20,8 28,18 12,18' fill='%23ffffff' opacity='0.9'/><rect x='17' y='22' width='6' height='10' fill='%23083344'/></svg>"


def get_cesium_html(
    port_name: str,
    center_lat: float,
    center_lon: float,
    vessels_with_tracks: Optional[List[Dict[str, Any]]] = None,
    congestion_index: Optional[float] = None,
) -> str:
    """Generate standalone HTML document containing the 3D CesiumJS animated globe."""
    token = CESIUM_ION_TOKEN or os.getenv("CESIUM_ION_TOKEN", "").strip()
    vessels = vessels_with_tracks or []

    # Cap at 1,000 vessels for browser WebGL rendering performance
    if len(vessels) > 1000:
        vessels = vessels[:1000]

    is_congested = bool(congestion_index is not None and congestion_index > 1.2)
    vessels_json = json.dumps(vessels)

    return f"""
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
          background: rgba(15, 23, 42, 0.90);
          color: #f8fafc;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.6);
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
          padding: 5px 9px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }}
        .btn-ctl:hover {{
          background: #334155;
          border-color: #38bdf8;
        }}
        .btn-ctl.active {{
          background: #0284c7;
          border-color: #38bdf8;
        }}
        .legend-indicator {{
          display: inline-block;
          width: 11px;
          height: 11px;
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
        <strong>⚓ {port_name} 3D Maritime Space</strong> &bull; <span id="vesselCount">{len(vessels)}</span> vessels
        {f'<span class="congested-badge">🚨 CONGESTED ({congestion_index:.2f})</span>' if is_congested else ''}
        <br>
        <span class="legend-indicator" style="background: #f97316; border-radius: 2px;"></span> Stationary / Waiting (&lt; 0.5 kn) &nbsp;&nbsp;
        <span class="legend-indicator" style="background: #06b6d4; border-radius: 2px;"></span> Moving Underway
        <div class="btn-group">
          <button class="btn-ctl" id="btnPlayPause">⏸ Pause</button>
          <button class="btn-ctl" onclick="setSpeed(30)">30x</button>
          <button class="btn-ctl active" id="spd120" onclick="setSpeed(120)">120x</button>
          <button class="btn-ctl" onclick="setSpeed(600)">600x</button>
          <button class="btn-ctl" onclick="setSpeed(1800)">1800x</button>
        </div>
      </div>
      <div id="cesiumContainer"></div>

      <script>
        const ionToken = "{token}";
        if (ionToken) {{
          Cesium.Ion.defaultAccessToken = ionToken;
        }}

        const viewer = new Cesium.Viewer('cesiumContainer', {{
          animation: false,
          timeline: true,
          fullscreenButton: false,
          homeButton: true,
          navigationHelpButton: false,
          baseLayerPicker: false,
          geocoder: false,
          sceneModePicker: false,
        }});

        // Smoothly stream Cesium world terrain without blocking viewer initialization
        if (ionToken) {{
          try {{
            Cesium.CesiumTerrainProvider.fromIonAssetId(1).then(tp => {{
              viewer.terrainProvider = tp;
            }}).catch(e => console.warn("Terrain provider deferred:", e));
          }} catch (e) {{}}
        }}

        const isGlobal = "{port_name}".includes("Global");
        const camAltitude = isGlobal ? 18000000.0 : 22000.0;
        const camPitch = isGlobal ? -85.0 : -42.0;
        const latOffset = isGlobal ? 0.0 : -0.06;

        // Dynamic 3D Camera flight
        viewer.camera.flyTo({{
          destination: Cesium.Cartesian3.fromDegrees({center_lon}, {center_lat} + latOffset, camAltitude),
          orientation: {{
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(camPitch),
            roll: 0.0
          }},
          duration: 1.5
        }});

        // Add Port Anchor Markers
        const portLocations = isGlobal
          ? [
              {{ name: "Rotterdam", lat: 51.95, lon: 4.15 }},
              {{ name: "Singapore", lat: 1.28, lon: 103.85 }},
              {{ name: "Shanghai", lat: 31.25, lon: 121.50 }},
              {{ name: "Los Angeles", lat: 33.74, lon: -118.26 }}
            ]
          : [{{ name: "{port_name}", lat: {center_lat}, lon: {center_lon} }}];

        portLocations.forEach(p => {{
          viewer.entities.add({{
            name: p.name + " Port",
            position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
            point: {{
              pixelSize: 12,
              color: Cesium.Color.GOLD,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
            }},
            label: {{
              text: p.name,
              font: "14px bold sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -12)
            }}
          }});
        }});

        // Pulsing Congestion Ring if Congestion Index > 1.2
        const isCongested = {str(is_congested).lower()};
        if (isCongested) {{
          let pulseAlpha = 0.5;
          let delta = 0.015;
          viewer.entities.add({{
            name: "Congestion Alert Perimeter",
            position: Cesium.Cartesian3.fromDegrees({center_lon}, {center_lat}),
            ellipse: {{
              semiMajorAxis: 8500.0,
              semiMinorAxis: 8500.0,
              material: new Cesium.ColorMaterialProperty(
                new Cesium.CallbackProperty(() => {{
                  pulseAlpha += delta;
                  if (pulseAlpha > 0.70 || pulseAlpha < 0.20) delta = -delta;
                  return Cesium.Color.RED.withAlpha(pulseAlpha);
                }}, false)
              ),
              height: 25.0,
              outline: true,
              outlineColor: Cesium.Color.ORANGERED,
              outlineWidth: 3
            }}
          }});
        }}

        // Process vessel data
        const vessels = {vessels_json};
        const svgOrange = "{SHIP_SVG_ORANGE}";
        const svgCyan = "{SHIP_SVG_CYAN}";

        let minJulian = null;
        let maxJulian = null;

        vessels.forEach(v => {{
          const isStationary = v.stationary;
          const iconUrl = isStationary ? svgOrange : svgCyan;
          const headingDeg = (v.heading || v.cog || 0.0);
          const track = v.track || [];

          if (track.length > 1) {{
            // Interpolated Multi-Sample Trajectory
            const positionProp = new Cesium.SampledPositionProperty();
            track.forEach(pt => {{
              try {{
                const isoStr = pt.iso;
                const julian = Cesium.JulianDate.fromIso8601(isoStr);
                if (!minJulian || Cesium.JulianDate.lessThan(julian, minJulian)) minJulian = julian;
                if (!maxJulian || Cesium.JulianDate.greaterThan(julian, maxJulian)) maxJulian = julian;
                const cart = Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, 6.0);
                positionProp.addSample(julian, cart);
              }} catch (err) {{}}
            }});

            positionProp.setInterpolationOptions({{
              interpolationDegree: 1,
              interpolationAlgorithm: Cesium.LinearApproximation
            }});
            // Keep vessel visible before first sample and after last sample
            positionProp.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
            positionProp.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;

            // Velocity-based dynamic 3D orientation for moving vessels
            const orientationProp = !isStationary
              ? new Cesium.VelocityOrientationProperty(positionProp)
              : undefined;

            const shipEntity = viewer.entities.add({{
              name: v.name + " (" + v.mmsi + ")",
              position: positionProp,
              orientation: orientationProp,
              // Crisp SVG Billboard rotated by vessel heading
              billboard: {{
                image: iconUrl,
                width: 32,
                height: 32,
                rotation: -Cesium.Math.toRadians(headingDeg),
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
              }},
              // Real 3D physical ship hull geometry (90m length x 24m beam x 14m height)
              box: {{
                dimensions: new Cesium.Cartesian3(90.0, 24.0, 14.0),
                material: Cesium.Color.fromCssColorString(isStationary ? '#f97316' : '#06b6d4').withAlpha(0.92),
                outline: true,
                outlineColor: Cesium.Color.WHITE.withAlpha(0.85),
                outlineWidth: 2,
              }},
              // Glowing movement trail behind moving ships
              path: !isStationary ? {{
                resolution: 1,
                material: new Cesium.PolylineGlowMaterialProperty({{
                  glowPower: 0.25,
                  color: Cesium.Color.CYAN.withAlpha(0.7)
                }}),
                width: 4,
                leadTime: 0,
                trailTime: 2400
              }} : undefined,
              description: `<div style="font-family:sans-serif; font-size:13px; line-height:1.5;">
                <b style="font-size:14px; color:#38bdf8;">${{v.name}}</b><br>
                <b>MMSI:</b> ${{v.mmsi}}<br>
                <b>Speed:</b> ${{v.sog}} knots<br>
                <b>Heading:</b> ${{headingDeg}}°<br>
                <b>Status:</b> ${{isStationary ? 'Stationary (Waiting/Anchored)' : 'Underway Transit'}}
              </div>`
            }});
          }} else {{
            // Single-point vessel representation
            const pos = Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 6.0);
            const headingRad = Cesium.Math.toRadians(headingDeg - 90.0);
            const hpr = new Cesium.HeadingPitchRoll(headingRad, 0.0, 0.0);
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);

            viewer.entities.add({{
              name: v.name + " (" + v.mmsi + ")",
              position: pos,
              orientation: orientation,
              billboard: {{
                image: iconUrl,
                width: 30,
                height: 30,
                rotation: -Cesium.Math.toRadians(headingDeg),
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
              }},
              box: {{
                dimensions: new Cesium.Cartesian3(80.0, 22.0, 12.0),
                material: Cesium.Color.fromCssColorString(isStationary ? '#f97316' : '#06b6d4').withAlpha(0.9),
                outline: true,
                outlineColor: Cesium.Color.WHITE.withAlpha(0.8),
              }},
              description: `<b>Ship:</b> ${{v.name}}<br><b>Speed:</b> ${{v.sog}} kn<br><b>Heading:</b> ${{headingDeg}}°`
            }});
          }}
        }});

        // Configure Animation Clock & Auto-Start
        if (minJulian && maxJulian && !Cesium.JulianDate.equals(minJulian, maxJulian)) {{
          viewer.clock.startTime = minJulian.clone();
          viewer.clock.stopTime = maxJulian.clone();
          viewer.clock.currentTime = minJulian.clone();
          viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
          viewer.clock.multiplier = 120; // 120x speed so vessels glide smoothly across the screen
          viewer.clock.shouldAnimate = true; // Auto-play immediately!
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


def render_cesium_globe(
    port_name: str,
    center_lat: float,
    center_lon: float,
    vessels_with_tracks: Optional[List[Dict[str, Any]]] = None,
    congestion_index: Optional[float] = None,
    height: int = 600,
) -> None:
    """Render an interactive 3D Cesium globe with animated 3D vessel models and tracks in Streamlit."""
    html_content = get_cesium_html(
        port_name=port_name,
        center_lat=center_lat,
        center_lon=center_lon,
        vessels_with_tracks=vessels_with_tracks,
        congestion_index=congestion_index,
    )
    components.html(html_content, height=height, scrolling=False)
