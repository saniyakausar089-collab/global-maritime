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
      let started = false;
      const startRelay = () => {
        if (started || relayProcess) return;
        started = true;
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
      };

      const req = http.get("http://127.0.0.1:3000/health", { timeout: 800 }, (res) => {
        if (res.statusCode === 200) {
          console.log("[Relay Dev Plugin] Port 3000 is already active and healthy.");
        } else {
          startRelay();
        }
      });

      req.on("error", startRelay);
      req.on("timeout", () => {
        req.destroy();
        startRelay();
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
        "/fleet": {
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
    server: { entry: "server" },
  },
});
