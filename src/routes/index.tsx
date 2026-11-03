import React, { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { LandingCanvas } from "@/components/landing/LandingCanvas";
import { LandingStoryUI } from "@/components/landing/LandingStoryUI";
import type { TrackedVessel } from "@/components/landing/ShipCourseVectors";
import { portsQuery } from "@/lib/api";

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

  const ports = useQuery(portsQuery());

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

    // Setup GSAP ScrollTrigger for 10 continuous scenes
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
    <div ref={containerRef} className="relative bg-[#080F20] text-[#F4F8FF]">
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
            portsData={ports.data?.data}
          />
        ) : (
          <div className="absolute inset-0 bg-[#080F20] flex items-center justify-center">
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
        portsData={ports.data?.data}
      />

      {/* 10 Discrete 120vh Scroll Sections */}
      <div className="relative z-10 pointer-events-none">
        <section id="scene-0" className="h-[120vh] w-full" />
        <section id="scene-1" className="h-[120vh] w-full" />
        <section id="scene-2" className="h-[120vh] w-full" />
        <section id="scene-3" className="h-[120vh] w-full" />
        <section id="scene-4" className="h-[120vh] w-full" />
        <section id="scene-5" className="h-[120vh] w-full" />
        <section id="scene-6" className="h-[120vh] w-full" />
        <section id="scene-7" className="h-[120vh] w-full" />
        <section id="scene-8" className="h-[120vh] w-full" />
        <section id="scene-9" className="h-[120vh] w-full" />
      </div>
    </div>
  );
}
