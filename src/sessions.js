// Sessions live in D1, in the `sessions` table (migrations/0002_sessions.sql). This file reads them and turns a
// row into the shape the pages, the browser code (window.AJ_DATA), emails and Slack use. It also holds the fixed
// lists (levels, topics) and a validator for anything that writes sessions, like the admin tools.
// Plain JavaScript with no imports, so the Worker, the build and the tests can all use it.

export const LEVELS = { all: 'All levels', new: 'New to AI', sometimes: 'Now and then', daily: 'Daily' };
export const TOPICS = { work: 'My job', life: 'Home and family', make: 'Making things', curious: 'Just curious' };
// Session types. Each has a short promise shown on the session page.
export const KINDS = {
  talk: { name: 'Talks and demos', promise: 'Sit back and watch. Demos, talks or a panel, then time to ask questions.' },
  'office-hours': { name: 'Office hours', promise: 'Drop in with your questions. Come and go whenever you like.' },
  'hands-on': { name: 'Hands-on', promise: 'Make something real, with a Guide at your table.' },
  group: { name: 'For your group', promise: 'Made for one kind of person, with examples from your world.' },
};
export const STATUSES = ['proposed', 'scheduled', 'cancelled'];
export const TIME_ZONE = 'America/Chicago';
export const DEFAULT_LOCATION = 'The Nieux, 2040 St. Charles';
export const LENGTH_MIN = 90;

const list = (v) => {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
};

// A guide is a name, plus an optional link to their website or LinkedIn: { name, url? }. Older rows and
// admin tools may give a plain name string; this turns either into the object shape. A link with no
// https:// gets one, so "hellogravel.com" works. Returns null for something that isn't a guide.
export function guide(g) {
  if (typeof g === 'string') g = { name: g };
  if (!g || typeof g !== 'object' || typeof g.name !== 'string' || !g.name.trim()) return null;
  const out = { name: g.name.trim() };
  const url = typeof g.url === 'string' ? g.url.trim() : '';
  if (url) out.url = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;
  return out;
}
const guides = (a) => (Array.isArray(a) ? a.map(guide).filter(Boolean) : []);
// Only real web links: http(s), with a dot in the host.
const goodUrl = (u) => {
  try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') && x.hostname.includes('.'); } catch { return false; }
};

// A D1 row (snake_case, JSON lists as text) as the camelCase object everything else uses.
export function fromRow(r) {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    status: r.status,
    ...(r.starts_at ? { startsAt: r.starts_at } : {}),
    lengthMin: r.length_min || LENGTH_MIN,
    ...(r.location ? { location: r.location } : {}),
    level: r.level,
    topics: list(r.topics),
    tags: list(r.tags),
    guides: guides(list(r.guides)),
    // Starting count that live taps add to. 0 for real sessions; the example sessions carry made-up numbers.
    count: r.seed_count || 0,
    kind: r.kind in KINDS ? r.kind : 'hands-on',
    officeHours: !!r.office_hours,
    // Example sessions stay out of search: noindex, not in the sitemap or llms.txt, no Event data.
    example: !!r.example,
    // When the row last changed, for <lastmod> in the sitemap.
    ...(r.updated_at ? { updatedAt: r.updated_at } : {}),
  };
}

// Sessions people can see: not cancelled, not hidden. Soonest first, then ideas in the order they were added.
export async function listSessions(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM sessions WHERE visible = 1 AND status != 'cancelled' ORDER BY starts_at IS NULL, starts_at, created_at, slug"
  ).all();
  return results.map(fromRow);
}

// One visible session by its slug, or null.
export async function getSession(env, slug) {
  const r = await env.DB.prepare("SELECT * FROM sessions WHERE slug = ? AND visible = 1 AND status != 'cancelled'").bind(slug).first();
  return r ? fromRow(r) : null;
}

// Problems with a session before it's saved, as plain sentences. An empty list means it's fine.
export function validate(s) {
  const errors = [];
  for (const k of ['slug', 'title', 'description', 'status', 'level']) if (!s[k]) errors.push(`missing ${k}`);
  if (s.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.slug)) errors.push('slug must be lowercase words joined by hyphens');
  if (s.status && !STATUSES.includes(s.status)) errors.push('status must be proposed, scheduled or cancelled');
  if (s.status === 'scheduled' && !s.startsAt) errors.push('scheduled sessions need startsAt');
  if (s.startsAt && Number.isNaN(Date.parse(s.startsAt))) errors.push('startsAt is not a valid date');
  if (s.startsAt && !/[+-]\d\d:\d\d$|Z$/.test(s.startsAt)) errors.push('startsAt needs a UTC offset, e.g. 2027-01-12T08:00:00-06:00');
  if (s.kind !== undefined && !(s.kind in KINDS)) errors.push(`unknown kind "${s.kind}"`);
  if (s.level && !(s.level in LEVELS)) errors.push(`unknown level "${s.level}"`);
  if (!Array.isArray(s.topics) || !s.topics.length) errors.push('needs at least one topic');
  else s.topics.forEach((t) => { if (!(t in TOPICS)) errors.push(`unknown topic "${t}"`); });
  if (s.guides !== undefined && !Array.isArray(s.guides)) errors.push('guides must be a list (can be empty)');
  else (s.guides || []).forEach((g) => {
    const n = guide(g);
    if (!n) errors.push('each guide needs a name');
    else if (n.url && !goodUrl(n.url)) errors.push(`the link for ${n.name} isn’t a web address, like https://example.com`);
  });
  return errors;
}

// Adds a session, or updates the one with the same slug (slugs never change once shared). Takes the camelCase
// shape fromRow() returns; fields left out keep their saved value on an update. Returns { ok, created, session }
// or { ok: false, errors }. Pages, share images and lists pick the change up on the next request.
const COLUMNS = {
  title: 'title', description: 'description', status: 'status', visible: 'visible', startsAt: 'starts_at', lengthMin: 'length_min',
  location: 'location', level: 'level', topics: 'topics', tags: 'tags', guides: 'guides', officeHours: 'office_hours', kind: 'kind', count: 'seed_count', example: 'example',
};
const toColumn = (k, v) => (k === 'guides' ? JSON.stringify(guides(v)) : ['topics', 'tags'].includes(k) ? JSON.stringify(v ?? []) : typeof v === 'boolean' ? Number(v) : v === '' ? null : v ?? null);
export async function saveSession(env, input) {
  const before = input.slug ? await env.DB.prepare('SELECT * FROM sessions WHERE slug = ?').bind(input.slug).first() : null;
  const merged = { ...(before ? fromRow(before) : {}), ...input };
  if (merged.status === 'scheduled' && !merged.startsAt) merged.startsAt = undefined;
  const errors = validate(merged);
  if (errors.length) return { ok: false, errors };
  if ('kind' in input) input = { ...input, officeHours: input.kind === 'office-hours' };
  const keys = Object.keys(COLUMNS).filter((k) => k in input);
  if (before) {
    if (keys.length) {
      await env.DB.prepare(`UPDATE sessions SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE slug = ?`)
        .bind(...keys.map((k) => toColumn(k, input[k])), input.slug).run();
    }
  } else {
    await env.DB.prepare(`INSERT INTO sessions (id, slug, ${keys.map((k) => COLUMNS[k]).join(', ')}) VALUES (?, ?, ${keys.map(() => '?').join(', ')})`)
      .bind(input.slug, input.slug, ...keys.map((k) => toColumn(k, input[k]))).run();
  }
  const row = await env.DB.prepare('SELECT * FROM sessions WHERE slug = ?').bind(input.slug).first();
  return { ok: true, created: !before, session: fromRow(row) };
}

// What the browser gets as window.AJ_DATA (/assets/sessions.js): the same shape the build used to write.
export const clientData = (sessions) => ({ levels: LEVELS, topics: TOPICS, kinds: KINDS, timeZone: TIME_ZONE, defaultLocation: DEFAULT_LOCATION, sessions });
