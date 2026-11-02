import { useState, useMemo } from "react";
import {
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Compass,
  ArrowRight,
  Info,
  Download,
} from "lucide-react";
import { type AnomalyFinding } from "@/lib/historicalData";
import { Card } from "@/components/ui-bits";

interface AnomalyDetectiveProps {
  anomalies: AnomalyFinding[];
  currentTime: number;
  onSeekAnomaly: (timestamp: number, vesselId: number) => void;
}

export function AnomalyDetective({
  anomalies,
  currentTime,
  onSeekAnomaly,
}: AnomalyDetectiveProps) {
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const handleToggleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      const matchesSeverity = severityFilter === "ALL" || a.severity === severityFilter;
      const matchesType = typeFilter === "ALL" || a.type === typeFilter;
      const matchesSearch =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.vesselName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.portName && a.portName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSeverity && matchesType && matchesSearch;
    });
  }, [anomalies, severityFilter, typeFilter, searchQuery]);

  const severityCounts = useMemo(() => {
    return {
      high: anomalies.filter((a) => a.severity === "high").length,
      medium: anomalies.filter((a) => a.severity === "medium").length,
      low: anomalies.filter((a) => a.severity === "low").length,
    };
  }, [anomalies]);

  // Download anomalies as JSON
  const handleExportJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(filteredAnomalies, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `maritime_anomalies_report_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            Rule-Based Maritime Anomaly Detective
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated kinematic verification flagging data blackouts (&gt;35 min), speed drop surges, prolonged anchorage idling, and corridor shifts.
          </p>
        </div>
        <button
          onClick={handleExportJson}
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5 text-cyan-500" />
          Export Findings (.json)
        </button>
      </div>

      {/* Metric Cards: High, Medium, Low */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setSeverityFilter(severityFilter === "high" ? "ALL" : "high")}
          className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
            severityFilter === "high"
              ? "border-rose-500 bg-rose-500/10"
              : "border-border bg-card hover:border-rose-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> High Severity
            </span>
            <span className="text-xl font-bold font-mono text-foreground">{severityCounts.high}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Gaps &gt;120m, rapid speed cuts in active traffic lanes, or acute corridor anomalies.
          </p>
        </div>

        <div
          onClick={() => setSeverityFilter(severityFilter === "medium" ? "ALL" : "medium")}
          className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
            severityFilter === "medium"
              ? "border-amber-500 bg-amber-500/10"
              : "border-border bg-card hover:border-amber-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Medium Severity
            </span>
            <span className="text-xl font-bold font-mono text-foreground">{severityCounts.medium}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Extended anchorage queue holds (&gt;10h) or telemetry dropouts between 35–60 min.
          </p>
        </div>

        <div
          onClick={() => setSeverityFilter(severityFilter === "low" ? "ALL" : "low")}
          className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
            severityFilter === "low"
              ? "border-sky-500 bg-sky-500/10"
              : "border-border bg-card hover:border-sky-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-500 uppercase tracking-wider flex items-center gap-1">
              <Info className="h-3.5 w-3.5" /> Low Severity
            </span>
            <span className="text-xl font-bold font-mono text-foreground">{severityCounts.low}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Minor corridor speed variations and scheduled berth queuing adjustments.
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <Card className="p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by vessel, port, or anomaly description..."
              className="w-full rounded-md border border-input bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground text-[11px] font-mono mr-1">Rule:</span>
            {[
              { id: "ALL", label: "All Rules" },
              { id: "OBSERVATION_GAP", label: "Telemetry Gaps" },
              { id: "PROLONGED_ANCHORAGE", label: "Prolonged Queues" },
              { id: "SPEED_SPIKE", label: "Speed Variance" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  typeFilter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Anomalies List */}
      <div className="space-y-3">
        {filteredAnomalies.length > 0 ? (
          filteredAnomalies.map((item) => {
            const isAck = acknowledgedIds.has(item.id);
            const severityColor =
              item.severity === "high"
                ? "text-rose-500 border-rose-500/30 bg-rose-500/5"
                : item.severity === "medium"
                ? "text-amber-500 border-amber-500/30 bg-amber-500/5"
                : "text-sky-500 border-sky-500/30 bg-sky-500/5";

            const badgeBg =
              item.severity === "high"
                ? "bg-rose-500/20 text-rose-400"
                : item.severity === "medium"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-sky-500/20 text-sky-400";

            return (
              <Card
                key={item.id}
                className={`p-4 transition-all border ${severityColor} ${
                  isAck ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono ${badgeBg}`}
                      >
                        {item.severity}
                      </span>
                      <h4 className="text-sm font-bold text-foreground truncate">
                        {item.title}
                      </h4>
                      {isAck && (
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-mono">
                          <CheckCircle className="h-3 w-3" /> Acknowledged
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.timestamp).toISOString().replace("T", " ").substring(0, 19)} UTC
                      </span>
                      <span>Target: <strong className="text-foreground">{item.vesselName}</strong></span>
                      {item.portName && <span>Port: <strong className="text-foreground">{item.portName}</strong></span>}
                      <span>Rule: <code>{item.rule}</code></span>
                      <span>Threshold: <code>{item.threshold}</code></span>
                      <span className="text-cyan-400 font-semibold">{item.confidence}</span>
                    </div>
                  </div>

                  {/* Actions: Jump to Replay & Acknowledge */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0">
                    <button
                      onClick={() => onSeekAnomaly(item.timestamp, item.vesselId)}
                      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                    >
                      <span>Jump to Time</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleAcknowledge(item.id)}
                      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline transition-colors font-mono"
                    >
                      {isAck ? "Mark Unread" : "Acknowledge"}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            No maritime anomalies matching the selected filters.
          </Card>
        )}
      </div>
    </div>
  );
}

