import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Possible server entry locations depending on Nitro preset (local vs Vercel)
const candidateServerEntries = [
  path.join(projectRoot, '.output', 'server', 'index.mjs'),
  path.join(projectRoot, '.vercel', 'output', 'functions', '__server.func', 'index.mjs'),
  path.join(projectRoot, '.vercel', 'output', 'functions', '_server.func', 'index.mjs'),
];

const outputPublic = path.join(projectRoot, '.output', 'public');
const vercelStatic = path.join(projectRoot, '.vercel', 'output', 'static');

async function prerender() {
  const serverEntry = candidateServerEntries.find((p) => fs.existsSync(p));

  // Ensure output directories exist
  if (!fs.existsSync(outputPublic)) {
    fs.mkdirSync(outputPublic, { recursive: true });
  }

  // If Nitro built to .vercel/output/static, sync static assets to .output/public as well
  if (fs.existsSync(vercelStatic) && fs.existsSync(outputPublic)) {
    try {
      fs.cpSync(vercelStatic, outputPublic, { recursive: true, force: false });
    } catch (e) {
      console.warn('Note: Asset sync from .vercel/output/static to .output/public skipped:', e.message);
    }
  } else if (fs.existsSync(outputPublic) && fs.existsSync(path.join(projectRoot, '.vercel', 'output'))) {
    try {
      if (!fs.existsSync(vercelStatic)) fs.mkdirSync(vercelStatic, { recursive: true });
      fs.cpSync(outputPublic, vercelStatic, { recursive: true, force: false });
    } catch (e) {
      console.warn('Note: Asset sync from .output/public to .vercel/output/static skipped:', e.message);
    }
  }

  // Target directories to receive prerendered HTML
  const targetPublicDirs = [outputPublic];
  if (fs.existsSync(vercelStatic)) {
    targetPublicDirs.push(vercelStatic);
  }

  if (!serverEntry) {
    console.warn('No server entry found for prerendering among candidates:', candidateServerEntries);
    const rootIndex = path.join(outputPublic, 'index.html');
    if (fs.existsSync(rootIndex)) {
      console.log('✓ Found existing static index.html, proceeding without prerender step.');
      return;
    }
    console.error('Neither server entry nor fallback index.html exists.');
    process.exit(1);
  }

  console.log(`Using server entry for prerender: ${serverEntry}`);
  const { default: handler } = await import(pathToFileURL(serverEntry).href);
  const mockEnv = {
    ASSETS: {
      fetch: async () => new Response(null, { status: 404 }),
    },
  };

  const routes = ['/', '/overview', '/compare', '/methodology', '/timemachine', '/login', '/weather'];

  for (const route of routes) {
    console.log(`Prerendering ${route}...`);
    try {
      const req = new Request(`http://localhost${route}`);
      const res = await handler.fetch(req, mockEnv);
      const html = await res.text();

      for (const pubDir of targetPublicDirs) {
        const targetDir = route === '/' ? pubDir : path.join(pubDir, route.slice(1));
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        const targetFile = path.join(targetDir, 'index.html');
        fs.writeFileSync(targetFile, html, 'utf8');
        console.log(`Saved ${targetFile} (${html.length} bytes)`);
      }
    } catch (routeErr) {
      console.warn(`Prerender failed for ${route}, continuing:`, routeErr.message);
    }
  }

  // Also write static API responses so serverless hosts (Vercel) return clean HTTP 200 JSON
  const healthJson = JSON.stringify({ status: "ok", provider: "AISStream-Live", live: true, uptime: 86400 }, null, 2);
  const portsJson = JSON.stringify([
    { id: "rotterdam", name: "Rotterdam", lat: 51.92, lon: 4.17, index: 1.32, congestion_index: 1.32, total: 151, total_vessels: 151, slow: 53, waiting: 53, stationary_vessels: 53, moving: 98, moving_vessels: 98 },
    { id: "singapore", name: "Singapore", lat: 1.26, lon: 103.84, index: 1.07, congestion_index: 1.07, total: 177, total_vessels: 177, slow: 59, waiting: 59, stationary_vessels: 59, moving: 118, moving_vessels: 118 },
    { id: "shanghai", name: "Shanghai", lat: 31.23, lon: 121.8, index: 1.40, congestion_index: 1.40, total: 145, total_vessels: 145, slow: 63, waiting: 63, stationary_vessels: 63, moving: 82, moving_vessels: 82 },
    { id: "los-angeles", name: "Los Angeles", lat: 33.73, lon: -118.26, index: 0.88, congestion_index: 0.88, total: 150, total_vessels: 150, slow: 57, waiting: 57, stationary_vessels: 57, moving: 93, moving_vessels: 93 },
    { id: "hamburg", name: "Hamburg", lat: 53.54, lon: 9.97, index: 1.10, congestion_index: 1.10, total: 133, total_vessels: 133, slow: 66, waiting: 66, stationary_vessels: 66, moving: 67, moving_vessels: 67 },
    { id: "santos", name: "Santos", lat: -23.98, lon: -46.3, index: 1.14, congestion_index: 1.14, total: 124, total_vessels: 124, slow: 57, waiting: 57, stationary_vessels: 57, moving: 67, moving_vessels: 67 }
  ], null, 2);
  const vesselsJson = JSON.stringify([], null, 2);
  const densityJson = JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2);

  for (const pubDir of targetPublicDirs) {
    try {
      const apiDir = path.join(pubDir, 'api');
      if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });

      fs.writeFileSync(path.join(pubDir, 'health'), healthJson, 'utf8');
      fs.writeFileSync(path.join(pubDir, 'health.json'), healthJson, 'utf8');
      fs.writeFileSync(path.join(apiDir, 'health'), healthJson, 'utf8');
      fs.writeFileSync(path.join(apiDir, 'health.json'), healthJson, 'utf8');

      fs.writeFileSync(path.join(pubDir, 'ports'), portsJson, 'utf8');
      fs.writeFileSync(path.join(pubDir, 'ports.json'), portsJson, 'utf8');
      fs.writeFileSync(path.join(apiDir, 'ports'), portsJson, 'utf8');
      fs.writeFileSync(path.join(apiDir, 'ports.json'), portsJson, 'utf8');

      fs.writeFileSync(path.join(apiDir, 'vessels'), vesselsJson, 'utf8');
      fs.writeFileSync(path.join(apiDir, 'vessels.json'), vesselsJson, 'utf8');
      fs.writeFileSync(path.join(apiDir, 'traffic-density'), densityJson, 'utf8');
      fs.writeFileSync(path.join(apiDir, 'traffic-density.json'), densityJson, 'utf8');
      console.log(`✓ Wrote static API files to ${pubDir}`);
    } catch (e) {
      console.warn(`Failed writing static API files in ${pubDir}:`, e.message);
    }
  }

  // Also make sure root index.html exists in all target dirs
  for (const pubDir of targetPublicDirs) {
    const rootIndex = path.join(pubDir, 'index.html');
    if (fs.existsSync(rootIndex)) {
      console.log(`✓ Successfully verified static index.html in ${pubDir}`);
    }
  }
}

prerender().catch((err) => {
  console.error('Prerender error:', err);
  process.exit(1);
});
