// ABOUTME: Tests for the admin MCP (src/mcp.js): keys, roles, and the session, people and faculty tools.
// ABOUTME: tests/d1.mjs (Node SQLite with every migration) stands in for D1; sessions are saved with src/sessions.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fakeD1, root } from './d1.mjs';
import { site } from '../src/site.js';
import { handleMcp, hashKey, newKey, slugify } from '../src/mcp.js';

async function setup() {
  const DB = fakeD1();
  const db = DB.raw;
  const env = { DB };
  const key = async (name, email, role) => {
    const k = newKey();
    db.prepare('INSERT INTO admin_keys (id, name, email, key_hash, role) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), name, email, await hashKey(k), role);
    return k;
  };
  const owner = await key('Andrew', 'andrew@example.com', 'owner');
  const organizer = await key('Dana', 'dana@example.com', 'organizer');
  let users = 0;
  const deps = {
    createUser: async (e, email, name) => {
      const id = `u${++users}`;
      db.prepare('INSERT INTO "user" (id, name, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)').run(id, name, email, 'now', 'now');
      return id;
    },
  };
  const post = (k, body, headers = {}) =>
    handleMcp(new Request('https://joinaijanuary.com/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(k ? { Authorization: `Bearer ${k}` } : {}), ...headers },
      body: JSON.stringify(body),
    }), env, deps);
  let n = 0;
  const tool = async (k, name, args = {}) => {
    const res = await post(k, { jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } });
    const { result } = await res.json();
    return result.isError ? { error: result.content[0].text } : result.structuredContent;
  };
  return { db, env, owner, organizer, post, tool };
}

test('no key, a wrong key, or a revoked key gets a 401', async () => {
  const { post, tool, owner } = await setup();
  const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };
  assert.equal((await post(null, ping)).status, 401);
  assert.equal((await post(newKey(), ping)).status, 401);
  const { key } = await tool(owner, 'add_admin', { name: 'Sam', email: 'sam@example.com' });
  assert.equal((await post(key, ping)).status, 200);
  await tool(owner, 'remove_admin', { email: 'sam@example.com' });
  assert.equal((await post(key, ping)).status, 401);
});

test('initialize answers with tools, and notifications get a 202', async () => {
  const { post, owner } = await setup();
  const res = await post(owner, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  const { result } = await res.json();
  assert.equal(result.protocolVersion, '2025-06-18');
  assert.ok(result.capabilities.tools);
  assert.equal((await post(owner, { jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
});

test('another site’s page can’t call it, and GET is refused', async () => {
  const { post, owner, env } = await setup();
  assert.equal((await post(owner, { jsonrpc: '2.0', id: 1, method: 'ping' }, { Origin: 'https://evil.example' })).status, 403);
  const res = await handleMcp(new Request('https://joinaijanuary.com/mcp'), env, {});
  assert.equal(res.status, 405);
});

test('organizers don’t see or run the owner tools', async () => {
  const { post, tool, organizer } = await setup();
  const { result } = await (await post(organizer, { jsonrpc: '2.0', id: 1, method: 'tools/list' })).json();
  const names = result.tools.map((t) => t.name);
  assert.ok(names.includes('add_session'));
  assert.ok(!names.includes('add_admin'));
  const res = await post(organizer, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'add_admin', arguments: { name: 'X', email: 'x@example.com' } } });
  assert.ok((await res.json()).error);
  assert.deepEqual(Object.keys((await tool(organizer, 'whoami'))), ['you']);
});

test('an owner can’t remove their own key', async () => {
  const { tool, owner } = await setup();
  assert.match((await tool(owner, 'remove_admin', { email: 'andrew@example.com' })).error, /own key/);
});

test('add, edit, hide and show a session', async () => {
  const { tool, organizer } = await setup();
  const made = await tool(organizer, 'add_session', { title: 'AI for your church’s bulletin', description: 'Write it faster.', level: 'new', topics: ['work'] });
  assert.equal(made.slug, 'ai-for-your-churchs-bulletin');
  assert.equal(made.session.status, 'proposed');
  const again = await tool(organizer, 'add_session', { title: 'AI for your church’s bulletin', description: 'Again.', level: 'new', topics: ['work'] });
  assert.equal(again.slug, 'ai-for-your-churchs-bulletin-2');

  assert.match((await tool(organizer, 'edit_session', { slug: made.slug, status: 'scheduled' })).error, /startsAt/);
  const edited = await tool(organizer, 'edit_session', { slug: made.slug, status: 'scheduled', startsAt: '2027-01-14T11:30:00-06:00' });
  assert.deepEqual(edited.changed, ['status', 'startsAt']);

  await tool(organizer, 'hide_session', { slug: made.slug });
  let listed = (await tool(organizer, 'list_sessions')).sessions.find((s) => s.slug === made.slug);
  assert.equal(listed.visible, false);
  await tool(organizer, 'show_session', { slug: made.slug });
  listed = (await tool(organizer, 'list_sessions', { status: 'scheduled' })).sessions;
  assert.ok(listed.some((s) => s.slug === made.slug && s.visible));
  assert.ok(listed.every((s) => s.status === 'scheduled'));
  assert.match((await tool(organizer, 'get_session', { slug: 'nope' })).error, /No session/);
});

test('add, list, export and remove people', async () => {
  const { tool, organizer } = await setup();
  const { slug } = await tool(organizer, 'add_session', { title: 'Coffee and AI', description: 'Bring a laptop.', level: 'all', topics: ['curious'], status: 'scheduled', startsAt: '2027-01-12T08:00:00-06:00' });

  assert.match((await tool(organizer, 'add_person', { slug, email: 'pat@example.com', kind: 'want' })).error, /already scheduled/);
  const added = await tool(organizer, 'add_person', { slug, email: 'Pat@Example.com', kind: 'rsvp', name: 'Pat' });
  assert.equal(added.newPerson, true);
  assert.equal((await tool(organizer, 'add_person', { slug, email: 'pat@example.com', kind: 'rsvp' })).newPerson, false);
  await tool(organizer, 'add_person', { slug, email: 'guide@example.com', kind: 'guide', name: '=cmd()', guideAs: 'Tulane AI Club' });

  const { people } = await tool(organizer, 'list_people', { slug });
  assert.equal(people.length, 2);
  assert.equal(people.find((p) => p.kind === 'guide').guideStatus, 'approved');

  const { csv } = await tool(organizer, 'export_people', { slug });
  assert.match(csv, /^name,email,kind,guide_as,added\n/);
  assert.match(csv, /'=cmd\(\)/); // no spreadsheet formulas

  await tool(organizer, 'remove_person', { slug, email: 'pat@example.com', kind: 'rsvp' });
  assert.equal((await tool(organizer, 'list_people', { slug, kind: 'rsvp' })).count, 0);
  assert.match((await tool(organizer, 'remove_person', { slug, email: 'pat@example.com', kind: 'rsvp' })).error, /isn’t on/);
});

test('slugs come out plain', () => {
  assert.equal(slugify('Café & crêpes: AI at home!'), 'cafe-crepes-ai-at-home');
});

// ---------- faculty ----------

const rd = (p) => readFileSync(join(root, p), 'utf8');
const templates = () => ({ session: rd('site/templates/session.html'), faculty: rd('site/templates/faculty.html'), head: rd('site/partials/head.html'), header: rd('site/partials/header.html'), footer: rd('site/partials/footer.html'), sheet: rd('site/partials/sheet.html') });
const sitePage = (env, path) => site(new Request(`https://x.test${path}`), { ...env, ASSETS: { fetch: async () => new Response('', { status: 404 }) } }, null, { templates: templates(), renderSession: () => new Uint8Array() });
const stripSlugs = async (env) => JSON.parse((await (await sitePage(env, '/assets/sessions.js')).text()).match(/AJ_DATA=(.*);\n$/)[1]).faculty.map((f) => f.slug);

const ELI = {
  name: 'Eli Ackerman',
  role: 'Co-host, AI Friday',
  bio: 'Helps people try AI for the first time.',
  photo: 'https://example.com/eli.jpg',
  links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/eli' }],
  projects: [{ name: 'Roux Wars', about: 'A tiny cooking game.', url: 'https://roux.example.com', image: 'https://example.com/roux.png' }],
  featured: true,
  sort: 15,
};

test('faculty: add then get round-trips every field, and the page shows right away', async () => {
  const { env, tool, organizer } = await setup();
  const added = await tool(organizer, 'add_faculty', ELI);
  assert.equal(added.slug, 'eli-ackerman');
  assert.match(added.warning, /No session lists "Eli Ackerman"/);
  const { faculty: f, page, groups, sessions } = await tool(organizer, 'get_faculty', { slug: 'eli-ackerman' });
  for (const k of Object.keys(ELI)) assert.deepEqual(f[k], ELI[k], k);
  assert.equal(f.isGroup, false);
  assert.equal(f.visible, true);
  assert.equal(page, '/faculty/eli-ackerman');
  assert.deepEqual(groups, []);
  assert.deepEqual(sessions, []);
  assert.equal((await sitePage(env, '/faculty/eli-ackerman')).status, 200);
  assert.ok((await stripSlugs(env)).includes('eli-ackerman')); // featured

  // A group named like a session guide links to the session, and needs no warning.
  const group = await tool(organizer, 'add_faculty', { name: 'AI Friday', isGroup: true, role: 'Free monthly AI meetup' });
  assert.equal(group.warning, undefined);
  assert.ok(group.sessions.some((s) => s.slug === 'ai-friday-kickoff'));
  const listed = (await tool(organizer, 'list_faculty')).faculty.find((x) => x.slug === 'ai-friday');
  assert.equal(listed.onMainPage, true);
  assert.ok(listed.leads > 0);
});

test('faculty: a taken slug or a name that differs only in case fails', async () => {
  const { tool, organizer } = await setup();
  await tool(organizer, 'add_faculty', { name: 'Whitley Rushing' });
  assert.match((await tool(organizer, 'add_faculty', { name: 'Someone Else', slug: 'whitley-rushing' })).error, /slug "whitley-rushing" is taken/);
  assert.match((await tool(organizer, 'add_faculty', { name: 'whitley rushing', slug: 'whitley-2' })).error, /already used by \/faculty\/whitley-rushing/);
  assert.match((await tool(organizer, 'add_faculty', { name: 'Bad Slug', slug: 'Bad Slug' })).error, /slug/);
});

test('faculty: edit replaces links and projects, and a rename needs confirmRename', async () => {
  const { tool, organizer } = await setup();
  await tool(organizer, 'add_faculty', ELI);
  const edited = await tool(organizer, 'edit_faculty', { slug: 'eli-ackerman', links: [{ label: 'Website', url: 'https://eli.example.com' }], projects: [] });
  assert.deepEqual(edited.changed, ['links', 'projects']);
  assert.deepEqual(edited.faculty.links, [{ label: 'Website', url: 'https://eli.example.com' }]);
  assert.deepEqual(edited.faculty.projects, []);
  assert.equal(edited.faculty.role, ELI.role); // left alone
  assert.ok(edited.faculty.updatedAt >= edited.faculty.createdAt);
  assert.match((await tool(organizer, 'edit_faculty', { slug: 'eli-ackerman' })).error, /Nothing to change/);

  // A name that only changes case isn't a rename.
  assert.equal((await tool(organizer, 'edit_faculty', { slug: 'eli-ackerman', name: 'ELI ACKERMAN' })).ok, true);

  await tool(organizer, 'add_faculty', { name: 'AI Friday', isGroup: true });
  assert.match((await tool(organizer, 'edit_faculty', { slug: 'ai-friday', name: 'AI Fridays' })).error, /ai-friday-kickoff[\s\S]*confirmRename: true/);
  const renamed = await tool(organizer, 'edit_faculty', { slug: 'ai-friday', name: 'AI Fridays', confirmRename: true });
  assert.equal(renamed.slug, 'ai-friday');
  assert.ok(renamed.sessionsNoLongerLinked.some((s) => s.slug === 'ai-friday-kickoff'));
  assert.match(renamed.note, /edit_session/);
});

test('faculty: set_group_members replaces the list in order and checks the slugs', async () => {
  const { env, tool, organizer } = await setup();
  await tool(organizer, 'add_faculty', { name: 'Hello Gravel', isGroup: true });
  for (const name of ['Daniel Crowley', 'Whitley Rushing', 'Andrew Dunn']) await tool(organizer, 'add_faculty', { name });

  const set = await tool(organizer, 'set_group_members', { group: 'hello-gravel', members: [{ slug: 'daniel-crowley', title: 'CEO' }, { slug: 'whitley-rushing' }] });
  assert.deepEqual(set.members, [{ slug: 'daniel-crowley', title: 'CEO' }, { slug: 'whitley-rushing', title: '' }]);
  await tool(organizer, 'set_group_members', { group: 'hello-gravel', members: [{ slug: 'andrew-dunn', title: 'Builder' }, { slug: 'daniel-crowley', title: 'CEO' }] });
  const { people } = await tool(organizer, 'get_faculty', { slug: 'hello-gravel' });
  assert.deepEqual(people.map((p) => [p.slug, p.title]), [['andrew-dunn', 'Builder'], ['daniel-crowley', 'CEO']]);
  assert.deepEqual((await tool(organizer, 'get_faculty', { slug: 'andrew-dunn' })).groups.map((g) => g.slug), ['hello-gravel']);
  assert.deepEqual((await tool(organizer, 'get_faculty', { slug: 'whitley-rushing' })).groups, []);
  assert.match(await (await sitePage(env, '/faculty/hello-gravel')).text(), /href="\/faculty\/andrew-dunn"/);

  assert.match((await tool(organizer, 'set_group_members', { group: 'andrew-dunn', members: [] })).error, /is a person, not a group/);
  assert.match((await tool(organizer, 'set_group_members', { group: 'hello-gravel', members: [{ slug: 'nobody-here' }] })).error, /No faculty member with the slug "nobody-here"/);
  assert.match((await tool(organizer, 'set_group_members', { group: 'hello-gravel', members: [{ slug: 'andrew-dunn' }, { slug: 'andrew-dunn' }] })).error, /twice/);
  // A failed call changes nothing.
  assert.equal((await tool(organizer, 'get_faculty', { slug: 'hello-gravel' })).people.length, 2);

  assert.deepEqual((await tool(organizer, 'set_group_members', { group: 'hello-gravel', members: [] })).members, []);
  assert.deepEqual((await tool(organizer, 'get_faculty', { slug: 'hello-gravel' })).people, []);
});

test('faculty: hide takes them off the strip and 404s their page; show brings them back', async () => {
  const { env, tool, organizer } = await setup();
  await tool(organizer, 'add_faculty', ELI);
  assert.ok((await stripSlugs(env)).includes('eli-ackerman'));
  await tool(organizer, 'hide_faculty', { slug: 'eli-ackerman' });
  assert.ok(!(await stripSlugs(env)).includes('eli-ackerman'));
  assert.equal((await sitePage(env, '/faculty/eli-ackerman')).status, 404);
  const row = (await tool(organizer, 'list_faculty')).faculty.find((f) => f.slug === 'eli-ackerman');
  assert.equal(row.visible, false);
  assert.equal(row.onMainPage, false);
  assert.match((await tool(organizer, 'hide_faculty', { slug: 'eli-ackerman' })).note, /already hidden/);
  await tool(organizer, 'show_faculty', { slug: 'eli-ackerman' });
  assert.ok((await stripSlugs(env)).includes('eli-ackerman'));
  assert.equal((await sitePage(env, '/faculty/eli-ackerman')).status, 200);
});

test('faculty: validation turns away http photos, long fields and bad shapes', async () => {
  const { tool, organizer } = await setup();
  const bad = async (args, re) => assert.match((await tool(organizer, 'add_faculty', { name: 'Pat Doe', ...args })).error, re);
  await bad({ photo: 'http://example.com/pat.jpg' }, /photo must be an https/);
  await bad({ photo: 'javascript:alert(1)' }, /photo/);
  await bad({ name: 'x'.repeat(81) }, /name must be 80/);
  await bad({ role: 'x'.repeat(121) }, /role must be 120/);
  await bad({ bio: 'x'.repeat(1201) }, /bio must be 1200/);
  await bad({ links: 'https://example.com' }, /links must be a list/);
  await bad({ links: [{ url: 'https://example.com' }] }, /link 1 needs a label/);
  await bad({ links: [{ label: 'Site', url: 'http://example.com' }] }, /link for Site must start with https/);
  await bad({ links: Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, url: 'https://example.com' })) }, /at most 8 links/);
  await bad({ projects: [{ name: 'Thing' }] }, /project 1 needs a name and an about/);
  await bad({ projects: [{ name: 'Thing', about: 'x'.repeat(201) }] }, /about line for Thing/);
  await bad({ projects: [{ name: 'Thing', about: 'ok', image: 'ftp://x.example.com/a.png' }] }, /image for Thing/);
  await bad({ projects: Array.from({ length: 16 }, (_, i) => ({ name: `P${i}`, about: 'ok' })) }, /at most 15 projects/);
  await bad({ featured: 'yes' }, /featured must be true or false/);
  await bad({ sort: 1.5 }, /sort must be a whole number/);
  assert.equal((await tool(organizer, 'list_faculty')).faculty.length, 0);
  // A committed /assets/ file is fine, and null shows initials.
  assert.equal((await tool(organizer, 'add_faculty', { name: 'Pat Doe', photo: '/assets/ai-friday-crawd.png', projects: [{ name: 'Thing', about: 'ok', image: '/assets/x.png' }] })).ok, true);
  assert.equal((await tool(organizer, 'edit_faculty', { slug: 'pat-doe', photo: null })).faculty.photo, undefined);
});

test('faculty: organizer keys see and run every faculty tool', async () => {
  const { post, organizer } = await setup();
  const { result } = await (await post(organizer, { jsonrpc: '2.0', id: 1, method: 'tools/list' })).json();
  const names = result.tools.map((t) => t.name);
  for (const n of ['list_faculty', 'get_faculty', 'add_faculty', 'edit_faculty', 'hide_faculty', 'show_faculty', 'set_group_members']) assert.ok(names.includes(n), n);
  assert.ok(!names.includes('delete_faculty'));
  const ro = result.tools.filter((t) => t.annotations.readOnlyHint).map((t) => t.name);
  assert.ok(ro.includes('list_faculty') && ro.includes('get_faculty') && !ro.includes('add_faculty'));
});
