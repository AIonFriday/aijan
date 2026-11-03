#!/usr/bin/env node
// Checks the built site in dist/: every internal link and asset points at a real file,
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
}

if (problems.length) {
  console.error('Problems in dist/:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`dist/ OK: ${html.length} pages, all internal links resolve.`);
