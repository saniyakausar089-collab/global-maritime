/**
 * TEMPORAL KNOWLEDGE GRAPH ENGINE
 * 
 * Represents maritime domain entities (Vessels, Ports, Voyages, Events, Scenarios, Corridors)
 * as graph nodes with time-bounded, typed relationships and provenance trails.
 */

import {
  getHistoricalArchive,
  type HistoricalVessel,
  type HistoricalEvent,
  type PortArea,
  MONITORED_PORTS,
  PORT_NETWORK_EDGES,
  ARCHIVE_START_TIME,
  ARCHIVE_END_TIME,
} from "./historicalData";

export type GraphNodeType =
  | "VESSEL"
  | "PORT"
  | "VOYAGE"
  | "EVENT"
  | "SCENARIO"
  | "CORRIDOR";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  subLabel?: string;
  entityId: string | number;
  properties: Record<string, any>;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation:
    | "OBSERVED_AT"
    | "ENTERED_PORT"
    | "DEPARTED_PORT"
    | "CONNECTS_CORRIDOR"
    | "TRIGGERED_EVENT"
    | "OPERATES_ON"
    | "BELONGS_TO_SCENARIO";
  label: string;
  validFrom?: number;
  validTo?: number;
  confidence: "DIRECT_OBSERVATION" | "DERIVED_RULE" | "INFERRED_MODEL";
  provenance: string;
}

export interface TemporalKnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Builds the complete temporal knowledge graph from the verified historical archive.
 */
export function buildMaritimeKnowledgeGraph(timeFilter?: { start: number; end: number }): TemporalKnowledgeGraph {
  const archive = getHistoricalArchive();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const startTime = timeFilter?.start ?? ARCHIVE_START_TIME;
  const endTime = timeFilter?.end ?? ARCHIVE_END_TIME;

  // 1. Port Nodes
  MONITORED_PORTS.forEach((port) => {
    nodes.push({
      id: `port-${port.id}`,
      type: "PORT",
      label: `${port.flag} ${port.name}`,
      subLabel: `${port.annualTeuMillions}M TEU/yr`,
      entityId: port.id,
      properties: {
        country: port.country,
        lat: port.lat,
        lon: port.lon,
        turnaroundHours: port.avgBerthTurnaroundHours,
      },
    });
  });

  // 2. Corridor Edges between Ports
  PORT_NETWORK_EDGES.forEach((corridor, idx) => {
    const corridorNodeId = `corridor-${corridor.fromPortId}-${corridor.toPortId}`;
    nodes.push({
      id: corridorNodeId,
      type: "CORRIDOR",
      label: corridor.corridorName,
      subLabel: `${corridor.transitDays}d transit • ${corridor.avgVolumeTeuWeekly.toLocaleString()} TEU/wk`,
      entityId: corridorNodeId,
      properties: {
        transitDays: corridor.transitDays,
        weeklySailings: corridor.weeklySailings,
        volumeTeu: corridor.avgVolumeTeuWeekly,
      },
    });

    edges.push({
      id: `edge-corr-from-${idx}`,
      source: `port-${corridor.fromPortId}`,
      target: corridorNodeId,
      relation: "CONNECTS_CORRIDOR",
      label: "Originates",
      confidence: "DIRECT_OBSERVATION",
      provenance: "Global Shipping Line Master Schedule",
    });

    edges.push({
      id: `edge-corr-to-${idx}`,
      source: corridorNodeId,
      target: `port-${corridor.toPortId}`,
      relation: "CONNECTS_CORRIDOR",
      label: "Terminates",
      confidence: "DIRECT_OBSERVATION",
      provenance: "Global Shipping Line Master Schedule",
    });
  });

  // 3. Vessel Nodes
  archive.vessels.forEach((vessel) => {
    // Check if vessel has observations within time window
    const inWindow = vessel.positions.some(
      (p) => p.timestamp >= startTime && p.timestamp <= endTime,
    );
    if (!inWindow) return;

    const vesselNodeId = `vessel-${vessel.id}`;
    nodes.push({
      id: vesselNodeId,
      type: "VESSEL",
      label: `${vessel.flag} ${vessel.name}`,
      subLabel: `MMSI: ${vessel.mmsi} • ${vessel.shipTypeLabel}`,
      entityId: vessel.id,
      properties: {
        mmsi: vessel.mmsi,
        callsign: vessel.callsign,
        flag: vessel.flagCountry,
        type: vessel.shipTypeLabel,
        avgSpeedKn: vessel.avgSpeedKn,
        destination: vessel.destination,
      },
    });

    // Link vessel to assigned/approached port
    if (vessel.portId) {
      edges.push({
        id: `edge-vessel-port-${vessel.id}`,
        source: vesselNodeId,
        target: `port-${vessel.portId}`,
        relation: "OBSERVED_AT",
        label: "Approach Zone",
        validFrom: vessel.firstObserved,
        validTo: vessel.lastObserved,
        confidence: "DIRECT_OBSERVATION",
        provenance: `AIS telemetry fixes (${vessel.positions.length} recorded waypoints)`,
      });
    }
  });

  // 4. Historical Event Nodes
  archive.events.forEach((evt) => {
    if (evt.timestamp < startTime || evt.timestamp > endTime) return;

    const eventNodeId = `event-${evt.id}`;
    nodes.push({
      id: eventNodeId,
      type: "EVENT",
      label: evt.title,
      subLabel: `${new Date(evt.timestamp).toISOString().substring(11, 16)} UTC`,
      entityId: evt.id,
      properties: {
        timestamp: evt.timestamp,
        rule: evt.rule,
        confidence: evt.confidence,
        description: evt.description,
      },
    });

    // Link event to Vessel
    edges.push({
      id: `edge-evt-vessel-${evt.id}`,
      source: eventNodeId,
      target: `vessel-${evt.vesselId}`,
      relation: "TRIGGERED_EVENT",
      label: "Involves Vessel",
      validFrom: evt.timestamp,
      validTo: evt.timestamp,
      confidence: evt.confidence === "Observed" ? "DIRECT_OBSERVATION" : "DERIVED_RULE",
      provenance: `Rule engine check: ${evt.rule}`,
    });

    // Link event to Port
    edges.push({
      id: `edge-evt-port-${evt.id}`,
      source: eventNodeId,
      target: `port-${evt.portId}`,
      relation: "ENTERED_PORT",
      label: "Occurred At",
      validFrom: evt.timestamp,
      validTo: evt.timestamp,
      confidence: "DERIVED_RULE",
      provenance: `Geofence radius boundary check at ${evt.portName}`,
    });
  });

  return { nodes, edges };
}

/**
 * Filter graph by entity type or query
 */
export function queryKnowledgeGraph(
  graph: TemporalKnowledgeGraph,
  options: {
    types?: GraphNodeType[];
    searchQuery?: string;
    focusNodeId?: string;
    degree?: number;
  },
): TemporalKnowledgeGraph {
  let filteredNodes = graph.nodes;

  if (options.types && options.types.length > 0) {
    filteredNodes = filteredNodes.filter((n) => options.types!.includes(n.type));
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    const q = options.searchQuery.toLowerCase();
    filteredNodes = filteredNodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        (n.subLabel && n.subLabel.toLowerCase().includes(q)),
    );
  }

  // Neighbor expansion if focusNodeId is provided
  if (options.focusNodeId) {
    const connectedNodeIds = new Set<string>([options.focusNodeId]);
    graph.edges.forEach((e) => {
      if (e.source === options.focusNodeId) connectedNodeIds.add(e.target);
      if (e.target === options.focusNodeId) connectedNodeIds.add(e.source);
    });

    filteredNodes = graph.nodes.filter((n) => connectedNodeIds.has(n.id));
  }

  const validNodeIdSet = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = graph.edges.filter(
    (e) => validNodeIdSet.has(e.source) && validNodeIdSet.has(e.target),
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}
