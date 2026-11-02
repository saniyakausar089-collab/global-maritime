import React, { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { LandingCanvas } from "@/components/landing/LandingCanvas";
import { LandingStoryUI } from "@/components/landing/LandingStoryUI";
import type { TrackedVessel } from "@/components/landing/ShipCourseVectors";

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

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentScene, setCurrentScene] = useState<number>(0);
  const [simulateStorm, setSimulateStorm] = useState(false);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<TrackedVessel | null>(null);

  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);

    // Detect mobile or low-memory device
    if (
      typeof window !== "undefined" &&
      (window.innerWidth < 768 || navigator.maxTouchPoints > 1)
    ) {
      setLowPowerMode(true);
    }

    const updateScrollTarget = () => {
      if (!containerRef.current) return;
      const totalScrollable = containerRef.current.scrollHeight - window.innerHeight;
      if (totalScrollable > 0) {
        const raw = Math.max(0, Math.min(1, window.scrollY / totalScrollable));
        targetProgressRef.current = raw;
      }
    };

    // Smooth inertia lerp loop (60-120fps)
    const smoothLoop = () => {
      const diff = targetProgressRef.current - currentProgressRef.current;
      if (Math.abs(diff) > 0.0001) {
        currentProgressRef.current += diff * 0.12; // Silky responsive damping
        const p = Math.max(0, Math.min(1, currentProgressRef.current));
        setScrollProgress(p);

        // Map 0.0 - 1.0 to scene indices 0 to 9
        const sceneIdx = Math.min(9, Math.max(0, Math.floor(p * 10)));
        setCurrentScene(sceneIdx);
      }

      animFrameRef.current = requestAnimationFrame(smoothLoop);
    };

    window.addEventListener("scroll", updateScrollTarget, { passive: true });
    window.addEventListener("resize", updateScrollTarget, { passive: true });

    // Initial position
    updateScrollTarget();
    currentProgressRef.current = targetProgressRef.current;
    setScrollProgress(targetProgressRef.current);
    animFrameRef.current = requestAnimationFrame(smoothLoop);

    return () => {
      window.removeEventListener("scroll", updateScrollTarget);
      window.removeEventListener("resize", updateScrollTarget);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const handleJumpToScene = useCallback((index: number) => {
    if (!containerRef.current) return;
    const totalHeight = containerRef.current.scrollHeight - window.innerHeight;
    const targetY = (index / 10) * totalHeight;
    window.scrollTo({
      top: targetY,
      behavior: "smooth",
    });
  }, []);

  return (
    <div ref={containerRef} className="relative bg-[#020814] text-white">
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
