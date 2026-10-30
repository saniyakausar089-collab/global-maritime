import { describe, expect, it } from "vitest";
import { PORTS, computePortMetrics, getShipTypeLabel } from "../../server/index.js";

describe("Relay Server Metrics & Port Telemetry", () => {
  it("defines exactly the 6 monitored ports with valid coordinates and bounding boxes", () => {
    expect(PORTS).toHaveLength(6);
    const ids = PORTS.map((p) => p.id);
    expect(ids).toEqual(["rotterdam", "singapore", "shanghai", "los-angeles", "hamburg", "santos"]);

    PORTS.forEach((p) => {
      expect(typeof p.lat).toBe("number");
      expect(typeof p.lon).toBe("number");
      expect(p.bbox).toHaveLength(2);
      const [[minLat, minLon], [maxLat, maxLon]] = p.bbox;
      expect(minLat).toBeLessThan(maxLat);
      expect(minLon).toBeLessThan(maxLon);
      expect(p.lat).toBeGreaterThanOrEqual(minLat);
      expect(p.lat).toBeLessThanOrEqual(maxLat);
      expect(p.lon).toBeGreaterThanOrEqual(minLon);
      expect(p.lon).toBeLessThanOrEqual(maxLon);
    });
  });

  it("returns empty state (congestion_index: null) when no vessels are detected (not fake data)", () => {
    const metrics = computePortMetrics("rotterdam");
    expect(metrics).not.toBeNull();
    expect(metrics?.total_vessels).toBe(0);
    expect(metrics?.congestion_index).toBeNull();
    expect(metrics?.stationary_vessels).toBe(0);
  });

  it("maps ship type IDs to standard human-readable maritime categories", () => {
    expect(getShipTypeLabel(70)).toBe("Cargo");
    expect(getShipTypeLabel(79)).toBe("Cargo");
    expect(getShipTypeLabel(80)).toBe("Tanker");
    expect(getShipTypeLabel(89)).toBe("Tanker");
    expect(getShipTypeLabel(60)).toBe("Passenger");
    expect(getShipTypeLabel(52)).toBe("Special Craft / Tug");
    expect(getShipTypeLabel(30)).toBe("Fishing");
    expect(getShipTypeLabel(0)).toBe("Unknown");
  });
});
