"""Database schema and metrics computation for Global Maritime Port Monitor.

Provides SQLite initialization, vessel record insertion, latest vessel queries,
hourly stationary vessel aggregation, and the Congestion Index calculation.
"""

import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import statistics
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import DB_PATH, PORTS, STATIONARY_SPEED_KNOTS


def get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Obtain a SQLite database connection with row factory configured."""
    target_path = Path(db_path) if db_path else DB_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target_path), timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[Path] = None) -> None:
    """Initialize the ais_records table and supporting indices."""
    with get_connection(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ais_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mmsi INTEGER NOT NULL,
                ship_name TEXT,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                sog REAL NOT NULL,
                cog REAL,
                port_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                is_demo INTEGER DEFAULT 0
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_port_time ON ais_records (port_id, timestamp)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_port_mmsi ON ais_records (port_id, mmsi)")
        conn.commit()


def insert_ais_record(
    mmsi: int,
    ship_name: Optional[str],
    lat: float,
    lon: float,
    sog: float,
    cog: Optional[float],
    port_id: str,
    timestamp: str,
    is_demo: int = 0,
    db_path: Optional[Path] = None,
) -> None:
    """Insert a single vessel position record."""
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO ais_records (mmsi, ship_name, lat, lon, sog, cog, port_id, timestamp, is_demo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (mmsi, ship_name or f"VESSEL-{mmsi}", lat, lon, sog, cog, port_id, timestamp, is_demo),
        )
        conn.commit()


def insert_ais_records_batch(
    records: List[tuple],
    db_path: Optional[Path] = None,
) -> None:
    """Insert multiple vessel position records in a single fast transaction."""
    if not records:
        return
    with get_connection(db_path) as conn:
        conn.executemany(
            """
            INSERT INTO ais_records (mmsi, ship_name, lat, lon, sog, cog, port_id, timestamp, is_demo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            records,
        )
        conn.commit()


def get_latest_vessels(port_id: str, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Get latest position and stationary status for each vessel in a port.

    Returns empty list if no data exists.
    """
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            """
            WITH ranked AS (
                SELECT
                    mmsi,
                    ship_name,
                    lat,
                    lon,
                    sog,
                    cog,
                    timestamp,
                    is_demo,
                    ROW_NUMBER() OVER (PARTITION BY mmsi ORDER BY timestamp DESC, id DESC) AS rn
                FROM ais_records
                WHERE port_id = ?
            )
            SELECT mmsi, ship_name, lat, lon, sog, cog, timestamp, is_demo
            FROM ranked
            WHERE rn = 1
            ORDER BY sog ASC
            """,
            (port_id,),
        )
        rows = cursor.fetchall()

    vessels = []
    for r in rows:
        vessels.append({
            "mmsi": r["mmsi"],
            "ship_name": r["ship_name"] or f"VESSEL {r['mmsi']}",
            "lat": float(r["lat"]),
            "lon": float(r["lon"]),
            "sog": float(r["sog"]),
            "cog": float(r["cog"]) if r["cog"] is not None else 0.0,
            "stationary": bool(r["sog"] < STATIONARY_SPEED_KNOTS),
            "timestamp": r["timestamp"],
            "is_demo": bool(r["is_demo"]),
        })
    return vessels


def get_hourly_stationary_history(port_id: str, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Aggregate distinct stationary vessels (SOG < 0.5 kn) per hour.

    Returns a list of dicts: [{'hour': 'YYYY-MM-DD HH:00:00', 'stationary': int}]
    """
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            """
            SELECT
                strftime('%Y-%m-%d %H:00:00', timestamp) AS hour,
                COUNT(DISTINCT mmsi) AS stationary
            FROM ais_records
            WHERE port_id = ? AND sog < ?
            GROUP BY hour
            ORDER BY hour ASC
            """,
            (port_id, STATIONARY_SPEED_KNOTS),
        )
        rows = cursor.fetchall()

    return [{"hour": r["hour"], "stationary": int(r["stationary"])} for r in rows if r["hour"]]


def get_congestion_index(port_id: str, db_path: Optional[Path] = None) -> Optional[float]:
    """Compute congestion index for a port.

    congestion_index = stationary_count(latest hour) / median(stationary_count per hour)
    Returns None if there is not enough history or if median is 0.
    """
    history = get_hourly_stationary_history(port_id, db_path=db_path)
    if len(history) < 2:
        return None

    counts = [h["stationary"] for h in history]
    med = statistics.median(counts)
    if med <= 0:
        return None

    latest_count = history[-1]["stationary"]
    return round(latest_count / med, 2)


def get_all_ports_summary(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Get high-level statistics and congestion index for all defined ports."""
    init_db(db_path)
    summary = []
    for port_id, info in PORTS.items():
        vessels = get_latest_vessels(port_id, db_path=db_path)
        ci = get_congestion_index(port_id, db_path=db_path)
        stationary_count = sum(1 for v in vessels if v["stationary"])
        moving_count = len(vessels) - stationary_count

        status = "unknown"
        if ci is not None:
            if ci < 0.8:
                status = "normal"
            elif ci <= 1.2:
                status = "busy"
            else:
                status = "congested"

        summary.append({
            "id": port_id,
            "name": info["name"],
            "lat": info["lat"],
            "lon": info["lon"],
            "congestion_index": ci,
            "status": status,
            "total_vessels": len(vessels),
            "stationary_vessels": stationary_count,
            "moving_vessels": moving_count,
        })
    return summary
