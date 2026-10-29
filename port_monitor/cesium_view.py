"""Cesium 3D Globe visualization component for Streamlit.

Renders an interactive 3D CesiumJS globe in Streamlit with vessel points,
color-coded by movement status (stationary vs moving), and port markers.
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

# Ensure .env is automatically loaded
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
for p in [BASE_DIR / ".env", PROJECT_ROOT / ".env", Path(".env")]:
    if p.is_file():
        load_dotenv(dotenv_path=p, override=True)
        break

from config import CESIUM_ION_TOKEN


def render_cesium_globe(
    port_name: str,
    center_lat: float,
    center_lon: float,
    vessels: Optional[List[Dict[str, Any]]] = None,
    height: int = 550,
) -> None:
    """Render a 3D CesiumJS globe centered on a port with plotted vessels."""
    token = CESIUM_ION_TOKEN or os.getenv("CESIUM_ION_TOKEN", "").strip()
    vessel_data = vessels or []

    # Prepare vessels payload for JS injection
    vessels_json = json.dumps([
        {
            "mmsi": v.get("mmsi"),
            "name": v.get("ship_name") or f"Vessel {v.get('mmsi')}",
            "lat": v.get("lat"),
            "lon": v.get("lon"),
            "sog": v.get("sog", 0.0),
            "stationary": bool(v.get("stationary")),
        }
        for v in vessel_data
    ])

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
        .badge-overlay {{
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 99;
          background: rgba(15, 23, 42, 0.85);
          color: #f8fafc;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(4px);
        }}
        .legend-dot {{
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 4px;
        }}
      </style>
    </head>
    <body>
      <div class="badge-overlay">
        <strong>{port_name}</strong> &bull; {len(vessel_data)} vessels plotted<br>
        <span class="legend-dot" style="background: #ef4444;"></span> Stationary (&lt; 0.5 kn) &nbsp;&nbsp;
        <span class="legend-dot" style="background: #3b82f6;"></span> Moving
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
          timeline: false,
          fullscreenButton: false,
          homeButton: true,
          navigationHelpButton: false,
          baseLayerPicker: false,
          geocoder: false,
          sceneModePicker: true,
        }});

        // Center camera over port
        viewer.camera.flyTo({{
          destination: Cesium.Cartesian3.fromDegrees({center_lon}, {center_lat}, 25000.0),
          orientation: {{
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-65.0),
            roll: 0.0
          }},
          duration: 1.5
        }});

        // Add port center marker
        viewer.entities.add({{
          name: "{port_name} Port Anchor",
          position: Cesium.Cartesian3.fromDegrees({center_lon}, {center_lat}),
          point: {{
            pixelSize: 12,
            color: Cesium.Color.GOLD,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
          }},
          label: {{
            text: "{port_name} Port",
            font: "13px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -9)
          }}
        }});

        // Add vessels
        const vessels = {vessels_json};
        vessels.forEach(v => {{
          const isStationary = v.stationary;
          const color = isStationary ? Cesium.Color.RED : Cesium.Color.DEEPSKYBLUE;
          viewer.entities.add({{
            name: v.name + " (" + v.mmsi + ")",
            position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat),
            point: {{
              pixelSize: 8,
              color: color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
            }},
            description: `<div style="font-size:12px;">
              <b>Ship:</b> ${{v.name}}<br>
              <b>MMSI:</b> ${{v.mmsi}}<br>
              <b>Speed:</b> ${{v.sog}} knots<br>
              <b>Status:</b> ${{isStationary ? 'Stationary' : 'Underway'}}
            </div>`
          }});
        }});
      </script>
    </body>
    </html>
    """

    components.html(html_content, height=height, scrolling=False)
