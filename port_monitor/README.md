# Global Maritime Port Monitor 🚢⚓

A Python-based maritime intelligence system that monitors global port congestion in real time using Automatic Identification System (AIS) transponder data, geofenced port boundaries, 3D CesiumJS globe visualization, and synthetic aperture radar (SAR) satellite cross-validation.

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
                                      │
                                      ▼
                            ┌───────────────────┐
                            │      ais.db       │ ◄─── seed_demo.py (synthetic)
                            │   (SQLite Store)  │
                            └─────────┬─────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
          ┌───────────────────┐               ┌───────────────────┐
          │    metrics.py     │               │    evaluate.py    │
          │(Congestion Index) │               │(Sentinel-1 SAR vs)│
          └─────────┬─────────┘               │ (AIS Validation)  │
                    │                         └───────────────────┘
          ┌─────────┴─────────┐
          ▼                   ▼
┌───────────────────┐ ┌───────────────┐
│      app.py       │ │    api.py     │
│(Streamlit + Cesium│ │(FastAPI REST) │
│    3D Globe)      │ └───────────────┘
└───────────────────┘
```

### Core Components
- **`config.py`**: Centralized configuration that loads `.env`, defines port geofences (Rotterdam, Singapore, Shanghai, Los Angeles), thresholds, and database paths.
- **`ingest.py`**: Asynchronous WebSocket client that connects to `wss://stream.aisstream.io/v0/stream`, subscribes to port bounding boxes, extracts PositionReport messages, and persists vessels into `ais.db`.
- **`metrics.py`**: SQLite database layer and analytical engine. Filters ships by Speed Over Ground (SOG < 0.5 knots = stationary), aggregates hourly counts, and calculates the **Congestion Index**.
- **`cesium_view.py`**: Interactive 3D CesiumJS globe embedded into Streamlit via Cesium Ion, color-coding stationary (red) and moving (blue) ships.
- **`app.py`**: Streamlit operational dashboard with global port rankings, 48-hour congestion sparklines, 3D globe rendering, searchable vessel tables, and CSV exports.
- **`api.py`**: FastAPI REST server providing endpoints (`/ports`, `/ports/{id}/vessels`, `/ports/{id}/history`).
- **`seed_demo.py`**: Standalone generator that populates realistic synthetic vessel positions and 48-hour history across all 4 ports for instant testing.
- **`evaluate.py`**: Google Earth Engine integration analyzing Sentinel-1 SAR (`COPERNICUS/S1_GRD`) backscatter to estimate vessel presence and compute Pearson/Spearman correlation against AIS records.

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

> **Note**: If PowerShell shows an `Execution_Policies` script restriction, allow activating local venvs:
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
Open `.env` in your editor and provide your keys:
- `AISSTREAM_API_KEY`: Free API key from [aisstream.io](https://aisstream.io).
- `CESIUM_ION_TOKEN`: Free token from [ion.cesium.com](https://ion.cesium.com) for high-resolution 3D terrain on the Cesium globe.
- `EE_PROJECT`: Your Google Cloud Project ID with Earth Engine API enabled (only needed for `evaluate.py`).

---

## How to Run Each Script

### Option A: Test Dashboard Immediately (Demo Mode)
You do not need to wait for live AIS data to explore the dashboard. Run:
```powershell
py seed_demo.py
```
This generates realistic simulated traffic across Rotterdam, Singapore, Shanghai, and Los Angeles with 48 hours of history.

### Option B: Launch Streamlit Dashboard
```powershell
py -m streamlit run app.py
```
The dashboard will open automatically in your browser at `http://localhost:8501`.
- View global metrics and ranking across all 4 ports.
- Switch to individual ports to explore the **3D Cesium Globe**, **48-hour trend chart**, and **searchable vessel table**.
- Export vessel lists and historical data to CSV.

### Option C: Live AIS Data Ingestion
Once you have your key from `aisstream.io` saved in `.env`:
```powershell
py ingest.py
```
This runs continuously in the background, ingesting transponder pings into `ais.db`.

### Option D: Launch FastAPI Backend
If you want to serve REST endpoints:
```powershell
py api.py
```
Interactive Swagger documentation is available at `http://127.0.0.1:8000/docs`.

### Option E: Satellite Cross-Validation (Earth Engine)
Authenticate your machine with Google Earth Engine (one-time setup):
```powershell
earthengine authenticate
```
Then run the satellite cross-validation:
```powershell
py evaluate.py
```
If Earth Engine is not yet authenticated, `evaluate.py` will skip gracefully without breaking. When authenticated, it queries Sentinel-1 radar scenes over the last 30 days, calculates Pearson/Spearman correlations, and saves results to `evaluation_results.csv`.

---

## Methodology

$$\text{Congestion Index} = \frac{\text{Stationary Vessels (Current Hour)}}{\text{Median Stationary Vessels (Historical Hours)}}$$

- **Stationary Definition**: A vessel with Speed Over Ground (SOG) $< 0.5\text{ knots}$ (anchored, moored, or berthed).
- **Status Classification**:
  - `Normal`: Index $< 0.8$
  - `Busy`: $0.8 \le \text{Index} \le 1.2$
  - `Congested`: $\text{Index} > 1.2$
  - `Not enough data`: Fewer than 2 distinct hourly history records available.

---

## Known Limitations

1. **Rough Bounding Boxes**: Port geofences are rectangular approximations. Depending on geographic contours, they may include adjacent high-speed transit channels or exclude remote deep-water outer anchorages.
2. **AIS Coverage Gaps**: Terrestrial AIS receivers rely on line-of-sight radio; outer anchorages may experience packet loss. While satellite AIS alleviates this, reception intervals can vary.
3. **Sentinel-1 Revisit Time**: Sentinel-1 SAR constellation orbits provide revisits roughly every 6 to 12 days over a given port. Consequently, satellite observation provides periodic radar snapshots rather than a continuous 24/7 stream.
4. **Congestion Index History Requirement**: The congestion index compares current counts against a statistical median. A newly configured port requires several days of continuous observations to establish a statistically meaningful baseline.
