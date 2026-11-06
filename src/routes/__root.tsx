import { QueryClient, QueryClientProvider, useIsFetching, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Anchor, Moon, Sun, RefreshCw, Radio, CheckCircle2, AlertCircle, WifiOff, History, Compass, Sparkles, LogIn } from "lucide-react";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLanding = pathname === "/";
  const isLogin = pathname === "/login";

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-bg text-ink relative selection:bg-accent/25 selection:text-ink">
        <div className="film-grain" />
        {!isLanding && !isLogin && <Header />}
        {isLanding || isLogin ? (
          <Outlet />
        ) : (
          <main className="mx-auto max-w-7xl px-4 py-6">
            <Outlet />
          </main>
        )}
      </div>
    </QueryClientProvider>
  );
}

function Header() {
  const [dark, setDark] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const feedHealth = useFeedHealth();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching() > 0;
  const now = useLiveTime();

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
    "whitespace-nowrap px-3.5 py-1.5 text-xs font-medium rounded-full transition-all text-ink-2 hover:text-ink hover:bg-white/5";
  const activeNavProps = {
    className:
      "whitespace-nowrap px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all bg-white/10 text-accent border border-white/10 shadow-xs",
  };

  const utcClock = formatUtcClock(now);

  return (
    <header className="sticky top-0 z-[1000] px-3 sm:px-4 pt-3 pb-1 pointer-events-none transition-all duration-300">
      {/* Centered Apple-Style Floating Glass Pill Nav */}
      <div
        className={`mx-auto max-w-[960px] h-[56px] rounded-full glass-panel px-3.5 sm:px-5 flex items-center justify-between pointer-events-auto transition-all duration-300 ${
          scrolled ? "shadow-[0_20px_40px_rgba(0,0,0,0.6)] scale-[0.985] bg-opacity-80" : "shadow-lg"
        }`}
      >
        {/* Left: Brand Identity with Fixed Line-Height & Overflow Protection */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-ink group">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 border border-accent/30 text-accent transition-transform group-hover:scale-105 shadow-inner">
              <Anchor className="h-4 w-4" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[13px] font-bold tracking-tight text-ink flex items-center gap-1.5 leading-none whitespace-nowrap">
                Port Monitor
              </span>
              <span className="hidden min-[1100px]:block text-[10px] font-normal text-ink-3 tracking-wider leading-tight mt-0.5 whitespace-nowrap">
                Enterprise Maritime Analytics
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 shrink-0">
          <Link to="/" className={`${navLinkClass} flex items-center gap-1.5`} activeProps={activeNavProps} activeOptions={{ exact: true }}>
            <Compass className="h-3.5 w-3.5 text-accent" />
            <span>Intro</span>
          </Link>
          <Link to="/overview" className={navLinkClass} activeProps={activeNavProps}>
            <span>Overview</span>
          </Link>
          <Link to="/timemachine" className={`${navLinkClass} flex items-center gap-1.5`} activeProps={activeNavProps}>
            <History className="h-3.5 w-3.5 text-accent" />
            <span>Time Machine</span>
          </Link>
          <Link to="/compare" className={navLinkClass} activeProps={activeNavProps}>
            <span>Compare</span>
          </Link>
          <Link to="/methodology" className={navLinkClass} activeProps={activeNavProps}>
            <span>Methodology</span>
          </Link>
          <Link to="/login" className={`${navLinkClass} flex items-center gap-1.5`} activeProps={activeNavProps}>
            <LogIn className="h-3.5 w-3.5 text-accent" />
            <span>Terminal Login</span>
          </Link>
        </nav>

        {/* Right: Live Telemetry, UTC Clock, Refresh & Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Pulsing LIVE Chip */}
          <div
            className="flex items-center gap-1.5 rounded-full border border-[#34D399]/30 bg-[#34D399]/12 px-2.5 py-1 text-xs font-mono"
            title={`AIS Stream Status: ${feedHealth.message}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-[#34D399]" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34D399]" />
            </span>
            <span className="text-[10px] font-bold text-[#34D399] tracking-wider">LIVE</span>
          </div>

          {/* Real-time UTC Clock */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-[10px] text-slate-200">
            <span className="text-accent font-semibold">{utcClock}</span>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            title={isFetching ? "Refreshing telemetry..." : "Refresh telemetry"}
            aria-label="Refresh data"
            className="flex items-center justify-center h-8 w-8 rounded-full border border-white/20 bg-white/10 text-slate-200 hover:text-white hover:bg-white/20 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-accent" : ""}`} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center justify-center h-8 w-8 rounded-full border border-white/20 bg-white/10 text-slate-200 hover:text-white hover:bg-white/20 transition-all cursor-pointer shadow-sm"
          >
            {dark ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-accent" />}
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-full border border-white/20 bg-white/10 text-white cursor-pointer shadow-sm"
            aria-label="Toggle mobile menu"
          >
            <span className="text-xs font-bold font-mono">☰</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden mx-auto max-w-[960px] mt-2 p-3 glass-panel rounded-2xl flex flex-col gap-1 pointer-events-auto">
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Intro
          </Link>
          <Link to="/overview" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Overview
          </Link>
          <Link to="/timemachine" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Time Machine
          </Link>
          <Link to="/compare" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Compare
          </Link>
          <Link to="/methodology" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Methodology
          </Link>
          <Link to="/login" onClick={() => setMobileMenuOpen(false)} className={`${navLinkClass} py-2`} activeProps={activeNavProps}>
            Terminal Login
          </Link>
        </div>
      )}
    </header>
  );
}
