import { EventEmitter } from "events";

/**
 * Base abstract AisProvider interface.
 * Providers emit:
 * - 'message': (rawMsg)
 * - 'position': ({ mmsi, lat, lon, sog, cog, hdg, name, time_utc, raw })
 * - 'static': ({ mmsi, name, type, destination, eta, length, beam, raw })
 * - 'status': ({ state: 'connecting' | 'connected' | 'error' | 'closed', message })
 * - 'error': (error)
 */
export class AisProvider extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
  }

  async start() {
    throw new Error(`start() not implemented in provider ${this.name}`);
  }

  async stop() {
    throw new Error(`stop() not implemented in provider ${this.name}`);
  }

  isConnected() {
    return false;
  }
}

