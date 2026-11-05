#!/usr/bin/env node
// Checks the built site in dist/: every internal link, asset and share image points at a real file,
// and no {{template}} values were left unfilled. Run `npm run build` first. No dependencies.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!existsSync(dist)) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dist);
const html = files.filter((f) => f.endsWith('.html'));

// Same rules as Cloudflare's auto-trailing-slash html_handling: /x serves x.html or x/index.html.
const resolves = (path) => {
  const p = decodeURIComponent(path.split(/[?#]/)[0]);
  if (p === '' || p === '/') return true;
  const base = join(dist, p);
  return [base, base + '.html', join(base, 'index.html')].some((c) => existsSync(c) && statSync(c).isFile());
};

const problems = [];
for (const f of html) {
  const src = readFileSync(f, 'utf8');
  const where = relative(dist, f);
  if (/\{\{\w+\}\}/.test(src)) problems.push(`${where}: unfilled {{template}} value`);
  for (const [, url] of src.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:|#)/.test(url)) continue;
    if (!url.startsWith('/')) { problems.push(`${where}: use a root-relative link, not "${url}"`); continue; }
    if (!resolves(url)) problems.push(`${where}: broken link ${url}`);
  }
  // Search basics: one <h1> per page, a description, and structured data that parses.
  const h1s = (src.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) problems.push(`${where}: needs exactly one <h1> (has ${h1s})`);
  if (!/<meta name="description" content="[^"]+">/.test(src)) problems.push(`${where}: missing meta description`);
  for (const [, json] of src.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try { JSON.parse(json); } catch { problems.push(`${where}: structured data (ld+json) is not valid JSON`); }
  }
  // Share images are absolute URLs (crawlers need that), so check their path against dist/ too.
  for (const [, path] of src.matchAll(/property="og:image" content="https?:\/\/[^/"]+(\/[^"]*)"/g)) {
    if (!resolves(path)) problems.push(`${where}: share image ${path} was not built`);
  }
}

// Every sitemap URL is a real page on the production host, and robots.txt points at the sitemap.
const sitemapPath = join(dist, 'sitemap.xml');
const robotsPath = join(dist, 'robots.txt');
if (!existsSync(sitemapPath)) problems.push('sitemap.xml is missing');
else {
  const urls = [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]));
  if (!urls.length) problems.push('sitemap.xml lists no pages');
  for (const u of urls) if (!resolves(u.pathname)) problems.push(`sitemap.xml: broken link ${u.pathname}`);
}
if (!existsSync(join(dist, 'llms.txt'))) problems.push('llms.txt is missing');
if (!existsSync(robotsPath) || !/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(readFileSync(robotsPath, 'utf8'))) problems.push('robots.txt must name the sitemap');

if (problems.length) {
  console.error('Problems in dist/:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`dist/ OK: ${html.length} pages, all internal links and share images resolve.`);
