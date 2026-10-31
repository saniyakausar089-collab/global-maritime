"""Sample data generation script for Global Maritime Port Monitor.

Fills ais.db with realistic synthetic vessel positions, headings, and short
tracks across all ports, clearly marked with is_demo=1 and 'DEMO' names.
Distributes ships between berth and anchorage zones for geofence validation.
"""

import math
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DB_PATH, PORTS, STATIONARY_SPEED_KNOTS
from metrics import init_db, insert_ais_records_batch, get_connection, upsert_vessel_static
from build_geofences import FALLBACK_ZONES

SHIP_TYPES = ["CONTAINER", "TANKER", "BULK CARRIER", "CARGO", "TUG", "CAR CARRIER"]


def random_point_in_polygon(poly_coords, rng):
    """Generate a random point within polygon bounding box."""
    lons = [pt[0] for pt in poly_coords]
    lats = [pt[1] for pt in poly_coords]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    # Blend towards center
    lon = min_lon + (max_lon - min_lon) * (0.2 + 0.6 * rng.random())
    lat = min_lat + (max_lat - min_lat) * (0.2 + 0.6 * rng.random())
    return lat, lon


def seed_demo_data(num_vessels_per_port: int = 30, history_hours: int = 48) -> None:
    """Populate SQLite database with realistic demo vessel records and smooth tracks."""
    init_db(DB_PATH)

    # Clean up existing demo records so runs are idempotent
    with get_connection(DB_PATH) as conn:
        conn.execute("DELETE FROM ais_records WHERE is_demo = 1")
        conn.commit()

    now = datetime.now(timezone.utc)
    total_records = 0

    print("=" * 65)
    print("[DEMO] Seeding ais.db with realistic DEMO AIS maritime data & tracks...")
    print("=" * 65)

    for port_id, p in PORTS.items():
        rng = random.Random(hash(port_id) & 0xFFFFFFFF)
        zones = FALLBACK_ZONES.get(port_id, {})
        berth_poly = zones.get("berth", [])
        anchorage_poly = zones.get("anchorage", [])

        vessels = []
        for i in range(num_vessels_per_port):
            mmsi = 999000000 + (hash(port_id) % 100000) * 100 + i
            ship_type = rng.choice(SHIP_TYPES)
            ship_name = f"DEMO {ship_type} {i + 1}"

            # ~45% at berth (working cargo), ~35% waiting at anchorage, ~20% moving/transit
            category_roll = rng.random()
            if category_roll < 0.45 and berth_poly:
                base_lat, base_lon = random_point_in_polygon(berth_poly, rng)
                zone_type = "berth"
                is_stationary = True
                base_sog = round(rng.uniform(0.0, 0.3), 1)
                heading = round(rng.uniform(0, 360), 1)
            elif category_roll < 0.80 and anchorage_poly:
                base_lat, base_lon = random_point_in_polygon(anchorage_poly, rng)
                zone_type = "anchorage"
                is_stationary = True
                base_sog = round(rng.uniform(0.0, 0.4), 1)
                heading = round(rng.uniform(0, 360), 1)
            else:
                (min_lat, min_lon), (max_lat, max_lon) = p["bbox"]
                base_lat = min_lat + (max_lat - min_lat) * (0.2 + 0.6 * rng.random())
                base_lon = min_lon + (max_lon - min_lon) * (0.2 + 0.6 * rng.random())
                zone_type = "port_boundary"
                is_stationary = False
                base_sog = round(rng.uniform(5.0, 16.0), 1)
                heading = round(rng.uniform(0, 360), 1)

            vessels.append({
                "mmsi": mmsi,
                "name": ship_name,
                "lat": base_lat,
                "lon": base_lon,
                "sog": base_sog,
                "heading": heading,
                "stationary": is_stationary,
                "zone_type": zone_type,
            })
            type_code = 70 if "CONTAINER" in ship_type else 80 if "TANKER" in ship_type else 75 if "BULK" in ship_type else 60
            upsert_vessel_static(
                mmsi=mmsi,
                ship_name=ship_name,
                ship_type=type_code,
                destination=f"{p['name'].upper()} TERMINAL",
                eta=(now + timedelta(hours=rng.randint(2, 48))).strftime("%m-%d %H:%M"),
                length=366.0 if "CONTAINER" in ship_type else 275.0 if "TANKER" in ship_type else 225.0,
                width=51.0 if "CONTAINER" in ship_type else 44.0 if "TANKER" in ship_type else 32.0,
                db_path=DB_PATH,
            )

        batch_records = []
        # Generate 48 hours of smooth historical track points for animation
        for h in range(history_hours, -1, -1):
            ts = (now - timedelta(hours=h)).strftime("%Y-%m-%d %H:00:00")
            for v in vessels:
                if v["stationary"]:
                    # Stationary ships swing slightly at anchor/berth
                    curr_lat = v["lat"] + (rng.random() - 0.5) * 0.0008
                    curr_lon = v["lon"] + (rng.random() - 0.5) * 0.0008
                    curr_sog = round(rng.uniform(0.0, 0.3), 1)
                    curr_cog = round((v["heading"] + rng.uniform(-5, 5)) % 360, 1)
                    curr_heading = curr_cog
                else:
                    # Moving vessels progress steadily along heading
                    hours_elapsed = (history_hours - h)
                    rad = math.radians(v["heading"])
                    # Speed kn * elapsed hours * degrees per nm
                    dist_deg = (v["sog"] * 0.0002) * (hours_elapsed % 12 - 6)
                    curr_lat = v["lat"] + dist_deg * math.cos(rad)
                    curr_lon = v["lon"] + dist_deg * math.sin(rad)
                    curr_sog = round(v["sog"] + rng.uniform(-1, 1), 1)
                    curr_cog = v["heading"]
                    curr_heading = v["heading"]

                batch_records.append((
                    v["mmsi"],
                    v["name"],
                    curr_lat,
                    curr_lon,
                    curr_sog,
                    curr_cog,
                    curr_heading,
                    port_id,
                    v["zone_type"],
                    ts,
                    1,
                ))

        insert_ais_records_batch(batch_records, db_path=DB_PATH)
        port_records = len(batch_records)
        total_records += port_records

        stationary_count = sum(1 for v in vessels if v["stationary"])
        berth_count = sum(1 for v in vessels if v["zone_type"] == "berth")
        anchorage_count = sum(1 for v in vessels if v["zone_type"] == "anchorage")
        print(f"  * {p['name']:12}: {len(vessels)} ships ({berth_count} berth, {anchorage_count} waiting anchorage) | {port_records} pings")

    print("=" * 65)
    print(f"Successfully seeded {total_records} demo records with tracks into {DB_PATH.name}!")
    print("=" * 65)


if __name__ == "__main__":
    seed_demo_data()
