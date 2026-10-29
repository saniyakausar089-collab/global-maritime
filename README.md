# Global Maritime Port Monitor 🚢⚓

Real-time global maritime port congestion monitor with AIS transponder ingestion, geofencing, 3D CesiumJS visualization, and satellite SAR cross-validation.

## Overview

Global Maritime Port Monitor continuously tracks commercial maritime traffic across major global ports (Rotterdam, Singapore, Shanghai, Los Angeles, Hamburg, Santos). It calculates port congestion indices based on stationary vessel counts, detects anchoring bottlenecks, and validates estimates using Earth Observation data.

## Project Structure

- **`port_monitor/`**: Core Python project containing backend services, ingestion, metrics, 3D visualization, and automated evaluation.
  - `app.py`: Streamlit dashboard with interactive 3D Cesium globe and 2D replay maps.
  - `ingest.py`: Live AISStream WebSocket client streaming position reports into SQLite `ais.db`.
  - `metrics.py`: Geofencing, stationary detection, and Congestion Index calculations.
  - `cesium_view.py`: 3D CesiumJS globe with animated vessel tracks and heading rotation.
  - `api.py`: FastAPI REST API for vessel statistics and historical trends.
  - `seed_demo.py`: High-density synthetic data generator.
  - `evaluate.py`: Google Earth Engine Sentinel-1 SAR ship detection validation.
- **`src/`**: React / Vite analytics dashboard connecting to the FastAPI backend.

## Getting Started

See [`port_monitor/README.md`](port_monitor/README.md) for full setup instructions on Windows PowerShell.
