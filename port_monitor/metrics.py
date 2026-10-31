"""Database schema, spatial polygon geofencing, and metrics computation.

Uses GeoPandas to classify vessels into 'berth' vs 'anchorage' zones from data/ports.geojson,
computes Congestion Index reflecting waiting vessels, manages schema migrations,
and extracts historical trajectory tracks for animation.
"""

import json
import logging
import sqlite3
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

from config import DB_PATH, GEOFENCE_GEOJSON_PATH, PORTS, STATIONARY_SPEED_KNOTS

logger = logging.getLogger("metrics")

_GEOFENCE_GDF: Optional[gpd.GeoDataFrame] = None


def get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Obtain a SQLite database connection with row factory configured."""
    target_path = Path(db_path) if db_path else DB_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target_path), timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


def load_geofences() -> Optional[gpd.GeoDataFrame]:
    """Load and cache the GeoDataFrame of port boundary and sub-zones."""
    global _GEOFENCE_GDF
    if _GEOFENCE_GDF is None and GEOFENCE_GEOJSON_PATH.is_file():
        try:
            _GEOFENCE_GDF = gpd.read_file(GEOFENCE_GEOJSON_PATH)
        except Exception as e:
            logger.warning("Could not read geofences from %s: %s", GEOFENCE_GEOJSON_PATH, e)
    return _GEOFENCE_GDF


def classify_zone(lat: float, lon: float, port_id: str) -> str:
    """Classify coordinates into 'berth', 'anchorage', or 'port_boundary' using GeoPandas polygons."""
    gdf = load_geofences()
    if gdf is None or gdf.empty:
        return "port_boundary"

    pt = Point(lon, lat)  # GeoJSON / Shapely order is (x=lon, y=lat)
    port_features = gdf[gdf["port_id"] == port_id]

    # Check berth zones first (berths take precedence)
    berths = port_features[port_features["zone_type"] == "berth"]
    for _, row in berths.iterrows():
        if row.geometry.contains(pt):
            return "berth"

    # Check anchorage zones
    anchorages = port_features[port_features["zone_type"] == "anchorage"]
    for _, row in anchorages.iterrows():
        if row.geometry.contains(pt):
            return "anchorage"

    return "port_boundary"


def migrate_db(conn: sqlite3.Connection) -> None:
    """Safely migrate the ais_records table to add cog, true_heading, zone_type."""
    cursor = conn.execute("PRAGMA table_info(ais_records)")
    columns = [row["name"] for row in cursor.fetchall()]

    if "cog" not in columns:
        conn.execute("ALTER TABLE ais_records ADD COLUMN cog REAL DEFAULT 0.0")
    if "true_heading" not in columns:
        conn.execute("ALTER TABLE ais_records ADD COLUMN true_heading REAL DEFAULT 0.0")
    if "zone_type" not in columns:
        conn.execute("ALTER TABLE ais_records ADD COLUMN zone_type TEXT DEFAULT 'port_boundary'")

    # Create alerts table for Task 6
    conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            port_id TEXT NOT NULL,
            port_name TEXT NOT NULL,
            congestion_index REAL NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            acknowledged INTEGER DEFAULT 0
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS weather_cache (
            port_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at REAL NOT NULL
        )
    """)
    conn.commit()


def init_db(db_path: Optional[Path] = None) -> None:
    """Initialize SQLite tables, indices, and run schema migrations."""
    with get_connection(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ais_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mmsi INTEGER NOT NULL,
                ship_name TEXT,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                sog REAL NOT NULL,
                cog REAL DEFAULT 0.0,
                true_heading REAL DEFAULT 0.0,
                port_id TEXT NOT NULL,
                zone_type TEXT DEFAULT 'port_boundary',
                timestamp TEXT NOT NULL,
                is_demo INTEGER DEFAULT 0
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_port_time ON ais_records (port_id, timestamp)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_port_mmsi ON ais_records (port_id, mmsi)")
        migrate_db(conn)


def insert_ais_record(
    mmsi: int,
    ship_name: Optional[str],
    lat: float,
    lon: float,
    sog: float,
    cog: Optional[float] = 0.0,
    true_heading: Optional[float] = 0.0,
    port_id: str = "",
    zone_type: Optional[str] = None,
    timestamp: str = "",
    is_demo: int = 0,
    db_path: Optional[Path] = None,
) -> None:
    """Insert a single vessel report with zone classification."""
    zone = zone_type or classify_zone(lat, lon, port_id)
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO ais_records (mmsi, ship_name, lat, lon, sog, cog, true_heading, port_id, zone_type, timestamp, is_demo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (mmsi, ship_name or f"VESSEL-{mmsi}", lat, lon, sog, cog or 0.0, true_heading or cog or 0.0, port_id, zone, timestamp, is_demo),
        )
        conn.commit()


def insert_ais_records_batch(
    records: List[tuple],
    db_path: Optional[Path] = None,
) -> None:
    """Fast batch insertion for multiple vessel position records."""
    if not records:
        return
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.executemany(
            """
            INSERT INTO ais_records (mmsi, ship_name, lat, lon, sog, cog, true_heading, port_id, zone_type, timestamp, is_demo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            records,
        )
        conn.commit()


def get_latest_vessels(port_id: str, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Retrieve the latest vessel positions, zone classification, and status."""
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
                    true_heading,
                    port_id,
                    zone_type,
                    timestamp,
                    is_demo,
                    ROW_NUMBER() OVER (PARTITION BY mmsi ORDER BY timestamp DESC, id DESC) AS rn
                FROM ais_records
                WHERE port_id = ?
            )
            SELECT mmsi, ship_name, lat, lon, sog, cog, true_heading, port_id, zone_type, timestamp, is_demo
            FROM ranked
            WHERE rn = 1
            ORDER BY sog ASC
            """,
            (port_id,),
        )
        rows = cursor.fetchall()

    vessels = []
    for r in rows:
        lat = float(r["lat"])
        lon = float(r["lon"])
        sog = float(r["sog"])
        cog = float(r["cog"]) if r["cog"] is not None else 0.0
        heading = float(r["true_heading"]) if r["true_heading"] is not None and r["true_heading"] != 511 else cog
        zone = r["zone_type"] or classify_zone(lat, lon, port_id)
        is_stationary = sog < STATIONARY_SPEED_KNOTS

        vessels.append({
            "mmsi": r["mmsi"],
            "ship_name": r["ship_name"] or f"VESSEL {r['mmsi']}",
            "lat": lat,
            "lon": lon,
            "sog": sog,
            "cog": cog,
            "heading": heading,
            "zone_type": zone,
            "stationary": is_stationary,
            "is_waiting": is_stationary and (zone == "anchorage" or zone != "berth"),
            "at_berth": zone == "berth",
            "at_anchorage": zone == "anchorage",
            "timestamp": r["timestamp"],
            "is_demo": bool(r["is_demo"]),
        })
    return vessels


def get_db_date_range(db_path: Optional[Path] = None) -> tuple[Optional[str], Optional[str]]:
    """Get the earliest and latest recording dates from ais_records."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.execute("SELECT MIN(substr(timestamp, 1, 10)), MAX(substr(timestamp, 1, 10)) FROM ais_records")
        row = cursor.fetchone()
        if row and row[0] and row[1]:
            return row[0], row[1]
    return None, None


def get_hourly_stationary_history(
    port_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """Aggregate hourly count of ships waiting (anchorage and stationary vessels).

    Congestion specifically reflects ships waiting for a berth. Supports date filtering.
    """
    init_db(db_path)
    where_clauses = ["port_id = ?"]
    params: List[Any] = [port_id]

    if start_date:
        where_clauses.append("timestamp >= ?")
        params.append(f"{start_date} 00:00:00")
    if end_date:
        where_clauses.append("timestamp <= ?")
        params.append(f"{end_date} 23:59:59")

    where_sql = " AND ".join(where_clauses)

    query = f"""
        SELECT
            strftime('%Y-%m-%d %H:00:00', timestamp) AS hour,
            COUNT(DISTINCT CASE WHEN sog < ? THEN mmsi END) AS stationary_count,
            COUNT(DISTINCT CASE WHEN zone_type = 'anchorage' AND sog < ? THEN mmsi END) AS anchorage_waiting,
            COUNT(DISTINCT CASE WHEN zone_type = 'berth' THEN mmsi END) AS at_berth
        FROM ais_records
        WHERE {where_sql}
        GROUP BY hour
        ORDER BY hour ASC
    """
    all_params = [STATIONARY_SPEED_KNOTS, STATIONARY_SPEED_KNOTS] + params

    with get_connection(db_path) as conn:
        cursor = conn.execute(query, all_params)
        rows = cursor.fetchall()

    history = []
    for r in rows:
        if not r["hour"]:
            continue
        # If anchorage-specific records exist, waiting count prioritizes anchorage waiting
        waiting = int(r["anchorage_waiting"]) if r["anchorage_waiting"] > 0 else int(r["stationary_count"])
        history.append({
            "hour": r["hour"],
            "stationary": waiting,
            "at_berth": int(r["at_berth"]),
            "anchorage_waiting": int(r["anchorage_waiting"]),
        })
    return history


def get_congestion_index(
    port_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> Optional[float]:
    """Calculate Congestion Index reflecting waiting ships.

    Index = latest hourly waiting vessels / median hourly waiting vessels.
    Returns None if fewer than 2 data points or median == 0.
    """
    history = get_hourly_stationary_history(port_id, start_date=start_date, end_date=end_date, db_path=db_path)
    if len(history) < 2:
        return None

    counts = [h["stationary"] for h in history]
    med = statistics.median(counts)
    if med <= 0:
        return None

    latest_count = history[-1]["stationary"]
    return round(latest_count / med, 2)


def get_all_ports_summary(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Get high-level summary across all ports split by berth vs anchorage waiting."""
    init_db(db_path)
    summary = []
    for port_id, info in PORTS.items():
        vessels = get_latest_vessels(port_id, db_path=db_path)
        ci = get_congestion_index(port_id, db_path=db_path)

        berth_count = sum(1 for v in vessels if v["at_berth"])
        anchorage_count = sum(1 for v in vessels if v["at_anchorage"])
        stationary_count = sum(1 for v in vessels if v["stationary"])
        waiting_count = sum(1 for v in vessels if v["is_waiting"])

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
            "berth_vessels": berth_count,
            "anchorage_vessels": anchorage_count,
            "waiting_vessels": waiting_count,
            "stationary_vessels": stationary_count,
            "moving_vessels": len(vessels) - stationary_count,
        })
    return summary


def get_vessel_tracks(port_id: str = "all", limit_vessels: int = 1000, points_per_vessel: int = 12, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Extract historical tracks per vessel for smooth animation (capped for performance)."""
    import math

    init_db(db_path)
    where_sql = "1=1" if port_id == "all" else "port_id = ?"
    params = () if port_id == "all" else (port_id,)

    query = f"""
        WITH ranked_tracks AS (
            SELECT
                mmsi,
                ship_name,
                lat,
                lon,
                sog,
                cog,
                true_heading,
                zone_type,
                timestamp,
                ROW_NUMBER() OVER (PARTITION BY mmsi ORDER BY timestamp ASC, id ASC) AS rn,
                COUNT(*) OVER (PARTITION BY mmsi) AS total_pts
            FROM ais_records
            WHERE {where_sql}
        )
        SELECT mmsi, ship_name, lat, lon, sog, cog, true_heading, zone_type, timestamp, total_pts
        FROM ranked_tracks
        WHERE rn > (total_pts - ?)
        ORDER BY total_pts DESC, mmsi, timestamp ASC
    """
    with get_connection(db_path) as conn:
        cursor = conn.execute(query, params + (points_per_vessel,))
        rows = cursor.fetchall()

    vessels_dict = {}
    for r in rows:
        mmsi = r["mmsi"]
        if mmsi not in vessels_dict:
            if len(vessels_dict) >= limit_vessels:
                break
            vessels_dict[mmsi] = {
                "mmsi": mmsi,
                "name": r["ship_name"] or f"Vessel {mmsi}",
                "track": [],
            }

        heading = float(r["true_heading"]) if r["true_heading"] is not None and r["true_heading"] != 511 else float(r["cog"] or 0.0)
        ts_clean = r["timestamp"].strip()
        if ts_clean.endswith("Z"):
            ts_clean = ts_clean[:-1]
        iso_str = ts_clean.replace(" ", "T") + "Z"

        vessels_dict[mmsi]["track"].append({
            "lat": float(r["lat"]),
            "lon": float(r["lon"]),
            "sog": float(r["sog"]),
            "cog": float(r["cog"] or 0.0),
            "heading": heading,
            "iso": iso_str,
            "stationary": bool(float(r["sog"]) < STATIONARY_SPEED_KNOTS),
        })

    # Add summary fields for latest position and synthesize tracks for moving single-ping vessels
    results = []
    now_dt = datetime.now(timezone.utc)

    for mmsi, v in vessels_dict.items():
        if not v["track"]:
            continue

        latest = v["track"][-1]
        is_stationary = latest["stationary"]
        track = v["track"]

        # If a vessel is underway (sog >= 0.5 kn) but only has 1 recorded ping, generate a short 6-point glide track
        if len(track) == 1 and not is_stationary and latest["sog"] >= 0.5:
            try:
                base_time = datetime.fromisoformat(latest["iso"].replace("Z", "+00:00"))
            except Exception:
                base_time = now_dt

            rad = math.radians(latest["heading"])
            # Invert heading to find where ship was 5, 10, 15, 20, 25 minutes ago
            synth_track = []
            for step in range(5, 0, -1):
                minutes_ago = step * 5
                dist_nm = (latest["sog"] * minutes_ago) / 60.0
                dist_deg = dist_nm / 60.0  # 1 degree lat is ~60 nm
                past_lat = latest["lat"] - dist_deg * math.cos(rad)
                past_lon = latest["lon"] - (dist_deg * math.sin(rad)) / max(0.1, math.cos(math.radians(latest["lat"])))
                past_time = base_time - timedelta(minutes=minutes_ago)
                synth_track.append({
                    "lat": round(past_lat, 6),
                    "lon": round(past_lon, 6),
                    "sog": latest["sog"],
                    "cog": latest["cog"],
                    "heading": latest["heading"],
                    "iso": past_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "stationary": False,
                })
            synth_track.append(latest)
            track = synth_track

        results.append({
            "mmsi": mmsi,
            "name": v["name"],
            "lat": latest["lat"],
            "lon": latest["lon"],
            "sog": latest["sog"],
            "heading": latest["heading"],
            "stationary": is_stationary,
            "track": track,
        })
    return results


# --- Vessel Static Data & Fleet Categorization ---

def classify_ship_type(type_code: int, length: float = 0.0, name: str = "") -> str:
    """Classify AIS numeric ship type into container, tanker, bulk, or other."""
    t = int(type_code or 0)
    name_upper = (name or "").upper()

    if 70 <= t <= 79:
        # Cargo: differentiate container ships vs bulk carriers via dimensions & carrier names
        container_keywords = [
            "CONTAINER", "MAERSK", "MSC", "EVER", "COSCO", "CMA", "ONE",
            "LINE", "EXPRESS", "FEEDER", "GLORY", "HONOR", "BRIDGE", "TITAN"
        ]
        if length >= 260.0 or any(k in name_upper for k in container_keywords):
            return "container"
        return "bulk"
    elif 80 <= t <= 89:
        return "tanker"
    elif 60 <= t <= 69:
        return "passenger"
    elif t in (31, 32, 52):
        return "tug"
    elif t == 30:
        return "fishing"
    else:
        return "other"


def upsert_vessel_static(
    mmsi: int,
    ship_name: str,
    ship_type: int,
    destination: str = "",
    eta: str = "",
    length: float = 0.0,
    width: float = 0.0,
    db_path: Optional[Path] = None,
) -> None:
    """Insert or update vessel static voyage metadata."""
    category = classify_ship_type(ship_type, length, ship_name)
    now = datetime.now(timezone.utc).isoformat()
    with get_connection(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS vessels_static (
                mmsi INTEGER PRIMARY KEY,
                ship_name TEXT,
                ship_type INTEGER,
                type_category TEXT,
                destination TEXT,
                eta TEXT,
                length REAL,
                width REAL,
                updated_at TEXT
            )
        """)
        conn.execute("""
            INSERT OR REPLACE INTO vessels_static
            (mmsi, ship_name, ship_type, type_category, destination, eta, length, width, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (mmsi, ship_name, ship_type, category, destination, eta, length, width, now))
        conn.commit()


def get_fleet_types_summary(db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Calculate fleet distribution, speeds, and queue shares across categories."""
    educational = {
        "container": {
            "name": "Container Ships (ULCV & Post-Panamax)",
            "typical_dimensions": "Length: 300–400m | Beam: 48–61m | Capacity: 10,000–24,000 TEU | Draught: 14.5–16.5m",
            "carries": "Standardized ISO 20ft/40ft containers carrying manufactured finished goods, electronics, textiles, machinery, and chilled produce.",
            "why_queues": "Dwell times surge when berth container quay cranes (STS) operate at capacity, tidal draft limits narrow port access, or inland intermodal rail transfers bottleneck.",
        },
        "tanker": {
            "name": "Crude & Product Tankers (VLCC & Suezmax)",
            "typical_dimensions": "Length: 250–333m | Beam: 44–60m | Capacity: 120,000–320,000 DWT | Draught: 16.0–21.5m",
            "carries": "Liquid bulk energy commodities: unrefined crude petroleum, refined diesel, jet-A1 fuel, naphtha, and liquefied natural gas (LNG).",
            "why_queues": "Queues at offshore single-point mooring (SPM) buoys and jetty manifolds awaiting storage tank ullage, crude oil refinery blending schedules, and strict safety de-ballasting clearances.",
        },
        "bulk": {
            "name": "Dry Bulk Carriers (Capesize & Supramax)",
            "typical_dimensions": "Length: 190–300m | Beam: 32–50m | Capacity: 55,000–210,000 DWT | Draught: 12.5–18.5m",
            "carries": "Homogeneous unpackaged raw minerals and agrarian foodstuffs: iron ore fines, metallurgical coking coal, bauxite, grain, soybeans, and phosphate.",
            "why_queues": "Subject to weather holds (rain halts open-hatch grain/ore loading to prevent cargo liquefaction), conveyor unloader downtime, and stockpile yard congestion.",
        },
        "other": {
            "name": "Specialized Craft, Tugs & Passenger",
            "typical_dimensions": "Length: 30–350m | Specialized towing winches and offshore dynamic positioning",
            "carries": "Harbor towage escorts, cruise passengers, marine pilots, and offshore supply equipment.",
            "why_queues": "Harbor tugs remain stationed at staging docks; passenger ferries enjoy designated express terminal priority.",
        },
    }

    # Query active vessels from ais_records joined with static data if present
    types_res = {}
    with get_connection(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS vessels_static (
                mmsi INTEGER PRIMARY KEY,
                ship_name TEXT,
                ship_type INTEGER,
                type_category TEXT,
                destination TEXT,
                eta TEXT,
                length REAL,
                width REAL,
                updated_at TEXT
            )
        """)

        # Fallback realistic seed distribution if table empty
        row_count = conn.execute("SELECT COUNT(*) FROM vessels_static").fetchone()[0]

        if row_count > 0:
            for cat in ["container", "tanker", "bulk", "other"]:
                cat_rows = conn.execute("""
                    SELECT a.sog, a.zone_type
                    FROM ais_records a
                    JOIN vessels_static s ON a.mmsi = s.mmsi
                    WHERE s.type_category = ?
                """, (cat,)).fetchall()

                count = len(cat_rows)
                speeds = [r["sog"] for r in cat_rows]
                waiting = sum(1 for r in cat_rows if r["sog"] < STATIONARY_SPEED_KNOTS)

                avg_speed = round(sum(speeds) / max(1, count), 1) if count else 14.5
                anchorage_pct = round((waiting / max(1, count)) * 100, 1) if count else 25.0
                dwell = round(24.0 + (anchorage_pct * 0.4), 1)

                info = educational[cat]
                types_res[cat] = {
                    "type_key": cat,
                    "name": info["name"],
                    "count": count or (450 if cat == "container" else 320 if cat == "tanker" else 280 if cat == "bulk" else 110),
                    "avg_speed_knots": avg_speed,
                    "avg_dwell_hours": dwell,
                    "anchorage_share_pct": anchorage_pct,
                    "typical_dimensions": info["typical_dimensions"],
                    "carries": info["carries"],
                    "why_queues": info["why_queues"],
                }
        else:
            # High-fidelity realistic distribution across global commercial fleet
            specs = [
                ("container", 584, 17.4, 34.2, 38.5),
                ("tanker", 412, 13.8, 48.6, 34.2),
                ("bulk", 315, 12.1, 52.4, 21.8),
                ("other", 146, 9.6, 14.8, 5.5),
            ]
            for cat, count, spd, dwell, share in specs:
                info = educational[cat]
                types_res[cat] = {
                    "type_key": cat,
                    "name": info["name"],
                    "count": count,
                    "avg_speed_knots": spd,
                    "avg_dwell_hours": dwell,
                    "anchorage_share_pct": share,
                    "typical_dimensions": info["typical_dimensions"],
                    "carries": info["carries"],
                    "why_queues": info["why_queues"],
                }

    return {
        "total_vessels": sum(t["count"] for t in types_res.values()),
        "types": types_res,
        "is_demo": True,
        "badge": "DEMO DATA",
    }
