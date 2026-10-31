import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const serverEntry = path.join(projectRoot, '.output', 'server', 'index.mjs');
const publicDir = path.join(projectRoot, '.output', 'public');

async function prerender() {
  if (!fs.existsSync(serverEntry)) {
    console.error('Server entry not found at:', serverEntry);
    process.exit(1);
  }

  const { default: handler } = await import(pathToFileURL(serverEntry).href);
  const mockEnv = {
    ASSETS: {
      fetch: async () => new Response(null, { status: 404 }),
    },
  };

  const routes = ['/', '/overview', '/compare', '/methodology'];

  for (const route of routes) {
    console.log(`Prerendering ${route}...`);
    const req = new Request(`http://localhost${route}`);
    const res = await handler.fetch(req, mockEnv);
    const html = await res.text();

    const targetDir = route === '/' ? publicDir : path.join(publicDir, route.slice(1));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetFile = path.join(targetDir, 'index.html');
    fs.writeFileSync(targetFile, html, 'utf8');
    console.log(`Saved ${targetFile} (${html.length} bytes)`);
  }

  // Also make sure root index.html exists
  const rootIndex = path.join(publicDir, 'index.html');
  if (fs.existsSync(rootIndex)) {
    console.log('✓ Successfully generated static index.html for Vercel SPA deployment!');
  }
}

prerender().catch(err => {
  console.error('Prerender error:', err);
  process.exit(1);
});
