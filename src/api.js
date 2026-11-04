// The taps people make, saved in D1: RSVP, "I want this", "I could guide this", suggestions,
// guide offers, and krewe requests. Every write belongs to a person: signed in on this device, or found by the
// email they typed (POST /api/start in worker.js).
// Sessions still come from data/sessions.json, so attendance.session_id holds the session's slug.

import data from '../data/sessions.json';

const SESSIONS = new Map(data.sessions.filter((s) => s.status !== 'cancelled' && s.visible !== false).map((s) => [s.slug, s]));
const KINDS = { rsvp: 'scheduled', want: 'proposed', guide: null }; // kind -> status it needs (null = any)
const SIZES = ['5-10', '10-20', '20-40', '40+'];

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const err = (status, error) => json({ error }, status);
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const id = () => crypto.randomUUID();

// Live counts that sit on top of the seed counts in data/sessions.json.
export async function counts(env) {
  const { results } = await env.DB.prepare(
    "SELECT session_id, kind, COUNT(*) AS n FROM attendance WHERE kind IN ('want','rsvp') GROUP BY session_id, kind"
  ).all();
  const out = {};
  for (const r of results) (out[r.session_id] ||= {})[r.kind] = r.n;
  return out;
}

// What one person has tapped.
export async function mine(env, userId) {
  const { results } = await env.DB.prepare('SELECT session_id, kind FROM attendance WHERE user_id = ?').bind(userId).all();
  const out = { rsvp: [], want: [], guide: [] };
  for (const r of results) if (SESSIONS.has(r.session_id)) out[r.kind].push(r.session_id);
  return out;
}

// POST /api/sessions/:slug/:kind  { on: true|false }
export async function toggle(env, user, slug, kind, body) {
  const s = SESSIONS.get(slug);
  if (!s) return err(404, 'No session with that link.');
  if (!(kind in KINDS)) return err(404, 'Not found');
  if (KINDS[kind] && s.status !== KINDS[kind]) return err(409, kind === 'rsvp' ? 'This one isn’t scheduled yet.' : 'This one is already scheduled.');
  const on = body.on !== false;
  let added = false;
  if (on) {
    const guideAs = kind === 'guide' ? text(body.guideAs, 80) || null : null;
    const saved = await env.DB.prepare(
      'INSERT INTO attendance (session_id, user_id, kind, guide_as, guide_status) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING'
    ).bind(slug, user.id, kind, guideAs, kind === 'guide' ? 'requested' : null).run();
    added = saved.meta.changes > 0;
  } else {
    await env.DB.prepare('DELETE FROM attendance WHERE session_id = ? AND user_id = ? AND kind = ?').bind(slug, user.id, kind).run();
  }
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM attendance WHERE session_id = ? AND kind = ?').bind(slug, kind).first();
  // count = seed count + saved taps (what people see); saved = saved taps only; added = this tap was new.
  return json({ ok: true, on, added, slug, kind, count: kind === 'guide' ? null : s.count + row.n, saved: row.n });
}

// POST /api/suggestions  { text }
export async function suggest(env, user, body) {
  const t = text(body.text, 1000);
  if (!t) return err(400, 'Type your idea first.');
  await env.DB.prepare('INSERT INTO suggestions (id, text, user_id) VALUES (?, ?, ?)').bind(id(), t, user.id).run();
  return json({ ok: true });
}

// POST /api/guide-offers  { topics: [], what, level, times: [], guideAs }
export async function offerToGuide(env, user, body) {
  const topics = Array.isArray(body.topics) ? body.topics.map((t) => text(t, 60)).filter(Boolean).slice(0, 10) : [];
  const what = text(body.what, 500);
  if (!topics.length && !what) return err(400, 'Pick at least one thing you could help with.');
  const extra = { level: text(body.level, 60) || null, times: Array.isArray(body.times) ? body.times.map((t) => text(t, 40)).slice(0, 6) : [] };
  await env.DB.prepare('INSERT INTO guide_offers (id, user_id, topics, what, guide_as, details) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id(), user.id, JSON.stringify(topics), what || null, text(body.guideAs, 80) || null, JSON.stringify(extra)).run();
  return json({ ok: true });
}

// POST /api/krewes  { groupName, what, size }
export async function kreweRequest(env, user, body) {
  const groupName = text(body.groupName, 120);
  const what = text(body.what, 1000);
  if (!groupName || !what) return err(400, 'Add your group’s name and what you want to learn.');
  const size = SIZES.includes(body.size) ? body.size : null;
  await env.DB.prepare('INSERT INTO krewe_requests (id, group_name, what, size, user_id) VALUES (?, ?, ?, ?, ?)')
    .bind(id(), groupName, what, size, user.id).run();
  return json({ ok: true });
}

// One tap from the browser, as app.js describes it: { type: 'rsvp' | 'want' | 'guide', slug, guideAs }
// or { type: 'suggest' | 'guideOffer' | 'krewe', ...form fields }. Only ever adds; undoing needs the person in.
export const TAP_TYPES = ['rsvp', 'want', 'guide', 'suggest', 'guideOffer', 'krewe'];
export function run(env, user, tap) {
  if (tap.type in KINDS) return toggle(env, user, String(tap.slug || ''), tap.type, { on: true, guideAs: tap.guideAs });
  if (tap.type === 'suggest') return suggest(env, user, tap);
  if (tap.type === 'guideOffer') return offerToGuide(env, user, tap);
  if (tap.type === 'krewe') return kreweRequest(env, user, tap);
  return err(400, 'Unknown tap.');
}

export const session = (slug) => SESSIONS.get(slug) || null;

// No more than this many "here's what you picked" emails per address per day, so the email box
// can't be used to flood someone. Taps past it still count; they just don't send email.
const DAILY_EMAILS = 6;
export async function canEmail(env, email) {
  const { results } = await env.DB.prepare("SELECT expiresAt FROM verification WHERE identifier LIKE 'magic-link:%' AND value LIKE ?")
    .bind(`%"email":${JSON.stringify(email)}%`).all();
  const now = Date.now();
  const live = results.filter((r) => new Date(typeof r.expiresAt === 'string' && /^\d+$/.test(r.expiresAt) ? Number(r.expiresAt) : r.expiresAt).getTime() > now);
  return live.length < DAILY_EMAILS;
}

export { json, err };
