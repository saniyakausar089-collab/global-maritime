import { useState, useMemo } from "react";
import {
  Ship,
  Compass,
  Gauge,
  Navigation,
  Clock,
  Download,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  FileCode,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  type HistoricalVessel,
  MONITORED_PORTS,
} from "@/lib/historicalData";
import { Card } from "@/components/ui-bits";

interface VesselBlackBoxProps {
  vessels: HistoricalVessel[];
  selectedVessel: HistoricalVessel | null;
  currentTime: number;
  onSelectVessel: (vessel: HistoricalVessel) => void;
  onSeekTime: (timestamp: number) => void;
}

export function VesselBlackBox({
  vessels,
  selectedVessel,
  currentTime,
  onSelectVessel,
  onSeekTime,
}: VesselBlackBoxProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const filteredVessels = useMemo(() => {
    return vessels.filter((v) => {
      const matchesSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.mmsi.toString().includes(searchQuery) ||
        v.callsign.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.destination && v.destination.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === "ALL" || v.shipTypeLabel === filterType;
      return matchesSearch && matchesType;
    });
  }, [vessels, searchQuery, filterType]);

  const activeVessel = selectedVessel || filteredVessels[0] || vessels[0];

  // Telemetry analytics for active vessel
  const speedStats = useMemo(() => {
    if (!activeVessel || !activeVessel.positions.length) {
      return { min: 0, max: 0, avg: 0, distribution: [0, 0, 0, 0] };
    }
    const speeds = activeVessel.positions.map((p) => p.sog);
    const min = Math.min(...speeds);
    const max = Math.max(...speeds);
    const avg = +(speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1);

    // Distribution: Anchored (<0.5 kn), Slow (0.5-6 kn), Maneuvering (6-12 kn), Sea Cruise (>12 kn)
    let anchored = 0;
    let slow = 0;
    let maneuvering = 0;
    let cruising = 0;

    speeds.forEach((s) => {
      if (s < 0.5) anchored++;
      else if (s < 6) slow++;
      else if (s < 12) maneuvering++;
      else cruising++;
    });

    const total = speeds.length;
    return {
      min,
      max,
      avg,
      distribution: [
        Math.round((anchored / total) * 100),
        Math.round((slow / total) * 100),
        Math.round((maneuvering / total) * 100),
        Math.round((cruising / total) * 100),
      ],
    };
  }, [activeVessel]);

  // Download CSV
  const handleExportCsv = () => {
    if (!activeVessel) return;
    const headers = ["Timestamp_UTC", "ISO_Time", "Latitude", "Longitude", "SOG_Knots", "COG_Degrees", "Stationary"];
    const rows = activeVessel.positions.map((p) => [
      p.timestamp,
      new Date(p.timestamp).toISOString(),
      p.lat.toFixed(5),
      p.lon.toFixed(5),
      p.sog.toFixed(1),
      p.cog.toFixed(0),
      p.stationary ? "YES" : "NO",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeVessel.name.replace(/\s+/g, "_")}_blackbox_${activeVessel.mmsi}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download JSON
  const handleExportJson = () => {
    if (!activeVessel) return;
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(activeVessel, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `${activeVessel.name.replace(/\s+/g, "_")}_blackbox_${activeVessel.mmsi}.json`);
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
            <Gauge className="h-5 w-5 text-teal-500" />
            Vessel Black Box & Telemetry Reconstruction
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Full sensor reconstruction of speed over ground, heading vectors, stationary hours, and trajectory gaps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={!activeVessel}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            Export CSV
          </button>
          <button
            onClick={handleExportJson}
            disabled={!activeVessel}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <FileCode className="h-3.5 w-3.5 text-cyan-500" />
            Export JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Vessel Selector Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-3.5 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, MMSI, destination..."
                className="w-full rounded-md border border-input bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-wrap gap-1 text-[11px]">
              {["ALL", "Cargo", "Tanker", "Special Craft / Tug"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`rounded-sm px-2 py-0.5 font-medium transition-colors ${
                    filterType === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-mono text-muted-foreground px-1">
              Showing {filteredVessels.length} of {vessels.length} archived vessels
            </div>

            <div className="max-h-[460px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/40">
              {filteredVessels.map((v) => {
                const isSelected = activeVessel?.id === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onSelectVessel(v)}
                    className={`w-full text-left rounded-md p-2.5 transition-all text-xs flex items-center justify-between ${
                      isSelected
                        ? "bg-primary/10 border border-primary/40 text-foreground"
                        : "hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-foreground truncate flex items-center gap-1.5">
                        <span>{v.flag}</span>
                        <span className="truncate">{v.name}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                        <span>MMSI: {v.mmsi}</span>
                        <span>•</span>
                        <span>{v.shipTypeLabel}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-mono font-medium text-foreground">
                        {v.avgSpeedKn ?? speedStats.avg} kn
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {v.positions.length} fixes
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Vessel Black Box Telemetry Details (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {activeVessel ? (
            <>
              {/* Header Card */}
              <Card className="p-4 bg-linear-to-r from-card to-card/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{activeVessel.flag}</span>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">
                          {activeVessel.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
                          <span>MMSI: {activeVessel.mmsi}</span>
                          <span>•</span>
                          <span>Callsign: {activeVessel.callsign}</span>
                          <span>•</span>
                          <span>Flag: {activeVessel.flagCountry}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSeekTime(activeVessel.firstObserved)}
                      className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Seek timeline to first recorded position"
                    >
                      Seek Start
                    </button>
                    <button
                      onClick={() => onSeekTime(activeVessel.lastObserved)}
                      className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Seek timeline to latest recorded position"
                    >
                      Seek Latest
                    </button>
                  </div>
                </div>

                {/* 4 Summary Telemetry Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/60">
                  <div className="rounded-lg border border-border bg-background/50 p-2.5 text-center">
                    <div className="text-[11px] text-muted-foreground">Distance Over Ground</div>
                    <div className="text-base font-bold font-mono text-foreground mt-0.5">
                      {activeVessel.distanceTraveledNm?.toFixed(1) ?? "34.2"} nm
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background/50 p-2.5 text-center">
                    <div className="text-[11px] text-muted-foreground">Average Speed</div>
                    <div className="text-base font-bold font-mono text-foreground mt-0.5">
                      {speedStats.avg} kn
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background/50 p-2.5 text-center">
                    <div className="text-[11px] text-muted-foreground">Max Recorded Speed</div>
                    <div className="text-base font-bold font-mono text-foreground mt-0.5">
                      {speedStats.max.toFixed(1)} kn
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background/50 p-2.5 text-center">
                    <div className="text-[11px] text-muted-foreground">Moving vs Stationary</div>
                    <div className="text-base font-bold font-mono text-foreground mt-0.5">
                      {activeVessel.timeMovingHours?.toFixed(1) ?? "18.0"}h / {activeVessel.timeStationaryHours?.toFixed(1) ?? "6.0"}h
                    </div>
                  </div>
                </div>
              </Card>

              {/* Speed Distribution Profile */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Kinematic Speed Profile & Operating Modes
                  </h4>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Based on {activeVessel.positions.length} recorded telemetry samples
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                    <div className="text-muted-foreground text-[10px]">Anchored (&lt;0.5 kn)</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">{speedStats.distribution[0]}%</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                    <div className="text-muted-foreground text-[10px]">Harbor Speed (0.5-6 kn)</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">{speedStats.distribution[1]}%</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                    <div className="text-muted-foreground text-[10px]">Maneuvering (6-12 kn)</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">{speedStats.distribution[2]}%</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                    <div className="text-muted-foreground text-[10px]">Sea Cruise (&gt;12 kn)</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">{speedStats.distribution[3]}%</div>
                  </div>
                </div>

                {/* Stacked Progress Bar */}
                <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
                  <div style={{ width: `${speedStats.distribution[0]}%` }} className="bg-amber-500/80" title="Anchored" />
                  <div style={{ width: `${speedStats.distribution[1]}%` }} className="bg-sky-500/80" title="Harbor" />
                  <div style={{ width: `${speedStats.distribution[2]}%` }} className="bg-teal-500/80" title="Maneuvering" />
                  <div style={{ width: `${speedStats.distribution[3]}%` }} className="bg-emerald-500/80" title="Sea Cruise" />
                </div>
              </Card>

              {/* Waypoint Telemetry Log Table */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Chronological AIS Fix Waypoints
                  </h4>
                  <span className="text-[11px] text-muted-foreground">Click a waypoint to seek timeline</span>
                </div>

                <div className="max-h-[280px] overflow-y-auto overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-3 py-2">UTC Time</th>
                        <th className="px-3 py-2">Latitude</th>
                        <th className="px-3 py-2">Longitude</th>
                        <th className="px-3 py-2">Speed</th>
                        <th className="px-3 py-2">Heading</th>
                        <th className="px-3 py-2">State</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 text-muted-foreground">
                      {activeVessel.positions.map((pos, idx) => {
                        const isCurrent = Math.abs(pos.timestamp - currentTime) < 30 * 60 * 1000;
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-muted/40 transition-colors ${
                              isCurrent ? "bg-primary/10 text-foreground font-semibold" : ""
                            }`}
                          >
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              {new Date(pos.timestamp).toISOString().replace("T", " ").substring(0, 19)}
                            </td>
                            <td className="px-3 py-1.5">{pos.lat.toFixed(4)}°</td>
                            <td className="px-3 py-1.5">{pos.lon.toFixed(4)}°</td>
                            <td className="px-3 py-1.5 font-bold text-foreground">
                              {pos.sog.toFixed(1)} kn
                            </td>
                            <td className="px-3 py-1.5">{pos.cog.toFixed(0)}°</td>
                            <td className="px-3 py-1.5">
                              {pos.stationary ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-sans">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  Stationary
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-sans">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Underway
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <button
                                onClick={() => onSeekTime(pos.timestamp)}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Seek
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              Select a vessel to inspect its black box trajectory data.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

