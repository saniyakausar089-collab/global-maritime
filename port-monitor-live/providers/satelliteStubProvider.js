import { AisProvider } from "./baseProvider.js";

/**
 * Satellite AIS Provider Stub
 * Supports commercial satellite providers (Spire, Datalastic, VesselFinder, Kpler)
 * Configured via AIS_PROVIDER=satellite and AIS_API_KEY.
 * When satellite is active, open-ocean coverage is direct, so estimates are only used for gaps.
 */
export class SatelliteStubProvider extends AisProvider {
  constructor(apiKey, providerName = "Spire/Satellite") {
    super(`Satellite-${providerName}`);
    this.apiKey = apiKey || "";
    this.providerName = providerName;
    this.running = false;
    this.pollInterval = null;
  }

  async start() {
    this.running = true;
    console.log(`[${this.name}] Initialized satellite AIS provider adapter.`);

    if (!this.apiKey) {
      console.warn(`[${this.name}] AIS_API_KEY is not set. Provider standing by in idle stub mode.`);
      this.emit("status", {
        state: "idle",
        message: "Satellite provider waiting for valid AIS_API_KEY",
      });
      return;
    }

    this.emit("status", {
      state: "connected",
      message: `Active Satellite Telemetry Adapter (${this.providerName})`,
    });

    // Commercial polling stub
    // Plugs into Spire Maritime / Datalastic REST/WebSocket endpoints
    this.pollInterval = setInterval(() => {
      // Future hook: fetch('/vessel-feed', { headers: { Authorization: `Bearer ${this.apiKey}` } })
    }, 60000);
  }

  async stop() {
    this.running = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.emit("status", { state: "closed", message: "Satellite provider stopped" });
  }

  isConnected() {
    return this.running && Boolean(this.apiKey);
  }
}

