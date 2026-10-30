import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function relayServerPlugin(): Plugin {
  let relayProcess: ChildProcess | null = null;

  return {
    name: "maritime-relay-server",
    apply: "serve", // dev mode only
    configureServer(server) {
      // Check if port 3000 is already running
      const req = http.get("http://127.0.0.1:3000/health", () => {
        console.log("[Relay Dev Plugin] Port 3000 is already active and healthy.");
      });

      req.on("error", () => {
        console.log("[Relay Dev Plugin] Auto-starting relay server on port 3000...");
        const serverPath = path.resolve(__dirname, "port-monitor-live", "server.js");
        relayProcess = spawn(process.execPath, [serverPath], {
          stdio: "inherit",
          shell: false,
          env: { ...process.env },
        });

        relayProcess.on("exit", (code) => {
          if (code && code !== 0) {
            console.error(`[Relay Dev Plugin] Relay process exited with code ${code}`);
          }
        });
      });

      const cleanup = () => {
        if (relayProcess) {
          try {
            relayProcess.kill();
          } catch {
            /* ignore */
          }
          relayProcess = null;
        }
      };

      server.httpServer?.on("close", cleanup);
      process.on("exit", cleanup);
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);
    },
  };
}

export default defineConfig({
  plugins: [relayServerPlugin()],
  vite: {
    optimizeDeps: {
      exclude: ["maplibre-gl"],
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3000",
          changeOrigin: true,
          ws: true,
        },
        "/ports": {
          target: "http://127.0.0.1:3000",
          changeOrigin: true,
        },
        "/health": {
          target: "http://127.0.0.1:3000",
          changeOrigin: true,
        },
        "/ws": {
          target: "ws://127.0.0.1:3000",
          ws: true,
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
