#!/usr/bin/env node
// A local preview of the site with no Wrangler and no accounts: the built dist/ plus the pages the Worker draws
// (src/site.js), over the in-memory D1 stand-in from tests/d1.mjs with every migration and scripts/faculty-mock.sql.
// Sign-in and taps are stubbed (nothing is saved). Used for the faculty mockup.
//
//   npm run preview        builds, then serves http://localhost:8787

import http from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeD1 } from '../tests/d1.mjs';
import { site } from '../src/site.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);

// Faculty photos and project screenshots are committed in site/assets/faculty/ (everyone OK'd theirs) and the build
// copies them into dist/. A file named after a slug (like whitley-rushing.jpg) wins over the photo in the mock row.
const photoDir = join(root, 'site/assets/faculty');

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
