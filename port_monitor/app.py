"""Streamlit Dashboard for Global Maritime Port Monitor.

Provides interactive visualization of monitored ports, 3D CesiumJS globe,
congestion trend charts, searchable vessel tables, and CSV exports.
"""

import sys
from pathlib import Path
import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import PORTS, STATIONARY_SPEED_KNOTS, DB_PATH
from metrics import (
    init_db,
    get_all_ports_summary,
    get_latest_vessels,
    get_hourly_stationary_history,
    get_congestion_index,
)
from cesium_view import render_cesium_globe

# Page setup
st.set_page_config(
    page_title="Global Maritime Port Monitor",
    page_icon="⚓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom styling
st.markdown("""
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
""", unsafe_allow_html=True)


def format_status_badge(ci: float | None) -> str:
    """Return colored HTML status badge based on Congestion Index."""
    if ci is None:
        return '<span class="badge-nodata">No data yet</span>'
    if ci < 0.8:
        return f'<span class="badge-normal">Normal ({ci:.2f})</span>'
    if ci <= 1.2:
        return f'<span class="badge-busy">Busy ({ci:.2f})</span>'
    return f'<span class="badge-congested">Congested ({ci:.2f})</span>'


def main():
    # Header
    col_head, col_refresh = st.columns([4, 1])
    with col_head:
        st.title("⚓ Global Maritime Port Monitor")
        st.caption("Real-time AIS congestion metrics, geofencing, and 3D globe visualization")
    with col_refresh:
        st.write("")
        if st.button("🔄 Refresh Data", use_container_width=True):
            st.rerun()

    # Ensure DB exists
    init_db(DB_PATH)
    ports_summary = get_all_ports_summary(DB_PATH)

    total_vessels_all = sum(p["total_vessels"] for p in ports_summary)
    has_data = total_vessels_all > 0

    if not has_data:
        st.info(
            "ℹ️ **No AIS records found in database yet.**\n\n"
            "• Run `py seed_demo.py` to populate realistic simulated vessel traffic and 48h history.\n"
            "• Or run `py ingest.py` after setting your `AISSTREAM_API_KEY` in `.env` to ingest live AIS data."
        )

    # Top KPI row
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

    # Sidebar Port Selection
    port_names = {pid: p["name"] for pid, p in PORTS.items()}
    port_options = ["all"] + list(PORTS.keys())
    selected_option = st.sidebar.selectbox(
        "Select Port View",
        options=port_options,
        format_func=lambda x: "🌐 All Monitored Ports" if x == "all" else f"⚓ {port_names[x]}",
    )

    st.sidebar.markdown("---")
    st.sidebar.markdown("### Port Details")
    for p in ports_summary:
        st.sidebar.markdown(
            f"**{p['name']}**: {format_status_badge(p['congestion_index'])} "
            f"({p['total_vessels']} ships)",
            unsafe_allow_html=True,
        )

    if selected_option == "all":
        st.subheader("Global Port Ranking & Status")

        # Summary Table
        table_rows = []
        for p in ports_summary:
            ci = p["congestion_index"]
            status_text = "Normal" if ci and ci < 0.8 else "Busy" if ci and ci <= 1.2 else "Congested" if ci else "No Data"
            table_rows.append({
                "Port": p["name"],
                "Congestion Index": f"{ci:.2f}" if ci is not None else "N/A",
                "Status": status_text,
                "Total Vessels": p["total_vessels"],
                "Stationary (<0.5 kn)": p["stationary_vessels"],
                "Moving": p["moving_vessels"],
                "Coordinates": f"{p['lat']}, {p['lon']}",
            })
        st.dataframe(pd.DataFrame(table_rows), use_container_width=True, hide_index=True)

        st.subheader("Comparative Congestion Trends (48h)")
        history_frames = {}
        for pid in PORTS:
            h = get_hourly_stationary_history(pid, DB_PATH)
            if h:
                df_h = pd.DataFrame(h).set_index("hour")
                df_h.rename(columns={"stationary": PORTS[pid]["name"]}, inplace=True)
                history_frames[pid] = df_h

        if history_frames:
            combined = pd.concat(history_frames.values(), axis=1).fillna(0)
            st.line_chart(combined)
        else:
            st.write("No historical data available to chart yet.")

    else:
        # Detail view for specific port
        port_info = PORTS[selected_option]
        port_name = port_info["name"]
        ci = get_congestion_index(selected_option, DB_PATH)
        vessels = get_latest_vessels(selected_option, DB_PATH)
        stationary_count = sum(1 for v in vessels if v["stationary"])
        moving_count = len(vessels) - stationary_count

        st.subheader(f"⚓ Port of {port_name}")
        st.markdown(f"Status: {format_status_badge(ci)}", unsafe_allow_html=True)

        m_col1, m_col2, m_col3, m_col4 = st.columns(4)
        m_col1.metric("Congestion Index", f"{ci:.2f}" if ci is not None else "N/A")
        m_col2.metric("Total Vessels in Geofence", len(vessels))
        m_col3.metric("Stationary Vessels", stationary_count)
        m_col4.metric("Moving Vessels", moving_count)

        tab_globe, tab_chart, tab_table = st.tabs(["🌍 3D Globe View", "📈 48-Hour Congestion History", "📋 Vessel List"])

        with tab_globe:
            st.caption(f"Interactive Cesium 3D Globe centered at {port_name} ({port_info['lat']}, {port_info['lon']})")
            render_cesium_globe(
                port_name=port_name,
                center_lat=port_info["lat"],
                center_lon=port_info["lon"],
                vessels=vessels,
                height=550,
            )

        with tab_chart:
            st.caption("Hourly count of stationary vessels (Speed Over Ground < 0.5 kn)")
            history = get_hourly_stationary_history(selected_option, DB_PATH)
            if history:
                df_hist = pd.DataFrame(history)
                df_hist["hour"] = pd.to_datetime(df_hist["hour"])
                df_hist = df_hist.set_index("hour")
                st.line_chart(df_hist["stationary"])
            else:
                st.info("No hourly history recorded for this port yet.")

        with tab_table:
            st.caption("Live and recent vessel transponder reports inside geofence")
            if vessels:
                search_query = st.text_input("Filter by ship name or MMSI", "")
                status_filter = st.radio("State Filter", ["All", "Stationary", "Moving"], horizontal=True)

                filtered_vessels = vessels
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
                        "Speed (kn)": v["sog"],
                        "Heading (deg)": v["cog"],
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
