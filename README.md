# Global Maritime Port Monitor 🚢⚓

Real-time global commercial fleet tracking and maritime port congestion monitor with live AIS transponder ingestion, polygonal geofencing, cinematic 3D scroll-driven storytelling, Open-Meteo marine weather risk management, and satellite SAR cross-validation.

---

## 3D Cinematic Story & Interactive Routes

- **`/` (Root Landing Story)**: Cinematic 3D scroll-driven narrative powered by Three.js (`@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`), GSAP ScrollTrigger, and smooth inertia scrolling with Lenis across 10 distinct scenes (1500vh total scroll length):
  - **Scene 01 — Global Network**: Whole-Earth view with NASA Black Marble night lighting, glossy dark navy oceans, glowing cyan trade lanes, and thousands of live/simulated commercial vessels.
  - **Scene 02 — Live AIS Tracking**: Camera glides across international shipping bottlenecks (English Channel, Malacca Strait, Suez) rendering vessels as instanced glowing markers with speed vectors.
  - **Scene 03 — Geofencing**: Angled camera dive over Rotterdam and Singapore drawing glowing berth (cyan) and anchorage (amber) polygons from `ports.geojson`.
  - **Scene 04 — Congestion Index**: Anchorage bottleneck close-up with concentric pulsing red warning rings when CI > 1.2 and dynamic gauge metrics.
  - **Scene 05 — Course and Track Analysis**: Speed-scaled Course Over Ground (COG) vectors, historical fading spline track trails, 30-60 min dashed dead-reckoning projected paths, destination great-circle arcs with reported ETAs, and interactive click/hover 3D vessel HUD cards.
  - **Scene 06 — Container Ships**: Ultra-detailed 3D Post-Panamax Container Ship model with multi-carrier container stacks, hydrodynamic wake foam, bow waves, real sea-state pitch/roll, and live fleet segment analytics.
  - **Scene 07 — Tankers**: 3D Suezmax/VLCC Crude Oil Tanker model with flush deck, midships cargo manifold piping network with valves, catwalks, hose handling cranes, and liquid bulk logistics telemetry.
  - **Scene 08 — Bulk Carriers**: 3D Geared Panamax Bulk Carrier model with 5 large cargo hatch coamings, 4 luffing deck cranes with grab tackle, high freeboard, and dry bulk weather hold metrics.
  - **Scene 09 — Meteorological Weather Risk**: Serious data-driven meteorological ocean visualization with thousands of flowing wind field streamlines (colored teal `< 15 kn` to amber `20-30 kn` to crimson `> 35 kn`), wave-height heat contour layer, barometric pressure isobars, a rotating radar storm cell overlay, and ships deflecting their projected paths around the hazard perimeter. Includes live Open-Meteo marine & forecast telemetry and a clearly labelled **`[SIMULATION] Simulate Storm`** toggle.
  - **Scene 10 — History & Validation**: Interactive timeline scrubber (-72h replay) and Copernicus Sentinel-1 SAR satellite cross-validation panel ("Not validated yet" when no ground-truth results exist).
  - **Navigation**: Slim left rail with 10 sections and scrubbed progress bar, "Open Overview" button with fade-and-zoom transition to `/overview`, "Skip to Overview" quick shortcut, and "Back to 3D Story" on the dashboard.
- **`/overview`**: The complete live operational analytics dashboard with vector map tracking, sortable port indices, ship search, category filters, and Gemini AI vessel intelligence.
- **`/compare`**: Multi-port comparative charts and historical metrics.
- **`/methodology`**: Detailed documentation on the Congestion Index formula, stationary vessel velocity thresholds, and spatial point-in-polygon classification.

---

## 3D Models & Visualization Credits

- **Container Ship 3D Model (`container_ship.glb`)**: Authentic PBR naval architecture with multi-tier container stacks, dual-color hull, navigation lanterns, and hydrodynamic wake foam. Sourced from `abdulkadrtr/usv-simulation-ros2` under **Creative Commons Attribution 4.0 International (CC-BY 4.0)**.
- **Passenger Ship 3D Model (`passenger_ship.glb`)**: Authentic ocean liner / passenger vessel with tiered passenger decks, bridge superstructure, and wake wash. Created by Kenney (Watercraft Kit) and released under **Creative Commons Zero 1.0 Universal (CC0 1.0) Public Domain Dedication**.
- **Crude Oil Tanker 3D Model (`tanker_ship.glb`)**: Authentic Suezmax/VLCC crude tanker with low freeboard, deck cargo piping, catwalks, and navigation lanterns. Sourced from `abdulkadrtr/usv-simulation-ros2` under **Creative Commons Attribution 4.0 International (CC-BY 4.0)**.
- **Gerstner Ocean Simulation**: Custom 4-harmonic Trochoidal Gerstner wave shader with sharp peaked crests, broad troughs, subsurface ocean tint, and real-time amplitude modulation driven by live Open-Meteo marine wave height (`wave_height_m`).
- **NASA Black Marble Textures**: NASA Earth Observatory public domain nighttime lights, specular water maps, and topological bump textures saved in `public/textures/`.

---

## Architecture Overview

```
                               ┌────────────────────────┐
                               │  AISStream.io (WSS)   │
                               └───────────┬────────────┘
                                           │
                                           ▼
                                 ┌───────────────────┐
                                 │   Node.js Relay   │
                                 │(port-monitor-live)│
                                 └─────────┬─────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
       ┌─────────────────────────┐                   ┌─────────────────────────┐
       │   FastAPI Backend / REST│                   │  Vite React Frontend    │
       │     (port_monitor)      │                   │  - 3D Scroll Story (/)  │
       │- GET /ports/{id}/weather│                   │  - Live Dashboard       │
       │- GET /fleet/types       │                   │    (/overview)          │
       │- GET /ports/{id}/vessels│                   │                         │
       │- SQLite weather_cache   │                   │                         │
       └─────────────────────────┘                   └─────────────────────────┘
```

---

## Environment Variables (`.env`)

Create a `.env` file in the root directory (never committed to git) with the following keys:

```env
# API & WebSocket URLs
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
VITE_API_BASE_URL=http://localhost:3000

# Cesium Ion Token for 3D terrain and globes (optional)
VITE_CESIUM_ION_TOKEN=your_cesium_ion_token_here

# AISStream API Key for live global vessel transponders (https://aisstream.io)
AISSTREAM_KEY=your_aisstream_api_key_here

# Optional Gemini API Key for deep vessel AI assistant
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Local Development (Windows PowerShell)

### 1. Install Dependencies
```powershell
npm install --legacy-peer-deps
```

### 2. Run the Application
```powershell
npm run dev
```
Or start the client with auto-spawned relay:
```powershell
npm run dev:client
```
- Open [http://localhost:8080](http://localhost:8080) for the 3D cinematic story.
- Open [http://localhost:8080/overview](http://localhost:8080/overview) for the operational dashboard.
- Open [http://localhost:3000/fleet/types](http://localhost:3000/fleet/types) for real fleet segment counts & analytics.
- Open [http://localhost:3000/ports/rotterdam/weather](http://localhost:3000/ports/rotterdam/weather) for live Open-Meteo marine & forecast metrics.

### 3. Production Build
```powershell
npm run build
```
Generates production SPA assets in `.output/public` with pre-rendered static HTML for `/`, `/overview`, `/compare`, and `/methodology`.
