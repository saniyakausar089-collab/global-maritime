import React, { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { LandingCanvas } from "@/components/landing/LandingCanvas";
import { LandingStoryUI } from "@/components/landing/LandingStoryUI";
import type { TrackedVessel } from "@/components/landing/ShipCourseVectors";

gsap.registerPlugin(ScrollTrigger);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Global Maritime Port Monitor — 3D Cinematic Story" },
      {
        name: "description",
        content:
          "Cinematic 3D scroll-driven exploration of live commercial AIS fleet tracking, geofencing, congestion indices, and Earth Observation validation.",
      },
      { property: "og:title", content: "Global Maritime Port Monitor — 3D Cinematic Story" },
      {
        property: "og:description",
        content:
          "Cinematic 3D scroll-driven exploration of live commercial AIS fleet tracking, geofencing, congestion indices, and Earth Observation validation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentScene, setCurrentScene] = useState<number>(0);
  const [simulateStorm, setSimulateStorm] = useState(false);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<TrackedVessel | null>(null);

  useEffect(() => {
    // Detect mobile or low-memory device
    if (
      typeof window !== "undefined" &&
      (window.innerWidth < 768 || navigator.maxTouchPoints > 1)
    ) {
      setLowPowerMode(true);
    }

    // Initialize smooth scrolling with Lenis
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      touchMultiplier: 1.8,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const tickerCb = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCb);
    gsap.ticker.lagSmoothing(0);

    // Setup GSAP ScrollTrigger for 10 distinct scenes across 1500vh
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.8,
        onUpdate: (self) => {
          const p = self.progress;
          setScrollProgress(p);

          // Map 0.0 - 1.0 to scene indices 0 to 9
          const sceneIdx = Math.min(9, Math.max(0, Math.floor(p * 10)));
          setCurrentScene(sceneIdx);
        },
      });
    }, containerRef);

    return () => {
      ctx.revert();
      gsap.ticker.remove(tickerCb);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const handleJumpToScene = (index: number) => {
    if (!lenisRef.current || !containerRef.current) return;
    const totalHeight = containerRef.current.scrollHeight - window.innerHeight;
    const targetY = (index / 10) * totalHeight;
    lenisRef.current.scrollTo(targetY, { duration: 1.4 });
  };

  return (
    <div ref={containerRef} className="relative bg-[#020814] text-white">
      {/* Fixed 3D WebGL Three.js Canvas */}
      <div className="fixed inset-0 h-screen w-screen overflow-hidden">
        <LandingCanvas
          scrollProgress={scrollProgress}
          activeScene={currentScene}
          simulateStorm={simulateStorm}
          lowPowerMode={lowPowerMode}
          onSelectVessel={setSelectedVessel}
          selectedVesselId={selectedVessel?.id}
        />
      </div>

      {/* Fixed Interactive Overlay Glass UI */}
      <LandingStoryUI
        currentScene={currentScene}
        scrollProgress={scrollProgress}
        simulateStorm={simulateStorm}
        onToggleSimulateStorm={() => setSimulateStorm((prev) => !prev)}
        lowPowerMode={lowPowerMode}
        onToggleLowPower={() => setLowPowerMode((prev) => !prev)}
        onJumpToScene={handleJumpToScene}
        selectedVessel={selectedVessel}
      />

      {/* 10 Discrete 150vh Scroll Sections (Total: 1500vh >= 12x viewport height) */}
      <div className="relative z-10 pointer-events-none">
        {/* Scene 01: Global Network */}
        <section id="scene-0" className="h-[150vh] w-full" />

        {/* Scene 02: Live AIS Tracking */}
        <section id="scene-1" className="h-[150vh] w-full" />

        {/* Scene 03: Geofencing */}
        <section id="scene-2" className="h-[150vh] w-full" />

        {/* Scene 04: Congestion Index */}
        <section id="scene-3" className="h-[150vh] w-full" />

        {/* Scene 05: Course and Track Analysis */}
        <section id="scene-4" className="h-[150vh] w-full" />

        {/* Scene 06: Container Ships */}
        <section id="scene-5" className="h-[150vh] w-full" />

        {/* Scene 07: Tankers */}
        <section id="scene-6" className="h-[150vh] w-full" />

        {/* Scene 08: Bulk Carriers and Other Vessels */}
        <section id="scene-7" className="h-[150vh] w-full" />

        {/* Scene 09: Weather Risk */}
        <section id="scene-8" className="h-[150vh] w-full" />

        {/* Scene 10: History and Validation */}
        <section id="scene-9" className="h-[150vh] w-full" />
      </div>
    </div>
  );
}
