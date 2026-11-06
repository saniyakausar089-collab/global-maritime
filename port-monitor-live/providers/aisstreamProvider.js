import { WebSocket } from "ws";
import { AisProvider } from "./baseProvider.js";
import { sanitizePosition, sanitizeStatic } from "../sanity.js";

export class AisStreamProvider extends AisProvider {
  constructor(apiKey) {
    super("AISStream");
    this.apiKey = apiKey ? apiKey.trim() : "";
    this.ws = null;
    this.retry = 0;
    this.running = false;
    this.reconnectTimer = null;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  async stop() {
    this.running = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emit("status", { state: "closed", message: "AISStream provider stopped" });
  }

  isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  connect() {
    if (!this.running || !this.apiKey) {
      if (!this.apiKey) {
        console.warn("[AISStream] No API key provided.");
        this.emit("status", { state: "error", message: "Missing AISSTREAM_KEY" });
      }
      return;
    }

    this.emit("status", { state: "connecting", message: "Connecting to AISStream WebSocket..." });
    console.log("[AISStream] Connecting to wss://stream.aisstream.io/v0/stream...");

    try {
      this.ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

      this.ws.on("open", () => {
        this.retry = 0;
        console.log("[AISStream] WebSocket connected. Subscribing to full-world bounding box...");

        // Full-world subscription [[90, -180], [-90, 180]] (NW to SE corners)
        const subscription = {
          APIKey: this.apiKey,
          BoundingBoxes: [[[90, -180], [-90, 180]]],
          FilterMessageTypes: [
            "PositionReport",
            "StandardClassBPositionReport",
            "ExtendedClassBPositionReport",
            "ShipStaticData",
          ],
        };

        this.ws.send(JSON.stringify(subscription));
        this.emit("status", { state: "connected", message: "Subscribed to full-world AISStream" });
      });

      this.ws.on("message", (raw) => {
        try {
          const packet = JSON.parse(raw);
          if (packet.error) {
            console.error("[AISStream] Upstream error:", packet.error);
            this.emit("error", new Error(packet.error));
            return;
          }

          const type = packet.MessageType;
          const meta = packet.MetaData || {};
          const msg = packet.Message || {};

          if (
            type === "PositionReport" ||
            type === "StandardClassBPositionReport" ||
            type === "ExtendedClassBPositionReport"
          ) {
            const posData = msg[type] || {};
            const sanitized = sanitizePosition(posData, meta);
            if (sanitized) {
              this.emit("position", sanitized);
            }
          } else if (type === "ShipStaticData") {
            const staticData = msg.ShipStaticData || {};
            const sanitized = sanitizeStatic(staticData, meta);
            if (sanitized) {
              this.emit("static", sanitized);
            }
          }
        } catch (err) {
          // Ignore corrupt JSON packets
        }
      });

      this.ws.on("error", (err) => {
        console.error("[AISStream] Connection error:", err.message);
        this.emit("error", err);
      });

      this.ws.on("close", (code, reason) => {
        this.ws = null;
        if (!this.running) return;

        const delay = Math.min(30000, 1000 * Math.pow(2, this.retry++));
        console.log(`[AISStream] Closed (${code}). Reconnecting in ${(delay / 1000).toFixed(1)}s...`);
        this.emit("status", {
          state: "connecting",
          message: `Reconnecting in ${(delay / 1000).toFixed(1)}s...`,
        });

        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      });
    } catch (e) {
      console.error("[AISStream] Initialization failed:", e);
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
  }
}
