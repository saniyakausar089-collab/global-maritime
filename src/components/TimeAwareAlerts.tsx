import { useState, useMemo } from "react";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  CheckCircle,
  Sliders,
  Clock,
  Info,
  Check,
} from "lucide-react";
import {
  evaluateHistoricalAlerts,
  DEFAULT_ALERT_RULES,
  type AlertRuleConfig,
  type TriggeredAlert,
} from "@/lib/alertEngine";
import { Card } from "@/components/ui-bits";

interface TimeAwareAlertsProps {
  onSeekTime?: (timestamp: number) => void;
}

export function TimeAwareAlerts({ onSeekTime }: TimeAwareAlertsProps) {
  const [rules, setRules] = useState<AlertRuleConfig[]>(DEFAULT_ALERT_RULES);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  const alerts = useMemo(() => {
    return evaluateHistoricalAlerts(rules);
  }, [rules]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter === "ALL") return true;
      return a.severity === severityFilter;
    });
  }, [alerts, severityFilter]);

  const toggleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-400" />
            Time-Aware Event & Historical Alert Engine
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configurable operational rule engine evaluating retroactive threshold violations across the 24-hour recorded dataset.
          </p>
        </div>

        {/* Retrospective disclaimer pill */}
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-mono text-muted-foreground">
          <Info className="h-3.5 w-3.5 text-cyan-400" />
          <span>Retrospective Analysis — Not Real-Time Pushes</span>
        </div>
      </div>

      {/* Configurable Alert Rules Summary */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5" />
          Active Detection Rules ({rules.filter((r) => r.enabled).length} of {rules.length})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {rules.map((rule) => {
            const severityColor =
              rule.severity === "CRITICAL"
                ? "text-rose-400 border-rose-500/30"
                : rule.severity === "WARNING"
                ? "text-amber-400 border-amber-500/30"
                : "text-sky-400 border-sky-500/30";

            return (
              <div
                key={rule.id}
                className={`rounded-lg border p-3 text-xs space-y-1.5 transition-all ${
                  rule.enabled
                    ? "bg-card border-border"
                    : "bg-muted/30 border-border/40 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold uppercase border px-1.5 py-0.2 rounded-xs ${severityColor}`}>
                    {rule.severity}
                  </span>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className="text-[10px] font-mono text-primary hover:underline"
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </button>
                </div>

                <div className="font-bold text-foreground truncate">{rule.name}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-2">
                  {rule.description}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                  Threshold: <strong>{rule.threshold} {rule.unit}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground text-[11px] font-mono mr-1">Severity:</span>
          {["ALL", "CRITICAL", "WARNING", "ADVISORY"].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                severityFilter === sev
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <span className="text-xs font-mono text-muted-foreground">
          {filteredAlerts.length} triggered alert instances
        </span>
      </div>

      {/* Alert Cards Feed */}
      <div className="space-y-3">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => {
            const isAck = acknowledgedIds.has(alert.id);
            const severityClass =
              alert.severity === "CRITICAL"
                ? "border-rose-500/40 bg-rose-500/5 text-rose-400"
                : alert.severity === "WARNING"
                ? "border-amber-500/40 bg-amber-500/5 text-amber-400"
                : "border-sky-500/40 bg-sky-500/5 text-sky-400";

            return (
              <Card
                key={alert.id}
                className={`p-4 transition-all border ${severityClass} ${
                  isAck ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-sm bg-card border px-2 py-0.5 text-[10px] font-mono font-bold uppercase">
                        {alert.severity}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">
                        {alert.ruleName}
                      </h4>
                      {isAck && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                          <CheckCircle className="h-3 w-3" /> Reviewed
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {alert.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.timestamp).toISOString().replace("T", " ").substring(0, 19)} UTC
                      </span>
                      <span>Target: <strong className="text-foreground">{alert.entityName}</strong></span>
                      <span>Trigger: <strong>{alert.triggerValue} {alert.unit}</strong> (Limit: {alert.thresholdValue})</span>
                      <span>Evidence: <code>{alert.evidenceRef}</code></span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0">
                    {onSeekTime && (
                      <button
                        onClick={() => onSeekTime(alert.timestamp)}
                        className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-mono text-foreground hover:bg-muted transition-colors"
                      >
                        Seek Timestamp
                      </button>
                    )}

                    <button
                      onClick={() => toggleAcknowledge(alert.id)}
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
            No historical alert instances triggered under configured parameters.
          </Card>
        )}
      </div>
    </div>
  );
}
