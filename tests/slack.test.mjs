// ABOUTME: Tests for the Slack messages the team gets when someone uses a form or taps a button on the site.
// ABOUTME: Runs on Node's built-in test runner; only the call to Slack's web API is faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tapMessage, postTap } from '../src/slack.js';

const origin = 'https://joinaijanuary.com';
const person = { name: 'Dana Roy', email: 'dana@example.com' };
const session = { slug: 'ai-for-email', title: 'AI for your email' };
const message = (tap, result = {}, s = null) => tapMessage({ tap, person, result, session: s, origin });

test('a suggestion shows the idea and who sent it', () => {
  const text = message({ type: 'suggest', text: 'Teach my mom to use AI' });
  assert.match(text, /Teach my mom to use AI/);
  assert.match(text, /Dana Roy/);
  assert.match(text, /dana@example\.com/);
});

test('a guide offer shows topics, details, level, times and group', () => {
  const text = message({ type: 'guideOffer', topics: ['Writing', 'Photos'], what: 'I teach at Tulane', level: 'Beginner', times: ['Evenings'], guideAs: 'Tulane AI Club' });
  for (const part of ['Writing, Photos', 'I teach at Tulane', 'Beginner', 'Evenings', 'Tulane AI Club', 'dana@example.com']) assert.ok(text.includes(part), part);
});

test('a guide offer leaves out what was left blank', () => {
  const text = message({ type: 'guideOffer', topics: ['Writing'] });
  assert.doesNotMatch(text, /Level|Times|Guiding as|undefined|null/);
});

test('a Bring a group request shows the group, size and goal', () => {
  const text = message({ type: 'krewe', groupName: 'St. Anna Choir', what: 'Learn the basics', size: '10-20' });
  for (const part of ['St. Anna Choir', 'Learn the basics', '10-20', 'dana@example.com']) assert.ok(text.includes(part), part);
});

test('an offer to guide one session links to it', () => {
  const text = message({ type: 'guide', slug: session.slug, guideAs: 'Tulane AI Club' }, { added: true }, session);
  assert.ok(text.includes(`<${origin}/sessions/ai-for-email|AI for your email>`));
  assert.ok(text.includes('Tulane AI Club'));
});

test('an RSVP is one line with the running count', () => {
  const text = message({ type: 'rsvp', slug: session.slug }, { added: true, count: 12 }, session);
  assert.ok(text.includes('AI for your email'));
  assert.match(text, /12 going/);
  assert.equal(text.split('\n').length, 1);
});

test('undoing a tap posts nothing', () => {
  assert.equal(message({ type: 'rsvp', slug: session.slug, on: false }, { count: 11 }, session), null);
});

test('tapping something already tapped posts nothing', () => {
  assert.equal(message({ type: 'rsvp', slug: session.slug }, { added: false, count: 12 }, session), null);
  assert.equal(message({ type: 'guide', slug: session.slug }, { added: false }, session), null);
});

test('"I want this" below 5 is one line with the running count', () => {
  const text = message({ type: 'want', slug: session.slug }, { added: true, count: 4 }, session);
  assert.ok(text.includes('dana@example.com'));
  assert.ok(text.includes('AI for your email'));
  assert.match(text, /4 want it/);
  assert.equal(text.split('\n').length, 1);
  assert.doesNotMatch(text, /Ready to schedule/);
});

test('"I want this" flags the tap that reaches 5', () => {
  const text = message({ type: 'want', slug: session.slug }, { added: true, count: 5 }, session);
  assert.ok(text.includes('dana@example.com'));
  assert.match(text, /5 want it/);
  assert.match(text, /Ready to schedule/);
});

test('"I want this" past 5 is a plain line again', () => {
  const text = message({ type: 'want', slug: session.slug }, { added: true, count: 6 }, session);
  assert.match(text, /6 want it/);
  assert.doesNotMatch(text, /Ready to schedule/);
});

test('text from the form cannot ping the channel or fake a link', () => {
  const text = message({ type: 'suggest', text: '<!channel> <https://evil.example|click> & more' });
  assert.ok(!text.includes('<!channel>'));
  assert.ok(!text.includes('<https://evil.example'));
  assert.ok(text.includes('&lt;!channel&gt;'));
  assert.ok(text.includes('&amp; more'));
});

test('a name cannot ping the channel either', () => {
  const text = tapMessage({ tap: { type: 'suggest', text: 'Hi' }, person: { name: '<!here>', email: 'a@example.com' }, result: {}, origin });
  assert.ok(!text.includes('<!here>'));
});

test('very long form text is cut down', () => {
  const text = message({ type: 'suggest', text: 'x'.repeat(50000) });
  assert.ok(text.length < 1500);
});

test('form fields of the wrong type are ignored', () => {
  const text = message({ type: 'guideOffer', topics: 'nope', what: { a: 1 }, times: [7], guideAs: 3 });
  assert.doesNotMatch(text, /object|undefined|nope/);
});

test('someone with only an email is shown by that email', () => {
  const text = tapMessage({ tap: { type: 'suggest', text: 'Hi' }, person: { email: 'a@example.com' }, result: {}, origin });
  assert.ok(text.includes('a@example.com'));
  assert.doesNotMatch(text, /undefined/);
});

const env = { SLACK_BOT_TOKEN: 'test-token', SLACK_CHANNEL: 'C123' };
const event = { tap: { type: 'suggest', text: 'An idea' }, person, result: {}, origin };

async function withFetch(reply, run) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(reply); };
  try { await run(); } finally { globalThis.fetch = real; }
  return calls;
}

test('posting sends the message to the channel with the token, with no link previews', async () => {
  const calls = await withFetch({ ok: true }, () => postTap(env, event));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://slack.com/api/chat.postMessage');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.channel, 'C123');
  assert.match(body.text, /An idea/);
  assert.equal(body.unfurl_links, false);
  assert.equal(body.unfurl_media, false);
});

test('nothing is sent when Slack is not set up', async () => {
  const calls = await withFetch({ ok: true }, async () => {
    await postTap({}, event);
    await postTap({ SLACK_BOT_TOKEN: 'test-token' }, event);
    await postTap({ SLACK_CHANNEL: 'C123' }, event);
  });
  assert.equal(calls.length, 0);
});

test('nothing is sent for a tap that has no message', async () => {
  const calls = await withFetch({ ok: true }, () => postTap(env, { ...event, tap: { type: 'want', slug: 'x', on: false }, result: { count: 2 }, session }));
  assert.equal(calls.length, 0);
});

test('an error from Slack is raised so it reaches the logs', async () => {
  await withFetch({ ok: false, error: 'channel_not_found' }, () =>
    assert.rejects(postTap(env, event), /channel_not_found/));
});
