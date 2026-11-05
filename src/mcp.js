// ABOUTME: The admin MCP server at /mcp: lets organizers add, edit and hide sessions and manage who's in them.
// ABOUTME: Plain JSON-RPC over HTTP POST (MCP "Streamable HTTP", answered as JSON), with one key per admin.
//
// Each admin sends their own key as `Authorization: Bearer aj_…`. Only its SHA-256 hash is stored, in
// admin_keys (migrations/0003). Revoking a key turns it off on the next call. See docs/admin.md.
//
// Sessions are read and saved with src/sessions.js, so a change shows on the site right away. The only thing
// passed in is how to make an account for a new email (Better Auth, in the Worker), so the tests can run this
// on Node with tests/d1.mjs standing in for D1.

import { fromRow, saveSession, LEVELS as LEVEL_NAMES, TOPICS as TOPIC_NAMES } from './sessions.js';

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const SERVER = { name: 'aijan-admin', title: 'AI January admin', version: '1.0.0' };
export const INSTRUCTIONS =
  'Admin tools for joinaijanuary.com (AI January, free AI sessions in New Orleans, Jan 8–29, 2027). ' +
  'All times are New Orleans time: give startsAt with an offset, like 2027-01-12T08:00:00-06:00. ' +
  'Slugs never change once a session exists. Changes show on the site right away, so check with the admin before writing. ' +
  'Use plain, friendly words in titles and descriptions; the people reading them are often new to AI.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KINDS = ['rsvp', 'want', 'guide'];
// What a person can be added as, by the session's status (the same rule the site's buttons follow).
const NEEDS = { rsvp: 'scheduled', want: 'proposed', guide: null };
const LEVELS = Object.keys(LEVEL_NAMES);
const TOPICS = Object.keys(TOPIC_NAMES);

const now = () => new Date().toISOString();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export async function hashKey(key) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
}

export function newKey() {
  return 'aj_' + b64url(crypto.getRandomValues(new Uint8Array(32)));
}

export function slugify(title) {
  return String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

class ToolError extends Error {}
const fail = (msg) => {
  throw new ToolError(msg);
};
const str = (v, name, max = 2000) => {
  if (typeof v !== 'string' || !v.trim()) fail(`${name} is required.`);
  return v.trim().slice(0, max);
};
const email = (v) => {
  const e = String(v || '').trim().toLowerCase();
  if (!EMAIL.test(e)) fail('That doesn’t look like an email address.');
  return e;
};
const slug = (v) => {
  const s = String(v || '').trim();
  if (!SLUG.test(s)) fail('Give the session’s slug, like coffee-office-hours-jan-12.');
  return s;
};
const kind = (v) => {
  if (!KINDS.includes(v)) fail('kind must be rsvp, want or guide.');
  return v;
};

// --- Shared reads ---------------------------------------------------------------------------------------------

async function sessionRow(env, s) {
  return env.DB.prepare('SELECT * FROM sessions WHERE slug = ?').bind(s).first();
}

async function mustSession(env, deps, s) {
  const row = await sessionRow(env, s);
  if (!row) fail(`No session with the slug "${s}". Use list_sessions to find it.`);
  return { ...fromRow(row), visible: !!row.visible };
}

async function tapCounts(env, s) {
  const q = s
    ? env.DB.prepare("SELECT session_id, kind, COUNT(*) AS n FROM attendance WHERE session_id = ? GROUP BY session_id, kind").bind(s)
    : env.DB.prepare('SELECT session_id, kind, COUNT(*) AS n FROM attendance GROUP BY session_id, kind');
  const { results } = await q.all();
  const out = {};
  for (const r of results) (out[r.session_id] ||= { rsvp: 0, want: 0, guide: 0 })[r.kind] = r.n;
  return out;
}

async function findUser(env, e) {
  return env.DB.prepare('SELECT id, name, email FROM "user" WHERE lower(email) = ?').bind(e).first();
}

async function people(env, s, k) {
  const q = k
    ? env.DB.prepare('SELECT u.name, u.email, a.kind, a.guide_as, a.guide_status, a.created_at FROM attendance a JOIN "user" u ON u.id = a.user_id WHERE a.session_id = ? AND a.kind = ? ORDER BY a.created_at').bind(s, k)
    : env.DB.prepare('SELECT u.name, u.email, a.kind, a.guide_as, a.guide_status, a.created_at FROM attendance a JOIN "user" u ON u.id = a.user_id WHERE a.session_id = ? ORDER BY a.kind, a.created_at').bind(s);
  const { results } = await q.all();
  return results.map((r) => ({
    name: r.name || null,
    email: r.email,
    kind: r.kind,
    ...(r.kind === 'guide' ? { guideAs: r.guide_as || null, guideStatus: r.guide_status } : {}),
    added: r.created_at,
  }));
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  // A leading = + - @ makes spreadsheets run the cell as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// --- Tools ----------------------------------------------------------------------------------------------------

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const SESSION_FIELDS = {
  title: { type: 'string', description: 'Short, plain title in sentence case.' },
  description: { type: 'string', description: 'One or two friendly sentences on what happens.' },
  status: { type: 'string', enum: ['proposed', 'scheduled', 'cancelled'], description: 'proposed = an idea people can say they want; scheduled = has a date; cancelled.' },
  startsAt: { type: 'string', description: 'Start time with the New Orleans offset, like 2027-01-12T08:00:00-06:00. Needed when scheduled.' },
  lengthMin: { type: 'integer', description: 'Length in minutes. Default 90.' },
  location: { type: ['string', 'null'], description: 'Where, if not The Nieux. null means The Nieux.' },
  level: { type: 'string', enum: LEVELS, description: 'all, new (New to AI), sometimes (Now and then), daily (Daily).' },
  topics: { type: 'array', items: { type: 'string', enum: TOPICS }, description: 'work (My job), life (Home and family), make (Making things), curious (Just curious).' },
  guides: { type: 'array', items: { type: 'string' }, description: 'Guide names as shown on the page (people or groups).' },
  tags: { type: 'array', items: { type: 'string' }, description: 'Free words. Add "ai-for" to an idea titled "AI for …" (like "AI for teachers") to show it as a button in the "AI for…" row on /sessions.' },
  officeHours: { type: 'boolean', description: 'True for drop-in office hours. Back end only, never shown as a category.' },
};

export const TOOLS = [
  {
    name: 'whoami',
    title: 'Who am I',
    description: 'Shows which admin key you are using and its role. Owners also see every admin key.',
    inputSchema: obj({}),
    readOnly: true,
    async run(env, admin) {
      const me = { name: admin.name, email: admin.email, role: admin.role };
      if (admin.role !== 'owner') return { you: me };
      const { results } = await env.DB.prepare('SELECT name, email, role, created_at, last_used_at, revoked_at FROM admin_keys ORDER BY created_at').all();
      return { you: me, admins: results.map((r) => ({ name: r.name, email: r.email, role: r.role, created: r.created_at, lastUsed: r.last_used_at, revoked: r.revoked_at })) };
    },
  },
  {
    name: 'add_admin',
    title: 'Add an admin',
    description: 'Makes a new admin key for someone. The key is shown only once: send it to them privately. Owner only.',
    inputSchema: obj({ name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', enum: ['organizer', 'owner'], description: 'Default organizer.' } }, ['name', 'email']),
    owner: true,
    async run(env, admin, args) {
      const name = str(args.name, 'name', 80);
      const e = email(args.email);
      const role = args.role === 'owner' ? 'owner' : 'organizer';
      const key = newKey();
      await env.DB.prepare('INSERT INTO admin_keys (id, name, email, key_hash, role) VALUES (?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), name, e, await hashKey(key), role).run();
      return { ok: true, name, email: e, role, key, note: 'This key is shown once. They add it as the header Authorization: Bearer <key>. See docs/admin.md.' };
    },
  },
  {
    name: 'remove_admin',
    title: 'Remove an admin',
    description: 'Turns off every admin key for an email, right away. Owner only. You can’t remove your own key.',
    inputSchema: obj({ email: { type: 'string' } }, ['email']),
    owner: true,
    destructive: true,
    async run(env, admin, args) {
      const e = email(args.email);
      if (e === admin.email.toLowerCase()) fail('You can’t remove your own key. Ask another owner.');
      const res = await env.DB.prepare('UPDATE admin_keys SET revoked_at = ? WHERE lower(email) = ? AND revoked_at IS NULL').bind(now(), e).run();
      if (!res.meta.changes) fail(`No active admin key for ${e}.`);
      return { ok: true, email: e, keysTurnedOff: res.meta.changes };
    },
  },
  {
    name: 'list_sessions',
    title: 'List sessions',
    description: 'Every session, including hidden and cancelled ones, with its date, status and how many people RSVPed, want it or offered to guide.',
    inputSchema: obj({ status: { type: 'string', enum: ['proposed', 'scheduled', 'cancelled'] } }),
    readOnly: true,
    async run(env, admin, args, deps) {
      const { results } = await env.DB.prepare('SELECT * FROM sessions ORDER BY (starts_at IS NULL), starts_at, title').all();
      const counts = await tapCounts(env);
      return {
        sessions: results
          .map((r) => ({ ...fromRow(r), visible: !!r.visible }))
          .filter((s) => !args.status || s.status === args.status)
          .map((s) => ({
            slug: s.slug, title: s.title, status: s.status, visible: s.visible, startsAt: s.startsAt || null, level: s.level,
            guides: s.guides, tags: s.tags, taps: counts[s.slug] || { rsvp: 0, want: 0, guide: 0 }, example: !!s.example,
          })),
      };
    },
  },
  {
    name: 'get_session',
    title: 'Get one session',
    description: 'One session with every field, its tap counts and its page link.',
    inputSchema: obj({ slug: { type: 'string' } }, ['slug']),
    readOnly: true,
    async run(env, admin, args, deps) {
      const s = await mustSession(env, deps, slug(args.slug));
      const counts = (await tapCounts(env, s.slug))[s.slug] || { rsvp: 0, want: 0, guide: 0 };
      return { session: s, taps: counts, page: `/sessions/${s.slug}` };
    },
  },
  {
    name: 'add_session',
    title: 'Add a session',
    description: 'Adds a new session. The slug is made from the title and never changes after this. It shows on the site right away.',
    inputSchema: obj({ ...SESSION_FIELDS, slug: { type: 'string', description: 'Optional. Made from the title if left out.' } }, ['title', 'description', 'level', 'topics']),
    async run(env, admin, args, deps) {
      const title = str(args.title, 'title', 120);
      let s = args.slug ? slug(args.slug) : slugify(title);
      if (!s) fail('Give a title with some letters or numbers in it.');
      if (args.slug && (await sessionRow(env, s))) fail(`The slug "${s}" is taken.`);
      for (let n = 2, base = s; await sessionRow(env, s); n++) s = `${base}-${n}`;
      const res = await saveSession(env, { status: 'proposed', ...pick(args), title, slug: s, example: false });
      if (!res.ok) fail(res.errors.join(' '));
      return { ok: true, slug: s, page: `/sessions/${s}`, session: res.session };
    },
  },
  {
    name: 'edit_session',
    title: 'Edit a session',
    description: 'Changes a session’s title, description, status, date, length, place, level, topics or guide names. Leave out what stays the same. Set status to cancelled to cancel it. The slug can’t change.',
    inputSchema: obj({ slug: { type: 'string' }, ...SESSION_FIELDS }, ['slug']),
    async run(env, admin, args, deps) {
      const s = await mustSession(env, deps, slug(args.slug));
      const changes = pick(args);
      if (!Object.keys(changes).length) fail('Nothing to change. Give at least one field.');
      const res = await saveSession(env, { ...changes, slug: s.slug });
      if (!res.ok) fail(res.errors.join(' '));
      return { ok: true, slug: s.slug, changed: Object.keys(changes), session: res.session };
    },
  },
  {
    name: 'hide_session',
    title: 'Hide a session',
    description: 'Takes a session off the site without losing anyone’s RSVPs or wants. show_session puts it back.',
    inputSchema: obj({ slug: { type: 'string' } }, ['slug']),
    async run(env, admin, args, deps) {
      return setVisible(env, deps, args, false);
    },
  },
  {
    name: 'show_session',
    title: 'Show a hidden session',
    description: 'Puts a hidden session back on the site.',
    inputSchema: obj({ slug: { type: 'string' } }, ['slug']),
    async run(env, admin, args, deps) {
      return setVisible(env, deps, args, true);
    },
  },
  {
    name: 'list_people',
    title: 'List people in a session',
    description: 'Who RSVPed, wants it, or offered to guide one session, with names and emails. Emails are private: don’t paste them anywhere public.',
    inputSchema: obj({ slug: { type: 'string' }, kind: { type: 'string', enum: KINDS } }, ['slug']),
    readOnly: true,
    async run(env, admin, args, deps) {
      const s = await mustSession(env, deps, slug(args.slug));
      const list = await people(env, s.slug, args.kind ? kind(args.kind) : null);
      return { slug: s.slug, title: s.title, count: list.length, people: list };
    },
  },
  {
    name: 'add_person',
    title: 'Add a person to a session',
    description: 'Adds someone by email as an RSVP (scheduled sessions), a want (ideas), or a guide (approved). Makes an account for a new email but sends no email. Guide names on the page are changed with edit_session.',
    inputSchema: obj({ slug: { type: 'string' }, email: { type: 'string' }, kind: { type: 'string', enum: KINDS }, name: { type: 'string', description: 'Optional, for a new person.' }, guideAs: { type: 'string', description: 'Optional group they guide for.' } }, ['slug', 'email', 'kind']),
    async run(env, admin, args, deps) {
      const s = await mustSession(env, deps, slug(args.slug));
      const k = kind(args.kind);
      if (NEEDS[k] && s.status !== NEEDS[k]) fail(k === 'rsvp' ? 'This one isn’t scheduled yet, so add them as a want instead.' : 'This one is already scheduled, so add them as an RSVP instead.');
      const e = email(args.email);
      let user = await findUser(env, e);
      const isNew = !user;
      if (!user) user = { id: await deps.createUser(env, e, typeof args.name === 'string' ? args.name.trim().slice(0, 80) : '') };
      const guideAs = k === 'guide' && typeof args.guideAs === 'string' ? args.guideAs.trim().slice(0, 80) || null : null;
      const res = await env.DB.prepare(
        'INSERT INTO attendance (session_id, user_id, kind, guide_as, guide_status) VALUES (?, ?, ?, ?, ?) ON CONFLICT (session_id, user_id, kind) DO UPDATE SET guide_status = excluded.guide_status, guide_as = COALESCE(excluded.guide_as, attendance.guide_as)'
      ).bind(s.slug, user.id, k, guideAs, k === 'guide' ? 'approved' : null).run();
      return { ok: true, slug: s.slug, email: e, kind: k, newPerson: isNew, added: res.meta.changes > 0 };
    },
  },
  {
    name: 'remove_person',
    title: 'Remove a person from a session',
    description: 'Takes someone off a session as an RSVP, a want, or a guide. Sends no email.',
    inputSchema: obj({ slug: { type: 'string' }, email: { type: 'string' }, kind: { type: 'string', enum: KINDS } }, ['slug', 'email', 'kind']),
    destructive: true,
    async run(env, admin, args, deps) {
      const s = await mustSession(env, deps, slug(args.slug));
      const k = kind(args.kind);
      const e = email(args.email);
      const user = await findUser(env, e);
      const res = user
        ? await env.DB.prepare('DELETE FROM attendance WHERE session_id = ? AND user_id = ? AND kind = ?').bind(s.slug, user.id, k).run()
        : { meta: { changes: 0 } };
      if (!res.meta.changes) fail(`${e} isn’t on ${s.slug} as ${k}.`);
      return { ok: true, slug: s.slug, email: e, kind: k };
    },
  },
  {
    name: 'export_people',
    title: 'Export people as CSV',
    description: 'A CSV of everyone in one session (name, email, kind, guide group, when added), for a door list or sign-in sheet.',
    inputSchema: obj({ slug: { type: 'string' }, kind: { type: 'string', enum: KINDS } }, ['slug']),
    readOnly: true,
    async run(env, admin, args, deps) {
      const s = await mustSession(env, deps, slug(args.slug));
      const list = await people(env, s.slug, args.kind ? kind(args.kind) : null);
      const rows = [['name', 'email', 'kind', 'guide_as', 'added'], ...list.map((p) => [p.name, p.email, p.kind, p.guideAs, p.added])];
      return { slug: s.slug, count: list.length, csv: rows.map((r) => r.map(csvCell).join(',')).join('\n') };
    },
  },
];

function pick(args) {
  const out = {};
  for (const k of Object.keys(SESSION_FIELDS)) if (k in args) out[k] = args[k];
  return out;
}

async function setVisible(env, deps, args, visible) {
  const s = await mustSession(env, deps, slug(args.slug));
  if (s.visible === visible) return { ok: true, slug: s.slug, visible, note: visible ? 'It was already showing.' : 'It was already hidden.' };
  const res = await saveSession(env, { slug: s.slug, visible });
  if (!res.ok) fail(res.errors.join(' '));
  return { ok: true, slug: s.slug, visible };
}

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
const allowed = (tool, admin) => !tool.owner || admin.role === 'owner';
const describe = (t) => ({
  name: t.name,
  title: t.title,
  description: t.description,
  inputSchema: t.inputSchema,
  annotations: { title: t.title, readOnlyHint: !!t.readOnly, destructiveHint: !!t.destructive, openWorldHint: false },
});

// The tools this admin may use, described the MCP way (name, title, description, inputSchema, annotations).
export const toolsFor = (admin) => TOOLS.filter((t) => allowed(t, admin)).map(describe);

// Runs one tool as this admin. Also used by Beignet in Slack (src/slack-bot.js), so both log the same way.
// Returns { ok: true, out } or { ok: false, error } with a message that is safe to show.
export async function runTool(env, admin, name, args, deps) {
  const tool = BY_NAME.get(name);
  if (!tool || !allowed(tool, admin)) return { ok: false, error: `Unknown tool: ${name}` };
  try {
    const out = await tool.run(env, admin, args && typeof args === 'object' && !Array.isArray(args) ? args : {}, deps);
    console.log(JSON.stringify({ mcp: tool.name, admin: admin.email, ...(admin.via ? { via: admin.via } : {}), ok: true }));
    return { ok: true, out };
  } catch (e) {
    if (!(e instanceof ToolError)) console.error(e);
    return { ok: false, error: e instanceof ToolError ? e.message : 'Something went wrong on our end.' };
  }
}

// --- HTTP + JSON-RPC ------------------------------------------------------------------------------------------

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const reply = (body, status = 200, headers = {}) =>
  new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { ...(body == null ? {} : { 'Content-Type': 'application/json' }), 'Cache-Control': 'no-store', ...headers },
  });

async function adminFor(request, env) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(aj_[A-Za-z0-9_-]{20,})\s*$/);
  if (!m) return null;
  const row = await env.DB.prepare('SELECT id, name, email, role FROM admin_keys WHERE key_hash = ? AND revoked_at IS NULL').bind(await hashKey(m[1])).first();
  if (!row) return null;
  await env.DB.prepare('UPDATE admin_keys SET last_used_at = ? WHERE id = ?').bind(now(), row.id).run();
  return row;
}

async function call(msg, env, admin, deps) {
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion;
      return rpcResult(id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: toolsFor(admin) });
    case 'tools/call': {
      if (!BY_NAME.has(params.name) || !allowed(BY_NAME.get(params.name), admin)) return rpcError(id, -32602, `Unknown tool: ${params.name}`);
      const r = await runTool(env, admin, params.name, params.arguments, deps);
      return rpcResult(id, r.ok
        ? { content: [{ type: 'text', text: JSON.stringify(r.out, null, 2) }], structuredContent: r.out, isError: false }
        : { content: [{ type: 'text', text: r.error }], isError: true });
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// deps: { createUser(env, email, name) -> the new user's id }
export async function handleMcp(request, env, deps) {
  const url = new URL(request.url);
  // Browsers send an Origin; MCP clients don't. Refusing other sites' pages guards against DNS rebinding.
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return reply(rpcError(null, -32600, 'Wrong origin'), 403);
  if (request.method !== 'POST') return reply(rpcError(null, -32600, 'Send JSON-RPC with POST.'), 405, { Allow: 'POST' });
  if (!env.DB) return reply(rpcError(null, -32603, 'The database isn’t set up.'), 503);

  const admin = await adminFor(request, env);
  if (!admin) return reply(rpcError(null, -32001, 'Add your admin key as the header Authorization: Bearer aj_…'), 401, { 'WWW-Authenticate': 'Bearer realm="aijan-admin"' });

  let body;
  try {
    body = await request.json();
  } catch {
    return reply(rpcError(null, -32700, 'That isn’t JSON.'), 400);
  }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]).filter((m) => m && typeof m === 'object');
  const out = [];
  for (const m of msgs) {
    if (m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
      if ('id' in m && !('result' in m) && !('error' in m)) out.push(rpcError(m.id, -32600, 'Not a JSON-RPC 2.0 request.'));
      continue;
    }
    if (!('id' in m)) continue; // a notification, like notifications/initialized
    out.push(await call(m, env, admin, deps));
  }
  if (!out.length) return reply(null, 202);
  return reply(batch ? out : out[0]);
}
