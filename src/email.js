// Email through Resend (https://resend.com): the "here's what you picked" note after a tap, and the link to My sessions.
// Locally, with DEV_LOG_LINKS=true in .dev.vars and no RESEND_API_KEY, emails are printed to the terminal instead.

import data from '../data/sessions.json';

const TZ = data.timeZone;
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
// RSVPs carry a calendar invite.
export function sendTapNote(env, { to, tap, session, count, origin, url, oneTime, local }) {
  const note = tapNote(tap, session, count);
  const attachments = [];
  if (tap.type === 'rsvp' && session?.startsAt) {
    attachments.push({ filename: `${session.slug}.ics`, content: b64(ics(session, origin)), content_type: 'text/calendar' });
  }
  return send(env, {
    to,
    local,
    subject: note.subject,
    lines: note.lines,
    button: { label: 'See your sessions', url },
    small: [oneTime ? `${LINK_NOTE} After that, type your email on My sessions for a new one.` : '', 'We only email you about what you pick.']
      .filter(Boolean)
      .join(' '),
    attachments,
  });
}

function tapNote(tap, s, count) {
  const title = s?.title || '';
  switch (tap.type) {
    case 'rsvp':
      return {
        subject: `You’re going: ${title}`,
        lines: [`You’re going to ${title}.`, `${when(s.startsAt)} at ${where(s)}. It’s free.`, 'The calendar invite is attached. We’ll send a reminder the day before.'],
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
const where = (s) => s.location || data.defaultLocation;

// A one-event calendar file. Sessions run 90 minutes.
function ics(s, origin) {
  const start = new Date(s.startsAt);
  const end = new Date(start.getTime() + 90 * 60000);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = (v) => String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const url = `${origin}/sessions/${s.slug}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI January//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${s.slug}@joinaijanuary.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${txt(s.title)}`,
    `LOCATION:${txt(where(s))}`,
    `DESCRIPTION:${txt(`${s.description}\n\nFree. ${url}`)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

const b64 = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str)));

async function send(env, { to, subject, lines, button, small, attachments = [], local }) {
  const text = [...lines, '', `${button.label}: ${button.url}`, '', small].join('\n');
  if (!env.RESEND_API_KEY) {
    if (local && env.DEV_LOG_LINKS === 'true') {
      console.log(`\n  Email to ${to}: ${subject}\n  ${text.replace(/\n/g, '\n  ')}\n`);
      return;
    }
    throw new Error('RESEND_API_KEY is not set');
  }
  const html = `<div style="font-family:system-ui,sans-serif;font-size:17px;line-height:1.5;color:#2A2035;max-width:30rem">
${lines.map((l) => `<p>${esc(l)}</p>`).join('\n')}
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
