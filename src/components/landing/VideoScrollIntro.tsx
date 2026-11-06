import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { RobotHero, settings as robotSettings } from "@/components/ui/robot-hero";

// ============================================================================
// TIMING CONFIGURATION ARRAYS (Single Pristine Clip: intro.mp4)
// ============================================================================
export const CLIPS = [
  "/videos/intro.mp4",
];

export const SEC: [number, number][] = [
  [0, 0.22],
  [0.20, 0.42],
  [0.40, 0.62],
  [0.60, 0.82],
  [0.80, 1.0],
];

export const ST: number[] = [0, 0.22, 0.44, 0.66, 0.88];

const N = CLIPS.length;

export function VideoScrollIntro() {
  const navigate = useNavigate();
  const [mountRobot, setMountRobot] = useState(false);

  // Video and DOM refs
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const pcRef = useRef<HTMLSpanElement>(null);
  const dotsRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Section element refs
  const s0Ref = useRef<HTMLElement>(null);
  const s1Ref = useRef<HTMLElement>(null);
  const s2Ref = useRef<HTMLElement>(null);
  const s3Ref = useRef<HTMLElement>(null);
  const s4Ref = useRef<HTMLElement>(null);

  // Keep track of object URLs to revoke on unmount
  const objectUrlsRef = useRef<string[]>([]);

  // Smooth scroll directly to the Robot Login section
  const scrollToLogin = () => {
    setMountRobot(true);
    const el = document.getElementById("login-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Lazy-mount 3D Three.js robot when login section is approached (frees 100% GPU during video scrub)
  useEffect(() => {
    const el = document.getElementById("login-section");
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMountRobot(true);
        }
      },
      { rootMargin: "500px" }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const vids = videoRefs.current.filter(Boolean) as HTMLVideoElement[];
    if (vids.length !== N) return;

    let isMounted = true;
    let rAFId = 0;

    // Loading progress tracker across clips
    const totalProgress = { p: CLIPS.map(() => 0) };
    const updateLoadingBar = () => {
      if (barRef.current) {
        const sum = totalProgress.p.reduce((acc, curr) => acc + curr, 0);
        const pct = (sum / N) * 100;
        barRef.current.style.width = `${pct}%`;
      }
    };

    // Fetch video into Blob and use createObjectURL
    async function loadVideo(videoEl: HTMLVideoElement, url: string, index: number) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const len = +(res.headers.get("content-length") || 0);

        if (res.body) {
          const reader = res.body.getReader();
          const chunks: Uint8Array[] = [];
          let got = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              got += value.length;
              totalProgress.p[index] = len ? got / len : 0.5;
              updateLoadingBar();
            }
          }

          if (!isMounted) return;
          const blob = new Blob(chunks, { type: "video/mp4" });
          const objUrl = URL.createObjectURL(blob);
          objectUrlsRef.current.push(objUrl);
          videoEl.src = objUrl;
        } else {
          videoEl.src = url;
        }
      } catch {
        if (!isMounted) return;
        videoEl.src = url;
      }

      await new Promise<void>((resolve) => {
        if (videoEl.readyState >= 2) {
          videoEl.pause();
          return resolve();
        }
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            videoEl.pause();
            resolve();
          }
        };
        videoEl.addEventListener("loadeddata", done, { once: true });
        videoEl.addEventListener("canplay", done, { once: true });
        videoEl.addEventListener("error", done, { once: true });
        setTimeout(done, 3000);
        videoEl.load();
      });

      videoEl.pause();
      videoEl.currentTime = 0;
      totalProgress.p[index] = 1;
      updateLoadingBar();
    }

    // Scroll calculations calibrated strictly so the entire video story finishes BEFORE login section enters
    const getStoryScrollable = () => {
      const sp = document.getElementById("sp");
      if (sp) {
        return Math.max(1, sp.offsetHeight - window.innerHeight);
      }
      return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };

    // Passive scroll listener updates target progress in ref (never React state)
    let targetP = 0;
    const onScroll = () => {
      const storyEnd = getStoryScrollable();
      targetP = Math.min(1, Math.max(0, window.scrollY / storyEnd));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Non-blocking asynchronous video seeking pipeline
    let isSeeking = false;
    let pendingTime: number | null = null;
    const v0 = vids[0];

    const onSeeked = () => {
      isSeeking = false;
      if (pendingTime !== null && v0) {
        const nextTime = pendingTime;
        pendingTime = null;
        if (Math.abs(v0.currentTime - nextTime) > 0.033) {
          isSeeking = true;
          v0.currentTime = nextTime;
        }
      }
    };

    if (v0) {
      v0.pause();
      v0.addEventListener("seeked", onSeeked);
    }

    function seekVideo(v: HTMLVideoElement, progress: number) {
      if (!v || v.readyState < 2) return;
      const d = v.duration || 10;
      const targetTime = Math.min(d - 0.05, Math.max(0, progress * d));

      if (isSeeking) {
        pendingTime = targetTime;
        return;
      }

      if (Math.abs(v.currentTime - targetTime) > 0.033) {
        isSeeking = true;
        v.currentTime = targetTime;
      }
    }

    const sectionEls = [s0Ref.current, s1Ref.current, s2Ref.current, s3Ref.current, s4Ref.current];

    // rAF smoothing loop with cinematic lerp
    let currentP = targetP;
    let lastTime = performance.now();

    function tick(now: number) {
      if (!isMounted) return;
      rAFId = requestAnimationFrame(tick);

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Cinematic analog lerp: factor 7.5 gives smooth inertia without rushing or lag
      if (prefersReducedMotion) {
        currentP = targetP;
      } else {
        const factor = 1 - Math.exp(-dt * 7.5);
        currentP += (targetP - currentP) * factor;
      }

      // Single continuous video scrubbing: steady 60fps with non-blocking seeks
      if (v0) {
        v0.style.opacity = "1";
        v0.style.visibility = "visible";
        seekVideo(v0, currentP);
      }

      // Section fading & sliding
      sectionEls.forEach((el, i) => {
        if (!el) return;
        const range = SEC[i];
        const fadeIn = (currentP - range[0]) / 0.035;
        const fadeOut = (range[1] - currentP) / 0.035;
        const opacity = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
        el.style.opacity = opacity.toString();
        el.style.transform = `translateY(calc(-50% + ${(1 - opacity) * 16}px))`;
        el.style.pointerEvents = opacity > 0.4 ? "auto" : "none";
      });

      // Hide video HUD only when user actually scrolls into the login section
      const storyEnd = getStoryScrollable();
      const inLoginSection = window.scrollY >= storyEnd - 40;

      // Active progress dot
      let bestDotIdx = 0;
      ST.forEach((step, i) => {
        if (currentP >= step - 0.02) bestDotIdx = i;
      });

      if (dotsRef.current) {
        dotsRef.current.style.opacity = inLoginSection ? "0" : "1";
        dotsRef.current.style.pointerEvents = inLoginSection ? "none" : "auto";
        const dotButtons = dotsRef.current.children;
        for (let i = 0; i < dotButtons.length; i++) {
          const btn = dotButtons[i] as HTMLElement;
          if (i === bestDotIdx) {
            btn.style.width = "34px";
            btn.style.backgroundColor = "var(--cy)";
          } else {
            btn.style.width = "10px";
            btn.style.backgroundColor = "rgba(255, 255, 255, 0.35)";
          }
        }
      }

      if (hintRef.current) {
        hintRef.current.style.opacity = inLoginSection ? "0" : "1";
      }

      // Percentage display
      if (pcRef.current) {
        pcRef.current.textContent = inLoginSection ? "LOGIN" : `${Math.round(currentP * 100)}%`;
      }
    }

    // Load footage concurrently
    Promise.all(vids.map((v, i) => loadVideo(v, CLIPS[i], i))).then(() => {
      if (!isMounted) return;
      if (loaderRef.current) {
        loaderRef.current.style.opacity = "0";
        setTimeout(() => {
          if (loaderRef.current && isMounted) {
            loaderRef.current.style.display = "none";
          }
        }, 700);
      }
      lastTime = performance.now();
      rAFId = requestAnimationFrame(tick);
    });

    return () => {
      isMounted = false;
      window.removeEventListener("scroll", onScroll);
      if (v0) {
        v0.removeEventListener("seeked", onSeeked);
      }
      if (rAFId) cancelAnimationFrame(rAFId);
      objectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      objectUrlsRef.current = [];
    };
  }, []);

  const handleGoTo = (u: number) => {
    const sp = document.getElementById("sp");
    const storyEnd = sp
      ? Math.max(1, sp.offsetHeight - window.innerHeight)
      : Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({
      top: u * storyEnd,
      behavior: "smooth",
    });
  };

  return (
    <div
      className="relative bg-[#050b18] text-[#f2f8fc] select-none font-sans"
      style={
        {
          "--ink": "#f2f8fc",
          "--mut": "#c4d6e2",
          "--cy": "#22d3ee",
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
        } as React.CSSProperties
      }
    >
      {/* ========================================================================= */}
      {/* 1. FIXED FULL-SCREEN VIDEO STAGE & SHADE                                  */}
      {/* ========================================================================= */}
      <div id="stage" className="fixed inset-0 overflow-hidden bg-[#050b18] z-0">
        {CLIPS.map((_, i) => (
          <video
            key={i}
            ref={(el) => {
              videoRefs.current[i] = el;
            }}
            id={`v${i}`}
            muted
            playsInline
            preload="auto"
            style={{
              opacity: i === 0 ? 1 : 0,
              transform: "translate3d(0, 0, 0)",
              willChange: "opacity, visibility",
              backfaceVisibility: "hidden",
            }}
            className="absolute inset-0 w-full h-full object-cover transition-none pointer-events-none"
          />
        ))}
        <div
          id="shade"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, rgba(3,10,22,0.7), rgba(3,10,22,0.15) 60%, transparent), linear-gradient(0deg, rgba(3,10,22,0.55), transparent 35%)",
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* 2. LOADING OVERLAY                                                        */}
      {/* ========================================================================= */}
      <div
        ref={loaderRef}
        id="ld"
        className="fixed inset-0 grid place-items-center bg-[#050b18] z-[99] transition-opacity duration-700"
      >
        <div className="w-[min(260px,60vw)] text-center text-sm font-semibold tracking-wide text-[#f2f8fc]">
          Loading footage
          <i
            ref={barRef}
            id="bar"
            className="block h-[3px] w-0 bg-[#22d3ee] transition-[width] duration-200 mt-3 rounded-full"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TOP BRANDING BAR (SAFE-AREA AWARE)                                     */}
      {/* ========================================================================= */}
      <div
        id="top"
        className="fixed left-[6vw] right-[6vw] flex justify-between items-center font-bold pointer-events-none z-40 text-sm sm:text-base"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 14px)",
        }}
      >
        <span className="tracking-tight text-[#f2f8fc]">Port Monitor</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={scrollToLogin}
            className="pointer-events-auto text-xs px-4 py-1.5 rounded-full bg-[#00ffc6] hover:bg-[#00e5b2] text-black font-extrabold transition-all shadow-[0_0_15px_rgba(0,255,198,0.4)] cursor-pointer"
          >
            Direct Login ↓
          </button>
          <span ref={pcRef} id="pc" className="font-medium text-[#c4d6e2] font-mono">
            0%
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SCROLL TEXT SECTIONS (TRANSITIONED VIA REFS IN RAF)                     */}
      {/* ========================================================================= */}
      {/* Section 0: Hero */}
      <section
        ref={s0Ref}
        id="s0"
        className="s fixed left-[6vw] top-1/2 max-w-[min(560px,88vw)] pointer-events-none z-30 opacity-0"
        style={{ textShadow: "0 2px 24px rgba(0, 10, 25, 0.6)" }}
      >
        <h1 className="text-[clamp(34px,5.4vw,76px)] leading-[1.03] font-bold tracking-tight">
          Global maritime.
        </h1>
        <p className="mt-4 text-[clamp(15px,1.5vw,19px)] text-[#c4d6e2] leading-relaxed max-w-[46ch]">
          One ocean. Connected intelligence. Scroll to sail.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-6 pointer-events-auto">
          <button
            onClick={() => handleGoTo(0.14)}
            className="btn inline-block px-7 py-3.5 rounded-full bg-[#22d3ee] text-[#02202b] font-bold text-[15px] cursor-pointer transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-3"
          >
            Enter the experience
          </button>
          <button
            type="button"
            onClick={scrollToLogin}
            className="btn inline-block px-6 py-3.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-[#f2f8fc] font-bold text-[15px] cursor-pointer transition-transform hover:scale-105 backdrop-blur-md"
          >
            Scroll to Login ↓
          </button>
        </div>
      </section>

      {/* Section 1: Vessel types */}
      <section
        ref={s1Ref}
        id="s1"
        className="s fixed left-[6vw] top-1/2 max-w-[min(560px,88vw)] pointer-events-none z-30 opacity-0"
        style={{ textShadow: "0 2px 24px rgba(0, 10, 25, 0.6)" }}
      >
        <h2 className="text-[clamp(34px,5.4vw,76px)] leading-[1.03] font-bold tracking-tight">
          Every vessel type, one ocean
        </h2>
        <p className="mt-4 text-[clamp(15px,1.5vw,19px)] text-[#c4d6e2] leading-relaxed max-w-[46ch]">
          Yachts, container ships and tankers, all tracked on the same live map.
        </p>
      </section>

      {/* Section 2: Commercial corridors */}
      <section
        ref={s2Ref}
        id="s2"
        className="s fixed left-[6vw] top-1/2 max-w-[min(560px,88vw)] pointer-events-none z-30 opacity-0"
        style={{ textShadow: "0 2px 24px rgba(0, 10, 25, 0.6)" }}
      >
        <h2 className="text-[clamp(34px,5.4vw,76px)] leading-[1.03] font-bold tracking-tight">
          Commercial corridors
        </h2>
        <p className="mt-4 text-[clamp(15px,1.5vw,19px)] text-[#c4d6e2] leading-relaxed max-w-[46ch]">
          Around 80% of world trade moves by sea, one container at a time.
        </p>
      </section>

      {/* Section 3: Bridge decisions */}
      <section
        ref={s3Ref}
        id="s3"
        className="s fixed left-[6vw] top-1/2 max-w-[min(560px,88vw)] pointer-events-none z-30 opacity-0"
        style={{ textShadow: "0 2px 24px rgba(0, 10, 25, 0.6)" }}
      >
        <h2 className="text-[clamp(34px,5.4vw,76px)] leading-[1.03] font-bold tracking-tight">
          Decisions are made on the bridge.
        </h2>
        <p className="mt-4 text-[clamp(15px,1.5vw,19px)] text-[#c4d6e2] leading-relaxed max-w-[46ch]">
          Weather, berth slots and queue length decide every arrival. Port Monitor puts them in one place.
        </p>
      </section>

      {/* Section 4: Live dashboard CTA */}
      <section
        ref={s4Ref}
        id="s4"
        className="s fixed left-[6vw] top-1/2 max-w-[min(560px,88vw)] pointer-events-none z-30 opacity-0"
        style={{ textShadow: "0 2px 24px rgba(0, 10, 25, 0.6)" }}
      >
        <h2 className="text-[clamp(34px,5.4vw,76px)] leading-[1.03] font-bold tracking-tight">
          Every port. Every vessel. One view.
        </h2>
        <p className="mt-4 text-[clamp(15px,1.5vw,19px)] text-[#c4d6e2] leading-relaxed max-w-[46ch]">
          Open the live dashboard to track congestion in real time.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-6 pointer-events-auto">
          <button
            type="button"
            onClick={scrollToLogin}
            className="btn inline-block px-7 py-3.5 rounded-full bg-[#00ffc6] text-black font-extrabold text-[15px] cursor-pointer transition-transform hover:scale-105 shadow-[0_0_25px_rgba(0,255,198,0.4)]"
          >
            Scroll to Direct Login ↓
          </button>
          <Link
            to="/overview"
            className="btn inline-block px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-[#f2f8fc] font-bold text-[15px] cursor-pointer transition-transform hover:scale-105 backdrop-blur-md"
          >
            Main Dashboard →
          </Link>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. CLICKABLE PROGRESS DOTS & HINT (SAFE-AREA AWARE)                       */}
      {/* ========================================================================= */}
      <nav
        ref={dotsRef}
        id="dots"
        aria-label="Sections"
        className="fixed left-[6vw] flex gap-2.5 z-40 transition-opacity duration-300"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)",
        }}
      >
        {ST.map((target, idx) => (
          <button
            key={idx}
            onClick={() => handleGoTo(target + 0.01)}
            aria-label={`Section ${idx + 1}`}
            className="d h-[10px] w-[10px] rounded-full border-0 cursor-pointer transition-all duration-300 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-3"
            style={{
              backgroundColor: idx === 0 ? "var(--cy)" : "rgba(255, 255, 255, 0.35)",
              width: idx === 0 ? "34px" : "10px",
            }}
          />
        ))}
      </nav>

      <div
        ref={hintRef}
        id="hint"
        className="fixed right-[6vw] text-[13px] text-[#c4d6e2] pointer-events-none z-40 transition-opacity duration-300"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
        }}
      >
        Scroll to explore
      </div>

      {/* ========================================================================= */}
      {/* 6. TALL SPACER DRIVING PASSIVE SCROLL (1050vh for stately, cinematic pace) */}
      {/* ========================================================================= */}
      <div id="sp" className="h-[1050vh] w-full pointer-events-none" />

      {/* ========================================================================= */}
      {/* 7. DIRECT LOGIN SECTION (ROBOT SENTRY) CONTINUOUS AFTER SCROLL             */}
      {/* ========================================================================= */}
      <section
        id="login-section"
        className="relative z-50 w-full min-h-screen bg-[#070b13] border-t border-cyan-500/20 shadow-[0_-25px_60px_rgba(0,0,0,0.95)]"
      >
        {mountRobot ? (
          <RobotHero
            {...robotSettings}
            backgroundText="LOGIN"
            ctaText="Login"
            contactText="Live Dashboard"
            contactHref="/overview"
            showLoginOption={true}
          />
        ) : (
          <div className="h-screen w-full flex items-center justify-center bg-[#070b13]">
            <div className="h-8 w-8 rounded-full border-2 border-[#00ffc6] border-t-transparent animate-spin" />
          </div>
        )}
      </section>
    </div>
  );
}

export default VideoScrollIntro;
