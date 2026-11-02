import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui-bits";
import { Anchor, ShieldCheck, Database, Navigation, Gauge, AlertCircle, Layers, Cpu } from "lucide-react";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology & Technical Specifications — Global Maritime Port Monitor" },
      {
        name: "description",
        content:
          "Technical documentation of AISStream data pipelines, 25km geofencing, congestion scoring formulas, and navigational heuristics.",
      },
      { property: "og:title", content: "Methodology — Global Maritime Port Monitor" },
      {
        property: "og:description",
        content:
          "Technical documentation of AISStream data pipelines, 25km geofencing, congestion scoring formulas, and navigational heuristics.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Methodology,
});

export function Methodology() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Methodology & Technical Specifications
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Engineering principles, telemetry pipelines, mathematical heuristics, and documented data limitations.
        </p>
      </div>

      {/* 1. Architecture & Pipeline */}
      <Card className="p-4 border border-border bg-card space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <Database className="h-4 w-4 text-primary" />
          <span>1. Live AIS Ingestion & Relay Architecture</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The dashboard ingests maritime Automatic Identification System (AIS) transponder messages broadcast over marine VHF channels (161.975 MHz and 162.025 MHz). Because client browsers cannot maintain authenticated, persistent high-throughput WebSocket sessions under rate quotas, our standalone Node.js relay establishes a single authenticated upstream connection to <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">wss://stream.aisstream.io/v0/stream</code>.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The relay parses raw AIS payloads (Message Types 1, 2, 3, 5, 18, and 19), validates coordinates, computes geofenced port approaches, and batches updates into lightweight JSON delta diffs streamed to browser clients at 2-second intervals.
        </p>
      </Card>

      {/* 2. Port Selection Criteria */}
      <Card className="p-4 border border-border bg-card space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <Anchor className="h-4 w-4 text-cyan-500" />
          <span>2. Monitored Port Selection Criteria</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Six primary commercial gateway ports were selected to provide representative coverage across major global container and tanker lanes:
        </p>
        <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
          <li><strong>Rotterdam (Netherlands):</strong> Europe's largest deepwater container and crude oil hub.</li>
          <li><strong>Singapore (Singapore):</strong> World's busiest transshipment and bunkering hub along the Malacca Strait.</li>
          <li><strong>Shanghai (China):</strong> World's largest container throughput gateway in the Yangtze River delta.</li>
          <li><strong>Los Angeles (USA):</strong> Critical North American transpacific intermodal import corridor.</li>
          <li><strong>Hamburg (Germany):</strong> Key Northern European feeder and Baltic distribution hub along the Elbe.</li>
          <li><strong>Santos (Brazil):</strong> South America's busiest commercial agricultural and raw material seaport.</li>
        </ul>
      </Card>

      {/* 3. Vessel Classification */}
      <Card className="p-4 border border-border bg-card space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <Layers className="h-4 w-4 text-indigo-500" />
          <span>3. Vessel Classification & Ship Type Codes</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vessels are classified using standard International Maritime Organization (IMO) and ITU AIS numeric category definitions:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="p-2 rounded bg-muted/40 border border-border/50">
            <span className="font-semibold text-foreground">Cargo (70–79)</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Container, bulk carriers, general cargo</p>
          </div>
          <div className="p-2 rounded bg-muted/40 border border-border/50">
            <span className="font-semibold text-foreground">Tanker (80–89)</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Crude oil, chemicals, LNG/LPG gas carriers</p>
          </div>
          <div className="p-2 rounded bg-muted/40 border border-border/50">
            <span className="font-semibold text-foreground">Passenger (60–69)</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Cruise liners, passenger ferries, catamarans</p>
          </div>
          <div className="p-2 rounded bg-muted/40 border border-border/50">
            <span className="font-semibold text-foreground">Tug / Special (50–59)</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Harbor tugs, pilot tenders, workboats, dredgers</p>
          </div>
        </div>
      </Card>

      {/* 4. Moving vs. Anchored Classification */}
      <Card className="p-4 border border-border bg-card space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <Gauge className="h-4 w-4 text-emerald-500" />
          <span>4. Navigational Heuristics: Moving vs. Anchored</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          While AIS transponders broadcast a <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">navigational_status</code> field, ship crews frequently forget to update manual status switches upon anchoring. To guarantee data consistency, our system evaluates kinematic Speed Over Ground (SOG):
        </p>
        <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
          <li><strong>Anchored / Moored:</strong> Speed Over Ground is strictly &lt; 0.5 knots (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">SOG &lt; 0.5 kn</code>). Includes vessels at anchor, in berth, or awaiting tug assistance.</li>
          <li><strong>Moving (Under Way):</strong> Speed Over Ground is $\ge$ 0.5 knots (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">SOG &ge; 0.5 kn</code>). High-speed navigation is designated for vessels &gt; 14 knots.</li>
        </ul>
      </Card>

      {/* 5. Congestion Index Formula */}
      <Card className="p-4 border border-border bg-card space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <Cpu className="h-4 w-4 text-rose-500" />
          <span>5. Congestion Index (CI) Mathematical Formula</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The Congestion Index (CI) quantifies anchorage queue pressure within a 25 km geofence around each port center point. When at least 5 commercial vessels are detected in the approach sector (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">total &ge; 5</code>), the index is calculated as:
        </p>
        <div className="rounded-lg bg-muted/60 p-3 font-mono text-xs border border-border text-foreground">
          CI = min(2.0, 0.6 + 1.6 * (slow_vessels / total_vessels))
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
          <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">CI &lt; 0.8: Normal Flow</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Berth turnaround is fluid; minimal anchorage queuing delay.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10">
            <span className="font-bold text-amber-600 dark:text-amber-400">0.8 &le; CI &le; 1.2: Busy</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Moderate volume; arrival queues forming in outer anchorage.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10">
            <span className="font-bold text-rose-600 dark:text-rose-400">CI &gt; 1.2: Congested</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Heavy anchorage queue; vessels experiencing substantial berth delay.</p>
          </div>
        </div>
      </Card>

      {/* 6. Data Cleaning & Latency */}
      <Card className="p-4 border border-border bg-card space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>6. Data Cleaning, Deduplication & Dead Reckoning</span>
        </div>
        <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
          <li><strong>MMSI Identity Deduplication:</strong> Messages sharing the same MMSI are merged in memory, preserving the latest position and heading.</li>
          <li><strong>Stale Purge Policy:</strong> Vessels not broadcasting an AIS position within 15 minutes are removed from memory.</li>
          <li><strong>Dead Reckoning Smoothing:</strong> To eliminate visual stutter between updates, positions are projected forward using SOG and COG for up to 45 seconds using standard spherical trigonometry.</li>
        </ul>
      </Card>

      {/* 7. Known Limitations */}
      <Card className="p-4 border border-border bg-card space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span>7. Documented Caveats & Technical Limitations</span>
        </div>
        <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <li><strong>VHF vs. Satellite AIS Coverage:</strong> Free AISStream data originates predominantly from coastal terrestrial receiver stations. Open-ocean transoceanic corridors have intermittent satellite reception; ocean fleet positions follow validated nautical route lanes.</li>
          <li><strong>GPS Multipath & Anchor Swing:</strong> Vessels at anchor naturally swing with tidal changes and wind, causing small apparent position shifts of 50–200 meters.</li>
          <li><strong>Non-Validated Metric Advisory:</strong> The Congestion Index is an observational queue ratio calculated from real-time transponder density. It is not an official government or port authority certificate of terminal efficiency.</li>
        </ul>
      </Card>
    </div>
  );
}
