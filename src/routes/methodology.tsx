import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui-bits";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — Global Maritime Port Monitor" },
      { name: "description", content: "How AIS data, geofencing and the congestion index are computed." },
      { property: "og:title", content: "Methodology — Port Monitor" },
      { property: "og:description", content: "How AIS data, geofencing and the congestion index are computed." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Methodology,
});

const sections = [
  ["AIS data source", "Vessel positions come from the Automatic Identification System (AIS): transponder broadcasts carrying each ship's MMSI, name, position and speed over ground (SOG). Messages are collected by the backend and aggregated per port."],
  ["Geofencing", "Each port is defined by a geographic boundary around its anchorages and terminals. Only vessels whose latest position falls inside that boundary are counted for the port."],
  ["Stationary threshold", "A vessel is classed as stationary when its speed over ground is below 0.5 knots — typically anchored, moored or waiting for a berth. Anything faster is treated as moving."],
  ["Congestion index", "Every hour the backend counts stationary vessels in the geofence. The index is the latest hourly stationary count divided by that port's median hourly count. 1.0 means typical; below 0.8 is Normal, 0.8–1.2 Busy, above 1.2 Congested. If there isn't enough history to compute a median the index is shown as \"Not enough data\"."],
] as const;

const limits = [
  "AIS coverage gaps (satellite/terrestrial reception) can undercount vessels.",
  "Some ships switch off or misreport AIS; names and speeds may be inaccurate.",
  "Moored vessels at berth working cargo are counted the same as ships waiting at anchor.",
  "Geofences are approximations and may include nearby traffic lanes or exclude outer anchorages.",
  "New ports need several days of history before the median, and therefore the index, is meaningful.",
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
        <p className="font-mono text-sm">congestion_index = stationary_count(latest hour) / median(stationary_count per hour)</p>
      </Card>
      <Card>
        <h2 className="font-semibold text-accent">Known limitations</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {limits.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </Card>
    </div>
  );
}
