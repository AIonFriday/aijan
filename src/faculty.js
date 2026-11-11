// Faculty: the people and groups who lead sessions. They live in D1, in the `faculty` table
// (migrations/0006_faculty.sql). A faculty row is tied to its sessions by name: a session guide whose name
// matches faculty.name (ignoring case) is that person. Plain JavaScript with no imports, like src/sessions.js.

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
    projects: list(r.projects).filter((p) => p && p.name).map((p) => ({ name: String(p.name), about: String(p.about || ''), ...(https(p.url) ? { url: https(p.url) } : {}), ...(typeof p.image === 'string' && /^(https:\/\/|\/assets\/)/.test(p.image) ? { image: p.image } : {}) })),
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


// Who's part of which group, as [{ group, person }] slugs. Empty until 0006 is applied.
export async function listMembers(env) {
  try {
    const { results } = await env.DB.prepare('SELECT group_slug, person_slug, title FROM faculty_members ORDER BY sort, person_slug').all();
    return results.map((r) => ({ group: r.group_slug, person: r.person_slug, title: r.title || '' }));
  } catch (e) {
    if (noTable(e)) return [];
    throw e;
  }
}

// A faculty member with their ties filled in: a group's people, or the groups a person is part of.
export function withTies(f, faculty, members) {
  const bySlug = (slug) => faculty.find((x) => x.slug === slug);
  return {
    ...f,
    people: members.filter((m) => m.group === f.slug && bySlug(m.person)).map((m) => ({ ...bySlug(m.person), title: m.title })),
    groups: members.filter((m) => m.person === f.slug).map((m) => bySlug(m.group)).filter(Boolean),
  };
}

// The faculty row for a session guide, by name, or undefined.
export const facultyFor = (faculty, name) => faculty.find((f) => f.name.toLowerCase() === String(name).trim().toLowerCase());

// A faculty member's own sessions: the visible ones that list them as a guide, soonest first.
export const sessionsFor = (f, sessions) => sessions.filter((s) => s.guides.some((g) => g.name.toLowerCase() === f.name.toLowerCase()));
// A person's own sessions plus their groups' sessions, soonest first. Each gets `via`: the group, when it's theirs.
export function allSessionsFor(f, sessions) {
  const own = sessionsFor(f, sessions).map((s) => ({ s }));
  const seen = new Set(own.map((x) => x.s.slug));
  const viaGroups = (f.groups || []).flatMap((g) => sessionsFor(g, sessions).filter((s) => !seen.has(s.slug) && seen.add(s.slug)).map((s) => ({ s, via: g })));
  return [...own, ...viaGroups].sort((a, b) => (a.s.startsAt || '9') > (b.s.startsAt || '9') ? 1 : -1);
}

// "Brent McCrossen" -> "BM", "AI Friday" -> "AF". Shown when there's no photo.
export const initials = (name) => String(name).split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// One of three soft colors per person, so the strip isn't all one color. Stable for a given slug.
export function tint(slug) {
  let h = 0;
  for (const c of String(slug)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ['purple', 'green', 'gold'][h % 3];
}

// What the browser gets in window.AJ_DATA.faculty: just enough for the strip and the /faculty grid.
// Only the faculty who lead a session themselves (named as its guide) show in the home strip and on /faculty.
// Everyone else, like the rest of a company's team, shows on their group's page and has their own page.
export const clientFaculty = (faculty, sessions, members = []) =>
  faculty.filter((f) => sessionsFor(f, sessions).length).map((f) => {
    const t = withTies(f, faculty, members);
    return { slug: f.slug, name: f.name, role: f.role, isGroup: f.isGroup, ...(f.photo ? { photo: f.photo } : {}), initials: initials(f.name), tint: tint(f.slug), sessions: sessionsFor(f, sessions).length, ...(t.groups.length ? { groups: t.groups.map((g) => g.name) } : {}), ...(t.people.length ? { people: t.people.length } : {}) };
  });
