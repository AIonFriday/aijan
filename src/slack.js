// ABOUTME: Tells the organizers in Slack when someone uses a form or taps a button on the site.
// ABOUTME: Off until SLACK_BOT_TOKEN and SLACK_CHANNEL are set, so local runs post nothing. See docs/slack.md.

const IDEA_GOAL = 5; // An idea needs this many "I want this" to get scheduled.
const MAX_FIELD = 1000;

// Slack reads <...> as mentions and links, so anything a person typed gets these three characters escaped.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const field = (v) => (typeof v === 'string' ? esc(v.trim().slice(0, MAX_FIELD)) : '');
const list = (v) => (Array.isArray(v) ? v.map(field).filter(Boolean).join(', ') : '');
const lines = (...parts) => parts.filter(Boolean).join('\n');
const labeled = (label, value) => (value ? `*${label}:* ${value}` : '');

function who({ name, email }) {
  const n = field(name);
  const e = field(email);
  return n && n !== e ? `${n} (${e})` : e;
}

const sessionLink = (session, origin) => `<${origin}/sessions/${session.slug}|${esc(session.title)}>`;

// The message for one tap, or null when this tap shouldn't reach Slack.
// `result` is what the save returned: `added` is false when the tap was already there, and `count` is what people see.
export function tapMessage({ tap, person, result, session, origin }) {
  if (tap.on === false || result.added === false) return null;
  const from = who(person);
  switch (tap.type) {
    case 'suggest':
      return lines('*New session idea*', field(tap.text), `From ${from}`);
    case 'guideOffer':
      return lines(
        '*New offer to guide*',
        labeled('Topics', list(tap.topics)),
        labeled('Details', field(tap.what)),
        labeled('Level', field(tap.level)),
        labeled('Good times', list(tap.times)),
        labeled('Guiding as', field(tap.guideAs)),
        `From ${from}`,
      );
    case 'krewe':
      return lines(
        '*New Bring a group request*',
        labeled('Group', field(tap.groupName)),
        labeled('Size', field(tap.size)),
        labeled('Wants to learn', field(tap.what)),
        `From ${from}`,
      );
    case 'guide':
      return lines(`*Offer to guide* ${sessionLink(session, origin)}`, labeled('Guiding as', field(tap.guideAs)), `From ${from}`);
    case 'rsvp':
      return `${from} is going to ${sessionLink(session, origin)}. ${result.count} going.`;
    case 'want':
      return result.count === IDEA_GOAL ? `*Ready to schedule:* ${IDEA_GOAL} people want ${sessionLink(session, origin)}. Time to pick a date.` : null;
    default:
      return null;
  }
}

// Posts one tap to the organizers' channel. Throws if Slack refuses, so callers can log it.
export async function postTap(env, event) {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_CHANNEL) return;
  const text = tapMessage(event);
  if (!text) return;
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel: env.SLACK_CHANNEL, text, unfurl_links: false, unfurl_media: false }),
  });
  const reply = await res.json();
  if (!reply.ok) throw new Error(`Slack said ${reply.error}`);
}
