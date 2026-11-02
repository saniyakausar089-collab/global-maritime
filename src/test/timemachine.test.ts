import { describe, it, expect } from "vitest";
import {
  getHistoricalArchive,
  interpolateVesselPosition,
  simulatePortScenario,
  calculateNetworkRippleEffects,
  ARCHIVE_START_TIME,
  ARCHIVE_END_TIME,
  MONITORED_PORTS,
} from "../lib/historicalData";
import {
  getStoredInvestigations,
  exportInvestigationMarkdown,
} from "../lib/investigationStore";
import {
  buildMaritimeKnowledgeGraph,
  queryKnowledgeGraph,
} from "../lib/knowledgeGraph";
import { computePortForecast } from "../lib/forecastEngine";
import { evaluateHistoricalAlerts } from "../lib/alertEngine";

describe("TIME MACHINE Engine & Kinematics", () => {
  it("loads deterministic 24-hour recorded maritime archive", () => {
    const archive = getHistoricalArchive();
    expect(archive.vessels.length).toBe(30);
    expect(archive.events.length).toBeGreaterThan(0);
    expect(archive.anomalies.length).toBeGreaterThan(0);
    expect(ARCHIVE_END_TIME - ARCHIVE_START_TIME).toBe(24 * 3600 * 1000);
  });

  it("kinematically interpolates vessel position between observation fixes", () => {
    const archive = getHistoricalArchive();
    const vessel = archive.vessels[0];
    const midTime = Math.floor((ARCHIVE_START_TIME + ARCHIVE_END_TIME) / 2);

    const pos = interpolateVesselPosition(vessel, midTime);
    expect(pos).toBeDefined();
    if (pos) {
      expect(typeof pos.lat).toBe("number");
      expect(typeof pos.lon).toBe("number");
      expect(typeof pos.sog).toBe("number");
    }
  });

  it("simulates What-If operational queue scenario", () => {
    const scenario = simulatePortScenario({
      targetPortId: "rotterdam",
      arrivalRateMultiplier: 1.4,
      capacityMultiplier: 0.6,
      disruptionStartHour: 6,
      disruptionDurationHours: 8,
    });

    expect(scenario.baselineQueue.length).toBe(24);
    expect(scenario.scenarioQueue.length).toBe(24);
    expect(scenario.peakQueueDelta).toBeGreaterThanOrEqual(0);
    expect(scenario.avgDelayIncreaseHours).toBeGreaterThanOrEqual(0);
    expect(scenario.recoveryHours).toBeGreaterThan(0);
  });

  it("computes downstream ripple effect delays along global corridors", () => {
    const ripples = calculateNetworkRippleEffects("rotterdam", 16);
    expect(ripples.length).toBeGreaterThan(0);
    const hamburgRip = ripples.find((r) => r.connectedPortId === "hamburg");
    expect(hamburgRip).toBeDefined();
    if (hamburgRip) {
      expect(hamburgRip.projectedDelayHours).toBeGreaterThan(0);
      expect(hamburgRip.affectedSailings).toBeGreaterThan(0);
    }
  });

  it("exports formatted formal markdown investigation report", () => {
    const cases = getStoredInvestigations();
    expect(cases.length).toBeGreaterThan(0);
    const md = exportInvestigationMarkdown(cases[0]);
    expect(md).toContain("# MARITIME INVESTIGATION DOSSIER");
    expect(md).toContain("## 1. Executive Summary");
    expect(md).toContain("## 3. Evidence & Findings");
  });

  it("builds and queries temporal knowledge graph with semantic edges", () => {
    const graph = buildMaritimeKnowledgeGraph();
    expect(graph.nodes.length).toBeGreaterThan(10);
    expect(graph.edges.length).toBeGreaterThan(10);

    const queried = queryKnowledgeGraph(graph, { types: ["PORT"] });
    expect(queried.nodes.every((n) => n.type === "PORT")).toBe(true);
  });

  it("computes predictive time-series forecast with backtesting validation", () => {
    const forecast = computePortForecast("rotterdam", "QUEUE_SIZE", 16, 8);
    expect(forecast.points.length).toBe(24);
    expect(forecast.evaluation.mae).toBeGreaterThanOrEqual(0);
    expect(forecast.evaluation.trainingWindowHours).toBe(16);
    expect(forecast.evaluation.horizonHours).toBe(8);
  });

  it("evaluates time-aware retrospective alert rules", () => {
    const alerts = evaluateHistoricalAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    const first = alerts[0];
    expect(first.evidenceRef).toBeDefined();
    expect(["CRITICAL", "WARNING", "ADVISORY"]).toContain(first.severity);
  });
});
