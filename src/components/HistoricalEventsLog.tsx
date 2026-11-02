import { useState } from "react";
import {
  type HistoricalEvent,
} from "@/lib/historicalData";
import {
  Anchor,
  Ship,
  Wind,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
  Filter,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui-bits";

export interface HistoricalEventsLogProps {
  events: HistoricalEvent[];
  selectedEvent: HistoricalEvent | null;
  onSelectEvent: (event: HistoricalEvent) => void;
}

export function HistoricalEventsLog({
  events,
  selectedEvent,
  onSelectEvent,
}: HistoricalEventsLogProps) {
  const [filterType, setFilterType] = useState<string>("all");

  const filteredEvents = events.filter((evt) => {
    if (filterType === "all") return true;
    return evt.type === filterType;
  });

  const getEventBadge = (type: HistoricalEvent["type"]) => {
    switch (type) {
      case "PORT_ENTRY":
        return {
          label: "Port Arrival",
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          icon: Ship,
        };
      case "PORT_DEPARTURE":
        return {
          label: "Departure",
          bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
          icon: Wind,
        };
      case "ANCHORAGE_DROP":
        return {
          label: "Anchorage Drop",
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
          icon: Anchor,
        };
      default:
        return {
          label: "Event",
          bg: "bg-primary/10 text-primary border-primary/30",
          icon: Layers,
        };
    }
  };

  return (
    <Card className="p-4 border border-border bg-card shadow-xs space-y-3">
      {/* Header and Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Anchor className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold text-foreground">Chronological Port Events</h3>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {filteredEvents.length} recorded events
          </span>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline">
            Type:
          </span>
          <button
            onClick={() => setFilterType("all")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
              filterType === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType("PORT_ENTRY")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
              filterType === "PORT_ENTRY" ? "bg-emerald-600 text-white font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Arrivals
          </button>
          <button
            onClick={() => setFilterType("PORT_DEPARTURE")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
              filterType === "PORT_DEPARTURE" ? "bg-cyan-600 text-white font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Departures
          </button>
          <button
            onClick={() => setFilterType("ANCHORAGE_DROP")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
              filterType === "ANCHORAGE_DROP" ? "bg-amber-600 text-white font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Anchor Drops
          </button>
        </div>
      </div>

      {/* Events Scroll Area */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
        {filteredEvents.map((evt) => {
          const badge = getEventBadge(evt.type);
          const Icon = badge.icon;
          const isSelected = selectedEvent?.id === evt.id;
          const timeStr = `${new Date(evt.timestamp).toISOString().slice(11, 19)} UTC`;

          return (
            <div
              key={evt.id}
              onClick={() => onSelectEvent(evt)}
              className={`group cursor-pointer rounded-lg border p-3 transition text-xs ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-2xs"
                  : "border-border bg-background hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.bg}`}>
                    <Icon className="h-3 w-3" />
                    {badge.label}
                  </span>
                  <span className="font-bold text-foreground group-hover:text-primary transition truncate max-w-[200px]">
                    {evt.vesselName}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                  <Clock className="h-3 w-3 text-cyan-500" />
                  <span>{timeStr}</span>
                </div>
              </div>

              <p className="mt-1.5 text-muted-foreground text-[11px] leading-relaxed">
                {evt.description}
              </p>

              <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground">
                <span>
                  Rule: <span className="font-mono">{evt.rule}</span>
                </span>
                <span className="font-semibold text-primary group-hover:underline flex items-center gap-1">
                  Seek Timeline <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
