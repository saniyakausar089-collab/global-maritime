# Global Maritime Port Monitor 🚢⚓

A real-time Python maritime intelligence platform that monitors port congestion using live Automatic Identification System (AIS) transponder data, polygonal sub-zone geofencing (berth vs. anchorage), animated 3D CesiumJS and 2D Pydeck visualization, automated multi-hour congestion alerts, and cross-validation against official port statistics and Sentinel-1 SAR satellite imagery.

---

## Architecture Overview

```
                                 ┌────────────────────────┐
                                 │  AISStream.io (WSS)   │
                                 └───────────┬────────────┘
                                             │
                                             ▼
                                   ┌───────────────────┐
                                   │     ingest.py     │
                                   └─────────┬─────────┘
                                             │ (Zone Classification via GeoPandas)
                                             ▼
                                   ┌───────────────────┐
      seed_demo.py (synthetic) ──► │      ais.db       │ ◄── alerts.py (Sustained CI > 1.2)
                                   │   (SQLite Store)  │
                                   └─────────┬─────────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     ▼                       ▼                       ▼
           ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
           │    metrics.py     │   │validate_official.py│  │    evaluate.py    │
           │(Congestion Index  │   │(AIS vs Official   │   │(Sentinel-1 SAR vs │
           │ & Vessel Tracks)  │   │  Stats Correlation│   │  AIS Backscatter) │
           └─────────┬─────────┘   └───────────────────┘   └───────────────────┘
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
 ┌───────────────────┐ ┌───────────────┐
 │      app.py       │ │    api.py     │
 │(Streamlit, Pydeck,│ │(FastAPI REST) │
 │ 3D Cesium Globe)  │ └───────────────┘
 └───────────────────┘
```

### Core Components

- **`config.py`**: Centralized configuration loader for `.env` credentials, port polygon mappings, database paths, and thresholds.
- **`build_geofences.py`**: Builds `data/ports.geojson` with high-precision polygon boundaries and sub-zones for **berths** and **anchorages** across all ports using OpenStreetMap and curated nautical fallbacks.
- **`ingest.py`**: Asynchronous WebSocket client ingesting live AIS `PositionReport` packets from `wss://stream.aisstream.io/v0/stream`, recording SOG, COG, true heading, and spatial zone classification into `ais.db`.
- **`metrics.py`**: Database abstraction, spatial point-in-polygon containment via GeoPandas/Shapely, historical vessel trajectory interpolation, and Congestion Index calculations.
- **`cesium_view.py`**: Interactive 3D CesiumJS globe with inline SVG vessel icons rotated by heading (orange for stationary <0.5 kn, cyan for moving), linear interpolation glide (`SampledPositionProperty`), fading motion trails, time speed controls (1x, 10x, 60x), and pulsing congestion rings.
- **`app.py`**: Streamlit operational dashboard featuring active alert banners, 2D Pydeck replay map, 3D Cesium globe, multi-port normalized comparative charts, date range filtering, CSV exports, and a methodology tab.
- **`alerts.py`**: Detects sustained severe congestion (Congestion Index > 1.2 for 3 consecutive hours), logs alerts to SQLite, and sends optional email notifications via standard Python `smtplib`.
- **`validate_official.py`**: Statistical validation comparing aggregated AIS traffic against official port authority statistics (`data/official_stats.csv`), calculating Pearson $r$, Spearman $\rho$, normalized RMSE, and lagged cross-correlation.
- **`evaluate.py`**: Google Earth Engine integration analyzing Copernicus Sentinel-1 SAR (`COPERNICUS/S1_GRD`) backscatter to validate ship counts.
- **`seed_demo.py`**: Populates realistic synthetic vessels and historical tracks across all ports for testing before live data arrives.
- **`tests/`**: Pytest test suite covering polygon geofence containment, congestion index formulas, and alert triggering logic.

---

## Setup Steps (Windows PowerShell)

### 1. Prerequisites

Ensure you have Python 3.10+ installed (`py --version`).

### 2. Navigate and Create Virtual Environment

```powershell
cd port_monitor
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

> **Note**: If PowerShell displays an `Execution_Policies` restriction when activating the venv:
>
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### 3. Install Dependencies

```powershell
py -m pip install --upgrade pip
py -m pip install -r requirements.txt
```

### 4. Configure Environment Keys

Copy the example environment template:

```powershell
cp .env.example .env
```

Open `.env` in your editor and configure:

- `AISSTREAM_API_KEY`: Free 40-character API key from [aisstream.io](https://aisstream.io).
- `CESIUM_ION_TOKEN`: Token from [ion.cesium.com](https://ion.cesium.com) for high-resolution 3D terrain on the Cesium globe.
- `EE_PROJECT`: (Optional) Google Cloud Project ID with Earth Engine API enabled (for `evaluate.py`).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_EMAIL`: (Optional) SMTP credentials for automated congestion email notifications. Leave empty to skip email dispatch.

---

## How to Run Each Script

### 1. Test Dashboard Immediately (Demo Mode)

To explore the complete dashboard with simulated vessels, headings, and 48-hour history:

```powershell
py seed_demo.py
```

### 2. Launch Streamlit Dashboard

```powershell
py -m streamlit run app.py
```

Open `http://localhost:8501` in your browser. You can:

- View active sustained congestion alert banners.
- Replay the last 24 hours of vessel movements with heading rotation in the **2D Pydeck Map**.
- Explore vessel glide and fading motion trails in the **3D Cesium Globe**.
- Select 2 to 4 ports under **🌐 All Monitored Ports** to compare normalized congestion trajectories.
- Filter historical data with the sidebar **Date Range Filter**.
- Download CSV reports for global rankings, comparisons, vessel lists, and alert logs.
- Review formulas and operational boundaries under the **📖 Methodology & Limitations** tab.

### 3. Run Live AIS Ingestion

To capture real-time vessel transponders from AISStream:

```powershell
py ingest.py
```

### 4. Build Port Geofences

To query OpenStreetMap Overpass API and update polygon zones in `data/ports.geojson`:

```powershell
py build_geofences.py
```

### 5. Check and Trigger Congestion Alerts

To manually scan ports for sustained congestion (> 1.2 for 3 consecutive hours) and dispatch alerts:

```powershell
py alerts.py
```

### 6. Validate Against Official Port Statistics

```powershell
py validate_official.py
```

Outputs statistical correlations, exports `validation_results.csv`, and generates `figures/validation.png`.

> [!IMPORTANT]
> `data/official_stats.csv` is populated with initial **PLACEHOLDER** records. Replace these rows with your actual Port Authority vessel call figures for production research.

### 7. Satellite Cross-Validation (Google Earth Engine)

One-time machine authentication:

```powershell
earthengine authenticate
```

Then run:

```powershell
py evaluate.py
```

### 8. Run Unit Tests

```powershell
py -m pytest tests -v
```

---

## Methodology

$$\text{Congestion Index (CI)} = \frac{\text{Current Waiting Vessels at Anchorage}}{\text{Historical Median Hourly Waiting Vessels}}$$

- **Sub-Zone Partitioning**: Classifies vessels into **berth** (loading/discharging) vs. **anchorage** (waiting queue) via polygonal geofences.
- **Stationary Threshold**: Speed Over Ground (SOG) $< 0.5\text{ knots}$ filters out transiting ships.
- **Status Classification**:
  - `Normal`: Index $< 0.8$
  - `Busy`: $0.8 \le \text{Index} \le 1.2$
  - `Congested`: $\text{Index} > 1.2$
  - `Sustained Alert`: $\text{Index} > 1.2$ for **3 consecutive hours**.

---

## Known Limitations

1. **Official Statistics Replacement**: Initial records in `data/official_stats.csv` are synthetic placeholders until actual Port Authority figures are entered.
2. **Terrestrial AIS Line-of-Sight**: Coastal AIS receivers have a 20–40 nautical mile horizon; outer anchorages may experience occasional packet drops.
3. **Satellite Revisit Period**: Sentinel-1 SAR constellation orbits provide revisits every 6 to 12 days, suited for periodic cross-validation rather than real-time tracking.
4. **Baseline Stabilization**: A newly initialized port requires several days of hourly observations to compute a statistically robust historical median.
