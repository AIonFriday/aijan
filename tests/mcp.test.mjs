// ABOUTME: Tests for the admin MCP (src/mcp.js): keys, roles, and the session and people tools.
// ABOUTME: tests/d1.mjs (Node SQLite with every migration) stands in for D1; sessions are saved with src/sessions.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeD1 } from './d1.mjs';
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
