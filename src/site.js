// The public pages that come from the sessions table in D1, drawn on request so a new or changed session shows up
// right away with no rebuild:
//   GET /assets/sessions.js          window.AJ_DATA for the home page, /sessions, /guide and My sessions
//   GET /sessions/:slug              one session's page
//   GET /og/sessions/:slug.png       its share image (cached; the page links it with ?v=<hash of what it shows>)
//   GET /faculty/:slug               one faculty member's page (src/faculty.js)
//   GET /sitemap.xml, /llms.txt      the built files, with the sessions filled in
// Everything else is the built site in dist/ (env.ASSETS). Templates and the share-image drawer are passed in
// (see src/worker.js), so tests can call this with files read from disk.

import { listSessions, getSession, clientData } from './sessions.js';
import { listFaculty, listMembers, withTies, clientFaculty } from './faculty.js';
import { facultyPage, sessionPage, shareFacts, shareVersion, sitemapWithSessions, llmsWithSessions } from './render.js';

export const SITE_URL = 'https://joinaijanuary.com';
export const ROUTES = ['/assets/sessions.js', '/sessions/*', '/faculty/*', '/og/sessions/*', '/sitemap.xml', '/llms.txt'];

const SHORT = 'public, max-age=60';
const asset = (env, request, path) => env.ASSETS.fetch(new Request(new URL(path, request.url), request));
async function notFound(env, request) {
  const page = await asset(env, request, '/404');
  return new Response(page.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// Returns a Response for the routes above, or null to let the built site answer.
export async function site(request, env, ctx, { templates, renderSession }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname;
  const siteUrl = env.SITE_URL || SITE_URL;

  if (path === '/assets/sessions.js') {
    const [sessions, faculty, members] = await Promise.all([listSessions(env), listFaculty(env), listMembers(env)]);
    const data = { ...clientData(sessions), faculty: clientFaculty(faculty, sessions, members) };
    const body = `// Sessions and faculty from D1, drawn by src/site.js.\nwindow.AJ_DATA=${JSON.stringify(data)};\n`;
    return new Response(body, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': SHORT } });
  }

  if (path === '/sitemap.xml' || path === '/llms.txt') {
    const [built, sessions] = await Promise.all([asset(env, request, path), listSessions(env)]);
    if (!built.ok) return built;
    const text = await built.text();
    const body = path === '/sitemap.xml' ? sitemapWithSessions(text, siteUrl, sessions) : llmsWithSessions(text, siteUrl, sessions);
    return new Response(body, { headers: { 'Content-Type': built.headers.get('Content-Type') || 'text/plain; charset=utf-8', 'Cache-Control': SHORT } });
  }

  let m = path.match(/^\/sessions\/([a-z0-9-]+)(\.html|\/)?$/);
  if (m) {
    if (m[2]) return Response.redirect(new URL(`/sessions/${m[1]}${url.search}`, url), 301);
    const [s, faculty] = await Promise.all([getSession(env, m[1]), listFaculty(env)]);
    if (!s) return notFound(env, request);
    return new Response(sessionPage(templates, siteUrl, s, faculty), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': SHORT } });
  }

  m = path.match(/^\/faculty\/([a-z0-9-]+)(\/)?$/);
  if (m) {
    if (m[2]) return Response.redirect(new URL(`/faculty/${m[1]}${url.search}`, url), 301);
    const [faculty, members, sessions] = await Promise.all([listFaculty(env), listMembers(env), listSessions(env)]);
    const f = faculty.find((x) => x.slug === m[1]);
    if (!f) return notFound(env, request);
    return new Response(facultyPage(templates, siteUrl, withTies(f, faculty, members), sessions), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': SHORT } });
  }

  m = path.match(/^\/og\/sessions\/([a-z0-9-]+)\.png$/);
  if (m) {
    const s = await getSession(env, m[1]);
    if (!s) return notFound(env, request);
    // Drawing one takes a few hundred milliseconds, so each version is drawn once per data center and cached.
    const v = shareVersion(s);
    const key = new Request(new URL(`/og/sessions/${s.slug}.png?v=${v}`, url));
    const cache = globalThis.caches?.default;
    let png = cache && (await cache.match(key));
    if (!png) {
      png = new Response(renderSession(shareFacts(s)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' } });
      if (cache) {
        const p = cache.put(key, png.clone());
        ctx?.waitUntil ? ctx.waitUntil(p) : await p;
      }
    }
    // The versioned link never changes; a bare link follows the session, so browsers check back.
    const forever = url.searchParams.get('v') === v;
    return new Response(png.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': forever ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' } });
  }

  return null;
}
