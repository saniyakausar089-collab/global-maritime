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
import { Anchor, Moon, Sun, RefreshCw, Radio, CheckCircle2, AlertCircle, WifiOff, History, Compass, Sparkles } from "lucide-react";
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
            3D Story
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

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        {!isLanding && <Header />}
        {isLanding ? (
          <Outlet />
        ) : (
          <main className="mx-auto max-w-7xl px-4 py-5">
            <Outlet />
          </main>
        )}
      </div>
    </QueryClientProvider>
  );
}

function Header() {
  const [dark, setDark] = useState(false);
  const feedHealth = useFeedHealth();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching() > 0;
  const now = useLiveTime();

  useEffect(() => {
    const d = localStorage.getItem("theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
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
    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent";
  const activeNavProps = {
    className:
      "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors bg-sidebar-accent text-sidebar-primary border border-sidebar-primary/20",
  };

  // Health Pill Config (LIVE, DELAYED, STALE, OFFLINE)
  const healthBadge = {
    LIVE: {
      label: "LIVE",
      color: "bg-emerald-500",
      ping: true,
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
      icon: Radio,
    },
    DELAYED: {
      label: "DELAYED",
      color: "bg-amber-400",
      ping: true,
      text: "text-amber-300",
      border: "border-amber-400/30",
      bg: "bg-amber-400/10",
      icon: AlertCircle,
    },
    STALE: {
      label: "STALE",
      color: "bg-orange-500",
      ping: false,
      text: "text-orange-400",
      border: "border-orange-500/30",
      bg: "bg-orange-500/10",
      icon: AlertCircle,
    },
    OFFLINE: {
      label: "OFFLINE",
      color: "bg-rose-500",
      ping: false,
      text: "text-rose-400",
      border: "border-rose-500/30",
      bg: "bg-rose-500/10",
      icon: WifiOff,
    },
  }[feedHealth.state] || {
    label: "LIVE",
    color: "bg-emerald-500",
    ping: true,
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    icon: Radio,
  };

  const HealthIcon = healthBadge.icon;
  const utcClock = formatUtcClock(now);
  const localClock = now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";
  const syncAgo = formatTimeAgo(feedHealth.lastSyncTime || undefined, now);

  return (
    <header className="sticky top-0 z-[1000] h-[64px] border-b border-sidebar-border bg-sidebar shadow-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-5">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-sidebar-foreground group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent border border-sidebar-primary/30 text-sidebar-primary transition-transform group-hover:scale-105 shadow-inner">
              <Anchor className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-sidebar-foreground flex items-center gap-1.5">
                Port Monitor
                <span className="rounded bg-sidebar-primary/15 px-1.5 py-0.2 text-[9px] font-semibold text-sidebar-primary uppercase tracking-widest border border-sidebar-primary/25">
                  AIS Intel
                </span>
              </span>
              <span className="text-[10px] font-normal text-sidebar-foreground/60 tracking-wider">
                Enterprise Maritime Analytics
              </span>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1">
            <Link to="/" className={`${navLinkClass} flex items-center gap-1.5`} activeProps={activeNavProps} activeOptions={{ exact: true }}>
              <Compass className="h-3.5 w-3.5 text-cyan-400" />
              3D Story
            </Link>
            <Link to="/overview" className={navLinkClass} activeProps={activeNavProps}>
              Overview
            </Link>
            <Link to="/timemachine" className={`${navLinkClass} flex items-center gap-1.5`} activeProps={activeNavProps}>
              <History className="h-3.5 w-3.5 text-cyan-400" />
              Time Machine
            </Link>
            <Link to="/compare" className={navLinkClass} activeProps={activeNavProps}>
              Compare
            </Link>
            <Link to="/methodology" className={navLinkClass} activeProps={activeNavProps}>
              Methodology
            </Link>
          </nav>
        </div>

        {/* Right: Telemetry, Sync, Clocks, Refresh & Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Feed Health Indicator Pill */}
          <div
            className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono backdrop-blur-sm ${healthBadge.border} ${healthBadge.bg}`}
            title={`AIS Stream Status: ${feedHealth.message}`}
          >
            <span className="relative flex h-2 w-2">
              {healthBadge.ping && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${healthBadge.color}`}
                />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${healthBadge.color}`} />
            </span>
            <span className={`text-[11px] font-bold ${healthBadge.text}`}>{healthBadge.label}</span>
          </div>

          {/* Real-time UTC & Local Clock */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/50 px-3 py-1 font-mono text-[11px] text-sidebar-foreground/90">
            <span className="font-semibold text-sidebar-primary">{utcClock}</span>
            <span className="text-sidebar-foreground/40">|</span>
            <span className="text-sidebar-foreground/60">{localClock} Local</span>
          </div>

          {/* Synchronization Timestamp */}
          <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono text-sidebar-foreground/60">
            <span>Synced:</span>
            <span className="text-sidebar-foreground/90 font-medium">{syncAgo}</span>
          </div>

          {/* Manual Refresh Button with Spinning State */}
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            title={isFetching ? "Refreshing telemetry..." : "Refresh telemetry"}
            aria-label="Refresh data"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary disabled:opacity-50 transition-all shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-sidebar-primary" : ""}`} />
          </button>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary transition-all shadow-xs"
          >
            {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-cyan-300" />}
          </button>
        </div>
      </div>
    </header>
  );
}
