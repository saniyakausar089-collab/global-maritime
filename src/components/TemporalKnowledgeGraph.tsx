import { useState, useMemo } from "react";
import {
  Network,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Anchor,
  Ship,
  Calendar,
  Compass,
  Info,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import {
  buildMaritimeKnowledgeGraph,
  queryKnowledgeGraph,
  type GraphNode,
  type GraphEdge,
  type GraphNodeType,
} from "@/lib/knowledgeGraph";
import { Card } from "@/components/ui-bits";

interface TemporalKnowledgeGraphProps {
  onSelectVessel?: (vesselId: number) => void;
  onSelectPort?: (portId: string) => void;
  onSeekTime?: (timestamp: number) => void;
}

export function TemporalKnowledgeGraph({
  onSelectVessel,
  onSelectPort,
  onSeekTime,
}: TemporalKnowledgeGraphProps) {
  const [selectedType, setSelectedType] = useState<GraphNodeType | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const fullGraph = useMemo(() => buildMaritimeKnowledgeGraph(), []);

  const filteredGraph = useMemo(() => {
    return queryKnowledgeGraph(fullGraph, {
      types: selectedType === "ALL" ? undefined : [selectedType],
      searchQuery: searchQuery,
      focusNodeId: selectedNodeId || undefined,
    });
  }, [fullGraph, selectedType, searchQuery, selectedNodeId]);

  const activeNode = useMemo(
    () => fullGraph.nodes.find((n) => n.id === selectedNodeId) || filteredGraph.nodes[0],
    [fullGraph.nodes, selectedNodeId, filteredGraph.nodes],
  );

  // Connected edges for the active node
  const activeEdges = useMemo(() => {
    if (!activeNode) return [];
    return fullGraph.edges.filter(
      (e) => e.source === activeNode.id || e.target === activeNode.id,
    );
  }, [fullGraph.edges, activeNode]);

  const typeColor = (type: GraphNodeType) => {
    switch (type) {
      case "PORT":
        return "border-purple-500/40 bg-purple-500/10 text-purple-400";
      case "CORRIDOR":
        return "border-cyan-500/40 bg-cyan-500/10 text-cyan-400";
      case "VESSEL":
        return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
      case "EVENT":
        return "border-amber-500/40 bg-amber-500/10 text-amber-400";
      default:
        return "border-border bg-card text-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Network className="h-5 w-5 text-purple-400" />
            Temporal Knowledge Graph & Provenance Network
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Interconnected topological ontology connecting Ports, Commercial Vessels, Maritime Shipping Corridors, and Recorded Events.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>{fullGraph.nodes.length} Nodes</span>
          <span>•</span>
          <span>{fullGraph.edges.length} Semantic Edges</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge graph (Rotterdam, Singapore, Ever Given, AIS fix)..."
              className="w-full rounded-md border border-input bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground text-[11px] font-mono mr-1">Entity:</span>
            {(["ALL", "PORT", "CORRIDOR", "VESSEL", "EVENT"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSelectedType(t);
                  setSelectedNodeId(null);
                }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  selectedType === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t === "ALL" ? "All Entities" : t}
              </button>
            ))}

            {selectedNodeId && (
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-[11px] text-cyan-400 hover:underline font-mono ml-2"
              >
                Clear Node Filter
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Graph Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Node Explorer Canvas (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing {filteredGraph.nodes.length} nodes & {filteredGraph.edges.length} edges
            </span>
            <span className="font-mono text-[11px]">Click node to inspect relationships</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredGraph.nodes.map((node) => {
              const isSelected = activeNode?.id === node.id;
              const badgeStyle = typeColor(node.type);

              return (
                <Card
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-3 cursor-pointer transition-all border ${
                    isSelected
                      ? "ring-2 ring-primary border-primary shadow-md bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider font-mono border ${badgeStyle}`}
                    >
                      {node.type}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {node.id}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-foreground mt-2 truncate">
                    {node.label}
                  </h4>

                  {node.subLabel && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {node.subLabel}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Selected Entity Dossier & Provenance Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {activeNode ? (
            <Card className="p-4 space-y-4 border-border">
              {/* Header */}
              <div className="border-b border-border pb-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono border ${typeColor(
                      activeNode.type,
                    )}`}
                  >
                    {activeNode.type}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    Node: {activeNode.id}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mt-2">
                  {activeNode.label}
                </h3>
                {activeNode.subLabel && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {activeNode.subLabel}
                  </p>
                )}
              </div>

              {/* Entity Properties */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Entity Metadata & Attributes
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(activeNode.properties).map(([k, v]) => (
                    <div key={k} className="rounded-md bg-muted/40 p-2 font-mono">
                      <div className="text-[10px] text-muted-foreground uppercase">{k}</div>
                      <div className="font-semibold text-foreground truncate mt-0.5">
                        {typeof v === "number" ? v.toLocaleString() : String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connected Semantic Relationships */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Semantic Edges ({activeEdges.length})
                  </h4>
                  <span className="text-[10px] text-muted-foreground font-mono">Provenance Trail</span>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {activeEdges.map((edge) => {
                    const isOutgoing = edge.source === activeNode.id;
                    const counterpartId = isOutgoing ? edge.target : edge.source;
                    const counterpart = fullGraph.nodes.find((n) => n.id === counterpartId);

                    return (
                      <div
                        key={edge.id}
                        onClick={() => setSelectedNodeId(counterpartId)}
                        className="rounded-md border border-border/80 bg-background/50 p-2 text-xs space-y-1 hover:border-primary/40 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-cyan-400 font-semibold">
                            {edge.relation}
                          </span>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            {edge.confidence}
                          </span>
                        </div>

                        <div className="font-medium text-foreground flex items-center gap-1.5 truncate">
                          <span>{isOutgoing ? "→" : "←"}</span>
                          <span className="truncate">{counterpart?.label || counterpartId}</span>
                        </div>

                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          Source: {edge.provenance}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Jump to Map Replay CTA */}
              {activeNode.type === "VESSEL" && onSelectVessel && (
                <button
                  onClick={() => onSelectVessel(Number(activeNode.entityId))}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                >
                  <Ship className="h-3.5 w-3.5" />
                  <span>Inspect Vessel in Historical Replay</span>
                </button>
              )}

              {activeNode.type === "PORT" && onSelectPort && (
                <button
                  onClick={() => onSelectPort(String(activeNode.entityId))}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                >
                  <Anchor className="h-3.5 w-3.5" />
                  <span>Filter Digital Twin to Port</span>
                </button>
              )}
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              Select any graph entity to inspect its knowledge provenance.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
