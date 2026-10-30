import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui-bits";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — Global Maritime Port Monitor" },
      {
        name: "description",
        content:
          "How AIS data, 25km geofencing, anchorage queues, and the congestion index are computed.",
      },
      { property: "og:title", content: "Methodology — Port Monitor" },
      {
        name: "description",
        content:
          "How AIS data, 25km geofencing, anchorage queues, and the congestion index are computed.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Methodology,
});

const sections = [
  [
    "Live AISStream Relay Architecture",
    "Data source: AISStream live AIS transponder feeds streamed directly from global terrestrial VHF coastal stations. Because browsers cannot maintain authenticated AISStream sockets with strict quota limits, our Node relay maintains a single upstream connection to wss://stream.aisstream.io/v0/stream, tracks vessels in memory with 15-minute expiry, and pushes batched 2-second diffs to clients over WebSockets.",
  ],
  [
    "Port Geofencing & Monitored Hubs",
    "Each of our 6 global hub ports (Rotterdam, Singapore, Shanghai, Los Angeles, Hamburg, Santos) is bounded by a 0.6° sector box covering shipping approaches, container berths, and waiting anchorages.",
  ],
  [
    "Congestion Index Formula",
    "The congestion index measures the share of commercial vessels within 25 km of a port moving under 0.5 knots (anchored, moored, or queuing for an open berth). When at least 5 vessels are detected within 25 km, the index is calculated as:",
  ],
] as const;

const limits = [
  "Free AISStream data can lag 1–3 minutes per vessel depending on coastal receiver traffic and uplink load.",
  "Coverage is best near ports with active terrestrial antenna networks; open ocean stretches between ports have patchy satellite coverage.",
  "Vessels at anchor may occasionally experience GPS drift; dead-reckoning filters dampen position jitter.",
  "If the upstream relay is started without an API key or with SIMULATE=1, simulated vessels are generated and clearly flagged in the UI.",
];

function Methodology() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Methodology</h1>
      {sections.map(([t, b]) => (
        <Card key={t}>
          <h2 className="font-semibold text-accent">{t}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b}</p>
        </Card>
      ))}
      <Card>
        <p className="font-mono text-sm leading-relaxed">
          slow_vessels = count(distance &lt;= 25km AND speed &lt; 0.5 kn)
          <br />
          congestion_index = total &gt;= 5 ? min(2.0, 0.6 + 1.6 * (slow / total)) : null
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> &lt; 0.8: Normal (Smooth flow)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> 0.8 – 1.2: Busy (Moderate volume)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> &gt; 1.2: Congested (Queuing
            delay)
          </span>
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold text-accent">Known limitations</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
