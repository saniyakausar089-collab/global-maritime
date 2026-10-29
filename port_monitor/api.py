"""FastAPI REST API for Global Maritime Port Monitor.

Provides endpoints for port summaries, vessel details, and historical
congestion trends, matching both frontend UI needs and external data consumers.
"""

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import PORTS, DB_PATH
from cesium_view import get_cesium_html
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from metrics import (
    init_db,
    get_all_ports_summary,
    get_latest_vessels,
    get_hourly_stationary_history,
    get_congestion_index,
    get_vessel_tracks,
)

app = FastAPI(
    title="Global Maritime Port Monitor API",
    description="REST API for maritime port congestion indices and AIS vessel tracking",
    version="1.0.0",
)

# Enable CORS for local dashboards and frontend portals
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    """Ensure database tables exist on server startup."""
    init_db(DB_PATH)


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


@app.get("/ports/{port_id}/vessels")
def get_port_vessels(port_id: str) -> List[Dict[str, Any]]:
    """Retrieve the latest vessel positions and movement states for a given port."""
    if port_id not in PORTS:
        raise HTTPException(status_code=404, detail=f"Port '{port_id}' not found.")
    return get_latest_vessels(port_id, DB_PATH)


@app.get("/ports/{port_id}/history")
def get_port_history(port_id: str) -> List[Dict[str, Any]]:
    """Retrieve hourly stationary vessel counts for the specified port."""
    if port_id not in PORTS:
        raise HTTPException(status_code=404, detail=f"Port '{port_id}' not found.")
    return get_hourly_stationary_history(port_id, DB_PATH)


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
