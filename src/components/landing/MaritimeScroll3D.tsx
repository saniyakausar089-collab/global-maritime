import React, { useEffect, useRef } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { RobotHero } from "@/components/ui/robot-hero";
import "./MaritimeScroll3D.css";

const TOTAL_FRAMES = 350;
const FRAME_PATHS = Array.from(
  { length: TOTAL_FRAMES },
  (_, i) => `/maritime_scroll_3d/frames/${String(i + 1).padStart(4, "0")}.webp?v=2`
);

// Gemini Watermark Cover Configuration (Normalized to source frame: exact star center at X=1740, Y=900)
const WM = { x: 0.906, y: 0.833, size: 0.055 };
const SHIP_LOGO_SRC = "/ship-logo.svg";
const DEBUG_WM = false;

export function MaritimeScroll3D() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isJourneyOnlyRoute = pathname === "/journey";
  const navigatedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoBadgeRef = useRef<HTMLDivElement>(null);
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

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    navigatedRef.current = false;
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

    const logoEl = logoBadgeRef.current;
    let frameNw = 1920;
    let frameNh = 1080;

    function updateLogoPosition(nw = frameNw, nh = frameNh) {
      if (!logoEl || !cv) return;
      const rect = cv.getBoundingClientRect();
      const vw = rect.width || window.innerWidth;
      const vh = rect.height || window.innerHeight;
      if (!vw || !vh || !nw || !nh) return;

      const scale = Math.max(vw / nw, vh / nh);
      const drawnW = nw * scale;
      const drawnH = nh * scale;
      const offsetX = (vw - drawnW) / 2;
      const offsetY = (vh - drawnH) / 2;

      const left = offsetX + WM.x * drawnW;
      const top = offsetY + WM.y * drawnH;
      const diameter = WM.size * drawnW;
      const badgeDiameter = Math.round(diameter * 1.3);

      logoEl.style.left = `${left}px`;
      logoEl.style.top = `${top}px`;
      logoEl.style.width = `${badgeDiameter}px`;
      logoEl.style.height = `${badgeDiameter}px`;
    }

    function size() {
      if (!cv) return;
      // Precision physical pixel mapping supporting crisp HD / Retina display output
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.0));
      const rect = cv.getBoundingClientRect();
      const targetW = Math.round((rect.width || window.innerWidth) * dpr);
      const targetH = Math.round((rect.height || window.innerHeight) * dpr);
      if (W !== targetW || H !== targetH) {
        W = cv.width = targetW;
        H = cv.height = targetH;
      }
      updateLogoPosition();
      draw(cur);
    }

    function draw(f: number) {
      if (!ctx || !W || !H) return;
      const index = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(f)));
      const im = imgs[index];
      if (!im || !im.complete || im.naturalWidth === 0) return;

      if (im.naturalWidth !== frameNw || im.naturalHeight !== frameNh) {
        frameNw = im.naturalWidth;
        frameNh = im.naturalHeight;
        updateLogoPosition(frameNw, frameNh);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Sharp HD Aspect Framing with Integer Pixel Alignment
      const nw = im.naturalWidth;
      const nh = im.naturalHeight;

      const s = Math.max(W / nw, H / nh);
      const w = Math.round(nw * s);
      const h = Math.round(nh * s);
      const dx = Math.round((W - w) / 2);
      const dy = Math.round((H - h) / 2);

      ctx.drawImage(im, 0, 0, nw, nh, dx, dy, w, h);

      // Seamlessly eliminate the source video watermark on canvas level
      const wmX = dx + WM.x * w;
      const wmY = dy + WM.y * h;
      const wmR = Math.max(38, Math.round(w * 0.038));

      const grad = ctx.createRadialGradient(wmX, wmY, 0, wmX, wmY, wmR);
      grad.addColorStop(0, "#04080d");
      grad.addColorStop(0.55, "#04080d");
      grad.addColorStop(0.80, "rgba(4, 8, 13, 0.9)");
      grad.addColorStop(1, "rgba(4, 8, 13, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wmX, wmY, wmR, 0, Math.PI * 2);
      ctx.fill();
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
        world.style.transform = `translate3d(${tx}px,${ty}px,0px)`;
      }
      if (glow) {
        glow.style.transform = `translate3d(${-tx * 0.4}px,${ty * 0.4}px,0) scale(${1 + t * 0.15})`;
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
          if (i === 0 && im.naturalWidth) {
            frameNw = im.naturalWidth;
            frameNh = im.naturalHeight;
            updateLogoPosition(frameNw, frameNh);
          }
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

  const isAuthenticated = typeof window !== "undefined" && localStorage.getItem("auth_logged_in") === "true";

  const scrollToTerminal = () => {
    const el = document.getElementById("ms-terminal-portal");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate({ to: "/login" });
    }
  };

  return (
    <div id="maritime-scroll" ref={containerRef}>
      {/* 800vh Scroll Track */}
      <main id="ms-track" ref={trackRef}>
        <section id="ms-stage">
          <nav id="ms-exit-nav" aria-label="Navigation">
            {isAuthenticated ? (
              <Link to="/overview" className="ms-nav-btn">
                Live Dashboard →
              </Link>
            ) : (
              <button type="button" onClick={scrollToTerminal} className="ms-nav-btn">
                Terminal Access ↓
              </button>
            )}
            <Link to="/login" className="ms-nav-btn">
              {isAuthenticated ? "Operator Console" : "Terminal Login"}
            </Link>
          </nav>

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
              <div
                ref={logoBadgeRef}
                className={`ms-wm-badge ${DEBUG_WM ? "ms-wm-debug" : ""}`}
                aria-hidden="true"
              >
                <img src={SHIP_LOGO_SRC} alt="" />
              </div>
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
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginTop: "1.25rem" }}>
                  {isAuthenticated ? (
                    <Link to="/overview" className="ms-cta-btn">
                      Enter Live Dashboard →
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={scrollToTerminal}
                        className="ms-cta-btn"
                      >
                        Terminal Clearance &amp; Login ↓
                      </button>
                      <Link to="/login" className="ms-nav-btn" style={{ padding: "11px 22px", borderRadius: "9999px" }}>
                        Direct Login Portal →
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div id="ms-hint" ref={hintRef}>
            SCROLL<span />
          </div>
        </section>
      </main>

      {/* Terminal Access & Interactive 3D Robot Sentry Login Portal */}
      {!isJourneyOnlyRoute && (
        <section
          id="ms-terminal-portal"
          className="relative z-30 w-full min-h-screen bg-[#070b13] border-t border-cyan-500/20 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]"
        >
          <div className="h-screen w-full overflow-hidden">
            <RobotHero showLoginOption={true} />
          </div>
        </section>
      )}
    </div>
  );
}
