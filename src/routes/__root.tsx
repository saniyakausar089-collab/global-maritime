import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { Anchor, Moon, Sun, Sparkles } from "lucide-react";
import { LiveClock } from "@/components/ui-bits";

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
        <div className="mt-6">
          <Link
            to="/overview"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to Overview
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
          <a
            href="/overview"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go to Overview
          </a>
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
      { title: "Global Maritime Port Monitor" },
      { name: "description", content: "Live AIS-based port congestion monitoring dashboard." },
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
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
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
  const routerState = useRouterState();
  const isLanding = routerState.location.pathname === "/";

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        {!isLanding && <Header />}
        {isLanding ? (
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
  const [dark, setDark] = useState(false);
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
  const link =
    "rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground";
  const active = {
    className: "rounded-md px-3 py-1.5 text-sm bg-sidebar-accent text-sidebar-primary font-medium",
  };
  return (
    <header className="sticky top-0 z-[1000] border-b border-sidebar-border bg-sidebar">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
        <Link to="/overview" className="mr-4 flex items-center gap-2 font-semibold text-sidebar-foreground">
          <Anchor className="h-5 w-5 text-sidebar-primary" /> Port Monitor
        </Link>
        <nav className="flex flex-wrap gap-1">
          <Link to="/overview" className={link} activeProps={active} activeOptions={{ exact: true }}>
            Overview
          </Link>
          <Link to="/compare" className={link} activeProps={active}>
            Compare
          </Link>
          <Link to="/methodology" className={link} activeProps={active}>
            Methodology
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-sidebar-accent hover:text-amber-300 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> 3D Story
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <LiveClock />
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
