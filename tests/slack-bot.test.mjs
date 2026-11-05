// ABOUTME: Tests for Beignet in Slack (src/slack-bot.js): signatures, which mentions count, and the model's tool loop.
// ABOUTME: Slack and OpenRouter are faked by swapping globalThis.fetch; tests/d1.mjs stands in for D1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { fakeD1 } from './d1.mjs';
import { verifySlack, handleSlackEvents, mentionFrom, runMention, tidy, SlackBotBase } from '../src/slack-bot.js';
import { saveSession } from '../src/sessions.js';

const SECRET = 'shh';
const CHANNEL = 'CADMIN';
const sign = (body, ts = Math.floor(Date.now() / 1000)) => ({
  'X-Slack-Request-Timestamp': String(ts),
  'X-Slack-Signature': 'v0=' + createHmac('sha256', SECRET).update(`v0:${ts}:${body}`).digest('hex'),
});
const env0 = () => ({ SLACK_SIGNING_SECRET: SECRET, SLACK_ADMIN_CHANNEL: CHANNEL, SLACK_BOT_TOKEN: 'xoxb', OPENROUTER_API_KEY: 'sk' });
const mention = (over = {}) => ({
  type: 'event_callback',
  event_id: 'Ev1',
  authorizations: [{ user_id: 'UBOT' }],
  event: { type: 'app_mention', channel: CHANNEL, user: 'UANDREW', text: '<@UBOT> what’s on?', ts: '100.1', ...over },
});
const post = (payload, env, start, headers) => {
  const body = JSON.stringify(payload);
  return handleSlackEvents(new Request('https://joinaijanuary.com/api/slack/events', { method: 'POST', headers: headers || sign(body), body }), env, start);
};

test('signatures: right secret and fresh timestamp only', async () => {
  const body = '{"a":1}';
  assert.equal(await verifySlack(new Headers(sign(body)), body, SECRET), true);
  assert.equal(await verifySlack(new Headers(sign(body)), body + ' ', SECRET), false);
  assert.equal(await verifySlack(new Headers(sign(body)), body, 'other'), false);
  assert.equal(await verifySlack(new Headers(sign(body, Math.floor(Date.now() / 1000) - 600)), body, SECRET), false);
  assert.equal(await verifySlack(new Headers({}), body, SECRET), false);
});

test('url_verification answers the challenge; bad signatures get a 401', async () => {
  const res = await post({ type: 'url_verification', challenge: 'abc' }, env0(), () => {});
  assert.deepEqual(await res.json(), { challenge: 'abc' });
  const bad = await post({ type: 'url_verification', challenge: 'abc' }, env0(), () => {}, sign('different'));
  assert.equal(bad.status, 401);
});

test('only mentions in the admin channel, from people, start work', async () => {
  const started = [];
  const start = (m) => started.push(m);
  assert.equal((await post(mention(), env0(), start)).status, 200);
  await post(mention({ channel: 'COTHER' }), env0(), start);
  await post(mention({ bot_id: 'B1' }), env0(), start);
  await post({ ...mention(), event: { ...mention().event, type: 'message' } }, env0(), start);
  assert.equal(started.length, 1);
  assert.equal(started[0].thread, '100.1');
  assert.equal(started[0].botUser, 'UBOT');
  assert.equal(started[0].origin, 'https://joinaijanuary.com');
  assert.equal(mentionFrom(mention(), { ...env0(), SLACK_ADMIN_CHANNEL: '' }), null);
});

test('replies never ping the whole channel', () => {
  assert.equal(tidy('hey <!channel> and <!here|here>'), 'hey channel and here');
});

// Fakes Slack and OpenRouter. `turns` are the model's messages, in order.
function fakeApis(turns) {
  const calls = { slack: [], claude: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('https://slack.com/api/')) {
      const method = url.slice(22).split('?')[0];
      calls.slack.push({ method, body: init.body ? JSON.parse(init.body) : Object.fromEntries(new URL(url).searchParams) });
      if (method === 'conversations.replies') {
        return Response.json({ ok: true, messages: [
          { user: 'UBOT', bot_id: 'B1', text: '*New session idea*\nAI for musicians\nFrom sam@example.com', ts: '90.0' },
          { user: 'UANDREW', text: '<@UBOT> add this as an idea for Making things', ts: '100.1' },
        ] });
      }
      return Response.json({ ok: true });
    }
    calls.claude.push({ url, ...JSON.parse(init.body) });
    return Response.json({ choices: [{ message: turns.shift() }] });
  };
  return { calls, restore: () => (globalThis.fetch = real) };
}

test('a mention runs Claude’s tool calls as an organizer and replies in the thread', async () => {
  const DB = fakeD1();
  const env = { ...env0(), DB };
  await saveSession(env, { slug: 'first-hour-with-chatgpt', title: 'Your first hour with ChatGPT', description: 'Start here.', status: 'proposed', level: 'new', topics: ['curious'] });
  const { calls, restore } = fakeApis([
    { role: 'assistant', content: 'Looking.', tool_calls: [{ id: 't1', type: 'function', function: { name: 'list_sessions', arguments: '{}' } }] },
    { role: 'assistant', content: 'One idea so far: *Your first hour with ChatGPT*. <!channel>' },
  ]);
  try {
    await runMention(env, { channel: CHANNEL, user: 'UANDREW', text: '<@UBOT> what’s on?', ts: '100.1', thread: '100.1', botUser: 'UBOT' }, {});
  } finally {
    restore();
  }
  const first = calls.claude[0];
  assert.equal(first.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(first.model, 'anthropic/claude-sonnet-5.5');
  const names = first.tools.map((t) => t.function.name);
  assert.ok(names.includes('list_sessions') && names.includes('edit_session'));
  assert.ok(!names.includes('add_admin') && !names.includes('remove_admin'), 'no owner tools in Slack');
  assert.equal(first.messages[0].role, 'system');
  assert.deepEqual(first.messages.slice(1), [{ role: 'user', content: '<@UANDREW>: what’s on?' }]);
  const result = calls.claude[1].messages[3];
  assert.equal(result.role, 'tool');
  assert.equal(result.tool_call_id, 't1');
  assert.match(result.content, /first-hour-with-chatgpt/);
  const reply = calls.slack.find((c) => c.method === 'chat.postMessage').body;
  assert.equal(reply.thread_ts, '100.1');
  assert.equal(reply.channel, CHANNEL);
  assert.equal(reply.text, 'One idea so far: *Your first hour with ChatGPT*. channel');
  assert.ok(!calls.slack.some((c) => c.method === 'conversations.replies'), 'a new mention needs no history');
});

test('in a thread, Claude sees the thread, starting from Beignet’s own post', async () => {
  const env = { ...env0(), DB: fakeD1() };
  const { calls, restore } = fakeApis([{ role: 'assistant', content: 'Added.' }]);
  try {
    await runMention(env, { channel: CHANNEL, user: 'UANDREW', text: '<@UBOT> add this as an idea for Making things', ts: '100.1', thread: '90.0', botUser: 'UBOT' }, {});
  } finally {
    restore();
  }
  const msgs = calls.claude[0].messages.slice(1);
  assert.equal(msgs.length, 2);
  assert.match(msgs[0].content, /^Beignet posted this earlier:\n\*New session idea\*/);
  assert.equal(msgs[1].content, '<@UANDREW>: add this as an idea for Making things');
});

test('a model failure becomes an apology in the thread', async () => {
  const env = { ...env0(), DB: fakeD1() };
  const real = globalThis.fetch;
  const posted = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith('https://slack.com/api/')) {
      posted.push(JSON.parse(init.body));
      return Response.json({ ok: true });
    }
    return new Response('overloaded', { status: 529 });
  };
  const err = console.error;
  console.error = () => {};
  try {
    await runMention(env, { channel: CHANNEL, user: 'U1', text: 'hi', ts: '1.0', thread: '1.0', botUser: 'UBOT' }, {});
  } finally {
    globalThis.fetch = real;
    console.error = err;
  }
  assert.ok(posted.some((p) => /something went wrong/.test(p.text || '')));
});

test('the Durable Object takes each Slack event once', async () => {
  const store = new Map();
  let alarms = 0;
  const state = { storage: {
    get: async (k) => store.get(k),
    put: async (k, v) => void store.set(k, v),
    setAlarm: async () => void alarms++,
    deleteAll: async () => store.clear(),
  } };
  const bot = new SlackBotBase(state, {});
  const send = () => bot.fetch(new Request('https://slack-bot/', { method: 'POST', body: JSON.stringify({ id: 'Ev1' }) }));
  await send();
  await send();
  assert.equal(alarms, 1);
});
