// Faculty: the people and groups who lead sessions. They live in D1, in the `faculty` table
// (migrations/0006_faculty.sql). A faculty row is tied to its sessions by name: a session guide whose name
// matches faculty.name (ignoring case) is that person. Plain JavaScript with no imports, like src/sessions.js.

// How many New Orleanians Tim's invitation asks to lead a session. The home strip counts the open spots.
export const FACULTY_GOAL = 25;

const list = (v) => {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
};
const https = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : '');

export function fromRow(r) {
  return {
    slug: r.slug,
    name: r.name,
    isGroup: !!r.is_group,
    role: r.role || '',
    bio: r.bio || '',
    ...(r.photo ? { photo: r.photo } : {}),
    links: list(r.links).filter((l) => l && l.label && https(l.url)).map((l) => ({ label: String(l.label), url: https(l.url) })),
    projects: list(r.projects).filter((p) => p && p.name).map((p) => ({ name: String(p.name), about: String(p.about || ''), ...(https(p.url) ? { url: https(p.url) } : {}) })),
  };
}

// Until 0006 is applied to a database, there's no faculty table: show no faculty rather than break the site.
const noTable = (e) => /no such table/i.test(String(e?.message || e));

export async function listFaculty(env) {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM faculty WHERE visible = 1 ORDER BY sort, name').all();
    return results.map(fromRow);
  } catch (e) {
    if (noTable(e)) return [];
    throw e;
  }
}

export async function getFaculty(env, slug) {
  try {
    const r = await env.DB.prepare('SELECT * FROM faculty WHERE slug = ? AND visible = 1').bind(slug).first();
    return r ? fromRow(r) : null;
  } catch (e) {
    if (noTable(e)) return null;
    throw e;
  }
}

// The faculty row for a session guide, by name, or undefined.
export const facultyFor = (faculty, name) => faculty.find((f) => f.name.toLowerCase() === String(name).trim().toLowerCase());

// A person's sessions: the visible ones that list them as a guide, soonest first.
export const sessionsFor = (f, sessions) => sessions.filter((s) => s.guides.some((g) => g.name.toLowerCase() === f.name.toLowerCase()));

// "Brent McCrossen" -> "BM", "AI Friday" -> "AF". Shown when there's no photo.
export const initials = (name) => String(name).split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// One of three soft colors per person, so the strip isn't all one color. Stable for a given slug.
export function tint(slug) {
  let h = 0;
  for (const c of String(slug)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ['purple', 'green', 'gold'][h % 3];
}

// What the browser gets in window.AJ_DATA.faculty: just enough for the strip and the /faculty grid.
export const clientFaculty = (faculty, sessions) =>
  faculty.map((f) => ({ slug: f.slug, name: f.name, role: f.role, isGroup: f.isGroup, ...(f.photo ? { photo: f.photo } : {}), initials: initials(f.name), tint: tint(f.slug), sessions: sessionsFor(f, sessions).length }));
