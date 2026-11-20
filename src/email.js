// Email through Resend (https://resend.com): the "here's what you picked" note after a tap, and the link to My sessions.
// Locally, with DEV_LOG_LINKS=true in .dev.vars and no RESEND_API_KEY, emails are printed to the terminal instead.

import { TIME_ZONE as TZ, DEFAULT_LOCATION } from './sessions.js';

const LINK_NOTE = 'The button works once, for 24 hours.';

// The link to My sessions, asked for on /me (or from an older bookmark).
export function sendSignInLink(env, { to, url, local }) {
  return send(env, {
    to,
    local,
    subject: 'Your AI January sessions',
    lines: ['Tap the button to see the sessions you picked.'],
    button: { label: 'See your sessions', url },
    small: `${LINK_NOTE} If you didn’t ask for this, you can ignore this email.`,
  });
}

// What someone just tapped, so they have it in writing. `url` is a one-time link to My sessions when this email
// is also how they get back in, or the plain /me address when they're already in on this device.
// RSVPs carry a real calendar invite (METHOD:REQUEST), so Gmail, Apple Mail and Outlook show it as an event to add,
// plus plain "add to Google Calendar / Outlook" links for anyone whose mail app doesn't.
export function sendTapNote(env, { to, tap, session, count, origin, url, oneTime, local }) {
  const note = tapNote(tap, session, count);
  const rsvp = tap.type === 'rsvp' && session?.startsAt;
  return send(env, {
    to,
    local,
    subject: note.subject,
    lines: note.lines,
    links: rsvp ? calendarLinks(session, origin) : [],
    button: { label: 'See your sessions', url },
    small: [oneTime ? `${LINK_NOTE} After that, type your email on My sessions for a new one.` : '', 'We only email you about what you pick.']
      .filter(Boolean)
      .join(' '),
    attachments: rsvp ? [invite(env, session, origin, to, 'REQUEST')] : [],
  });
}

// Someone took back an RSVP: a short note, and a cancel for the same event so it leaves their calendar.
export function sendCancelNote(env, { to, session, origin, url, local }) {
  return send(env, {
    to,
    local,
    subject: `You’re off the list: ${session.title}`,
    lines: [`We took you off the list for ${session.title}.`, 'If your calendar has it, it should go away on its own. Changed your mind? You can say you’re going again any time.'],
    button: { label: 'See your sessions', url },
    small: 'We only email you about what you pick.',
    attachments: [invite(env, session, origin, to, 'CANCEL')],
  });
}

function tapNote(tap, s, count) {
  const title = s?.title || '';
  switch (tap.type) {
    case 'rsvp':
      return {
        subject: `You’re going: ${title}`,
        lines: [`You’re going to ${title}.`, `${when(s.startsAt)} at ${where(s)}. It’s free.`, 'The calendar invite is attached.'],
      };
    case 'want':
      return {
        subject: `Got it: ${title}`,
        lines: [
          `You want ${title}.`,
          count >= 5
            ? `That makes ${count}, which is enough. We’ll pick a date and email you.`
            : `${count} ${count === 1 ? 'person wants' : 'people want'} it so far. When 5 do, we’ll put it on the calendar and email you the date.`,
        ],
      };
    case 'guide':
      return { subject: 'Thanks for offering to guide', lines: [`Thanks for offering to guide ${title}.`, 'An organizer will email you soon.'] };
    case 'guideOffer':
      return { subject: 'Thanks for offering to guide', lines: ['Thanks for offering to guide a session.', 'An organizer will email you soon to find a time.'] };
    case 'krewe':
      return { subject: 'We got your group’s request', lines: [`We got your request for ${tap.groupName || 'your group'}.`, 'An organizer will email you soon about a time.'] };
    default:
      return { subject: 'Thanks for your idea', lines: ['We got your idea. An organizer reads every one.', 'If it fits, it goes up on the site so people can say they want it.'] };
  }
}

const when = (iso) => {
  const d = new Date(iso);
  const day = d.toLocaleString('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' });
  const time = d.toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  return `${day} at ${time}`;
};
const where = (s) => s.location || DEFAULT_LOCATION;

// The session's start and end. Sessions run 90 minutes unless the session says otherwise.
const span = (s) => {
  const start = new Date(s.startsAt);
  return [start, new Date(start.getTime() + (s.lengthMin || 90) * 60000)];
};
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// "Add to Google Calendar" and "Add to Outlook" links, for mail apps that don't show the invite.
export function calendarLinks(s, origin) {
  const [start, end] = span(s);
  const details = `${s.description || ''}\n\nFree. ${origin}/sessions/${s.slug}`.trim();
  const g = new URLSearchParams({ action: 'TEMPLATE', text: s.title, dates: `${stamp(start)}/${stamp(end)}`, details, location: where(s), ctz: TZ });
  const o = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: s.title, startdt: start.toISOString(), enddt: end.toISOString(), body: details, location: where(s) });
  return [
    { label: 'Google Calendar', url: `https://calendar.google.com/calendar/render?${g}` },
    { label: 'Outlook', url: `https://outlook.live.com/calendar/0/deeplink/compose?${o}` },
  ];
}

// The invite file. REQUEST makes mail apps show it as an event with an add button; CANCEL takes it back off.
// The UID is the same for a session every time, and SEQUENCE only goes up (it's the time in seconds),
// so a later invite or cancel replaces the earlier one in someone's calendar.
// The person is already going, so PARTSTAT=ACCEPTED and RSVP=FALSE: no "Will you attend?" to answer.
export function ics(s, origin, { to, organizer, method = 'REQUEST', now = new Date() }) {
  const [start, end] = span(s);
  const txt = (v) => String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const url = `${origin}/sessions/${s.slug}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI January//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${s.slug}@joinaijanuary.com`,
    `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${txt(s.title)}`,
    `LOCATION:${txt(where(s))}`,
    `DESCRIPTION:${txt(`${s.description || ''}\n\nFree. ${url}`.trim())}`,
    `URL:${url}`,
    `ORGANIZER;CN=AI January:mailto:${organizer}`,
    `ATTENDEE;CN=${to};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${to}`,
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    ...(method === 'CANCEL' ? [] : ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${txt(s.title)}`, 'TRIGGER:-PT1H', 'END:VALARM']),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

// Calendar lines can be at most 75 bytes; longer ones go on to the next line after a space.
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      size = 0;
    }
    cur += ch;
    size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const fromAddress = (env) => (String(env.EMAIL_FROM || '').match(/<([^>]+)>/) || [, env.EMAIL_FROM || 'hello@joinaijanuary.com'])[1];

const invite = (env, s, origin, to, method) => ({
  filename: method === 'CANCEL' ? 'cancel.ics' : 'invite.ics',
  content: b64(ics(s, origin, { to, organizer: fromAddress(env), method })),
  content_type: `text/calendar; charset=utf-8; method=${method}`,
});

const b64 = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str)));

async function send(env, { to, subject, lines, links = [], button, small, attachments = [], local }) {
  const text = [...lines, ...(links.length ? ['', ...links.map((l) => `Add to ${l.label}: ${l.url}`)] : []), '', `${button.label}: ${button.url}`, '', small].join('\n');
  if (!env.RESEND_API_KEY) {
    if (local && env.DEV_LOG_LINKS === 'true') {
      console.log(`\n  Email to ${to}: ${subject}\n  ${text.replace(/\n/g, '\n  ')}\n`);
      return;
    }
    throw new Error('RESEND_API_KEY is not set');
  }
  const html = `<div style="font-family:system-ui,sans-serif;font-size:17px;line-height:1.5;color:#2A2035;max-width:30rem">
${lines.map((l) => `<p>${esc(l)}</p>`).join('\n')}
${links.length ? `<p style="font-size:15px">Add it to: ${links.map((l) => `<a href="${esc(l.url)}" style="color:#6A4C8C;font-weight:700">${esc(l.label)}</a>`).join(' · ')}</p>` : ''}
<p><a href="${esc(button.url)}" style="display:inline-block;background:#6A4C8C;color:#FFFDF6;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">${esc(button.label)}</a></p>
<p style="color:#5E5469;font-size:15px">${esc(small)}</p>
</div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text, html, ...(attachments.length ? { attachments } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend said ${res.status}: ${await res.text()}`);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
