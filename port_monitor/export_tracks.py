"""Export vessel tracks from ais.db to web/data/tracks.json for the 3D viewer.

Run:  py export_tracks.py
Then serve the viewer:  py -m http.server 8000 --directory web
Open: http://localhost:8000
"""

import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict

import pandas as pd

# Path resolution for standalone execution from any directory
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
sys.path.insert(0, str(BASE_DIR))

try:
    from config import CESIUM_ION_TOKEN, DB_PATH as CONFIG_DB_PATH, PORTS as CONFIG_PORTS
    import metrics
except ImportError:
    CONFIG_DB_PATH = BASE_DIR / "ais.db"
    CESIUM_ION_TOKEN = os.getenv("CESIUM_ION_TOKEN", "")
    CONFIG_PORTS = {
        "rotterdam": {"name": "Rotterdam", "lat": 51.95, "lon": 4.10},
        "singapore": {"name": "Singapore", "lat": 1.25, "lon": 103.85},
        "shanghai": {"name": "Shanghai", "lat": 31.00, "lon": 122.00},
        "los_angeles": {"name": "Los Angeles", "lat": 33.72, "lon": -118.25},
    }
    metrics = None

DB_PATH = CONFIG_DB_PATH if CONFIG_DB_PATH.is_file() else (PROJECT_ROOT / "ais.db" if (PROJECT_ROOT / "ais.db").is_file() else BASE_DIR / "ais.db")
OUT = BASE_DIR / "web" / "data" / "tracks.json"
ROOT_OUT = PROJECT_ROOT / "web" / "data" / "tracks.json"
HOURS = 24            # how much history to replay
MAX_POINTS = 60       # points kept per vessel track
STATIONARY_SOG = 0.5

# Port centers definition
PORTS = {
    pid: (info["name"], info["lat"], info["lon"])
    for pid, info in CONFIG_PORTS.items()
}


def load_positions() -> pd.DataFrame:
    """Load positions from SQLite, handling both ais_records and positions tables."""
    if not DB_PATH.is_file():
        return pd.DataFrame()

    con = sqlite3.connect(str(DB_PATH))
    cursor = con.cursor()

    # Determine table name
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ais_records', 'positions')")
    tables = [r[0] for r in cursor.fetchall()]

    if "ais_records" in tables:
        table_name = "ais_records"
        ts_col = "timestamp"
    elif "positions" in tables:
        table_name = "positions"
        ts_col = "ts"
    else:
        con.close()
        return pd.DataFrame()

    df = pd.read_sql(f"SELECT * FROM {table_name}", con)
    con.close()

    if df.empty:
        return df

    # Normalize timestamp column to 'ts'
    if ts_col in df.columns:
        df["ts"] = df[ts_col]

    df["ts"] = pd.to_datetime(
        df["ts"].astype(str).str.replace(" +0000 UTC", "", regex=False).str.replace("Z", "", regex=False),
        errors="coerce",
        utc=True,
    )
    df = df.dropna(subset=["ts"])

    # Heading: prefer true_heading, fall back to course over ground (cog)
    heading = df["true_heading"] if "true_heading" in df.columns else pd.Series(511, index=df.index)
    cog = df["cog"] if "cog" in df.columns else pd.Series(0, index=df.index)
    df["heading"] = heading.where((heading < 360) & (heading >= 0) & (heading != 511), cog).fillna(0)

    if "sog" not in df.columns:
        df["sog"] = 0.0

    return df


def port_indices() -> Dict[str, Any]:
    """Calculate congestion index per port via metrics module if available."""
    if metrics is not None:
        try:
            return {pid: metrics.get_congestion_index(pid, db_path=DB_PATH) for pid in PORTS}
        except Exception as err:
            print("Notice: Congestion index computation via metrics:", err)
    return {pid: None for pid in PORTS}


def sync_config_local_js():
    """Ensure web/config.local.js is populated with the real CESIUM_ION_TOKEN from .env."""
    token = CESIUM_ION_TOKEN or os.getenv("CESIUM_ION_TOKEN", "").strip()
    js_content = f"""// Auto-configured from .env (git-ignored)
window.APP_CONFIG = {{
  CESIUM_ION_TOKEN: "{token}",
  DATA_URL: "data/tracks.json",
  MAX_VESSELS: 1000
}};
"""
    for target in [BASE_DIR / "web" / "config.local.js", PROJECT_ROOT / "web" / "config.local.js"]:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(js_content, encoding="utf-8")


def main():
    sync_config_local_js()
    df = load_positions()
    if df.empty:
        raise SystemExit("No data in ais.db yet. Run ingest.py or seed_demo.py first.")

    end = df["ts"].max()
    start = end - pd.Timedelta(hours=HOURS)
    df = df[df["ts"] >= start].sort_values("ts")

    vessels = []
    for mmsi, g in df.groupby("mmsi"):
        g = g.drop_duplicates("ts").tail(MAX_POINTS)
        if len(g) < 2:
            # If moving, keep single-point vessels as well
            if g.iloc[-1]["sog"] < STATIONARY_SOG:
                continue
        last = g.iloc[-1]
        vessels.append({
            "mmsi": int(mmsi),
            "name": str(last.get("ship_name", "") or f"Vessel {mmsi}"),
            "sog": round(float(last["sog"]), 1),
            "heading": round(float(last["heading"])),
            "stationary": bool(last["sog"] < STATIONARY_SOG),
            "track": [
                [t.strftime("%Y-%m-%dT%H:%M:%SZ"), float(lo), float(la)]
                for t, lo, la in zip(g["ts"], g["lon"], g["lat"])
            ],
        })

    idx = port_indices()
    ports = [
        {"id": pid, "name": n, "lat": la, "lon": lo, "index": idx.get(pid)}
        for pid, (n, la, lo) in PORTS.items()
    ]

    payload = json.dumps({
        "start": df["ts"].min().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ports": ports,
        "vessels": vessels,
    }, indent=2)

    for out_path in [OUT, ROOT_OUT]:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(payload, encoding="utf-8")
        print(f"Wrote {len(vessels)} vessels to {out_path}")


if __name__ == "__main__":
    main()
