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
    featured: !!r.featured,
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
// The home strip and /faculty show the faculty who lead a session themselves (named as its guide), plus anyone
// marked featured. Everyone else, like the rest of a company's team, shows on their group's page and has their own page.
export const clientFaculty = (faculty, sessions, members = []) =>
  faculty.filter((f) => f.featured || sessionsFor(f, sessions).length).map((f) => {
    const t = withTies(f, faculty, members);
    return { slug: f.slug, name: f.name, role: f.role, isGroup: f.isGroup, ...(f.photo ? { photo: f.photo } : {}), initials: initials(f.name), tint: tint(f.slug), sessions: allSessionsFor(t, sessions).length, leads: sessionsFor(f, sessions).length, ...(t.groups.length ? { groups: t.groups.map((g) => g.name) } : {}), ...(t.people.length ? { people: t.people.length } : {}) };
  });

// --- Writing faculty (the admin tools in src/mcp.js) ----------------------------------------------------------

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LIMITS = { name: 80, role: 120, bio: 1200, links: 8, linkLabel: 30, projects: 15, projectName: 60, projectAbout: 200 };
// Only real https web links, with a dot in the host.
const httpsUrl = (u) => {
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname.includes('.'); } catch { return false; }
};
// An image is an https link, or a file under /assets/ that's committed to the repo.
const imageUrl = (u) => httpsUrl(u) || /^\/assets\/[\w./-]+$/.test(u);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const tooLong = (v, max) => typeof v === 'string' && v.length > max;

// Problems with a faculty row before it's saved, as plain sentences. An empty list means it's fine.
// Takes the camelCase shape fromRow() returns, plus visible and sort.
export function validate(f) {
  const errors = [];
  if (!f.slug || !SLUG.test(f.slug)) errors.push('slug must be lowercase words joined by hyphens, like whitley-rushing');
  if (typeof f.name !== 'string' || !f.name.trim()) errors.push('name is required');
  else if (tooLong(f.name, LIMITS.name)) errors.push(`name must be ${LIMITS.name} characters or fewer`);
  for (const k of ['role', 'bio']) {
    if (f[k] !== undefined && typeof f[k] !== 'string') errors.push(`${k} must be text`);
    else if (tooLong(f[k], LIMITS[k])) errors.push(`${k} must be ${LIMITS[k]} characters or fewer`);
  }
  if (f.photo != null && f.photo !== '' && (typeof f.photo !== 'string' || !imageUrl(f.photo))) errors.push('photo must be an https:// link (or a committed /assets/ file), or null for initials');
  for (const k of ['isGroup', 'featured', 'visible']) if (f[k] !== undefined && typeof f[k] !== 'boolean') errors.push(`${k} must be true or false`);
  if (f.sort !== undefined && !Number.isInteger(f.sort)) errors.push('sort must be a whole number');

  if (f.links !== undefined) {
    if (!Array.isArray(f.links)) errors.push('links must be a list of { label, url }');
    else {
      if (f.links.length > LIMITS.links) errors.push(`at most ${LIMITS.links} links`);
      f.links.forEach((l, i) => {
        if (!isObj(l) || typeof l.label !== 'string' || !l.label.trim() || typeof l.url !== 'string') errors.push(`link ${i + 1} needs a label and a url`);
        else {
          if (tooLong(l.label, LIMITS.linkLabel)) errors.push(`link label "${l.label.slice(0, 20)}…" must be ${LIMITS.linkLabel} characters or fewer`);
          if (!httpsUrl(l.url)) errors.push(`the link for ${l.label} must start with https://`);
        }
      });
    }
  }
  if (f.projects !== undefined) {
    if (!Array.isArray(f.projects)) errors.push('projects must be a list of { name, about, url?, image? }');
    else {
      if (f.projects.length > LIMITS.projects) errors.push(`at most ${LIMITS.projects} projects`);
      f.projects.forEach((p, i) => {
        if (!isObj(p) || typeof p.name !== 'string' || !p.name.trim() || typeof p.about !== 'string') { errors.push(`project ${i + 1} needs a name and an about line`); return; }
        if (tooLong(p.name, LIMITS.projectName)) errors.push(`project name "${p.name.slice(0, 20)}…" must be ${LIMITS.projectName} characters or fewer`);
        if (tooLong(p.about, LIMITS.projectAbout)) errors.push(`the about line for ${p.name} must be ${LIMITS.projectAbout} characters or fewer`);
        if (p.url != null && (typeof p.url !== 'string' || !httpsUrl(p.url))) errors.push(`the url for ${p.name} must start with https://`);
        if (p.image != null && (typeof p.image !== 'string' || !imageUrl(p.image))) errors.push(`the image for ${p.name} must be an https:// link or a committed /assets/ file`);
      });
    }
  }
  return errors;
}

// Only the fields we store, trimmed, so nothing extra lands in the JSON columns.
const cleanLinks = (a) => a.map((l) => ({ label: l.label.trim(), url: l.url.trim() }));
const cleanProjects = (a) => a.map((p) => ({ name: p.name.trim(), about: p.about.trim(), ...(p.url ? { url: p.url.trim() } : {}), ...(p.image ? { image: p.image.trim() } : {}) }));

const COLUMNS = { name: 'name', isGroup: 'is_group', role: 'role', bio: 'bio', photo: 'photo', links: 'links', projects: 'projects', sort: 'sort', featured: 'featured', visible: 'visible' };
const toColumn = (k, v) =>
  k === 'links' ? JSON.stringify(cleanLinks(v)) : k === 'projects' ? JSON.stringify(cleanProjects(v)) : typeof v === 'boolean' ? Number(v) : typeof v === 'string' ? (k === 'photo' && !v.trim() ? null : v.trim()) : v ?? null;

// Any faculty row by slug, hidden ones too, as fromRow() plus visible, sort and dates. Null if there's none.
export async function getFacultyRow(env, slug) {
  const r = await env.DB.prepare('SELECT * FROM faculty WHERE slug = ?').bind(slug).first();
  return r ? adminRow(r) : null;
}
export const adminRow = (r) => ({ ...fromRow(r), sort: r.sort, visible: !!r.visible, createdAt: r.created_at, updatedAt: r.updated_at });

// Adds a faculty row, or updates the one with the same slug (slugs never change). Fields left out keep their
// saved value; links and projects replace the whole list. Returns { ok, created, faculty } or { ok: false, errors }.
// The pages pick the change up on the next request.
export async function saveFaculty(env, input) {
  const before = await getFacultyRow(env, input.slug);
  const merged = { ...(before || {}), ...input };
  const errors = validate(merged);
  if (!errors.length) {
    const clash = await env.DB.prepare('SELECT slug FROM faculty WHERE name = ? COLLATE NOCASE AND slug != ?').bind(merged.name.trim(), merged.slug).first();
    if (clash) errors.push(`"${merged.name.trim()}" is already used by /faculty/${clash.slug}. Names must be different, ignoring case.`);
  }
  if (errors.length) return { ok: false, errors };
  const keys = Object.keys(COLUMNS).filter((k) => k in input);
  if (before) {
    if (keys.length) {
      await env.DB.prepare(`UPDATE faculty SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE slug = ?`)
        .bind(...keys.map((k) => toColumn(k, input[k])), input.slug).run();
    }
  } else {
    await env.DB.prepare(`INSERT INTO faculty (slug, ${keys.map((k) => COLUMNS[k]).join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`)
      .bind(input.slug, ...keys.map((k) => toColumn(k, input[k]))).run();
  }
  return { ok: true, created: !before, faculty: await getFacultyRow(env, input.slug) };
}

// Replaces a group's whole member list: [{ slug, title? }], shown in this order. The caller checks the slugs.
export async function setMembers(env, group, members) {
  const stmts = [
    env.DB.prepare('DELETE FROM faculty_members WHERE group_slug = ?').bind(group),
    ...members.map((m, i) => env.DB.prepare('INSERT INTO faculty_members (group_slug, person_slug, title, sort) VALUES (?, ?, ?, ?)').bind(group, m.slug, m.title || '', (i + 1) * 10)),
  ];
  // D1's batch runs them as one transaction, so a group is never left half-updated.
  await env.DB.batch(stmts);
}
