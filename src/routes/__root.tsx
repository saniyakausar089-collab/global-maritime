import { QueryClient, QueryClientProvider, useIsFetching, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Anchor, Moon, Sun, RefreshCw, Radio, CheckCircle2, AlertCircle, WifiOff, History, Compass, Sparkles, LogIn, LogOut, ShieldCheck, Lock, CloudSun } from "lucide-react";
import { useFeedHealth, type FeedHealthState } from "@/lib/feedHealth";
import { useLiveTime, formatUtcClock, formatTimeAgo } from "@/lib/time";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Intro
          </Link>
          <Link
            to="/overview"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Live Overview
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {}, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/overview"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Global Maritime Port Monitor — AIS Intelligence Dashboard" },
      { name: "description", content: "Live enterprise AIS transponder monitoring, port congestion analytics, and vessel intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "alternate icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLanding = pathname === "/";
  const isLogin = pathname === "/login";
  const isJourney = pathname === "/journey";

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_logged_in") === "true";
    }
    return false;
  });

  useEffect(() => {
    const handleAuth = () => {
      const logged = localStorage.getItem("auth_logged_in") === "true";
      setIsAuthenticated(logged);
    };
    window.addEventListener("auth-change", handleAuth);
    window.addEventListener("storage", handleAuth);
    return () => {
      window.removeEventListener("auth-change", handleAuth);
      window.removeEventListener("storage", handleAuth);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated && !isLanding && !isLogin && !isJourney) {
      navigate({
        to: "/login",
        search: { redirect: pathname },
        replace: true,
      });
    }
  }, [isAuthenticated, pathname, isLanding, isLogin, isJourney, navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[#050608] text-white relative selection:bg-cyan-500/30 selection:text-white tactical-grid-bg">
        <div className="film-grain" />
        {!isLanding && !isLogin && !isJourney && <Header />}
        {isLanding || isLogin || isJourney ? (
          <Outlet />
        ) : !isAuthenticated ? (
          <div className="flex min-h-[70vh] items-center justify-center px-4">
            <div className="flex flex-col items-center gap-3 text-center p-7 rounded-2xl border border-cyan-500/30 bg-[#07090E]/85 backdrop-blur-xl max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(0,243,255,0.15)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-[#00f3ff] animate-pulse">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide uppercase font-sans">Operator Clearance Required</h2>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                Guest access restricted. Routing to Secure Terminal Login...
              </p>
            </div>
          </div>
        ) : (
          <main className="mx-auto max-w-[1400px] px-3 sm:px-6 py-4 sm:py-6">
            <Outlet />
          </main>
        )}
      </div>
    </QueryClientProvider>
  );
}

function Header() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const feedHealth = useFeedHealth();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching() > 0;
  const now = useLiveTime();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_logged_in") === "true";
    }
    return false;
  });
  const [authUser, setAuthUser] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_user") || "Operator";
    }
    return "Operator";
  });

  useEffect(() => {
    const syncAuth = () => {
      const logged = localStorage.getItem("auth_logged_in") === "true";
      setIsAuthenticated(logged);
      setAuthUser(localStorage.getItem("auth_user") || "Operator");
    };
    window.addEventListener("auth-change", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("auth-change", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("auth_logged_in");
      localStorage.removeItem("auth_user");
      window.dispatchEvent(new Event("auth-change"));
    } catch {}
    navigate({ to: "/login", replace: true });
  };

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const d = stored === null ? true : stored === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    localStorage.setItem("theme", d ? "dark" : "light");
  };

  const handleRefresh = async () => {
    if (isFetching) return;
    await queryClient.invalidateQueries();
  };

  const navLinkClass =
    "whitespace-nowrap px-3.5 py-1.5 text-xs font-mono font-medium rounded-lg transition-all text-slate-400 hover:text-white hover:bg-cyan-500/10 hover:border-cyan-500/20 border border-transparent";
  const activeNavProps = {
    className:
      "whitespace-nowrap px-3.5 py-1.5 text-xs font-mono font-semibold rounded-lg transition-all bg-cyan-500/15 text-[#00f3ff] border border-cyan-500/40 shadow-[0_0_12px_rgba(0,243,255,0.2)]",
  };

  const utcClock = formatUtcClock(now);

  return (
    <header className="sticky top-0 z-[1000] px-3 sm:px-6 pt-2.5 pb-1.5 pointer-events-none transition-all duration-300">
      {/* Tactical Military-Spec Floating Cockpit Nav */}
      <div
        className={`mx-auto max-w-[1280px] h-[60px] rounded-2xl px-4 sm:px-6 flex items-center justify-between pointer-events-auto transition-all duration-300 border border-cyan-500/20 bg-[#07090E]/90 backdrop-blur-2xl ${
          scrolled
            ? "shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(0,243,255,0.15)] scale-[0.99] border-cyan-500/35"
            : "shadow-[0_12px_30px_rgba(0,0,0,0.8)]"
        }`}
      >
        {/* Left: Brand Identity with Tactical Radar Ring */}
        <div className="flex items-center gap-3.5 shrink-0">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-cyan-500/20 to-blue-600/10 border border-cyan-500/40 text-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-transform group-hover:scale-105">
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ffc6] opacity-80" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00ffc6]" />
              </span>
              <Anchor className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[14px] font-bold tracking-wider text-white uppercase font-sans flex items-center gap-2 leading-none">
                Global Maritime
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 tracking-normal">
                  AIS-NET
                </span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 tracking-wider leading-tight mt-1">
                FLEET SURVEILLANCE &amp; PORT COMMAND
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Tactical Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1.5 shrink-0">
          <Link to="/" className={`${navLinkClass} flex items-center gap-1.5`} activeProps={activeNavProps} activeOptions={{ exact: true }}>
            <Compass className="h-3.5 w-3.5 text-cyan-400" />
            <span>Intro</span>
          </Link>
          <Link to="/overview" className={navLinkClass} activeProps={activeNavProps}>
            <span>Command Overview</span>
          </Link>
          <Link to="/timemachine" className={`${navLinkClass} flex items-center gap-1.5`} activeProps={activeNavProps}>
            <History className="h-3.5 w-3.5 text-cyan-400" />
            <span>Time Machine</span>
          </Link>
          <Link to="/weather" className={`${navLinkClass} flex items-center gap-1.5`} activeProps={activeNavProps}>
            <CloudSun className="h-3.5 w-3.5 text-cyan-400" />
            <span>Weather & Marine</span>
          </Link>
          <Link to="/compare" className={navLinkClass} activeProps={activeNavProps}>
            <span>Compare</span>
          </Link>
          <Link to="/methodology" className={navLinkClass} activeProps={activeNavProps}>
            <span>Methodology</span>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-cyan-500/20">
              <div className="flex items-center gap-1.5 rounded-lg border border-[#00ffc6]/40 bg-[#00ffc6]/10 px-2.5 py-1 text-xs font-mono text-[#00ffc6] shadow-[0_0_10px_rgba(0,255,198,0.15)]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#00ffc6]" />
                <span className="max-w-[110px] truncate text-[11px] font-semibold">
                  {authUser.includes("@") ? authUser.split("@")[0] : authUser}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Log out from console"
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-white/10 hover:border-rose-500/30 transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <Link to="/login" className={`${navLinkClass} flex items-center gap-1.5`} activeProps={activeNavProps}>
              <LogIn className="h-3.5 w-3.5 text-cyan-400" />
              <span>Operator Login</span>
            </Link>
          )}
        </nav>

        {/* Right: Live Telemetry, UTC Clock, Refresh & Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Tactical Pulsing LIVE Chip */}
          <div
            className="flex items-center gap-1.5 rounded-lg border border-[#00ffc6]/40 bg-[#00ffc6]/10 px-2.5 py-1 text-xs font-mono shadow-[0_0_12px_rgba(0,255,198,0.2)]"
            title={`AIS Stream Status: ${feedHealth.message}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-[#00ffc6]" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00ffc6]" />
            </span>
            <span className="text-[10px] font-bold text-[#00ffc6] tracking-wider">LIVE AIS</span>
          </div>

          {/* Real-time UTC Zulu Clock */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-[#0B0E14] px-2.5 py-1 font-mono text-[11px] text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="text-slate-400 text-[10px]">ZULU</span>
            <span className="text-[#00f3ff] font-semibold">{utcClock}</span>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            title={isFetching ? "Refreshing telemetry..." : "Refresh telemetry"}
            aria-label="Refresh data"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-cyan-500/30 bg-[#0B0E14] text-slate-300 hover:text-[#00f3ff] hover:border-cyan-500/60 hover:bg-cyan-500/10 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-cyan-400" : ""}`} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-cyan-500/30 bg-[#0B0E14] text-slate-300 hover:text-[#00f3ff] hover:border-cyan-500/60 hover:bg-cyan-500/10 transition-all cursor-pointer shadow-sm"
          >
            {dark ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-cyan-400" />}
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg border border-cyan-500/30 bg-[#0B0E14] text-white cursor-pointer shadow-sm"
            aria-label="Toggle mobile menu"
          >
            <span className="text-xs font-bold font-mono">☰</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden mx-auto max-w-[1280px] mt-2 p-3.5 rounded-2xl flex flex-col gap-1.5 pointer-events-auto border border-cyan-500/30 bg-[#07090E]/95 backdrop-blur-2xl shadow-[0_20px_40px_rgba(0,0,0,0.9)]">
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Intro
          </Link>
          <Link to="/overview" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Command Overview
          </Link>
          <Link to="/timemachine" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Time Machine
          </Link>
          <Link to="/weather" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Weather & Marine
          </Link>
          <Link to="/compare" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Compare
          </Link>
          <Link to="/methodology" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Methodology
          </Link>

          {isAuthenticated ? (
            <div className="pt-2 mt-1 border-t border-cyan-500/20 flex items-center justify-between px-2">
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#00ffc6]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="truncate max-w-[140px] font-semibold">{authUser}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-1 px-3 py-1 text-xs font-mono text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
              Operator Login
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
