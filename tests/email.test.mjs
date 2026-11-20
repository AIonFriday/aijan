// RSVP emails carry a calendar invite that mail apps show as an event, and taking an RSVP back sends a cancel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ics, calendarLinks, sendTapNote, sendCancelNote } from '../src/email.js';

const s = { slug: 'ai-friday-kickoff', title: 'AI Friday: the kickoff, for everyone', description: 'Come; bring a friend.', startsAt: '2027-01-08T09:00:00-06:00', lengthMin: 120, status: 'scheduled' };
const origin = 'https://joinaijanuary.com';
const env = { RESEND_API_KEY: 'test', EMAIL_FROM: 'AI January <hello@joinaijanuary.com>' };
const unfold = (t) => t.replace(/\r\n /g, '');

async function capture(fn) {
  const real = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, init) => ((body = JSON.parse(init.body)), new Response('{}'));
  try { await fn(); } finally { globalThis.fetch = real; }
  return body;
}

test('the invite is a request with an organizer and an attendee who is already going', () => {
  const t = ics(s, origin, { to: 'pat@example.com', organizer: 'hello@joinaijanuary.com', now: new Date('2026-11-20T12:00:00Z') });
  const u = unfold(t);
  assert.match(u, /METHOD:REQUEST/);
  assert.match(u, /DTSTART:20270108T150000Z/);
  assert.match(u, /DTEND:20270108T170000Z/);
  assert.match(u, /UID:ai-friday-kickoff@joinaijanuary\.com/);
  assert.match(u, /SUMMARY:AI Friday: the kickoff\\, for everyone/);
  assert.match(u, /DESCRIPTION:Come\\\; bring a friend\.\\n\\nFree\. https:\/\/joinaijanuary\.com\/sessions\/ai-friday-kickoff/);
  assert.match(u, /LOCATION:The Nieux\\, 2040 St\. Charles/);
  assert.match(u, /ORGANIZER;CN=AI January:mailto:hello@joinaijanuary\.com/);
  assert.match(u, /ATTENDEE;[^\r]*PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:pat@example\.com/);
  for (const line of t.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `line too long: ${line}`);
  assert.ok(t.endsWith('\r\n'));
});

test('a later invite or cancel has a higher sequence, so it replaces the first one', () => {
  const seq = (t) => Number(t.match(/SEQUENCE:(\d+)/)[1]);
  const first = ics(s, origin, { to: 'a@b.co', organizer: 'h@j.co', now: new Date('2026-11-20T12:00:00Z') });
  const cancel = ics(s, origin, { to: 'a@b.co', organizer: 'h@j.co', method: 'CANCEL', now: new Date('2026-11-21T12:00:00Z') });
  assert.ok(seq(cancel) > seq(first));
  assert.ok(seq(cancel) < 2 ** 31);
  assert.match(cancel, /METHOD:CANCEL/);
  assert.match(cancel, /STATUS:CANCELLED/);
  assert.doesNotMatch(cancel, /VALARM/);
});

test('Google and Outlook links carry the title, times and place', () => {
  const [g, o] = calendarLinks(s, origin).map((l) => new URL(l.url));
  assert.equal(g.searchParams.get('dates'), '20270108T150000Z/20270108T170000Z');
  assert.equal(g.searchParams.get('text'), s.title);
  assert.equal(o.searchParams.get('startdt'), '2027-01-08T15:00:00.000Z');
  assert.equal(o.searchParams.get('location'), 'The Nieux, 2040 St. Charles');
});

test('the RSVP email attaches invite.ics as a calendar request and links to calendars', async () => {
  const body = await capture(() => sendTapNote(env, { to: 'pat@example.com', tap: { type: 'rsvp' }, session: s, origin, url: `${origin}/me`, oneTime: false }));
  assert.equal(body.attachments.length, 1);
  assert.equal(body.attachments[0].filename, 'invite.ics');
  assert.equal(body.attachments[0].content_type, 'text/calendar; charset=utf-8; method=REQUEST');
  const file = new TextDecoder().decode(Uint8Array.from(atob(body.attachments[0].content), (c) => c.charCodeAt(0)));
  assert.match(unfold(file), /mailto:pat@example\.com/);
  assert.match(body.html, /calendar\.google\.com/);
  assert.match(body.text, /Add to Outlook: https:\/\/outlook\.live\.com/);
  assert.doesNotMatch(body.text, /reminder/);
});

test('other taps have no invite', async () => {
  const body = await capture(() => sendTapNote(env, { to: 'pat@example.com', tap: { type: 'want' }, session: { ...s, status: 'proposed' }, count: 2, origin, url: `${origin}/me` }));
  assert.equal(body.attachments, undefined);
  assert.doesNotMatch(body.html, /calendar\.google\.com/);
});

test('taking an RSVP back sends a cancel', async () => {
  const body = await capture(() => sendCancelNote(env, { to: 'pat@example.com', session: s, origin, url: `${origin}/me` }));
  assert.match(body.subject, /off the list/);
  assert.equal(body.attachments[0].content_type, 'text/calendar; charset=utf-8; method=CANCEL');
});
