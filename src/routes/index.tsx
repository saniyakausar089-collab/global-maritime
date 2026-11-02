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
      { title: "Global Maritime — Cinematic 3D Maritime Intelligence" },
      {
        name: "description",
        content:
          "Cinematic continuous 3D scroll-driven journey exploring live commercial AIS fleet tracking, geofencing, congestion indices, weather risk, and temporal digital twin intelligence.",
      },
      { property: "og:title", content: "Global Maritime — Cinematic 3D Maritime Intelligence" },
      {
        property: "og:description",
        content:
          "Cinematic continuous 3D scroll-driven journey exploring live commercial AIS fleet tracking, geofencing, congestion indices, weather risk, and temporal digital twin intelligence.",
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

  const [mounted, setMounted] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentScene, setCurrentScene] = useState<number>(0);
  const [simulateStorm, setSimulateStorm] = useState(false);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<TrackedVessel | null>(null);

  useEffect(() => {
    setMounted(true);

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

    // Setup GSAP ScrollTrigger for 13 continuous scenes across 1560vh
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.8,
        onUpdate: (self) => {
          const p = self.progress;
          setScrollProgress(p);

          // Map 0.0 - 1.0 to scene indices 0 to 12
          const sceneIdx = Math.min(12, Math.max(0, Math.floor(p * 13)));
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
    const targetY = (index / 13) * totalHeight;
    lenisRef.current.scrollTo(targetY, { duration: 1.4 });
  };

  return (
    <div ref={containerRef} className="relative bg-[#050C18] text-[#F2F6FA]">
      {/* Fixed 3D WebGL Three.js Canvas */}
      <div className="fixed inset-0 h-screen w-screen overflow-hidden">
        {mounted ? (
          <LandingCanvas
            scrollProgress={scrollProgress}
            activeScene={currentScene}
            simulateStorm={simulateStorm}
            lowPowerMode={lowPowerMode}
            onSelectVessel={setSelectedVessel}
            selectedVesselId={selectedVessel?.id}
          />
        ) : (
          <div className="absolute inset-0 bg-[#020814] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-cyan-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              <span className="text-xs font-mono tracking-widest uppercase text-slate-400">
                Initializing 3D Geospatial Engine...
              </span>
            </div>
          </div>
        )}
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

      {/* 13 Discrete 120vh Scroll Sections (Total: 1560vh >= 15x viewport height) */}
      <div className="relative z-10 pointer-events-none">
        {/* Scene 01: Awakening of Earth */}
        <section id="scene-0" className="h-[120vh] w-full" />

        {/* Scene 02: Global Trade Network */}
        <section id="scene-1" className="h-[120vh] w-full" />

        {/* Scene 03: The Living Ocean */}
        <section id="scene-2" className="h-[120vh] w-full" />

        {/* Scene 04: The Vessel Reveal */}
        <section id="scene-3" className="h-[120vh] w-full" />

        {/* Scene 05: Live Fleet Tracking */}
        <section id="scene-4" className="h-[120vh] w-full" />

        {/* Scene 06: The Port Discovery */}
        <section id="scene-5" className="h-[120vh] w-full" />

        {/* Scene 07: Port Congestion Intelligence */}
        <section id="scene-6" className="h-[120vh] w-full" />

        {/* Scene 08: Weather Risk Intelligence */}
        <section id="scene-7" className="h-[120vh] w-full" />

        {/* Scene 09: The Temporal Digital Twin */}
        <section id="scene-8" className="h-[120vh] w-full" />

        {/* Scene 10: Time Machine Intelligence Suite */}
        <section id="scene-9" className="h-[120vh] w-full" />

        {/* Scene 11: Global Ripple Effect */}
        <section id="scene-10" className="h-[120vh] w-full" />

        {/* Scene 12: Engineering and Methodology */}
        <section id="scene-11" className="h-[120vh] w-full" />

        {/* Scene 13: Enter the Global Control Centre */}
        <section id="scene-12" className="h-[120vh] w-full" />
      </div>
    </div>
  );
}
