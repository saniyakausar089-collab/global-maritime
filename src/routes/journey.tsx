import { createFileRoute } from "@tanstack/react-router";
import { MaritimeScroll3D } from "@/components/landing/MaritimeScroll3D";

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "3D Journey — Port Monitor: Global Maritime" },
      {
        name: "description",
        content:
          "Scroll-driven 3D commercial vessel animation and route depth layer visualization.",
      },
      { property: "og:title", content: "3D Journey — Port Monitor: Global Maritime" },
      {
        property: "og:description",
        content:
          "Scroll-driven 3D commercial vessel animation and route depth layer visualization.",
      },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&display=swap",
      },
    ],
  }),
  component: JourneyPage,
});

function JourneyPage() {
  return <MaritimeScroll3D />;
}
