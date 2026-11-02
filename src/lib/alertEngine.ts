/**
 * TIME-AWARE ALERTING ENGINE
 * 
 * Configurable rule engine for historical anomaly and threshold alerting.
 * Evaluates operational conditions across the 24-hour recorded timeline
 * with retrospective attribution and false-positive reviewing.
 */

import {
  getHistoricalArchive,
  type HistoricalVessel,
  MONITORED_PORTS,
} from "./historicalData";

export interface AlertRuleConfig {
  id: string;
  name: string;
  description: string;
  metric: "TRAFFIC_SURGE" | "QUEUE_THRESHOLD" | "STATIONARY_HOLD" | "DATA_GAP";
  threshold: number;
  unit: string;
  severity: "CRITICAL" | "WARNING" | "ADVISORY";
  enabled: boolean;
}

export interface TriggeredAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: number;
  entityType: "PORT" | "VESSEL";
  entityId: string | number;
  entityName: string;
  severity: "CRITICAL" | "WARNING" | "ADVISORY";
  triggerValue: number;
  thresholdValue: number;
  unit: string;
  message: string;
  evidenceRef: string;
  acknowledged: boolean;
}

export const DEFAULT_ALERT_RULES: AlertRuleConfig[] = [
  {
    id: "rule-queue-surge",
    name: "Outer Anchorage Congestion Surge",
    description: "Triggers when anchored vessels waiting in approach zone exceed threshold",
    metric: "QUEUE_THRESHOLD",
    threshold: 4,
    unit: "vessels",
    severity: "CRITICAL",
    enabled: true,
  },
  {
    id: "rule-prolonged-dwell",
    name: "Excessive Vessel Idling Duration",
    description: "Triggers when a commercial vessel remains stationary (<0.5 kn) longer than threshold",
    metric: "STATIONARY_HOLD",
    threshold: 8,
    unit: "hours",
    severity: "WARNING",
    enabled: true,
  },
  {
    id: "rule-telemetry-blackout",
    name: "Kinematic AIS Data Gap",
    description: "Triggers when gap between consecutive AIS position fixes exceeds threshold",
    metric: "DATA_GAP",
    threshold: 45,
    unit: "minutes",
    severity: "WARNING",
    enabled: true,
  },
  {
    id: "rule-traffic-spike",
    name: "High Traffic Inbound Density",
    description: "Triggers when total vessels monitored in port boundary exceeds threshold",
    metric: "TRAFFIC_SURGE",
    threshold: 7,
    unit: "vessels",
    severity: "ADVISORY",
    enabled: true,
  },
];

/**
 * Evaluates configured rules against the 24-hour historical archive.
 */
export function evaluateHistoricalAlerts(
  rules: AlertRuleConfig[] = DEFAULT_ALERT_RULES,
): TriggeredAlert[] {
  const archive = getHistoricalArchive();
  const alerts: TriggeredAlert[] = [];

  const activeRules = rules.filter((r) => r.enabled);

  // 1. Evaluate Vessel-Level Rules (Data Gaps & Stationary Holds)
  archive.vessels.forEach((vessel) => {
    // Gap Rule
    const gapRule = activeRules.find((r) => r.metric === "DATA_GAP");
    if (gapRule) {
      for (let i = 1; i < vessel.positions.length; i++) {
        const gapMin = (vessel.positions[i].timestamp - vessel.positions[i - 1].timestamp) / 60000;
        if (gapMin >= gapRule.threshold) {
          alerts.push({
            id: `alert-gap-${vessel.id}-${i}`,
            ruleId: gapRule.id,
            ruleName: gapRule.name,
            timestamp: vessel.positions[i].timestamp,
            entityType: "VESSEL",
            entityId: vessel.id,
            entityName: vessel.name,
            severity: gapRule.severity,
            triggerValue: Math.round(gapMin),
            thresholdValue: gapRule.threshold,
            unit: "minutes",
            message: `AIS transmission gap of ${Math.round(gapMin)} min observed between fixes #${i} and #${i + 1}`,
            evidenceRef: `Vessel telemetry gap fix #POS-${i}`,
            acknowledged: false,
          });
          break; // Flag once per vessel
        }
      }
    }

    // Stationary Hold Rule
    const holdRule = activeRules.find((r) => r.metric === "STATIONARY_HOLD");
    if (holdRule && vessel.timeStationaryHours && vessel.timeStationaryHours >= holdRule.threshold) {
      alerts.push({
        id: `alert-hold-${vessel.id}`,
        ruleId: holdRule.id,
        ruleName: holdRule.name,
        timestamp: vessel.lastObserved,
        entityType: "VESSEL",
        entityId: vessel.id,
        entityName: vessel.name,
        severity: holdRule.severity,
        triggerValue: vessel.timeStationaryHours,
        thresholdValue: holdRule.threshold,
        unit: "hours",
        message: `Stationary anchorage duration reached ${vessel.timeStationaryHours.toFixed(1)} continuous hours (<0.5 kn)`,
        evidenceRef: `Continuous SOG log <0.5 kn at ${vessel.portName || "approach"}`,
        acknowledged: false,
      });
    }
  });

  // 2. Evaluate Port-Level Rules (Queue & Density)
  MONITORED_PORTS.forEach((port) => {
    const portVessels = archive.vessels.filter((v) => v.portId === port.id);
    const stationaryCount = portVessels.filter((v) => (v.timeStationaryHours || 0) > 4).length;
    const totalCount = portVessels.length;

    // Queue Rule
    const queueRule = activeRules.find((r) => r.metric === "QUEUE_THRESHOLD");
    if (queueRule && stationaryCount >= queueRule.threshold) {
      alerts.push({
        id: `alert-queue-${port.id}`,
        ruleId: queueRule.id,
        ruleName: queueRule.name,
        timestamp: archive.vessels[0]?.lastObserved || Date.now(),
        entityType: "PORT",
        entityId: port.id,
        entityName: port.name,
        severity: queueRule.severity,
        triggerValue: stationaryCount,
        thresholdValue: queueRule.threshold,
        unit: "vessels",
        message: `Anchorage queue exceeded capacity limit: ${stationaryCount} vessels actively waiting`,
        evidenceRef: `Aggregated approach geofence count at ${port.name}`,
        acknowledged: false,
      });
    }

    // Traffic Surge Rule
    const surgeRule = activeRules.find((r) => r.metric === "TRAFFIC_SURGE");
    if (surgeRule && totalCount >= surgeRule.threshold) {
      alerts.push({
        id: `alert-surge-${port.id}`,
        ruleId: surgeRule.id,
        ruleName: surgeRule.name,
        timestamp: archive.vessels[0]?.lastObserved || Date.now(),
        entityType: "PORT",
        entityId: port.id,
        entityName: port.name,
        severity: surgeRule.severity,
        triggerValue: totalCount,
        thresholdValue: surgeRule.threshold,
        unit: "vessels",
        message: `Monitored vessel density peaked at ${totalCount} vessels in gateway jurisdiction`,
        evidenceRef: `24h cumulative boundary presence count at ${port.name}`,
        acknowledged: false,
      });
    }
  });

  return alerts.sort((a, b) => b.timestamp - a.timestamp);
}

