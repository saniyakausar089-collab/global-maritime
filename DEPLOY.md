# 🚢 Global Maritime Port Monitor — Free Deployment & Operations Guide

This guide details how to deploy the **Node.js AISStream Relay Backend** completely free on **Render** and the **MapLibre GL Live Map Frontend** on **Vercel** (or Netlify), including environment configuration and troubleshooting.

---

## Architecture Overview

```
┌─────────────────────────────────┐
│     AISStream.io (Upstream)    │
│  wss://stream.aisstream.io/...  │
└────────────────┬────────────────┘
                 │ (1 persistent upstream connection)
                 ▼
┌─────────────────────────────────┐
│  Render Free Web Service Relay  │
│  (port-monitor-live/server.js)  │
│  - Holds AISSTREAM_KEY secretly │
│  - 2-second batched diffs       │
│  - REST: /health, /api/ports    │
│  - WebSockets: /ws              │
└────────────────┬────────────────┘
                 │ WebSocket /ws & HTTPS
                 ▼
┌─────────────────────────────────┐
│     Vercel Frontend (Vite SPA)  │
│  - MapLibre GL Vector Map       │
│  - Smooth dead-reckoning ships  │
│  - Automatic cold-start retry   │
└─────────────────────────────────┘
```

---

## 1. Deploy Relay Backend to Render (Free)

1. Sign up / Log in to [Render.com](https://render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service settings:
   - **Name**: `port-monitor-relay`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` (or `node port-monitor-live/server.js`)
   - **Plan**: `Free`
5. Under **Environment Variables**, add:
   | Key               | Value                                      | Description                           |
   | ----------------- | ------------------------------------------ | ------------------------------------- |
   | `AISSTREAM_KEY`   | `<YOUR_AISSTREAM_API_KEY>`                 | Your free AISStream API Key           |
   | `PORT`            | `10000`                                    | Port automatically assigned by Render |
   | `ALLOWED_ORIGINS` | `*` (or your Vercel URL)                   | Allowed CORS origins                  |
6. Under **Health Check Path**, enter: `/health`.
7. Click **Deploy Web Service**.
8. Note your public backend URL (e.g. `https://port-monitor-relay.onrender.com`).

---

## 2. Deploy Frontend to Vercel (Free)

1. Sign up / Log in to [Vercel.com](https://vercel.com).
2. Click **Add New…** → **Project** and import your repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.output/public`
4. Under **Environment Variables**, add:
   | Key            | Value                                     | Example                                       |
   | -------------- | ----------------------------------------- | --------------------------------------------- |
   | `VITE_API_URL` | `https://<YOUR-RENDER-APP>.onrender.com`  | `https://port-monitor-relay.onrender.com`     |
   | `VITE_WS_URL`  | `wss://<YOUR-RENDER-APP>.onrender.com/ws` | `wss://port-monitor-relay.onrender.com/ws`    |
5. Click **Deploy**.

---

## 3. Keep Server Awake (Render Cold Start Mitigation)

Render free instances spin down after 15 minutes of inactivity. When a user arrives, Render takes 30–50 seconds to wake up (the frontend automatically detects this and displays a **WAKING UP SERVER** badge).

To keep the backend awake 24/7 for free:

1. Create a free account on [UptimeRobot.com](https://uptimerobot.com).
2. Click **Add New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Port Monitor Relay Health`
   - **URL (or IP)**: `https://<YOUR-RENDER-APP>.onrender.com/health`
   - **Monitoring Interval**: Every `5 minutes`
3. Click **Create Monitor**. Render will now stay active and responsive with zero cold start delay.

---

## 4. Local Testing & Verification

### Running backend + frontend together

```bash
npm run dev
```

This runs both the relay server (on port 3000) and the Vite development server (on port 5173) simultaneously using `concurrently`.

### Testing the WebSocket Relay directly

Using `wscat`:
```bash
npx wscat -c ws://localhost:3000/ws
```

You should see:
1. `{"t":"snap","mode":"live",...}` snapshot message on connection.
2. `{"t":"diff","v":[...],"ports":[...]}` diff message every 2 seconds.

---

## 5. Troubleshooting ("Ships Not Showing" Debug Checklist)

| Symptom | Probable Cause | Fix |
| ------- | -------------- | --- |
| **"API unreachable — DEMO fallback data"** | Relay server not running or wrong URL | Ensure backend is running (`node port-monitor-live/server.js`) and `VITE_API_URL` matches the backend host. |
| **"Waking up server…"** | Render free tier cold start spin-up | Wait 30–45s for container initialization, or set up UptimeRobot keep-alive. |
| **"SIMULATED DATA" badge** | `AISSTREAM_KEY` not set or `SIMULATE=1` | Ensure `AISSTREAM_KEY` is configured in `port-monitor-live/.env` or Render environment. |
| **"Waiting for ships…"** | AISStream initial data buffer delay | Free AISStream data can take 30–60 seconds to stream reports for active ports. |
| **CORS errors in console** | Frontend domain not in `ALLOWED_ORIGINS` | Set `ALLOWED_ORIGINS=*` or add your frontend domain to the environment variable. |
