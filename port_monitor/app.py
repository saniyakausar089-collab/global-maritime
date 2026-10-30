"""Streamlit Dashboard for Global Maritime Port Monitor.

Provides interactive visualization of monitored ports, 3D CesiumJS globe with animated
interpolated tracks, 2D Pydeck map with time replay, congestion trends, comparison views,
real-time alert notifications, and methodology documentation.
"""

import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import pydeck as pdk
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))

from alerts import (
    check_and_trigger_alerts,
    get_active_congested_ports,
    get_recent_alerts,
)
from cesium_view import (
    SHIP_SVG_CYAN,
    SHIP_SVG_ORANGE,
    render_cesium_globe,
)
from config import DB_PATH, PORTS, STATIONARY_SPEED_KNOTS
from metrics import (
    get_all_ports_summary,
    get_congestion_index,
    get_db_date_range,
    get_hourly_stationary_history,
    get_latest_vessels,
    get_vessel_tracks,
    init_db,
)

# Page configuration
st.set_page_config(
    page_title="Global Maritime Port Monitor",
    page_icon="⚓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS styling
st.markdown(
    """
    <style>
        .metric-card {
            background-color: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .badge-normal {
            background-color: #065f46;
            color: #34d399;
            padding: 3px 8px;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 0.8rem;
        }
        .badge-busy {
            background-color: #854d0e;
            color: #facc15;
            padding: 3px 8px;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 0.8rem;
        }
        .badge-congested {
            background-color: #991b1b;
            color: #f87171;
            padding: 3px 8px;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 0.8rem;
        }
        .badge-nodata {
            background-color: #334155;
            color: #94a3b8;
            padding: 3px 8px;
            border-radius: 9999px;
            font-weight: 500;
            font-size: 0.8rem;
        }
    </style>
    """,
    unsafe_allow_html=True,
)


def format_status_badge(ci: Optional[float]) -> str:
    """Return colored HTML status badge based on Congestion Index."""
    if ci is None:
        return '<span class="badge-nodata">No data yet</span>'
    if ci < 0.8:
        return f'<span class="badge-normal">Normal ({ci:.2f})</span>'
    if ci <= 1.2:
        return f'<span class="badge-busy">Busy ({ci:.2f})</span>'
    return f'<span class="badge-congested">Congested ({ci:.2f})</span>'


def render_pydeck_2d_map(
    port_name: str,
    center_lat: float,
    center_lon: float,
    vessels_with_tracks: List[Dict[str, Any]],
    replay_step: int = 0,
    max_steps: int = 12,
) -> None:
    """Render 2D interactive map with Pydeck IconLayer and PathLayer.

    Replays vessel positions across time slices with vessel heading rotation.
    """
    if not vessels_with_tracks:
        st.info("No vessel tracks available to display on the 2D map.")
        return

    icon_records = []
    path_records = []

    for v in vessels_with_tracks:
        track = v.get("track", [])
        if not track:
            continue

        # Clamp slice index according to replay_step
        idx = min(replay_step, len(track) - 1)
        pt = track[idx]
        is_stationary = pt.get("stationary", False)

        svg_url = SHIP_SVG_ORANGE if is_stationary else SHIP_SVG_CYAN
        heading = pt.get("heading", 0.0)

        icon_records.append({
            "mmsi": v["mmsi"],
            "name": v["name"],
            "lat": pt["lat"],
            "lon": pt["lon"],
            "sog": pt["sog"],
            "heading": heading,
            "status": "Stationary" if is_stationary else "Moving",
            "icon_data": {
                "url": svg_url,
                "width": 32,
                "height": 32,
                "anchorX": 16,
                "anchorY": 16,
            },
        })

        # Build trajectory trail up to replay slice
        sub_track = track[: idx + 1]
        if len(sub_track) >= 2:
            coords = [[p["lon"], p["lat"]] for p in sub_track]
            path_records.append({
                "mmsi": v["mmsi"],
                "path": coords,
                "color": [249, 115, 22, 180] if is_stationary else [6, 182, 212, 180],
            })

    df_icons = pd.DataFrame(icon_records)
    df_paths = pd.DataFrame(path_records)

    layers = []
    if not df_paths.empty:
        layers.append(
            pdk.Layer(
                "PathLayer",
                df_paths,
                get_path="path",
                get_color="color",
                width_min_pixels=2,
                pickable=False,
            )
        )

    if not df_icons.empty:
        layers.append(
            pdk.Layer(
                "IconLayer",
                df_icons,
                get_position=["lon", "lat"],
                get_icon="icon_data",
                get_size=4,
                size_scale=8,
                get_angle="heading",
                pickable=True,
            )
        )

    view_state = pdk.ViewState(
        latitude=center_lat,
        longitude=center_lon,
        zoom=11.2,
        pitch=0,
    )

    deck = pdk.Deck(
        layers=layers,
        initial_view_state=view_state,
        tooltip={
            "html": "<b>{name}</b> (MMSI: {mmsi})<br/>Status: {status}<br/>Speed: {sog} kn<br/>Heading: {heading}°",
            "style": {"backgroundColor": "#0f172a", "color": "#f8fafc", "fontSize": "12px", "padding": "8px"},
        },
        map_style="mapbox://styles/mapbox/dark-v10",
    )

    st.pydeck_chart(deck, use_container_width=True)


def main():
    # Database initialization
    init_db(DB_PATH)

    # Top Alert Scan & Active Alert Notification
    active_congested = get_active_congested_ports(DB_PATH)
    if active_congested:
        alert_names = [f"**{a['port_name']}** (CI: {a['current_ci']:.2f}, {a['consecutive_hours']}h sustained)" for a in active_congested]
        st.error(
            f"🚨 **ACTIVE CONGESTION ALERT**: Sustained severe congestion detected at {', '.join(alert_names)}! "
            "Congestion index has exceeded 1.2 for 3 or more consecutive hours.",
            icon="🚨",
        )

    # Header section
    col_head, col_refresh = st.columns([4, 1])
    with col_head:
        st.title("⚓ Global Maritime Port Monitor")
        st.caption("Real-time AIS congestion metrics, polygon geofencing, 3D Cesium globe, and automated alerting")
    with col_refresh:
        st.components.v1.html(
            """
            <div style="font-family: monospace; font-size: 12px; color: #94a3b8; display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 4px 0;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 6px #22c55e;"></span>
                <span style="color:#22c55e; font-weight:700;">LIVE</span>
                <span id="st-clock" style="color:#f8fafc; font-weight:600;">--:--:-- UTC</span>
            </div>
            <script>
                function tick() {
                    const d = new Date();
                    const pad = (n) => String(n).padStart(2, '0');
                    const utc = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + ' UTC';
                    const el = document.getElementById('st-clock');
                    if (el) el.textContent = utc;
                }
                tick();
                setInterval(tick, 1000);
            </script>
            """,
            height=34,
        )
        if st.button("🔄 Refresh Data", use_container_width=True):
            check_and_trigger_alerts(DB_PATH)
            st.rerun()

    # Sidebar Port Navigation & Controls
    port_names = {pid: p["name"] for pid, p in PORTS.items()}
    port_options = ["all"] + list(PORTS.keys()) + ["methodology"]
    selected_option = st.sidebar.selectbox(
        "Navigation",
        options=port_options,
        format_func=lambda x: (
            "🌐 All Monitored Ports"
            if x == "all"
            else "📖 Methodology & Limitations"
            if x == "methodology"
            else f"⚓ {port_names[x]}"
        ),
    )

    # Date Range Filter in Sidebar
    min_date_str, max_date_str = get_db_date_range(DB_PATH)
    start_filter_date: Optional[str] = None
    end_filter_date: Optional[str] = None

    if min_date_str and max_date_str:
        try:
            d_min = datetime.strptime(min_date_str, "%Y-%m-%d").date()
            d_max = datetime.strptime(max_date_str, "%Y-%m-%d").date()
            st.sidebar.markdown("---")
            st.sidebar.markdown("### 📅 Date Range Filter")
            date_selection = st.sidebar.date_input(
                "Filter Historical Metrics",
                value=(d_min, d_max),
                min_value=d_min - timedelta(days=365),
                max_value=d_max + timedelta(days=30),
            )
            if isinstance(date_selection, tuple) and len(date_selection) == 2:
                start_filter_date = date_selection[0].strftime("%Y-%m-%d")
                end_filter_date = date_selection[1].strftime("%Y-%m-%d")
        except Exception:
            pass

    # Port Summary in Sidebar
    ports_summary = get_all_ports_summary(DB_PATH)
    total_vessels_all = sum(p["total_vessels"] for p in ports_summary)

    st.sidebar.markdown("---")
    st.sidebar.markdown("### Port Quick Status")
    for p in ports_summary:
        st.sidebar.markdown(
            f"**{p['name']}**: {format_status_badge(p['congestion_index'])} "
            f"({p['total_vessels']} ships)",
            unsafe_allow_html=True,
        )

    # Sidebar Recent Alerts Panel
    st.sidebar.markdown("---")
    st.sidebar.markdown("### 🔔 Sustained Alerts")
    recent_alerts = get_recent_alerts(limit=5, db_path=DB_PATH)
    if recent_alerts:
        for al in recent_alerts:
            st.sidebar.caption(f"**{al['port_name']}** ({al['timestamp'][:16]}): CI {al['congestion_index']:.2f}")
    else:
        st.sidebar.caption("No alerts triggered. Operating normally.")

    # Top KPI Metrics Row
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Monitored Ports", len(PORTS))
    with col2:
        congested_count = sum(1 for p in ports_summary if (p["congestion_index"] or 0) > 1.2)
        st.metric("Congested Ports (> 1.2)", congested_count)
    with col3:
        st.metric("Active Tracked Vessels", total_vessels_all)
    with col4:
        with_ci = [p for p in ports_summary if p["congestion_index"] is not None]
        if with_ci:
            busiest = max(with_ci, key=lambda x: x["congestion_index"])
            st.metric("Busiest Port", f"{busiest['name']} ({busiest['congestion_index']:.2f})")
        else:
            st.metric("Busiest Port", "N/A")

    st.divider()

    # VIEW 1: Methodology and Limitations
    if selected_option == "methodology":
        st.header("📖 Methodology and Limitations")
        st.markdown(
            """
            This section documents the computational principles, spatial partitioning, data sources,
            and operational boundaries of the Global Maritime Port Monitor.
            """
        )

        col_m1, col_m2 = st.columns(2)
        with col_m1:
            st.subheader("1. Data Ingestion & Transponders")
            st.markdown(
                """
                - **Primary Stream**: High-frequency AIS messages received from [AISStream.io](https://aisstream.io) via WebSocket.
                - **Transponder Standards**: Decodes Class A (SOLAS convention large commercial vessels) and Class B (regional craft) `PositionReport` packets.
                - **Attributes Captured**: MMSI, Ship Name, Latitude, Longitude, Speed Over Ground (SOG), Course Over Ground (COG), and True Heading.
                """
            )

            st.subheader("2. Polygon Geofencing Hierarchy")
            st.markdown(
                """
                - **Tighter Boundaries**: Replaces naive rectangular bounding boxes with high-precision polygonal geofences defined in `data/ports.geojson`.
                - **Sub-Zone Partitioning**:
                    - **Berths**: Quays, docks, and container terminals where loading/discharging takes place.
                    - **Anchorages**: Dedicated offshore maritime holding sectors where incoming ships drop anchor while awaiting clearance.
                - **Spatial Lookup**: Evaluated via GeoPandas and Shapely point-in-polygon containment (`Point(lon, lat)`).
                """
            )

            st.subheader("3. Stationary Threshold (< 0.5 kn)")
            st.markdown(
                """
                - Vessels with **Speed Over Ground < 0.5 knots** are designated **stationary**.
                - This threshold cleanly filters out vessels maneuvering in transit while capturing moored or anchored ships.
                """
            )

        with col_m2:
            st.subheader("4. Congestion Index (CI) Formula")
            st.markdown(
                """
                Congestion specifically quantifies ships **waiting for an available berth**:
                $$\\text{Congestion Index (CI)} = \\frac{\\text{Waiting Vessels at Current Hour}}{\\text{Historical Median Hourly Waiting Vessels}}$$
                - **CI < 0.8**: *Normal* (sub-average queue)
                - **0.8 ≤ CI ≤ 1.2**: *Busy* (expected baseline operating range)
                - **CI > 1.2**: *Congested* (elevated backlog)
                - **Alert Rule**: Sustained $\\text{CI} > 1.2$ for **3 consecutive hours** triggers an alert and optional SMTP dispatch.
                """
            )

            st.subheader("5. Official Statistics & Earth Engine Validation")
            st.markdown(
                """
                - **Official Benchmarks**: Daily/weekly vessel calls and queue times aggregated from port authority reports (`data/official_stats.csv`).
                - **Statistical Validation**: Evaluated via `validate_official.py` using Pearson correlation ($r$), Spearman rank correlation ($\\rho$), normalized RMSE, and lagged cross-correlation.
                - **Satellite SAR Cross-Validation**: `evaluate.py` queries Sentinel-1 Synthetic Aperture Radar (SAR) C-band backscatter via Google Earth Engine (`COPERNICUS/S1_GRD`) for cloud-penetrating ship detection.
                """
            )

            st.subheader("6. Known Operational Limitations")
            st.markdown(
                """
                - **Terrestrial AIS Line-of-Sight**: Coastal AIS receivers have a 20-40 nautical mile horizon; offshore anchorages may experience signal attenuation.
                - **AIS Manipulation & Dark Vessels**: Ships may disable transponders or spoof positions.
                - **Sentinel-1 Revisit Period**: SAR satellite passes occur every 6 to 12 days, precluding hourly SAR tracking.
                - **Baseline Stabilization**: A newly initialized port requires several days of hourly observations to compute a robust historical median.
                """
            )

    # VIEW 2: All Monitored Ports (Global Summary + Comparison)
    elif selected_option == "all":
        tab_all_globe, tab_all_stats, tab_all_alerts = st.tabs([
            "🌍 Global 3D Fleet Globe",
            "📊 Port Rankings & Comparison",
            "🔔 Alerts Log",
        ])

        with tab_all_globe:
            st.caption("Interactive 3D CesiumJS Global Fleet: Real-time 3D vessels with interpolated trajectory tracks, heading orientation, and fading trails.")
            global_tracks = get_vessel_tracks("all", db_path=DB_PATH)
            render_cesium_globe(
                port_name="Global Maritime Fleet",
                center_lat=25.0,
                center_lon=55.0,
                vessels_with_tracks=global_tracks,
                congestion_index=None,
                height=620,
            )

        with tab_all_stats:
            st.subheader("🌐 Global Port Ranking & Status")

            # Global Ports Summary Table
            table_rows = []
            for p in ports_summary:
                ci = p["congestion_index"]
                status_text = "Normal" if ci and ci < 0.8 else "Busy" if ci and ci <= 1.2 else "Congested" if ci else "No Data"
                table_rows.append({
                    "Port": p["name"],
                    "Congestion Index": f"{ci:.2f}" if ci is not None else "N/A",
                    "Status": status_text,
                    "Total Ships": p["total_vessels"],
                    "Waiting at Anchorage": p["anchorage_vessels"],
                    "Moored at Berth": p["berth_vessels"],
                    "Stationary (<0.5 kn)": p["stationary_vessels"],
                    "Moving": p["moving_vessels"],
                    "Coordinates": f"{p['lat']}, {p['lon']}",
                })
            df_summary = pd.DataFrame(table_rows)
            st.dataframe(df_summary, use_container_width=True, hide_index=True)

            # CSV Download for Global Summary
            st.download_button(
                label="📥 Download Global Summary CSV",
                data=df_summary.to_csv(index=False).encode("utf-8"),
                file_name="global_port_summary.csv",
                mime="text/csv",
            )

            st.divider()

            # Multi-Port Comparative View (Overlay Normalized History)
            st.subheader("📊 Port Comparison View (Overlay Normalized Congestion)")
            st.caption("Compares 2 to 4 ports normalized against each port's historical median baseline (1.0 = Baseline Median)")

            default_selection = list(PORTS.keys())[:3]
            selected_compare = st.multiselect(
                "Select 2 to 4 ports to compare",
                options=list(PORTS.keys()),
                default=default_selection,
                format_func=lambda x: PORTS[x]["name"],
            )

            if len(selected_compare) >= 2:
                norm_series = {}
                comp_table_rows = []

                for pid in selected_compare:
                    p_name = PORTS[pid]["name"]
                    hist = get_hourly_stationary_history(pid, start_date=start_filter_date, end_date=end_filter_date, db_path=DB_PATH)
                    if not hist:
                        continue

                    df_h = pd.DataFrame(hist)
                    med_val = df_h["stationary"].median() if not df_h.empty else 0.0

                    if med_val > 0:
                        df_h["normalized_ci"] = (df_h["stationary"] / med_val).round(2)
                    else:
                        df_h["normalized_ci"] = 1.0

                    df_h = df_h.set_index("hour")
                    norm_series[p_name] = df_h["normalized_ci"]

                    latest_ci = df_h["normalized_ci"].iloc[-1] if not df_h.empty else 1.0
                    peak_ci = df_h["normalized_ci"].max() if not df_h.empty else 1.0

                    comp_table_rows.append({
                        "Port": p_name,
                        "Baseline Median Ships": int(med_val),
                        "Latest Relative Congestion": f"{latest_ci:.2f}x",
                        "Peak Relative Congestion": f"{peak_ci:.2f}x",
                        "Status": "Congested" if latest_ci > 1.2 else "Busy" if latest_ci >= 0.8 else "Normal",
                    })

                if norm_series:
                    df_compare = pd.DataFrame(norm_series).ffill().bfill()
                    st.line_chart(df_compare)

                    df_comp_stats = pd.DataFrame(comp_table_rows)
                    st.dataframe(df_comp_stats, use_container_width=True, hide_index=True)

                    st.download_button(
                        label="📥 Download Comparison Data CSV",
                        data=df_compare.to_csv().encode("utf-8"),
                        file_name="port_comparison_normalized.csv",
                        mime="text/csv",
                    )
                else:
                    st.info("Insufficient historical records to generate comparison.")
            else:
                st.warning("Please select at least 2 ports to enable comparison view.")

        with tab_all_alerts:
            # Recent Alerts Log
            st.subheader("🔔 Recent Congestion Alerts Log")
            all_alerts = get_recent_alerts(limit=20, db_path=DB_PATH)
            if all_alerts:
                df_alerts = pd.DataFrame(all_alerts)
                st.dataframe(
                    df_alerts[["timestamp", "port_name", "congestion_index", "message"]],
                    use_container_width=True,
                    hide_index=True,
                )
                st.download_button(
                    label="📥 Download Alerts Log CSV",
                    data=df_alerts.to_csv(index=False).encode("utf-8"),
                    file_name="port_alerts_log.csv",
                    mime="text/csv",
                )
            else:
                st.info("No congestion alerts logged in database.")

    # VIEW 3: Port Detail View
    else:
        port_info = PORTS[selected_option]
        port_name = port_info["name"]
        ci = get_congestion_index(selected_option, start_date=start_filter_date, end_date=end_filter_date, db_path=DB_PATH)
        vessels = get_latest_vessels(selected_option, db_path=DB_PATH)
        vessels_with_tracks = get_vessel_tracks(selected_option, db_path=DB_PATH)

        anchorage_count = sum(1 for v in vessels if v["at_anchorage"])
        berth_count = sum(1 for v in vessels if v["at_berth"])
        stationary_count = sum(1 for v in vessels if v["stationary"])
        moving_count = len(vessels) - stationary_count

        st.subheader(f"⚓ Port of {port_name}")
        st.markdown(f"Status: {format_status_badge(ci)}", unsafe_allow_html=True)

        m1, m2, m3, m4, m5 = st.columns(5)
        m1.metric("Congestion Index", f"{ci:.2f}" if ci is not None else "N/A")
        m2.metric("Total Vessels", len(vessels))
        m3.metric("Anchorage (Waiting)", anchorage_count)
        m4.metric("At Berth", berth_count)
        m5.metric("Moving Ships", moving_count)

        tab_globe, tab_2d, tab_chart, tab_table = st.tabs([
            "🌍 3D Globe View",
            "🗺️ 2D Animated Map (Pydeck)",
            "📈 Congestion History",
            "📋 Vessel Transponder List",
        ])

        with tab_globe:
            st.caption(
                f"Interactive 3D CesiumJS Globe: Vessel symbols oriented by heading (orange: stationary/waiting, cyan: moving). "
                f"Features interpolated motion glide, fading trails, and congestion rings."
            )
            render_cesium_globe(
                port_name=port_name,
                center_lat=port_info["lat"],
                center_lon=port_info["lon"],
                vessels_with_tracks=vessels_with_tracks,
                congestion_index=ci,
                height=580,
            )

        with tab_2d:
            st.caption("2D Animated Map with Pydeck: Replay last 24 hours of vessel trajectory tracks and heading rotation.")
            replay_slider = st.slider(
                "Playback Time Slice",
                min_value=0,
                max_value=12,
                value=12,
                step=1,
                help="Slide to replay earlier positions along vessel historical tracks.",
            )
            render_pydeck_2d_map(
                port_name=port_name,
                center_lat=port_info["lat"],
                center_lon=port_info["lon"],
                vessels_with_tracks=vessels_with_tracks,
                replay_step=replay_slider,
            )

        with tab_chart:
            st.caption("Hourly trends of vessels waiting at anchorage vs moored at berth.")
            history = get_hourly_stationary_history(
                selected_option,
                start_date=start_filter_date,
                end_date=end_filter_date,
                db_path=DB_PATH,
            )
            if history:
                df_hist = pd.DataFrame(history)
                df_hist["hour"] = pd.to_datetime(df_hist["hour"])
                df_hist = df_hist.set_index("hour")
                chart_data = df_hist[["stationary", "at_berth"]]
                chart_data.columns = ["Waiting (Anchorage)", "At Berth"]
                st.line_chart(chart_data)
            else:
                st.info("No hourly history recorded for this port within the selected period.")

        with tab_table:
            st.caption("Vessel positions and transponder reports within the geofence.")
            if vessels:
                f_col1, f_col2, f_col3 = st.columns([2, 1, 1])
                with f_col1:
                    search_query = st.text_input("Filter by ship name or MMSI", "")
                with f_col2:
                    zone_filter = st.selectbox("Zone Filter", ["All", "anchorage", "berth", "port_boundary"])
                with f_col3:
                    status_filter = st.radio("State Filter", ["All", "Stationary", "Moving"], horizontal=True)

                filtered_vessels = vessels
                if zone_filter != "All":
                    filtered_vessels = [v for v in filtered_vessels if v.get("zone_type") == zone_filter]

                if status_filter == "Stationary":
                    filtered_vessels = [v for v in filtered_vessels if v["stationary"]]
                elif status_filter == "Moving":
                    filtered_vessels = [v for v in filtered_vessels if not v["stationary"]]

                if search_query.strip():
                    q = search_query.strip().lower()
                    filtered_vessels = [
                        v for v in filtered_vessels
                        if q in str(v["mmsi"]) or q in v["ship_name"].lower()
                    ]

                table_data = [
                    {
                        "MMSI": v["mmsi"],
                        "Ship Name": v["ship_name"],
                        "Zone": v.get("zone_type", "port_boundary"),
                        "Speed (kn)": v["sog"],
                        "COG (deg)": v.get("cog", 0.0),
                        "Heading (deg)": v["heading"],
                        "Status": "Stationary" if v["stationary"] else "Moving",
                        "Latitude": round(v["lat"], 4),
                        "Longitude": round(v["lon"], 4),
                        "Last Seen (UTC)": v["timestamp"],
                        "Demo Data": "Yes" if v["is_demo"] else "No",
                    }
                    for v in filtered_vessels
                ]

                df_vessels = pd.DataFrame(table_data)
                st.dataframe(df_vessels, use_container_width=True, hide_index=True)

                csv = df_vessels.to_csv(index=False).encode("utf-8")
                st.download_button(
                    label="📥 Download Table as CSV",
                    data=csv,
                    file_name=f"{selected_option}_vessels.csv",
                    mime="text/csv",
                )
            else:
                st.info("No vessels currently detected in this port.")


if __name__ == "__main__":
    main()
