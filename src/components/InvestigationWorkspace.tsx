import { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  CheckCircle,
  Clock,
  Shield,
  Search,
  BookOpen,
  User,
  Tag,
  AlertCircle,
  FileCode,
} from "lucide-react";
import {
  getStoredInvestigations,
  saveInvestigation,
  deleteInvestigation,
  exportInvestigationMarkdown,
  type InvestigationCase,
  type InvestigationFinding,
} from "@/lib/investigationStore";
import { MONITORED_PORTS } from "@/lib/historicalData";
import { Card } from "@/components/ui-bits";

export function InvestigationWorkspace() {
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // New Case Form State
  const [newTitle, setNewTitle] = useState("");
  const [newTargetType, setNewTargetType] = useState<"PORT" | "VESSEL" | "CORRIDOR">("PORT");
  const [newTargetName, setNewTargetName] = useState("Port of Rotterdam");
  const [newLeadAnalyst, setNewLeadAnalyst] = useState("Chief Intelligence Officer");
  const [newSummary, setNewSummary] = useState("");

  // New Finding Form State
  const [findingType, setFindingType] = useState<"FACT" | "INFERENCE" | "ANALYST_NOTE" | "HYPOTHESIS">("FACT");
  const [findingStatement, setFindingStatement] = useState("");
  const [findingEvidence, setFindingEvidence] = useState("");

  useEffect(() => {
    const list = getStoredInvestigations();
    setCases(list);
    if (list.length > 0 && !activeCaseId) {
      setActiveCaseId(list[0].id);
    }
  }, [activeCaseId]);

  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0];

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newCase: InvestigationCase = {
      id: `case-${Date.now()}`,
      title: newTitle.trim(),
      targetType: newTargetType,
      targetId: newTargetName.toLowerCase().replace(/\s+/g, "-"),
      targetName: newTargetName.trim(),
      timeWindowStart: Date.now() - 24 * 3600 * 1000,
      timeWindowEnd: Date.now(),
      leadAnalyst: newLeadAnalyst.trim() || "Maritime Intelligence Analyst",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "OPEN",
      summary: newSummary.trim() || "Operational incident investigation underway.",
      findings: [
        {
          id: `f-${Date.now()}`,
          type: "FACT",
          statement: "Telemetry observation initiated across 24h historical archive window.",
          evidenceRef: "AIS Position Stream fix #1",
        },
      ],
    };

    saveInvestigation(newCase);
    const updated = getStoredInvestigations();
    setCases(updated);
    setActiveCaseId(newCase.id);
    setIsCreatingNew(false);
    setNewTitle("");
    setNewSummary("");
  };

  const handleAddFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !findingStatement.trim()) return;

    const newFinding: InvestigationFinding = {
      id: `f-${Date.now()}`,
      type: findingType,
      statement: findingStatement.trim(),
      evidenceRef: findingEvidence.trim() || "Kinematic replay observation",
      timestamp: Date.now(),
    };

    const updatedCase: InvestigationCase = {
      ...activeCase,
      findings: [...activeCase.findings, newFinding],
    };

    saveInvestigation(updatedCase);
    setCases(getStoredInvestigations());
    setFindingStatement("");
    setFindingEvidence("");
  };

  const handleRemoveFinding = (findingId: string) => {
    if (!activeCase) return;
    const updatedCase: InvestigationCase = {
      ...activeCase,
      findings: activeCase.findings.filter((f) => f.id !== findingId),
    };
    saveInvestigation(updatedCase);
    setCases(getStoredInvestigations());
  };

  const handleUpdateStatus = (newStatus: "OPEN" | "UNDER_REVIEW" | "CLOSED") => {
    if (!activeCase) return;
    const updatedCase: InvestigationCase = {
      ...activeCase,
      status: newStatus,
    };
    saveInvestigation(updatedCase);
    setCases(getStoredInvestigations());
  };

  const handleDeleteCase = (id: string) => {
    deleteInvestigation(id);
    const updated = getStoredInvestigations();
    setCases(updated);
    if (activeCaseId === id) {
      setActiveCaseId(updated[0]?.id || "");
    }
  };

  // Export Markdown Report
  const handleExportMarkdown = () => {
    if (!activeCase) return;
    const md = exportInvestigationMarkdown(activeCase);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeCase.title.replace(/\s+/g, "_")}_Dossier.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export JSON Report
  const handleExportJson = () => {
    if (!activeCase) return;
    const str = JSON.stringify(activeCase, null, 2);
    const blob = new Blob([str], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeCase.title.replace(/\s+/g, "_")}_Dossier.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            Incident Investigation Workspace & Evidence Dossier
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Formal incident dossier workbench with evidentiary fact vs hypothesis taxonomy, analyst annotations, and exportable intelligence briefings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreatingNew(!isCreatingNew)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isCreatingNew ? "Cancel" : "New Investigation"}</span>
          </button>
        </div>
      </div>

      {/* New Case Creator Modal/Form */}
      {isCreatingNew && (
        <Card className="p-4 border-cyan-500/40 bg-cyan-500/5 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4 text-cyan-400" />
            Create Incident Investigation Dossier
          </h3>
          <form onSubmit={handleCreateCase} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">Investigation Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Singapore Outer Roads Queuing Anomaly"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Lead Analyst</label>
                <input
                  type="text"
                  value={newLeadAnalyst}
                  onChange={(e) => setNewLeadAnalyst(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Target Type</label>
                <select
                  value={newTargetType}
                  onChange={(e) => setNewTargetType(e.target.value as any)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground mt-1"
                >
                  <option value="PORT">Port Facility</option>
                  <option value="VESSEL">Commercial Vessel</option>
                  <option value="CORRIDOR">Shipping Corridor</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Target Name</label>
                <input
                  type="text"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  placeholder="e.g. Port of Rotterdam"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Executive Incident Summary</label>
              <textarea
                rows={2}
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="Brief summary of what was observed, anomalies identified, and hypothesis under review..."
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Create Dossier
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Case List Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="p-3 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Active Dossiers ({cases.length})
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {cases.map((c) => {
                const isSelected = activeCase?.id === c.id;
                const statusColor =
                  c.status === "CLOSED"
                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                    : c.status === "UNDER_REVIEW"
                    ? "text-amber-500 bg-amber-500/10 border-amber-500/30"
                    : "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";

                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveCaseId(c.id)}
                    className={`cursor-pointer rounded-lg p-3 text-xs transition-all border ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-foreground line-clamp-1">{c.title}</h4>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border shrink-0 ${statusColor}`}>
                        {c.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-1.5">
                      <span>{c.targetName}</span>
                      <span>•</span>
                      <span>{c.findings.length} findings</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Active Case Workspace (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {activeCase ? (
            <>
              {/* Dossier Header */}
              <Card className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground">{activeCase.title}</h3>
                      <span className="text-xs font-mono text-muted-foreground">[{activeCase.id}]</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                      <span>Lead: <strong className="text-foreground">{activeCase.leadAnalyst}</strong></span>
                      <span>Target: <strong className="text-foreground">{activeCase.targetName}</strong></span>
                      <span>Updated: {new Date(activeCase.updatedAt).toISOString().substring(0, 10)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportMarkdown}
                      className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      title="Download formal Markdown briefing"
                    >
                      <Download className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Export Dossier (.md)</span>
                    </button>
                    <button
                      onClick={handleExportJson}
                      className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      title="Download JSON"
                    >
                      <FileCode className="h-3.5 w-3.5 text-emerald-400" />
                      <span>JSON</span>
                    </button>
                    <button
                      onClick={() => handleDeleteCase(activeCase.id)}
                      className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Delete dossier"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border/50">
                  {activeCase.summary}
                </p>

                {/* Status Switcher */}
                <div className="flex items-center gap-2 pt-2 text-xs">
                  <span className="text-muted-foreground text-[11px] font-mono">Case Status:</span>
                  {(["OPEN", "UNDER_REVIEW", "CLOSED"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(st)}
                      className={`rounded-sm px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        activeCase.status === st
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Add Finding Form */}
              <Card className="p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Append Evidentiary Finding
                </h4>

                <form onSubmit={handleAddFinding} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground font-mono">Taxonomy Type</label>
                      <select
                        value={findingType}
                        onChange={(e) => setFindingType(e.target.value as any)}
                        className="w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground mt-0.5"
                      >
                        <option value="FACT">FACT (Verified AIS Telemetry)</option>
                        <option value="INFERENCE">INFERENCE (Kinematic Model)</option>
                        <option value="HYPOTHESIS">HYPOTHESIS (Operational Claim)</option>
                        <option value="ANALYST_NOTE">ANALYST NOTE (Context)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] text-muted-foreground font-mono">Evidence Reference / Source</label>
                      <input
                        type="text"
                        value={findingEvidence}
                        onChange={(e) => setFindingEvidence(e.target.value)}
                        placeholder="e.g. SOG fix #14 (<0.5 kn) or Corridor model #AsiaEurope"
                        className="w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground mt-0.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground font-mono">Finding Statement</label>
                    <input
                      type="text"
                      required
                      value={findingStatement}
                      onChange={(e) => setFindingStatement(e.target.value)}
                      placeholder="Concise analytical statement..."
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground mt-0.5"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Save Finding
                    </button>
                  </div>
                </form>
              </Card>

              {/* Findings List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Recorded Findings & Evidence ({activeCase.findings.length})
                </h4>

                {activeCase.findings.map((f) => {
                  const tagColor =
                    f.type === "FACT"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      : f.type === "INFERENCE"
                      ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/30"
                      : f.type === "HYPOTHESIS"
                      ? "text-purple-400 bg-purple-500/10 border-purple-500/30"
                      : "text-amber-400 bg-amber-500/10 border-amber-500/30";

                  return (
                    <Card key={f.id} className="p-3 flex items-start justify-between gap-3 border-border">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border ${tagColor}`}>
                            {f.type}
                          </span>
                          <span className="text-xs text-foreground font-medium">{f.statement}</span>
                        </div>
                        {f.evidenceRef && (
                          <div className="text-[11px] font-mono text-muted-foreground">
                            Evidence: <code>{f.evidenceRef}</code>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveFinding(f.id)}
                        className="text-muted-foreground hover:text-rose-500 transition-colors p-1"
                        title="Remove finding"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              Select or create an investigation dossier.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
