#!/usr/bin/env node
// A local preview of the site with no Wrangler and no accounts: the built dist/ plus the pages the Worker draws
// (src/site.js), over the in-memory D1 stand-in from tests/d1.mjs with every migration and scripts/faculty-mock.sql.
// Sign-in and taps are stubbed (nothing is saved). Used for the faculty mockup.
//
//   npm run preview        builds, fetches the mockup photos once, then serves http://localhost:8787
//
// Photos go to site/assets/faculty/ (gitignored) and are copied into dist/. One that can't be downloaded falls
// back to initials (or no picture, for a project).

import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeD1 } from '../tests/d1.mjs';
import { site } from '../src/site.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);

// Public pictures for the mockup: the person's own site, their company's site, or a screenshot of the project.
const PHOTOS = {
  'andrew-dunn.jpg': 'https://dunn.us/andrew.jpg',
  // AI Friday recap photos (people mid-talk, not headshots); swap for real headshots when we have them.
  'eli-ackerman.jpg': 'https://aifri.day/images/meetings/1-eli.jpg',
  'laura-williams.jpg': 'https://aifri.day/images/meetings/2-laura.jpg',
  'max-materne.jpg': 'https://aifri.day/images/meetings/3-max.jpg',
  'hello-gravel.png': 'https://hellogravel.com/images/hello-gravel-logo.png',
  'p-ai-friday.webp': 'https://dunn.us/_astro/ai-friday.MOa9-2fR_ZzM52i.webp',
  'p-hallucinating-splines.webp': 'https://dunn.us/_astro/hallucinating-splines.BMfT5lYv_Z2hKAJc.webp',
  'p-seedat.webp': 'https://dunn.us/_astro/seedat.Co3zxanl_Z1484UG.webp',
  'p-nola-art.webp': 'https://dunn.us/_astro/nola-art.CXbt2h37_vc61A.webp',
  'p-mardi-gras-fyi.webp': 'https://dunn.us/_astro/mardi-gras-fyi.JXgRVzS9_4TUzu.webp',
  'p-hello-gravel-site.png': 'https://hellogravel.com/images/hello-gravel-og.png',
  'p-hello-gravel-games.png': 'https://storage.googleapis.com/firecrawl-scrape-media/screenshot-32263336-bda1-49f8-80c0-b996d9516504.png?GoogleAccessId=scrape-bucket-accessor%40firecrawl.iam.gserviceaccount.com&Expires=1795024358&Signature=EArNePc%2FLgHxJoi7q4yXRB3MO7YFWEJ4RgNB%2B1ZfQTqmCYz%2Fuf3PgjB9lCBlRppDH3zTRhTmR62NqaftpMm91RNc51vYwoQtckHHD6vlIBOqtFl%2FdBP70j1kB86lYa03uYXdCbAztUtyWEZT1eeqAxGRpGNI%2FzrODuUwJQgRwe8bVolcGzwZCDNima4s8ypZbjrd7S%2ByVlkvN5WVZ%2BtwcccwElIXc2MV4%2FQf5%2FvxezCdjUTELogSWkdqtr2x9120VogWDxUOLOqTktJETtB0nxAtonLa9MfoEfGoOvPUbEJSI9kHivauP%2BFgTkn%2BK74IBjqaD7v2AGA93o3RDvU6FA%3D%3D',
  'tim-williamson.jpg': 'https://resconnola.com/wp-content/uploads/2017/03/Tim-W.jpg',
  'p-cfb-homecoming.webp': 'https://dunn.us/_astro/cfb-homecoming.D3Iuq-Zo_26XdiP.webp',
  'p-pick-yeah.webp': 'https://dunn.us/_astro/pick-yeah.LLzX7Hq-_Z1EbwwR.webp',
  'p-roux-wars.webp': 'https://dunn.us/_astro/roux-wars.DxycFqRQ_ZkBgb9.webp',
  'p-is-mardi-gras-early.webp': 'https://dunn.us/_astro/is-mardi-gras-early.BsBB_eu4_Z5aubT.webp',
  'p-flatten-nola.webp': 'https://dunn.us/_astro/flatten-nola.CrwYcud7_15FIF0.webp',
  'p-markdown-to-pdf.webp': 'https://dunn.us/_astro/markdown-to-pdf.DhXtIjeA_2sxvq8.webp',
  'p-agent-reading-relay.webp': 'https://dunn.us/_astro/agent-reading-relay.fLHJ_gok_1xwPS0.webp',
  'p-haunted-windows.webp': 'https://dunn.us/_astro/haunted-windows.D_WBsIod_Z1cUU9x.webp',
  'p-design-vibes.webp': 'https://dunn.us/_astro/design-vibes.YFNE8VLp_ZQMhbB.webp',
  'p-battlefield.webp': 'https://dunn.us/_astro/battlefield-first-edition.C-Vk4P1w_Z1Cq4xG.webp',
  'p-revelry.png': 'https://revelry.co/assets/img/logo-mark.png',
};
const photoDir = join(root, 'site/assets/faculty');
mkdirSync(photoDir, { recursive: true });
for (const [file, url] of Object.entries(PHOTOS)) {
  if (existsSync(join(photoDir, file))) continue;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'aijan-preview' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    writeFileSync(join(photoDir, file), Buffer.from(await r.arrayBuffer()));
    console.log(`photo: ${file}`);
  } catch (e) {
    console.log(`photo: couldn't get ${file} (${e.message}); it falls back to initials`);
  }
}
// A photo saved by slug (like whitley-rushing.jpg) wins over the one in the mock rows.
mkdirSync(join(root, 'dist/assets/faculty'), { recursive: true });
for (const f of readdirSync(photoDir)) copyFileSync(join(photoDir, f), join(root, 'dist/assets/faculty', f));

const DB = fakeD1();
DB.raw.exec(readFileSync(join(root, 'scripts/faculty-mock.sql'), 'utf8'));
const have = (p) => p && (!p.startsWith('/assets/') || existsSync(join(root, 'dist', p)));
for (const row of DB.raw.prepare('SELECT slug, photo, projects FROM faculty').all()) {
  const own = readdirSync(photoDir).find((f) => f.startsWith(`${row.slug}.`));
  const photo = own ? `/assets/faculty/${own}` : have(row.photo) ? row.photo : null;
  const projects = JSON.parse(row.projects).map((p) => (have(p.image) ? p : { ...p, image: undefined }));
  DB.raw.prepare('UPDATE faculty SET photo = ?, projects = ? WHERE slug = ?').run(photo, JSON.stringify(projects), row.slug);
}

const read = (p) => readFileSync(join(root, p), 'utf8');
const templates = { session: read('site/templates/session.html'), faculty: read('site/templates/faculty.html'), head: read('site/partials/head.html'), header: read('site/partials/header.html'), footer: read('site/partials/footer.html'), sheet: read('site/partials/sheet.html') };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain', '.xml': 'application/xml', '.zip': 'application/zip', '.pdf': 'application/pdf' };
const fileFor = (p) => {
  const base = join(root, 'dist', decodeURIComponent(p));
  return [base, `${base}.html`, join(base, 'index.html')].find((c) => existsSync(c) && statSync(c).isFile());
};
const ASSETS = {
  fetch: async (req) => {
    const f = fileFor(new URL(req.url).pathname);
    if (f) return new Response(readFileSync(f), { headers: { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' } });
    return new Response(readFileSync(join(root, 'dist/404.html')), { status: 404, headers: { 'Content-Type': TYPES['.html'] } });
  },
};
const env = { DB, ASSETS, SITE_URL: `http://localhost:${PORT}` };
const ME = { signedIn: false, going: [], want: [], guide: [], counts: {}, providers: [] };

http.createServer(async (req, res) => {
  try {
    const request = new Request(`http://localhost:${PORT}${req.url}`);
    const resp = new URL(request.url).pathname.startsWith('/api/')
      ? Response.json(ME)
      : (await site(request, env, null, { templates, renderSession: () => new Uint8Array() })) || (await ASSETS.fetch(request));
    res.writeHead(resp.status, Object.fromEntries(resp.headers));
    res.end(Buffer.from(await resp.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => console.log(`\nPreview: http://localhost:${PORT}/  ·  /faculty  ·  /faculty/hello-gravel\n`));
