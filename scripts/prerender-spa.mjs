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

  const routes = ['/', '/overview', '/compare', '/methodology'];

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
