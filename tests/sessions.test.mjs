// ABOUTME: Tests for sessions in D1: the real lineup the migrations leave, the pages the Worker draws from it (session pages,
// ABOUTME: share images, /assets/sessions.js, sitemap, llms.txt), and taps. Run `npm run build` first (it serves dist/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fakeD1, root } from './d1.mjs';
import { listSessions, getSession, validate, fromRow } from '../src/sessions.js';
import { site } from '../src/site.js';
import { toggle, mine } from '../src/api.js';
import { renderSession } from '../scripts/og-files.mjs';

const read = (p) => readFileSync(join(root, p), 'utf8');
const templates = {
  session: read('site/templates/session.html'),
  head: read('site/partials/head.html'),
  header: read('site/partials/header.html'),
  footer: read('site/partials/footer.html'),
  sheet: read('site/partials/sheet.html'),
};
const TYPES = { '.html': 'text/html', '.xml': 'application/xml', '.txt': 'text/plain' };
// Serves dist/ the way the ASSETS binding does: /x is x.html.
const ASSETS = {
  fetch: async (req) => {
    const p = new URL(req.url).pathname;
    for (const f of [p, p + '.html']) {
      const file = join(root, 'dist', f);
      if (existsSync(file) && extname(file)) return new Response(readFileSync(file), { headers: { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' } });
    }
    return new Response('not found', { status: 404 });
  },
};
const setup = () => ({ DB: fakeD1(), ASSETS });
const get = (env, path) => site(new Request(`https://joinaijanuary.com${path}`), env, null, { templates, renderSession });

// The same search basics scripts/check-html.mjs checks on the built pages.
function searchBasics(html) {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'one <h1>');
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.doesNotMatch(html, /\{\{\w+\}\}/, 'no unfilled template values');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(([, j]) => JSON.parse(j));
  return blocks;
}

test('the migrations leave the real lineup, with no example sessions', async () => {
  const env = setup();
  const all = await listSessions(env);
  assert.ok(all.every((s) => !s.example && s.count === 0 && validate(s).length === 0));
  const sched = all.filter((s) => s.status === 'scheduled').map((s) => s.slug);
  assert.deepEqual(sched, ['ai-friday-kickoff', 'build-a-game-with-ai', 'office-hours-jan-19', 'office-hours-jan-21', 'office-hours-jan-26', 'office-hours-jan-28']);
  const kickoff = await getSession(env, 'ai-friday-kickoff');
  assert.equal(kickoff.startsAt, '2027-01-08T09:00:00-06:00');
  const oh = await getSession(env, 'office-hours-jan-21');
  assert.equal(oh.officeHours, true);
  assert.equal(oh.lengthMin, 120);
  // Ideas after the calendar: a few general topics, then the "AI for…" groups.
  const ideas = all.filter((s) => s.status === 'proposed');
  assert.ok(ideas.length <= 12, 'keep the vote list short');
  assert.ok(ideas.some((s) => s.tags.includes('ai-for')) && ideas.some((s) => !s.tags.includes('ai-for')));
  assert.ok(ideas.filter((s) => s.tags.includes('ai-for')).every((s) => /^AI for /.test(s.title)));
  assert.equal(all.findIndex((s) => s.status === 'proposed'), sched.length);
});

test('hidden and cancelled sessions are left out', async () => {
  const env = setup();
  env.DB.raw.exec("UPDATE sessions SET visible = 0 WHERE slug = 'ai-friday-kickoff'; UPDATE sessions SET status = 'cancelled' WHERE slug = 'office-hours-jan-19'");
  const slugs = (await listSessions(env)).map((s) => s.slug);
  assert.ok(!slugs.includes('ai-friday-kickoff') && !slugs.includes('office-hours-jan-19'));
  assert.equal((await get(env, '/sessions/ai-friday-kickoff')).status, 404);
});

test('/assets/sessions.js hands the browser the sessions from D1', async () => {
  const env = setup();
  env.DB.raw.exec("UPDATE sessions SET title = 'Changed in the database' WHERE slug = 'ai-friday-kickoff'");
  const res = await get(env, '/assets/sessions.js');
  assert.match(res.headers.get('Content-Type'), /javascript/);
  const window = {};
  new Function('window', await res.text())(window);
  assert.equal(window.AJ_DATA.timeZone, 'America/Chicago');
  assert.equal(window.AJ_DATA.levels.new, 'New to AI');
  assert.equal(window.AJ_DATA.sessions[0].title, 'Changed in the database');
});

const addExample = (env) => env.DB.raw.exec(`INSERT INTO sessions (id, slug, title, description, status, starts_at, level, topics, example)
  VALUES ('made-up-demo', 'made-up-demo', 'A made-up demo', 'Not real.', 'scheduled', '2027-01-13T11:30:00-06:00', 'all', '["curious"]', 1)`);

test('an example session page is drawn from D1 and kept out of search', async () => {
  const env = setup();
  addExample(env);
  const res = await get(env, '/sessions/made-up-demo');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.deepEqual(searchBasics(html), []);
  assert.match(html, /<h1>A made-up demo<\/h1>/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /og\/sessions\/made-up-demo\.png\?v=\w+/);
  const sitemap = await (await get(env, '/sitemap.xml')).text();
  assert.doesNotMatch(sitemap, /made-up-demo/);
  assert.doesNotMatch(await (await get(env, '/llms.txt')).text(), /made-up-demo/);
});

test('a real scheduled session gets Event data, the sitemap and llms.txt', async () => {
  const env = setup();
  const html = await (await get(env, '/sessions/office-hours-jan-21')).text();
  assert.doesNotMatch(html, /noindex/);
  const [ld] = searchBasics(html);
  const event = ld['@graph'][0];
  assert.equal(event['@type'], 'Event');
  assert.equal(event.startDate, '2027-01-21T15:00:00-06:00');
  assert.equal(event.endDate, '2027-01-21T17:00:00-06:00', 'office hours run two hours');

  const sitemap = await (await get(env, '/sitemap.xml')).text();
  assert.match(sitemap, /<loc>https:\/\/joinaijanuary\.com\/sessions\/ai-friday-kickoff<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/joinaijanuary\.com\/where<\/loc>/);
  assert.doesNotMatch(sitemap, /<!--/);
  const llms = await (await get(env, '/llms.txt')).text();
  assert.match(llms, /## Scheduled sessions\n\n- \[AI Friday: the kickoff/);
  assert.doesNotMatch(llms, /<!--/);
});

test('with only example sessions, the sitemap and llms.txt list none', async () => {
  const env = setup();
  env.DB.raw.exec('DELETE FROM sessions');
  addExample(env);
  const sitemap = await (await get(env, '/sitemap.xml')).text();
  assert.doesNotMatch(sitemap, /\/sessions\/|<!--/);
  assert.match(sitemap, /<loc>https:\/\/joinaijanuary\.com\/where<\/loc>/);
  const llms = await (await get(env, '/llms.txt')).text();
  assert.doesNotMatch(llms, /Scheduled sessions|<!--/);
  assert.match(llms, /Why AI January.*\n\n## Optional/);
});

test('unknown sessions get the 404 page; old .html and trailing-slash links redirect', async () => {
  const env = setup();
  const res = await get(env, '/sessions/no-such-thing');
  assert.equal(res.status, 404);
  assert.match(await res.text(), /<h1/);
  const r = await get(env, '/sessions/ai-friday-kickoff/');
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('Location'), 'https://joinaijanuary.com/sessions/ai-friday-kickoff');
  assert.equal(await get(env, '/where'), null, 'other pages are left to the built site');
});

test('a session share image is a PNG, versioned by what it shows', async () => {
  const env = setup();
  const page = await (await get(env, '/sessions/first-hour-with-ai')).text();
  const src = page.match(/property="og:image" content="https:\/\/joinaijanuary\.com([^"]+)"/)[1];
  const res = await get(env, src);
  assert.equal(res.headers.get('Content-Type'), 'image/png');
  assert.match(res.headers.get('Cache-Control'), /immutable/);
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(1, 4)].map((c) => String.fromCharCode(c)).join(''), 'PNG');
  env.DB.raw.exec("UPDATE sessions SET title = 'A new title' WHERE slug = 'first-hour-with-ai'");
  const after = await (await get(env, '/sessions/first-hour-with-ai')).text();
  assert.notEqual(after.match(/og\/sessions\/[^"]+/)[0], src.slice(1), 'a new title gets a new image link');
});

test('taps check the session in D1', async () => {
  const env = setup();
  env.DB.raw.exec(`INSERT INTO "user" (id, name, email, createdAt, updatedAt) VALUES ('u1', 'Dana', 'dana@example.com', '2026-11-05', '2026-11-05')`);
  const user = { id: 'u1' };
  const want = await (await toggle(env, user, 'first-hour-with-ai', 'want', {})).json();
  assert.equal(want.count, 1, 'counts start at 0');
  assert.equal((await toggle(env, user, 'first-hour-with-ai', 'rsvp', {})).status, 409);
  assert.equal((await toggle(env, user, 'no-such-thing', 'want', {})).status, 404);
  assert.deepEqual((await mine(env, 'u1')).want, ['first-hour-with-ai']);
  env.DB.raw.exec("UPDATE sessions SET visible = 0 WHERE slug = 'first-hour-with-ai'");
  assert.deepEqual((await mine(env, 'u1')).want, [], 'hidden sessions drop out of My sessions');
});

test('validate catches what the build used to', () => {
  const ok = fromRow({ slug: 'a-b', title: 'T', description: 'D', status: 'scheduled', starts_at: '2027-01-12T08:00:00-06:00', level: 'new', topics: '["work"]' });
  assert.deepEqual(validate(ok), []);
  const bad = validate({ slug: 'A B', title: 'T', description: 'D', status: 'scheduled', startsAt: '2027-01-12T08:00:00', level: 'pro', topics: ['cats'] });
  assert.equal(bad.length, 4);
});

test('saveSession adds and updates sessions, and refuses bad ones', async () => {
  const { saveSession } = await import('../src/sessions.js');
  const env = setup();
  const made = await saveSession(env, { slug: 'ai-for-musicians', title: 'AI for musicians', description: 'Set lists and grant forms.', status: 'proposed', level: 'all', topics: ['make'] });
  assert.equal(made.ok, true);
  assert.equal(made.created, true);
  assert.equal(made.session.example, false);
  assert.equal((await get(env, '/sessions/ai-for-musicians')).status, 200);

  const moved = await saveSession(env, { slug: 'ai-for-musicians', status: 'scheduled', startsAt: '2027-01-20T18:00:00-06:00', guides: ['Kermit'] });
  assert.equal(moved.ok && moved.created, false);
  assert.equal(moved.session.title, 'AI for musicians', 'fields left out keep their value');
  assert.deepEqual(moved.session.guides, ['Kermit']);

  const bad = await saveSession(env, { slug: 'ai-for-musicians', status: 'scheduled', startsAt: '' });
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join(), /need startsAt/);
  assert.equal((await saveSession(env, { slug: 'Bad Slug', title: 'x', description: 'x', status: 'proposed', level: 'all', topics: ['make'] })).ok, false);
});

test('every session has a type, shown on its page', async () => {
  const env = setup();
  const by = Object.fromEntries((await listSessions(env)).map((s) => [s.slug, s.kind]));
  assert.equal(by['ai-friday-kickoff'], 'talk');
  assert.equal(by['build-a-game-with-ai'], 'hands-on');
  assert.equal(by['office-hours-jan-21'], 'office-hours');
  assert.equal(by['ai-for-teachers'], 'group');
  assert.equal(by['first-hour-with-ai'], 'hands-on');
  const html = await (await get(env, '/sessions/office-hours-jan-21')).text();
  assert.match(html, /<span class="kind k-office-hours">Office hours<\/span> Drop in/);
  assert.match(validate({ ...(await getSession(env, 'ai-for-teachers')), kind: 'party' }).join(), /unknown kind/);
});

test('saving a type keeps the office hours flag in step', async () => {
  const { saveSession } = await import('../src/sessions.js');
  const env = setup();
  const r = await saveSession(env, { slug: 'first-hour-with-ai', kind: 'office-hours' });
  assert.equal(r.session.kind, 'office-hours');
  assert.equal(r.session.officeHours, true);
});
