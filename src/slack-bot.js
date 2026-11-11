// ABOUTME: Beignet in Slack: when someone @mentions the bot in the admin channel, a model (through OpenRouter) answers
// ABOUTME: in the thread and can use every organizer tool from the admin MCP (src/mcp.js). See docs/slack.md.
//
// Slack posts events to POST /api/slack/events. Slack wants an answer within 3 seconds and the model can take longer,
// so the Worker checks the signature, hands the mention to a Durable Object (SlackBotBase, one per Slack event id)
// and answers 200 right away. The Durable Object runs the work from an alarm, which may run for minutes, and the
// event id doubles as a guard against Slack's retries running the same request twice.
//
// Beignet acts as an organizer (never an owner), so it can't make or remove admin keys: a new key would be posted
// in the channel for everyone to read. Mentions anywhere but SLACK_ADMIN_CHANNEL are ignored.

import { toolsFor, runTool, INSTRUCTIONS } from './mcp.js';

const SLACK = 'https://slack.com/api/';
const MAX_AGE_S = 60 * 5; // Slack's advice: refuse requests signed more than five minutes ago.
const MAX_ROUNDS = 6; // tool rounds per mention, so a confused loop can't run forever (or run up the bill)
const HISTORY = 20; // thread messages the model sees
const DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5'; // an OpenRouter model id

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Slack signs each request: v0= HMAC-SHA256(signing secret, "v0:<timestamp>:<raw body>").
export async function verifySlack(headers, body, secret, nowS = Math.floor(Date.now() / 1000)) {
  const ts = headers.get('X-Slack-Request-Timestamp');
  const sig = headers.get('X-Slack-Signature') || '';
  if (!secret || !ts || !/^\d+$/.test(ts) || Math.abs(nowS - Number(ts)) > MAX_AGE_S) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const want = 'v0=' + hex(await crypto.subtle.sign('HMAC', key, enc.encode(`v0:${ts}:${body}`)));
  if (sig.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

const ok = (body = null) =>
  new Response(body == null ? '' : JSON.stringify(body), { status: 200, headers: body == null ? {} : { 'Content-Type': 'application/json' } });

// The mention to act on, or null when this event isn't for Beignet.
export function mentionFrom(payload, env) {
  if (payload?.type !== 'event_callback') return null;
  const e = payload.event || {};
  if (e.type !== 'app_mention' || !env.SLACK_ADMIN_CHANNEL || e.channel !== env.SLACK_ADMIN_CHANNEL) return null;
  if (e.bot_id || e.subtype) return null; // other bots, edits, and our own posts
  return {
    id: payload.event_id,
    channel: e.channel,
    user: e.user,
    text: String(e.text || ''),
    ts: e.ts,
    thread: e.thread_ts || e.ts,
    botUser: payload.authorizations?.[0]?.user_id || null,
  };
}

// POST /api/slack/events. `start(mention)` hands the work off (the Durable Object in production).
export async function handleSlackEvents(request, env, start) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!env.SLACK_SIGNING_SECRET) return new Response('Slack isn’t set up yet.', { status: 503 });
  const body = await request.text();
  if (!(await verifySlack(request.headers, body, env.SLACK_SIGNING_SECRET))) return new Response('Bad signature', { status: 401 });
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('That isn’t JSON.', { status: 400 });
  }
  if (payload.type === 'url_verification') return ok({ challenge: payload.challenge });
  const mention = mentionFrom(payload, env);
  if (mention && env.SLACK_BOT_TOKEN && env.OPENROUTER_API_KEY) await start({ ...mention, origin: new URL(request.url).origin });
  return ok();
}

// --- Slack Web API ---------------------------------------------------------------------------------------------

async function slack(env, method, args, { get = false } = {}) {
  const url = SLACK + method + (get ? '?' + new URLSearchParams(args) : '');
  const res = await fetch(url, get
    ? { headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` } }
    : { method: 'POST', headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(args) });
  const reply = await res.json();
  if (!reply.ok) throw new Error(`Slack ${method} said ${reply.error}`);
  return reply;
}

// Never lets the model's reply ping the whole channel.
export const tidy = (text) => text.replace(/<!(channel|here|everyone)(\|[^>]*)?>/g, '$1').trim();

const stripMention = (text, botUser) => (botUser ? text.split(`<@${botUser}>`).join('') : text).trim();

// The thread so far, as chat messages: Beignet's posts are the assistant, everyone else is the user.
export async function threadMessages(env, m) {
  let msgs = [{ user: m.user, text: m.text, ts: m.ts }];
  if (m.thread !== m.ts) {
    const { messages = [] } = await slack(env, 'conversations.replies', { channel: m.channel, ts: m.thread, limit: '100' }, { get: true });
    msgs = messages.filter((x) => Number(x.ts) <= Number(m.ts)).slice(-HISTORY);
    if (!msgs.some((x) => x.ts === m.ts)) msgs.push({ user: m.user, text: m.text, ts: m.ts });
  }
  const out = [];
  for (const x of msgs) {
    const mine = (m.botUser && x.user === m.botUser) || (x.bot_id && x.bot_profile?.name === 'Beignet');
    const body = String(x.text || '');
    if (!body.trim()) continue;
    // The model's turns start with the user, so a thread under one of Beignet's own posts (like a new session idea)
    // starts with that post as context.
    if (mine && !out.length) out.push({ role: 'user', content: `Beignet posted this earlier:\n${body}` });
    else out.push({ role: mine ? 'assistant' : 'user', content: mine ? body : `<@${x.user || 'someone'}>: ${stripMention(body, m.botUser)}` });
  }
  return out;
}

// --- The model ----------------------------------------------------------------------------------------------------

const SYSTEM = [
  'You are Beignet, the helper bot for the AI January organizers, answering in their private Slack channel.',
  'AI January is free AI sessions in New Orleans, Jan 8–28, 2027, at joinaijanuary.com.',
  'Anyone who mentions you here is an organizer. You can use the site’s admin tools for them.',
  INSTRUCTIONS,
  'Do what they clearly ask. When a request is unclear, or would cancel or hide a session or take someone off one, say exactly what you will do and ask them to confirm in this thread first. A reply like "yes" in the thread is their confirmation.',
  'Say what you changed, with the page link (https://joinaijanuary.com/sessions/<slug>) when there is one.',
  'People are shown as <@U…> Slack ids; you can mention them the same way.',
  'Write for Slack: short, plain sentences. Use *bold*, _italics_, bullet lines starting with "•", and links as <url|text>. No headings or tables. Never use <!channel>, <!here> or <!everyone>.',
  'Emails are private to this channel: never suggest posting them anywhere else.',
].join('\n\n');

// OpenRouter's chat completions API (OpenAI format), so the model is a setting: BOT_MODEL in wrangler.jsonc.
async function chat(env, body) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://joinaijanuary.com',
      'X-Title': 'AI January Beignet',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter said ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

const parseArgs = (s) => {
  try {
    return typeof s === 'string' && s.trim() ? JSON.parse(s) : {};
  } catch {
    return null;
  }
};

// The reply for one mention. Runs the model's tool calls as an organizer named for the Slack user.
export async function answer(env, m, deps) {
  const admin = { name: `Beignet for <@${m.user}>`, email: `slack:${m.user}`, role: 'organizer', via: 'slack' };
  const tools = toolsFor(admin).map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
  const thread = await threadMessages(env, m);
  if (!thread.length) return 'Hi! Ask me about sessions or who’s coming, and I can make changes on the site too.';
  const messages = [{ role: 'system', content: SYSTEM }, ...thread];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await chat(env, {
      model: env.BOT_MODEL || DEFAULT_MODEL,
      messages,
      tools,
      // The OpenRouter key has a daily spend cap, so answers stay short and thinking stays light.
      max_tokens: 4000,
      reasoning: { effort: 'low' },
    });
    const choice = res.choices?.[0];
    if (!choice?.message) throw new Error(`OpenRouter sent no answer: ${JSON.stringify(res).slice(0, 300)}`);
    const msg = choice.message;
    const calls = msg.tool_calls || [];
    if (!calls.length) return (typeof msg.content === 'string' ? msg.content : '').trim() || 'Done.';
    // The whole message goes back (reasoning included), so the next round sees it unchanged.
    messages.push(msg);
    for (const c of calls) {
      const args = parseArgs(c.function?.arguments);
      const r = args ? await runTool(env, admin, c.function?.name, args, deps) : { ok: false, error: 'The tool arguments weren’t valid JSON.' };
      messages.push({ role: 'tool', tool_call_id: c.id, content: r.ok ? JSON.stringify(r.out) : `Error: ${r.error}` });
    }
  }
  return 'That took more steps than I’m allowed. Could you break it into smaller asks?';
}

// Answers one mention in its thread. Never throws: a failure becomes a short apology in the thread.
export async function runMention(env, m, deps) {
  const where = { channel: m.channel, thread_ts: m.thread };
  await slack(env, 'reactions.add', { channel: m.channel, timestamp: m.ts, name: 'eyes' }).catch(() => {});
  let text;
  try {
    text = await answer(env, m, deps);
  } catch (e) {
    console.error(e);
    text = 'Sorry, something went wrong on my end. Try again in a minute.';
  }
  await slack(env, 'chat.postMessage', { ...where, text: tidy(text), unfurl_links: false, unfurl_media: false }).catch((e) => console.error(e));
  await slack(env, 'reactions.remove', { channel: m.channel, timestamp: m.ts, name: 'eyes' }).catch(() => {});
}

// --- Durable Object ------------------------------------------------------------------------------------------

// One instance per Slack event id. The Worker subclasses it with `deps(origin)` (how to make an account).
export class SlackBotBase {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const mention = await request.json();
    if (await this.state.storage.get('mention')) return ok(); // Slack retried an event we already have
    await this.state.storage.put('mention', mention);
    await this.state.storage.setAlarm(Date.now());
    return ok();
  }

  async alarm() {
    if (await this.state.storage.get('done')) return this.state.storage.deleteAll();
    const m = await this.state.storage.get('mention');
    // Marked done first, so a crash can't post the same answer twice. Kept an hour to catch late retries.
    await this.state.storage.put('done', true);
    await this.state.storage.setAlarm(Date.now() + 60 * 60 * 1000);
    if (m) await runMention(this.env, m, this.deps(m.origin));
  }

  deps() {
    return {};
  }
}
