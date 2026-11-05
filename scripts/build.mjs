#!/usr/bin/env node
// Builds the static site into dist/. No dependencies: plain Node 20+.
//
//   node scripts/build.mjs          build dist/
//
// What it does:
//   1. Copies site/assets/ to dist/assets/.
//   2. Renders site/pages/*.html with the shared partials into dist/ (sessions.html is the /sessions page).
//   3. Draws the home share image (scripts/og.mjs): dist/og/home.png.
//   4. Writes dist/sitemap.xml, dist/robots.txt, dist/llms.txt and the IndexNow key file.
//   5. Zips site/assets/brand/ into dist/assets/brand/ai-january-brand-kit.zip for the /brand page.
//
// Sessions are not built: they live in D1, and the Worker draws their pages, share images, /assets/sessions.js
// and the session lines in the sitemap and llms.txt on request (src/site.js). Page pieces both use are in src/render.js.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHome } from './og-files.mjs';
import { esc, fill, graph, PLACE, PRESENTERS, FREE, head as headFor, header as headerFor, footer, SESSIONS_MARK } from '../src/render.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = process.env.SITE_URL || 'https://joinaijanuary.com';

const read = (p) => readFileSync(join(root, p), 'utf8');

// ---------- 1. assets ----------
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'og'), { recursive: true });
cpSync(join(root, 'site/assets'), join(dist, 'assets'), { recursive: true });
cpSync(join(root, 'site/assets/brand/favicon.ico'), join(dist, 'favicon.ico')); // browsers ask for /favicon.ico on their own

// ---------- 2. pages ----------
const t = { head: read('site/partials/head.html'), header: read('site/partials/header.html'), footer: read('site/partials/footer.html'), sheet: read('site/partials/sheet.html') };
const partials = { footer: footer(t.footer), sheet: t.sheet };

// ---------- search engines and answer engines ----------
// Structured data for the home page and /where. The shared pieces (PLACE, PRESENTERS, FREE) are in src/render.js.
const ORG = { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: 'AI January', url: `${SITE_URL}/`, logo: `${SITE_URL}/assets/brand/favicon-512.png`, email: 'january@aifri.day', parentOrganization: PRESENTERS };
const MONTH_EVENT = {
  '@type': 'EventSeries',
  '@id': `${SITE_URL}/#event`,
  name: 'AI January',
  description: 'Three weeks of free AI workshops, office hours, and conversations in New Orleans. Beginners welcome.',
  url: `${SITE_URL}/`,
  image: `${SITE_URL}/og/home.png`,
  startDate: '2027-01-08',
  endDate: '2027-01-29',
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  isAccessibleForFree: true,
  location: PLACE,
  organizer: PRESENTERS,
  offers: { ...FREE, url: `${SITE_URL}/sessions` },
};
// The home page's questions, read from its own <details> so the structured copy never drifts from the page.
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim();
const faqLd = (html) => ({
  '@type': 'FAQPage',
  mainEntity: [...html.matchAll(/<details><summary>(.*?)<\/summary>(.*?)<\/details>/gs)].map(([, q, a]) => ({
    '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a.replace(/<\/p>\s*<p>/g, '</p> <p>')) },
  })),
});
const head = (o) => headFor(t, SITE_URL, o);
const header = (current) => headerFor(t, current);

const PAGES = {
  'index.html': { path: '/', title: 'AI January · Free AI sessions in New Orleans', ogTitle: 'You’re invited to learn AI.', description: 'Three weeks of free AI workshops, office hours, and conversations in New Orleans, Jan 8–29, 2027. Beginners welcome.' },
  'sessions.html': { path: '/sessions', title: 'Sessions · AI January', description: 'Every free AI session in New Orleans this January, on a calendar or by topic. Vote for the ideas you want next.', current: 'sessions' },
  'guide.html': { path: '/guide', title: 'Guide a session · AI January', description: 'Guide a free AI session in New Orleans this January. No slides, just help the people at your table.', current: 'guide' },
  'krewe.html': { path: '/krewe', title: 'Bring your krewe · AI January', description: 'Bring your team, congregation, class, or block to a free AI session this January. We’ll match you with a guide.', current: 'krewe' },
  'where.html': { path: '/where', title: 'Where it is · AI January', description: 'Most AI January sessions are at The Nieux, 2040 St. Charles Ave, in the Eiffel Tower building. Address, parking, streetcar, and the rooms.', current: 'where' },
  'brand.html': { path: '/brand', title: 'Logos and brand · AI January', ogTitle: 'AI January logos and brand', description: 'Logos, colors, fonts, share images, and a short description of AI January, free to use when you write about us or put us on a flyer.' },
  'why.html': { path: '/why', title: 'Why AI January', ogTitle: 'Why AI January', description: 'We want more people in New Orleans using AI tools and building with them. Here’s how that turned into three weeks of free sessions.' },
  'privacy.html': { path: '/privacy', title: 'Privacy · AI January', description: 'What AI January keeps when you use the site, who sees it, and how to have it deleted.' },
  'me.html': { path: '/me', title: 'My sessions · AI January', description: 'The free AI sessions you picked: the ones you’re going to, the ones you want, and the ones you offered to guide.', current: 'me', noindex: true },
  '404.html': { path: '/404', title: 'Not found · AI January', description: 'That page isn’t here.', noindex: true },
};
for (const file of readdirSync(join(root, 'site/pages'))) {
  const meta = PAGES[file];
  if (!meta) throw new Error(`Add site/pages/${file} to PAGES in scripts/build.mjs`);
  const src = read(`site/pages/${file}`);
  const jsonLdHtml = file === 'index.html'
    ? graph(ORG, { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, name: 'AI January', url: `${SITE_URL}/`, publisher: { '@id': ORG['@id'] } }, MONTH_EVENT, faqLd(src))
    : file === 'where.html' ? graph({ ...PLACE, '@id': `${SITE_URL}/where#place`, url: `${SITE_URL}/where` })
    : '';
  const html = fill(src, { ...partials, head: head({ ...meta, jsonLdHtml }), header: header(meta.current) });
  writeFileSync(join(dist, file), html);
}

// ---------- 3. the home share image ----------
// Session share images are drawn by the Worker (src/site.js) from the same code.
writeFileSync(join(dist, 'og/home.png'), renderHome());

// ---------- 4. sitemap, robots.txt and IndexNow key ----------
// /me is personal and /404 isn't a real page, so neither goes to search engines.
// SESSIONS_MARK is where the Worker adds the sessions from D1 (example sessions stay out).
const sitemapPaths = Object.values(PAGES).filter((p) => !p.noindex).map((p) => p.path);
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths.map((p) => `  <url><loc>${esc(SITE_URL + p)}</loc></url>`).join('\n')}\n${SESSIONS_MARK}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
// llms.txt (llmstxt.org): a short plain-text summary for AI assistants that read the site, with the key pages.
const pageLine = (file, label) => `- [${label}](${SITE_URL}${PAGES[file].path}): ${PAGES[file].description}`;
writeFileSync(join(dist, 'llms.txt'), `# AI January

> Free AI sessions for everyone in New Orleans, Jan 8–29, 2027. Three weeks of workshops, office hours, and conversations, most at The Nieux, 2040 St. Charles Ave. Beginners welcome. Presented by Nieux Society and AI Friday.

- Every session is free. No AI experience needed.
- Sessions are 90 minutes, on weekdays, grouped by topic: My job, Home and family, Making things, Just curious.
- The month starts with AI Friday: the kickoff, Friday Jan 8, 2027, 9 AM.
- Anyone can suggest a session. Once five people want it and a guide signs up, it goes on the calendar.
- Volunteers who lead sessions are called guides. No slides: they open a laptop and help the people at their table.
- Groups (an office, congregation, class, or block) can ask for their own session.
- All times are New Orleans time (Central).
- Contact: january@aifri.day

## Pages

${pageLine('index.html', 'Home')}
${pageLine('sessions.html', 'Sessions')}
${pageLine('where.html', 'Where it is')}
${pageLine('guide.html', 'Guide a session')}
${pageLine('krewe.html', 'Bring a group')}
${pageLine('why.html', 'Why AI January')}
${SESSIONS_MARK}
## Optional

${pageLine('brand.html', 'Logos and brand')}
${pageLine('privacy.html', 'Privacy')}
`);
// IndexNow reads this file at the site root to confirm we own the domain. The key is public by design.
const INDEXNOW_KEY = '5549035db5f241c1b11c0c47c3a7f890';
writeFileSync(join(dist, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);

// ---------- 5. the brand kit zip ----------
// One download with every logo file, the usage guide and the README. A plain zip written by hand (deflate from
// node:zlib, CRC-32 below) so the build stays dependency-free. Fixed file dates keep the zip the same build to build.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zip(entries) {
  const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (11 << 5) | 4; // Nov 4, 2026
  const local = [], central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const packed = deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(DOS_TIME, 10); h.writeUInt16LE(DOS_DATE, 12); h.writeUInt32LE(crc32(data), 14);
    h.writeUInt32LE(packed.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nameBuf.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); h.copy(c, 8, 6, 28);
    c.writeUInt32LE(offset, 42);
    local.push(h, nameBuf, packed);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + packed.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, dir, end]);
}
const brandDir = join(root, 'site/assets/brand');
const kit = readdirSync(brandDir).sort().map((f) => ({ name: `ai-january-brand-kit/${f}`, data: readFileSync(join(brandDir, f)) }));
writeFileSync(join(dist, 'assets/brand/ai-january-brand-kit.zip'), zip(kit));

console.log(`Built dist/: ${Object.keys(PAGES).length} pages and the home share image. Session pages come from D1 at request time.`);
