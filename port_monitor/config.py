"""Configuration module for Global Maritime Port Monitor.

Loads environment variables from .env files, defines monitored ports with
geographic bounding boxes, database location, and maritime thresholds.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Search and load .env from current directory, module directory, or parent directory
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

dotenv_paths = [
    BASE_DIR / ".env",
    PROJECT_ROOT / ".env",
    Path(".env"),
]
for p in dotenv_paths:
    if p.is_file():
        load_dotenv(dotenv_path=p, override=True)
        break

# API Keys and External IDs (Never hardcode or print these)
AISSTREAM_API_KEY = os.getenv("AISSTREAM_API_KEY", "").strip()
CESIUM_ION_TOKEN = os.getenv("CESIUM_ION_TOKEN", "").strip()
EE_PROJECT = os.getenv("EE_PROJECT", "").strip()

# SQLite Database Path (Unified so scripts in any directory use the same file)
DB_PATH = BASE_DIR / "ais.db"

# Threshold for marking a ship stationary (typically anchored or moored) in knots
STATIONARY_SPEED_KNOTS = 0.5

# Monitored Ports Definition
# Each port defines center coords and bounding box: [[min_lat, min_lon], [max_lat, max_lon]]
PORTS = {
    "rotterdam": {
        "id": "rotterdam",
        "name": "Rotterdam",
        "lat": 51.92,
        "lon": 4.17,
        "bbox": [[51.80, 3.80], [52.10, 4.60]],
    },
    "singapore": {
        "id": "singapore",
        "name": "Singapore",
        "lat": 1.26,
        "lon": 103.84,
        "bbox": [[1.15, 103.60], [1.45, 104.10]],
    },
    "shanghai": {
        "id": "shanghai",
        "name": "Shanghai",
        "lat": 31.23,
        "lon": 121.80,
        "bbox": [[30.50, 121.30], [31.80, 122.50]],
    },
    "los-angeles": {
        "id": "los-angeles",
        "name": "Los Angeles",
        "lat": 33.73,
        "lon": -118.26,
        "bbox": [[33.60, -118.40], [33.85, -118.10]],
    },
    "hamburg": {
        "id": "hamburg",
        "name": "Hamburg",
        "lat": 53.54,
        "lon": 9.97,
        "bbox": [[53.40, 9.70], [53.65, 10.15]],
    },
    "santos": {
        "id": "santos",
        "name": "Santos",
        "lat": -23.98,
        "lon": -46.30,
        "bbox": [[-24.10, -46.45], [-23.85, -46.20]],
    },
}

def get_port_for_coords(lat: float, lon: float) -> str | None:
    """Determine which port bounding box contains the given coordinates."""
    for port_id, p in PORTS.items():
        (min_lat, min_lon), (max_lat, max_lon) = p["bbox"]
        if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
            return port_id
    return None

def get_aisstream_bounding_boxes() -> list:
    """Format bounding boxes for the AISStream WebSocket subscription filter.
    
    AISStream requires North-West [max_lat, min_lon] to South-East [min_lat, max_lon].
    """
    boxes = []
    for p in PORTS.values():
        (min_lat, min_lon), (max_lat, max_lon) = p["bbox"]
        boxes.append([[max_lat, min_lon], [min_lat, max_lon]])
    return boxes
