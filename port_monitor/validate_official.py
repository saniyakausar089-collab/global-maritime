"""Validation module comparing AIS metrics against official port authority statistics.

Aggregates daily AIS metrics from ais.db, computes Pearson and Spearman correlations,
calculates lagged cross-correlation (analyzing if AIS leads official figures), and RMSE.
Exports validation_results.csv and figures/validation.png with summary statistics.
"""

import os
from pathlib import Path
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
import pandas as pd
from scipy import stats
import matplotlib
matplotlib.use("Agg")  # Non-interactive headless backend
import matplotlib.pyplot as plt

from config import DB_PATH, OFFICIAL_STATS_PATH, PORTS, STATIONARY_SPEED_KNOTS
from metrics import init_db, get_connection

FIGURES_DIR = Path(__file__).resolve().parent / "figures"
VALIDATION_CSV = Path(__file__).resolve().parent / "validation_results.csv"
VALIDATION_PNG = FIGURES_DIR / "validation.png"


def load_official_stats() -> pd.DataFrame:
    """Load official statistics from data/official_stats.csv and check for placeholders."""
    if not OFFICIAL_STATS_PATH.is_file():
        raise FileNotFoundError(f"Missing official stats file at {OFFICIAL_STATS_PATH}")

    df = pd.read_csv(OFFICIAL_STATS_PATH)
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")

    # Check for placeholder markers
    has_placeholder = df["source"].astype(str).str.contains("PLACEHOLDER", case=False).any()
    if has_placeholder:
        print("\n" + "!" * 72)
        print("[WARNING] Official statistics dataset contains PLACEHOLDER rows!")
        print("          Please replace data/official_stats.csv with official port authority")
        print("          records before using this evaluation for production decisions.")
        print("!" * 72 + "\n")

    return df, has_placeholder


def get_daily_ais_metrics() -> pd.DataFrame:
    """Aggregate daily AIS observations per port from SQLite ais.db."""
    init_db(DB_PATH)
    with get_connection(DB_PATH) as conn:
        cursor = conn.execute(
            """
            SELECT
                port_id AS port,
                strftime('%Y-%m-%d', timestamp) AS date,
                COUNT(DISTINCT mmsi) AS ais_total_vessels,
                COUNT(DISTINCT CASE WHEN sog < ? THEN mmsi END) AS ais_stationary_vessels,
                COUNT(DISTINCT CASE WHEN zone_type = 'anchorage' AND sog < ? THEN mmsi END) AS ais_anchorage_waiting,
                COUNT(DISTINCT CASE WHEN zone_type = 'berth' THEN mmsi END) AS ais_at_berth
            FROM ais_records
            GROUP BY port, date
            ORDER BY port, date ASC
            """,
            (STATIONARY_SPEED_KNOTS, STATIONARY_SPEED_KNOTS),
        )
        rows = cursor.fetchall()

    data = [dict(r) for r in rows if r["date"]]
    return pd.DataFrame(data)


def compute_lagged_cross_correlation(s1: pd.Series, s2: pd.Series, max_lag: int = 5) -> dict:
    """Compute cross-correlation across different day lags (-max_lag to +max_lag)."""
    lags = list(range(-max_lag, max_lag + 1))
    corrs = {}
    for lag in lags:
        if lag < 0:
            c = s1.iloc[:lag].corr(s2.iloc[-lag:])
        elif lag > 0:
            c = s1.iloc[lag:].corr(s2.iloc[:-lag])
        else:
            c = s1.corr(s2)
        corrs[lag] = round(float(c), 4) if pd.notnull(c) else 0.0
    return corrs


def run_validation():
    """Execute complete validation analysis and generate figures."""
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("[VALIDATE] Starting AIS vs. Official Port Statistics Validation")
    print("=" * 70)

    official_df, is_placeholder = load_official_stats()
    ais_df = get_daily_ais_metrics()

    if ais_df.empty:
        print("[ERROR] No AIS data available in ais.db. Run seed_demo.py or ingest.py first.")
        return

    merged = pd.merge(official_df, ais_df, on=["port", "date"], how="inner")

    if merged.empty or len(merged) < 3:
        print("[WARNING] Insufficient overlapping date records between AIS and official stats.")
        print("          AIS dates:      ", ais_df['date'].unique().tolist())
        print("          Official dates: ", official_df['date'].unique().tolist()[:5])
        # Fallback to outer join fill or align dates for evaluation testing
        merged = pd.merge(official_df, ais_df, on=["port"], how="inner")
        if merged.empty:
            print("[ERROR] No matching ports between datasets.")
            return

    # Target comparison column (vessel calls or waiting hours)
    target_col = "vessel_calls" if "vessel_calls" in merged.columns else "avg_wait_hours"
    ais_metric_col = "ais_total_vessels" if target_col == "vessel_calls" else "ais_stationary_vessels"

    x = merged[ais_metric_col].values.astype(float)
    y = merged[target_col].values.astype(float)

    # 1. Pearson and Spearman correlations
    pearson_r, p_val = stats.pearsonr(x, y) if len(x) > 2 and np.std(x) > 0 and np.std(y) > 0 else (0.0, 1.0)
    spearman_rho, s_val = stats.spearmanr(x, y) if len(x) > 2 and np.std(x) > 0 and np.std(y) > 0 else (0.0, 1.0)

    # 2. RMSE (normalized)
    x_norm = (x - np.mean(x)) / (np.std(x) if np.std(x) > 0 else 1.0)
    y_norm = (y - np.mean(y)) / (np.std(y) if np.std(y) > 0 else 1.0)
    rmse = float(np.sqrt(np.mean((x_norm - y_norm) ** 2)))

    # 3. Lagged Cross-Correlation (does AIS lead official figures?)
    lag_corrs = compute_lagged_cross_correlation(pd.Series(x), pd.Series(y), max_lag=4)
    best_lag = max(lag_corrs.keys(), key=lambda l: lag_corrs[l])
    lead_text = f"AIS leads official stats by {best_lag} day(s)" if best_lag > 0 else f"Official stats lead by {-best_lag} day(s)" if best_lag < 0 else "Synchronous (0-day lag)"

    # Output Summary Table
    results = [{
        "metric_compared": f"{ais_metric_col} vs {target_col}",
        "sample_points": len(merged),
        "pearson_r": round(float(pearson_r), 4),
        "pearson_p_value": round(float(p_val), 5),
        "spearman_rho": round(float(spearman_rho), 4),
        "rmse_normalized": round(rmse, 4),
        "best_lag_days": best_lag,
        "lead_lag_relationship": lead_text,
        "contains_placeholder_data": is_placeholder,
    }]
    results_df = pd.DataFrame(results)
    results_df.to_csv(VALIDATION_CSV, index=False)

    print("\n" + "=" * 70)
    print("[SUMMARY] VALIDATION METRICS TABLE")
    print("=" * 70)
    for k, v in results[0].items():
        print(f"  {k:28}: {v}")
    print("=" * 70)
    print(f"Results exported to: {VALIDATION_CSV}")

    # Generate Matplotlib Visualizations
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    fig.suptitle(f"AIS vs Official Port Statistics Validation ({'PLACEHOLDER' if is_placeholder else 'OFFICIAL'})", fontsize=13, fontweight="bold")

    # Subplot 1: Direct Scatter & Trend Line
    axes[0].scatter(x, y, color="#0284c7", alpha=0.7, edgecolors="none", s=50)
    m, b = np.polyfit(x, y, 1) if np.std(x) > 0 else (0, np.mean(y))
    axes[0].plot(x, m * x + b, color="#dc2626", linestyle="--", label=f"Trend (r = {pearson_r:.2f})")
    axes[0].set_xlabel(f"AIS Metric ({ais_metric_col})", fontsize=10)
    axes[0].set_ylabel(f"Official Stat ({target_col})", fontsize=10)
    axes[0].set_title("Scatter Correlation", fontsize=11)
    axes[0].legend(loc="upper left")
    axes[0].grid(True, linestyle=":", alpha=0.6)

    # Subplot 2: Normalized Comparison
    axes[1].plot(x_norm[:20], label=f"AIS ({ais_metric_col})", marker="o", color="#0284c7")
    axes[1].plot(y_norm[:20], label=f"Official ({target_col})", marker="s", linestyle="--", color="#ea580c")
    axes[1].set_xlabel("Sample Observation", fontsize=10)
    axes[1].set_ylabel("Normalized Value (Z-Score)", fontsize=10)
    axes[1].set_title(f"Normalized Overlay (RMSE: {rmse:.2f})", fontsize=11)
    axes[1].legend()
    axes[1].grid(True, linestyle=":", alpha=0.6)

    # Subplot 3: Lagged Cross-Correlation Bar Chart
    lags = list(lag_corrs.keys())
    c_vals = [lag_corrs[l] for l in lags]
    colors = ["#22c55e" if l == best_lag else "#94a3b8" for l in lags]
    axes[2].bar(lags, c_vals, color=colors, width=0.6)
    axes[2].set_xlabel("Lag in Days (Positive = AIS Leads)", fontsize=10)
    axes[2].set_ylabel("Correlation Coefficient", fontsize=10)
    axes[2].set_title(f"Lag Analysis: Peak at Lag {best_lag}", fontsize=11)
    axes[2].grid(True, linestyle=":", alpha=0.6)

    plt.tight_layout()
    plt.savefig(VALIDATION_PNG, dpi=150)
    plt.close()
    print(f"Validation chart saved to: {VALIDATION_PNG}\n")


if __name__ == "__main__":
    run_validation()
