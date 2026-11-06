import { createFileRoute } from "@tanstack/react-router";
import { VideoScrollIntro } from "@/components/landing/VideoScrollIntro";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Port Monitor: Global Maritime" },
      {
        name: "description",
        content:
          "One ocean. Connected intelligence. Commercial corridors, bridge operations, global fleet tracking, and real-time port congestion overview.",
      },
      { property: "og:title", content: "Port Monitor: Global Maritime" },
      {
        property: "og:description",
        content:
          "One ocean. Connected intelligence. Commercial corridors, bridge operations, global fleet tracking, and real-time port congestion overview.",
      },
      { property: "og:type", content: "website" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return <VideoScrollIntro />;
}
