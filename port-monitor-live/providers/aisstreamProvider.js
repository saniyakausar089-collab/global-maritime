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
        console.log("[AISStream] WebSocket connected. Subscribing to full-world & regional bounding boxes...");

        // Full-world subscription box [[90, -180], [-90, 180]] plus strategic oceanic & port regions
        const boundingBoxes = [
          // 0. Full World Global Bounding Box (All oceans, seas, and ports globally)
          [[90.0, -180.0], [-90.0, 180.0]],
          // 1. North Sea / Baltic / English Channel
          [[65.0, -5.0], [49.0, 30.0]],
          // 2. Mediterranean
          [[46.0, -6.0], [30.0, 36.5]],
          // 3. US East Coast + Gulf of Mexico
          [[45.0, -98.0], [24.0, -65.0]],
          // 4. US West Coast
          [[50.0, -130.0], [30.0, -115.0]],
          // 5. Caribbean
          [[28.0, -90.0], [10.0, -60.0]],
          // 6. Brazil Coast
          [[5.0, -52.0], [-35.0, -34.0]],
          // 7. West Africa
          [[15.0, -20.0], [-10.0, 15.0]],
          // 8. Red Sea + Persian Gulf
          [[30.5, 32.0], [11.0, 60.0]],
          // 9. India Coast & Arabian Sea
          [[25.0, 65.0], [6.0, 90.0]],
          // 10. SE Asia (Malacca Strait, Singapore, South China Sea)
          [[25.0, 95.0], [-11.0, 125.0]],
          // 11. East Asia (China, Korea, Japan)
          [[45.0, 115.0], [20.0, 145.0]],
          // 12. Australia Coast
          [[-10.0, 110.0], [-45.0, 155.0]],
          // 13. Port: Rotterdam
          [[52.4, 3.6], [51.4, 4.7]],
          // 14. Port: Singapore
          [[1.6, 103.3], [0.9, 104.3]],
          // 15. Port: Shanghai
          [[31.7, 121.2], [30.7, 122.4]],
          // 16. Port: Los Angeles
          [[34.2, -118.7], [33.2, -117.8]],
          // 17. Port: Hamburg
          [[54.0, 9.4], [53.1, 10.5]],
          // 18. Port: Santos
          [[-23.5, -46.8], [-24.5, -45.8]],
        ];

        const subscription = {
          APIKey: this.apiKey,
          BoundingBoxes: boundingBoxes,
          FilterMessageTypes: [
            "PositionReport",
            "StandardClassBPositionReport",
            "ExtendedClassBPositionReport",
            "ShipStaticData",
          ],
        };

        this.ws.send(JSON.stringify(subscription));
        this.emit("status", { state: "connected", message: `Subscribed to ${boundingBoxes.length} AISStream bounding boxes` });
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
