import React, { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import "./MaritimeScroll3D.css";

const TOTAL_FRAMES = 350;
const FRAME_PATHS = Array.from(
  { length: TOTAL_FRAMES },
  (_, i) => `/maritime_scroll_3d/frames/${String(i + 1).padStart(4, "0")}.webp?v=2`
);

export function MaritimeScroll3D() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isJourneyOnlyRoute = pathname === "/journey";

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLElement>(null);
  const progBarRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loaderBarRef = useRef<HTMLElement>(null);
  const capsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rAFId = 0;
    let isDisposed = false;
    let preloadStarted = false;

    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const world = worldRef.current;
    const glow = glowRef.current;
    const sheen = sheenRef.current;
    const pct = pctRef.current;
    const progBar = progBarRef.current;
    const hint = hintRef.current;
    const loader = loaderRef.current;
    const loaderBar = loaderBarRef.current;
    const track = trackRef.current;
    const caps = capsRef.current.filter(Boolean) as HTMLDivElement[];

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const imgs: HTMLImageElement[] = new Array(TOTAL_FRAMES);
    let loaded = 0;
    let W = 0;
    let H = 0;
    let target = 0;
    let cur = 0;
    let mx = 0;
    let my = 0;
    let smx = 0;
    let smy = 0;

    function size() {
      if (!cv) return;
      const r = cv.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.width = Math.round(r.width * d);
      H = cv.height = Math.round(r.height * d);
      draw(cur);
    }

    function draw(f: number) {
      if (!ctx || !W || !H) return;
      const index = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(f)));
      const im = imgs[index];
      if (!im || !im.complete || im.naturalWidth === 0) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      const w = im.naturalWidth * s;
      const h = im.naturalHeight * s;
      ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    }

    function onScroll() {
      if (!track) return;
      const r = track.getBoundingClientRect();
      const max = track.offsetHeight - window.innerHeight;
      if (max <= 0) return;
      target = Math.max(0, Math.min(1, -r.top / max));
    }

    function onPointerMove(e: PointerEvent) {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    }

    function onDeviceOrientation(e: DeviceOrientationEvent) {
      if (e.gamma == null || e.beta == null) return;
      mx = Math.max(-1, Math.min(1, e.gamma / 30));
      my = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    }

    function onResize() {
      size();
      onScroll();
    }

    function loop() {
      if (isDisposed) return;
      const p = target;
      cur += (p * (TOTAL_FRAMES - 1) - cur) * (reduce ? 1 : 0.12);
      smx += (mx - smx) * 0.06;
      smy += (my - smy) * 0.06;
      draw(cur);

      const t = cur / (TOTAL_FRAMES - 1);

      // Subtle 3D choreography clamped to ±3deg Y and ±2deg X with base scale 1.10
      const ryRaw = reduce ? 0 : Math.sin(t * Math.PI * 2) * 1.8 + smx * 1.2;
      const rxRaw = reduce ? 0 : Math.cos(t * Math.PI * 1.5) * 1.2 - smy * 0.8;
      const ry = Math.max(-3, Math.min(3, ryRaw));
      const rx = Math.max(-2, Math.min(2, rxRaw));
      const rz = reduce ? 0 : Math.sin(t * Math.PI * 3) * 0.4;
      const tx = Math.max(-12, Math.min(12, smx * -10));
      const ty = Math.max(-10, Math.min(10, smy * -8));

      if (world) {
        world.style.transform = `translate3d(${tx}px,${ty}px,0px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(1.10)`;
      }
      if (glow) {
        glow.style.transform = `translate3d(${-ry * 4}px,${rx * 4}px,0) scale(${1 + t * 0.2})`;
      }
      if (sheen) {
        sheen.style.background = `linear-gradient(${110 + ry * 3}deg,transparent ${30 + ry}%,rgba(160,255,245,.14) ${50 + ry * 1.2}%,transparent ${70 + ry}%)`;
      }
      if (pct) {
        pct.textContent = String(Math.round(t * 100)).padStart(2, "0") + "%";
      }
      if (progBar) {
        progBar.style.height = `${t * 100}%`;
      }
      if (hint) {
        hint.style.opacity = t < 0.02 ? "1" : "0";
      }
      caps.forEach((c) => {
        const a = Number(c.dataset.a || "0");
        const b = Number(c.dataset.b || "1");
        c.classList.toggle("ms-on", t >= a && t <= b);
      });

      rAFId = window.requestAnimationFrame(loop);
    }

    function ready() {
      if (isDisposed) return;
      size();
      onScroll();
      cur = target * (TOTAL_FRAMES - 1);
      if (loader) {
        loader.classList.add("ms-done");
      }
      rAFId = window.requestAnimationFrame(loop);
    }

    function startPreload() {
      if (preloadStarted || isDisposed) return;
      preloadStarted = true;

      FRAME_PATHS.forEach((src, i) => {
        const im = new Image();
        im.onload = im.onerror = () => {
          if (isDisposed) return;
          imgs[i] = im;
          loaded++;
          if (loaderBar) {
            loaderBar.style.width = `${(loaded / TOTAL_FRAMES) * 100}%`;
          }
          if (loaded === TOTAL_FRAMES) {
            ready();
          }
        };
        im.src = src;
      });
    }

    // Lazy Preload: IntersectionObserver triggers only when 3D section is within ~1500px
    let observer: IntersectionObserver | null = null;
    if (track && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            startPreload();
            observer?.disconnect();
            observer = null;
          }
        },
        { rootMargin: "1500px" }
      );
      observer.observe(track);
    } else {
      startPreload();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("deviceorientation", onDeviceOrientation, { passive: true });

    return () => {
      isDisposed = true;
      if (observer) {
        observer.disconnect();
      }
      if (rAFId) {
        window.cancelAnimationFrame(rAFId);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("deviceorientation", onDeviceOrientation);
    };
  }, []);

  return (
    <div id="maritime-scroll" ref={containerRef}>
      {/* 800vh Scroll Track */}
      <main id="ms-track" ref={trackRef}>
        <section id="ms-stage">
          {/* Navigation Controls only on standalone /journey route */}
          {isJourneyOnlyRoute && (
            <nav id="ms-exit-nav" aria-label="Journey Navigation">
              <Link to="/" className="ms-nav-btn">
                ← Intro
              </Link>
              <Link to="/overview" className="ms-nav-btn">
                Overview →
              </Link>
            </nav>
          )}

          {/* Loading Screen Overlay (Scoped strictly inside stage) */}
          <div id="ms-loader" ref={loaderRef}>
            <div>
              LOADING VOYAGE
              <div id="ms-bar">
                <i ref={loaderBarRef} />
              </div>
            </div>
          </div>

          {/* Vertical Scroll Progress Bar (Scoped strictly inside stage) */}
          <div id="ms-prog">
            <i ref={progBarRef} />
          </div>

          <div id="ms-bgglow" ref={glowRef} />
          <div id="ms-world" ref={worldRef}>
            <div id="ms-screen">
              <canvas id="ms-canvas" ref={canvasRef} />
              <div id="ms-sheen" ref={sheenRef} />
            </div>
            <div className="ms-layer">
              <div id="ms-hud">
                DEPTH LAYER<b id="ms-pct" ref={pctRef}>00%</b>
              </div>
              <div
                className="ms-cap"
                data-a="0.02"
                data-b="0.22"
                ref={(el) => {
                  capsRef.current[0] = el;
                }}
              >
                <small>01 · THE STORM</small>
                <h2>Into the weather</h2>
                <p>Scroll to move through the clouds.</p>
              </div>
              <div
                className="ms-cap"
                data-a="0.27"
                data-b="0.45"
                ref={(el) => {
                  capsRef.current[1] = el;
                }}
              >
                <small>02 · THE VESSEL</small>
                <h2>One ship, one horizon</h2>
                <p>The cargo carrier breaks through open water.</p>
              </div>
              <div
                className="ms-cap"
                data-a="0.5"
                data-b="0.74"
                ref={(el) => {
                  capsRef.current[2] = el;
                }}
              >
                <small>03 · THE SIGNAL</small>
                <h2>Every route, live</h2>
                <p>Speed, heading and risk are mapped in real time.</p>
              </div>
              <div
                className="ms-cap"
                data-a="0.78"
                data-b="1.0"
                ref={(el) => {
                  capsRef.current[3] = el;
                }}
              >
                <small>04 · DESTINATION</small>
                <h2>Global Fleet Intelligence</h2>
                <p>Live transponder telemetry, berth queues, and congestion tracking across every commercial corridor.</p>
                <Link to="/overview" className="ms-cta-btn">
                  Explore the live dashboard →
                </Link>
              </div>
            </div>
          </div>
          <div id="ms-hint" ref={hintRef}>
            SCROLL<span />
          </div>
        </section>
      </main>
    </div>
  );
}
