"""Sample data generation script for Global Maritime Port Monitor.

Fills ais.db with realistic synthetic vessel positions and 48-hour history
around all four ports, clearly marked with is_demo=1 and 'DEMO' names.
"""

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DB_PATH, PORTS, STATIONARY_SPEED_KNOTS
from metrics import init_db, insert_ais_records_batch, get_connection


SHIP_TYPES = ["CONTAINER", "TANKER", "BULK CARRIER", "CARGO", "TUG", "CAR CARRIER"]


def seed_demo_data(num_vessels_per_port: int = 25, history_hours: int = 48) -> None:
    """Populate SQLite database with realistic demo vessel records."""
    init_db(DB_PATH)

    # Optional: clean up existing demo records so we don't accumulate duplicates on multiple runs
    with get_connection(DB_PATH) as conn:
        conn.execute("DELETE FROM ais_records WHERE is_demo = 1")
        conn.commit()

    now = datetime.now(timezone.utc)
    total_records = 0

    print("=" * 60)
    print("Seeding ais.db with realistic DEMO AIS maritime data...")
    print("=" * 60)

    for port_id, p in PORTS.items():
        (min_lat, min_lon), (max_lat, max_lon) = p["bbox"]
        lat_range = max_lat - min_lat
        lon_range = max_lon - min_lon

        # Deterministic seed per port for consistent realistic distributions
        rng = random.Random(hash(port_id) & 0xFFFFFFFF)

        vessels = []
        for i in range(num_vessels_per_port):
            mmsi = 999000000 + (hash(port_id) % 100000) * 100 + i
            ship_type = rng.choice(SHIP_TYPES)
            ship_name = f"DEMO {ship_type} {i + 1}"
            is_stationary = rng.random() < 0.55

            base_lat = min_lat + 0.15 * lat_range + rng.random() * (0.7 * lat_range)
            base_lon = min_lon + 0.15 * lon_range + rng.random() * (0.7 * lon_range)

            vessels.append({
                "mmsi": mmsi,
                "name": ship_name,
                "lat": base_lat,
                "lon": base_lon,
                "stationary": is_stationary,
            })

        batch_records = []
        # Generate 48 hours of historical and current positions
        for h in range(history_hours, -1, -1):
            ts = (now - timedelta(hours=h)).strftime("%Y-%m-%d %H:00:00")
            for v in vessels:
                # Add slight drift to coordinates
                drift_lat = v["lat"] + (rng.random() - 0.5) * 0.005
                drift_lon = v["lon"] + (rng.random() - 0.5) * 0.005

                # Keep stationary vessels slow, moving vessels faster
                if v["stationary"]:
                    sog = round(rng.uniform(0.0, 0.4), 1)
                else:
                    sog = round(rng.uniform(3.5, 14.5), 1)

                cog = round(rng.uniform(0.0, 359.0), 1)

                batch_records.append((
                    v["mmsi"],
                    v["name"],
                    drift_lat,
                    drift_lon,
                    sog,
                    cog,
                    port_id,
                    ts,
                    1,
                ))

        insert_ais_records_batch(batch_records, db_path=DB_PATH)
        port_records = len(batch_records)
        total_records += port_records
        stationary_now = sum(1 for v in vessels if v["stationary"])
        print(f"  * {p['name']} ({port_id}): {len(vessels)} vessels ({stationary_now} stationary, {len(vessels) - stationary_now} moving) | {port_records} historical pings")

    print("=" * 60)
    print(f"Successfully seeded {total_records} demo records into {DB_PATH.name}!")
    print("=" * 60)


if __name__ == "__main__":
    seed_demo_data()
