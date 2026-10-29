"""Evaluation module comparing Sentinel-1 SAR ship detection with AIS counts.

Uses Google Earth Engine (COPERNICUS/S1_GRD) to estimate vessel counts across
each port bounding box over the last 30 days and compares them against AIS
stationary vessel counts using pandas, exporting Pearson and Spearman correlations
to evaluation_results.csv.

Skips gracefully if Earth Engine is not authenticated.
"""

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sys

# Ensure UTF-8 output encoding on Windows PowerShell
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
from scipy import stats

from config import DB_PATH, EE_PROJECT, PORTS, STATIONARY_SPEED_KNOTS
from metrics import init_db, get_connection

RESULTS_CSV = Path(__file__).resolve().parent / "evaluation_results.csv"


def get_ais_port_stationary_counts(days: int = 30) -> dict:
    """Fetch average daily stationary vessel counts from ais.db for each port."""
    init_db(DB_PATH)
    counts = {}
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")

    with get_connection(DB_PATH) as conn:
        for port_id in PORTS:
            cursor = conn.execute(
                """
                SELECT COUNT(DISTINCT mmsi) AS stationary_count
                FROM ais_records
                WHERE port_id = ? AND sog < ? AND timestamp >= ?
                """,
                (port_id, STATIONARY_SPEED_KNOTS, cutoff),
            )
            row = cursor.fetchone()
            counts[port_id] = int(row["stationary_count"]) if row and row["stationary_count"] else 0

    return counts


def run_earth_engine_evaluation() -> None:
    """Run Sentinel-1 vessel detection and compute correlation with AIS metrics."""
    print("=" * 70)
    print("[EVAL] Starting Sentinel-1 vs. AIS Ship Evaluation")
    print("=" * 70)

    try:
        import ee
    except ImportError:
        print("[WARNING] 'earthengine-api' is not installed. Skipping evaluation.")
        return

    # Check Earth Engine credentials & project
    project_id = EE_PROJECT or os.getenv("EE_PROJECT", "").strip()
    try:
        if project_id:
            ee.Initialize(project=project_id)
        else:
            ee.Initialize()
        print(f"[OK] Google Earth Engine initialized successfully (Project: {project_id or 'default'}).")
    except Exception as e:
        print("[WARNING] Google Earth Engine is not authenticated or project ID is missing.")
        print(f"   Details: {e}")
        print("   To authenticate with Google Earth Engine, run:")
        print("     earthengine authenticate")
        print("   And set EE_PROJECT=<your-gcp-project-id> in your .env file.")
        print("   Skipping Earth Engine evaluation gracefully.")
        return

    # Time window: last 30 days
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    end_date = now.strftime("%Y-%m-%d")

    print(f"Querying Sentinel-1 GRD imagery from {start_date} to {end_date}...")

    ais_counts = get_ais_port_stationary_counts(days=30)
    results = []

    for port_id, p in PORTS.items():
        (min_lat, min_lon), (max_lat, max_lon) = p["bbox"]
        roi = ee.Geometry.Rectangle([min_lon, min_lat, max_lon, max_lat])

        try:
            # Query Sentinel-1 Ground Range Detected (GRD) in IW mode
            s1_collection = (
                ee.ImageCollection("COPERNICUS/S1_GRD")
                .filterBounds(roi)
                .filterDate(start_date, end_date)
                .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
                .filter(ee.Filter.eq("instrumentMode", "IW"))
                .select("VV")
            )

            collection_size = s1_collection.size().getInfo()

            if collection_size > 0:
                # Composite mean backscatter
                mean_img = s1_collection.mean().clip(roi)
                # Ships act as high-backscatter corner reflectors on water (> -10 dB threshold)
                ship_mask = mean_img.gt(-10.0)

                # Count ship candidate pixels
                pixel_count_dict = ship_mask.reduceRegion(
                    reducer=ee.Reducer.sum(),
                    geometry=roi,
                    scale=20,
                    maxPixels=1e8,
                ).getInfo()

                raw_pixel_count = pixel_count_dict.get("VV", 0) or 0
                # Approximate 1 ship ~ 6-12 pixels at 20m resolution depending on ship size
                estimated_ships = max(0, int(round(raw_pixel_count / 8.0)))
            else:
                estimated_ships = 0

            ais_val = ais_counts.get(port_id, 0)
            results.append({
                "port_id": port_id,
                "port_name": p["name"],
                "s1_scenes": collection_size,
                "sentinel1_estimated_ships": estimated_ships,
                "ais_stationary_count": ais_val,
            })
            print(f"  * {p['name']:12}: S1 Scenes={collection_size:2d} | S1 Est. Ships={estimated_ships:4d} | AIS Stationary={ais_val:4d}")

        except Exception as query_err:
            print(f"  [WARNING] Error querying port {p['name']}: {query_err}")
            results.append({
                "port_id": port_id,
                "port_name": p["name"],
                "s1_scenes": 0,
                "sentinel1_estimated_ships": 0,
                "ais_stationary_count": ais_counts.get(port_id, 0),
            })

    df = pd.DataFrame(results)

    # Compute correlations if sufficient variation exists
    pearson_corr, spearman_corr = None, None
    s1_vals = df["sentinel1_estimated_ships"].values
    ais_vals = df["ais_stationary_count"].values

    if len(df) >= 3 and len(set(s1_vals)) > 1 and len(set(ais_vals)) > 1:
        p_res = stats.pearsonr(s1_vals, ais_vals)
        s_res = stats.spearmanr(s1_vals, ais_vals)
        pearson_corr = round(float(p_res.statistic), 4)
        spearman_corr = round(float(s_res.statistic), 4)
    else:
        # Graceful handling when data variance is zero or too few points
        pearson_corr = 0.0
        spearman_corr = 0.0

    df["pearson_correlation"] = pearson_corr
    df["spearman_correlation"] = spearman_corr

    # Save to CSV
    df.to_csv(RESULTS_CSV, index=False)
    print("\n" + "=" * 70)
    print("[SUMMARY] EVALUATION RESULTS SUMMARY")
    print("=" * 70)
    print(df[["port_name", "s1_scenes", "sentinel1_estimated_ships", "ais_stationary_count"]].to_string(index=False))
    print("-" * 70)
    print(f"Pearson Correlation  (r): {pearson_corr}")
    print(f"Spearman Correlation (rho): {spearman_corr}")
    print(f"Results exported to: {RESULTS_CSV}")
    print("=" * 70)


if __name__ == "__main__":
    run_earth_engine_evaluation()
