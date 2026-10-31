"""FastAPI REST API for Global Maritime Port Monitor.

Provides endpoints for port summaries, vessel details, historical
congestion trends, and Open-Meteo marine/weather risk assessment, matching
both frontend UI needs and external data consumers.
"""

import json
import logging
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import PORTS, DB_PATH
from cesium_view import get_cesium_html
from metrics import (
    init_db,
    get_all_ports_summary,
    get_latest_vessels,
    get_hourly_stationary_history,
    get_congestion_index,
    get_vessel_tracks,
    get_connection,
)

logger = logging.getLogger("api")

app = FastAPI(
    title="Global Maritime Port Monitor API",
    description="REST API for maritime port congestion indices, AIS vessel tracking, and weather risk management",
    version="1.1.0",
)

# Enable CORS for local dashboards and frontend portals
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_weather_cache_table():
    """Ensure weather_cache table exists in SQLite DB."""
    try:
        with get_connection(DB_PATH) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS weather_cache (
                    port_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at REAL NOT NULL
                )
            """)
            conn.commit()
    except Exception as e:
        logger.warning(f"Could not create weather_cache table: {e}")


@app.on_event("startup")
def startup_event():
    """Ensure database tables exist on server startup."""
    init_db(DB_PATH)
    ensure_weather_cache_table()


@app.get("/")
def read_root():
    """API health check and general metadata."""
    return {
        "name": "Global Maritime Port Monitor API",
        "status": "online",
        "monitored_ports": list(PORTS.keys()),
    }


@app.get("/ports")
def get_ports() -> List[Dict[str, Any]]:
    """Retrieve all monitored ports with their current congestion index."""
    return get_all_ports_summary(DB_PATH)


@app.get("/ports/{port_id}")
def get_port_detail(port_id: str) -> Dict[str, Any]:
    """Retrieve metadata and congestion metrics for a single port."""
    if port_id not in PORTS:
        raise HTTPException(status_code=404, detail=f"Port '{port_id}' not found.")

    p = PORTS[port_id]
    ci = get_congestion_index(port_id, DB_PATH)
    vessels = get_latest_vessels(port_id, DB_PATH)
    stationary = sum(1 for v in vessels if v["stationary"])

    return {
        "id": port_id,
        "name": p["name"],
        "lat": p["lat"],
        "lon": p["lon"],
        "bbox": p["bbox"],
        "congestion_index": ci,
        "total_vessels": len(vessels),
        "stationary_vessels": stationary,
        "moving_vessels": len(vessels) - stationary,
    }


@app.get("/fleet/types")
def get_fleet_types():
    """Retrieve counts, average speeds, dwell times, and queue shares per vessel type."""
    from metrics import get_fleet_types_summary
    return get_fleet_types_summary(DB_PATH)


@app.get("/ports/{port_id}/vessels")
def get_port_vessels(port_id: str, type: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve the latest vessel positions and movement states for a given port, optionally filtered by type."""
    if port_id not in PORTS:
        raise HTTPException(status_code=404, detail=f"Port '{port_id}' not found.")
    vessels = get_latest_vessels(port_id, DB_PATH)
    if type and type != "all":
        from metrics import classify_ship_type
        filtered = []
        for v in vessels:
            cat = classify_ship_type(v.get("ship_type", 70), v.get("length", 0), v.get("ship_name", ""))
            if cat == type.lower() or (type.lower() == "cargo" and cat in ("container", "bulk")):
                filtered.append(v)
        return filtered
    return vessels


@app.get("/ports/{port_id}/history")
def get_port_history(port_id: str) -> List[Dict[str, Any]]:
    """Retrieve hourly stationary vessel counts for the specified port."""
    if port_id not in PORTS:
        raise HTTPException(status_code=404, detail=f"Port '{port_id}' not found.")
    return get_hourly_stationary_history(port_id, DB_PATH)


@app.get("/ports/{port_id}/weather")
def get_port_weather(port_id: str) -> Dict[str, Any]:
    """Retrieve weather & marine risk metrics for a port from Open-Meteo, cached in SQLite."""
    if port_id not in PORTS:
        raise HTTPException(status_code=404, detail=f"Port '{port_id}' not found.")

    p = PORTS[port_id]
    lat = p["lat"]
    lon = p["lon"]
    now = time.time()
    cache_ttl = 900.0  # 15 minutes

    # 1. Check SQLite cache
    ensure_weather_cache_table()
    try:
        with get_connection(DB_PATH) as conn:
            row = conn.execute(
                "SELECT data, updated_at FROM weather_cache WHERE port_id = ?",
                (port_id,),
            ).fetchone()
            if row and (now - row["updated_at"]) < cache_ttl:
                cached_data = json.loads(row["data"])
                # Refresh AIS live freshness badge
                cached_data["data_status"] = check_ais_status(port_id)
                return cached_data
    except Exception as e:
        logger.warning(f"Weather cache read failed: {e}")

    # 2. Query free Open-Meteo APIs (Forecast & Marine)
    wind_speed_kn = 14.5
    wind_dir = 240
    wave_height_m = 1.2
    swell_m = 0.8
    visibility_km = 12.0

    try:
        # Forecast API: wind speed (knots), wind direction, visibility
        forecast_url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
            f"&current=wind_speed_10m,wind_direction_10m,visibility,weather_code"
            f"&wind_speed_unit=kn"
        )
        req = urllib.request.Request(forecast_url, headers={"User-Agent": "GlobalMaritimePortMonitor/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            fc_json = json.loads(response.read().decode("utf-8"))
            cur = fc_json.get("current", {})
            wind_speed_kn = float(cur.get("wind_speed_10m", wind_speed_kn))
            wind_dir = int(cur.get("wind_direction_10m", wind_dir))
            raw_vis = cur.get("visibility")
            if raw_vis is not None:
                visibility_km = round(float(raw_vis) / 1000.0, 1)
    except Exception as e:
        logger.warning(f"Open-Meteo forecast fetch error for {port_id}: {e}")

    try:
        # Marine API: wave height & swell
        marine_url = (
            f"https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}"
            f"&current=wave_height,swell_wave_height"
        )
        req = urllib.request.Request(marine_url, headers={"User-Agent": "GlobalMaritimePortMonitor/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            mar_json = json.loads(response.read().decode("utf-8"))
            mcur = mar_json.get("current", {})
            wh = mcur.get("wave_height")
            if wh is not None:
                wave_height_m = round(float(wh), 2)
            sw = mcur.get("swell_wave_height")
            if sw is not None:
                swell_m = round(float(sw), 2)
    except Exception as e:
        logger.warning(f"Open-Meteo marine fetch error for {port_id}: {e}")

    # Determine storm risk tier
    if wave_height_m >= 3.2 or wind_speed_kn >= 30.0:
        storm_risk = "High"
        operational_impact = "Pilotage suspended; strict anchorage holding pattern in effect."
    elif wave_height_m >= 1.8 or wind_speed_kn >= 18.0:
        storm_risk = "Elevated"
        operational_impact = "Pilotage delays possible; increased tug escort for ULCVs."
    else:
        storm_risk = "Low"
        operational_impact = "Normal commercial navigation, berthing, and pilot operations active."

    data_status = check_ais_status(port_id)

    result = {
        "port_id": port_id,
        "port_name": p["name"],
        "wind_speed_knots": round(wind_speed_kn, 1),
        "wind_direction_deg": wind_dir,
        "wave_height_m": wave_height_m,
        "swell_height_m": swell_m,
        "visibility_km": visibility_km,
        "storm_risk": storm_risk,
        "operational_impact": operational_impact,
        "data_status": data_status,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }

    # Store in SQLite cache
    try:
        with get_connection(DB_PATH) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO weather_cache (port_id, data, updated_at) VALUES (?, ?, ?)",
                (port_id, json.dumps(result), now),
            )
            conn.commit()
    except Exception as e:
        logger.warning(f"Failed to write weather cache: {e}")

    return result


def check_ais_status(port_id: str) -> Dict[str, Any]:
    """Check whether AIS data for this port is LIVE, DEMO, or OFFLINE."""
    try:
        with get_connection(DB_PATH) as conn:
            row = conn.execute(
                "SELECT timestamp, is_demo FROM ais_records WHERE port_id = ? ORDER BY id DESC LIMIT 1",
                (port_id,),
            ).fetchone()
            if not row:
                row = conn.execute(
                    "SELECT timestamp, is_demo FROM ais_records ORDER BY id DESC LIMIT 1"
                ).fetchone()

            if not row:
                return {"badge": "DEMO DATA", "is_live": False, "is_demo": True}

            is_demo = bool(row["is_demo"])
            if is_demo:
                return {"badge": "DEMO DATA", "is_live": False, "is_demo": True}

            # Check timestamp freshness (under 10 minutes = 600 seconds)
            ts_str = row["timestamp"]
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            now_utc = datetime.now(timezone.utc)
            diff_sec = (now_utc - ts).total_seconds()
            if diff_sec <= 600:
                return {"badge": "LIVE", "is_live": True, "is_demo": False, "age_seconds": round(diff_sec)}
            else:
                return {"badge": "OFFLINE", "is_live": False, "is_demo": False, "age_seconds": round(diff_sec)}
    except Exception:
        return {"badge": "DEMO DATA", "is_live": False, "is_demo": True}


@app.get("/ports/{port_id}/globe-html", response_class=HTMLResponse)
def get_port_globe_html(port_id: str):
    """Retrieve full standalone 3D CesiumJS animated globe HTML with 3D vessel tracking."""
    if port_id not in PORTS and port_id != "all":
        raise HTTPException(status_code=404, detail=f"Port '{port_id}' not found.")
    p = PORTS.get(port_id, {"name": "Global Fleet", "lat": 25.0, "lon": 55.0})
    ci = get_congestion_index(port_id, DB_PATH) if port_id in PORTS else None
    tracks = get_vessel_tracks(port_id, db_path=DB_PATH)
    html_content = get_cesium_html(
        port_name=p["name"],
        center_lat=p["lat"],
        center_lon=p["lon"],
        vessels_with_tracks=tracks,
        congestion_index=ci,
    )
    return HTMLResponse(content=html_content)


WEB_DIR = Path(__file__).resolve().parent / "web"
TRACKS_JSON = WEB_DIR / "data" / "tracks.json"


@app.get("/data/tracks.json")
def get_tracks_json():
    """Serve exported vessel tracks for Cesium 3D viewer."""
    if not TRACKS_JSON.is_file():
        import export_tracks
        export_tracks.main()
    return FileResponse(TRACKS_JSON, media_type="application/json")


if WEB_DIR.is_dir():
    app.mount("/web", StaticFiles(directory=str(WEB_DIR), html=True), name="web")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
