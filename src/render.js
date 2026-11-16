// Page pieces shared by the build (static pages) and the Worker (session pages, drawn from D1 on request).
// Plain JavaScript with no imports beyond src/sessions.js, so both can use it. Templates come in as strings:
// the build reads them from disk, the Worker imports them as text modules.
//
// Templates use {{name}}. Values are HTML-escaped unless the name ends in "Html" or is a partial.

import { LEVELS, KINDS, TIME_ZONE, DEFAULT_LOCATION } from './sessions.js';
import { facultyFor, allSessionsFor, initials, tint } from './faculty.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RAW = { head: 1, header: 1, footer: 1, sheet: 1, navSessions: 1, navGuide: 1, navKrewe: 1, navMe: 1, barWide: 1 };
export const fill = (tpl, vars) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`Template value {{${k}}} is missing`);
    return k.endsWith('Html') || k in RAW ? vars[k] : esc(vars[k]);
  });

// ---------- search engines and answer engines ----------
// Structured data (schema.org JSON-LD) so Google and AI answer engines can read the plain facts: what this is,
// when, where, that it's free, and who runs it. </ is escaped so a value can never close the script tag.
export const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
export const graph = (...items) => ld({ '@context': 'https://schema.org', '@graph': items });
export const PLACE = {
  '@type': 'Place',
  name: 'The Nieux',
  address: { '@type': 'PostalAddress', streetAddress: '2040 St. Charles Ave', addressLocality: 'New Orleans', addressRegion: 'LA', postalCode: '70130', addressCountry: 'US' },
};
export const PRESENTERS = [
  { '@type': 'Organization', name: 'Nieux Society', url: 'https://www.nieuxsociety.com/' },
  { '@type': 'Organization', name: 'AI Friday', url: 'https://aifri.day/' },
];
// validFrom is when RSVPs opened. Google's Event report warns when an offer has none.
export const FREE = { '@type': 'Offer', price: 0, priceCurrency: 'USD', availability: 'https://schema.org/InStock', validFrom: '2026-11-05T00:00:00-06:00' };

// ---------- shared partials ----------
// t: { head, header, footer, sheet } template strings from site/partials/.
export const footer = (tpl) => tpl.replace('{{brandLink}}', '<li><a href="/brand">Brand and logos</a></li>');

export const head = (t, siteUrl, o) =>
  fill(t.head, {
    // Personal pages, the 404 and example sessions stay out of search results.
    robotsHtml: o.noindex ? '<meta name="robots" content="noindex">' : '',
    jsonLdHtml: o.jsonLdHtml || '',
    title: o.title,
    description: o.description,
    url: siteUrl + o.path,
    ogType: o.ogType || 'website',
    ogTitle: o.ogTitle || o.title,
    // Each session has its own share image (title and date over the map); other pages share the home one.
    ogImage: `${siteUrl}${o.ogImage || '/og/home.png'}`,
    ogImageAlt: o.ogImageAlt || 'AI January: You’re invited to learn AI. Free AI sessions in New Orleans, Jan 8–28, 2027.',
  });

const here = ' aria-current="page"';
// The Sessions page is wider than the rest (calendar plus the vote box), so its header widens to match.
export const header = (t, current) =>
  fill(t.header, { barWide: current === 'sessions' ? ' wide' : '', navSessions: current === 'sessions' ? here : '', navGuide: current === 'guide' ? here : '', navKrewe: current === 'krewe' ? here : '', navMe: current === 'me' ? here : '' });

// ---------- one session ----------
const part = (d, o) => d.toLocaleString('en-US', { timeZone: TIME_ZONE, ...o });
const clock = (d) => part(d, { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
const NEEDED = 5;
// After "Not scheduled yet" on an idea's page: how many want it, or nothing at zero. session.js uses the same words.
const wantLine = (n) => (n >= NEEDED ? ' · enough people, scheduling soon' : n ? ` · ${n} ${n === 1 ? 'wants' : 'want'} this` : '');

// The plain facts about when a session is, used by its page, its share image and llms.txt.
export function when(s) {
  if (s.status !== 'scheduled') return { scheduled: false, text: 'Not set yet. We pick a date once five people want it.' };
  const start = new Date(s.startsAt);
  const end = new Date(start.getTime() + (s.lengthMin || 90) * 60000);
  const day = part(start, { weekday: 'short', month: 'short', day: 'numeric' });
  // Six hours or more (a hackathon) reads as all day.
  const allDay = (s.lengthMin || 90) >= 360;
  return { scheduled: true, start, end, day, allDay, startClock: allDay ? 'all day' : clock(start), text: allDay ? `${day}, all day` : `${day}, ${clock(start)} – ${clock(end)}`, date: part(start, { month: 'short', day: 'numeric' }), month: part(start, { month: 'short' }).toUpperCase(), dayNum: part(start, { day: 'numeric' }) };
}

// What the share image shows. Its hash goes in the image URL, so a change to the session gets a fresh image
// past every cache.
export function shareFacts(s) {
  const w = when(s);
  return { title: s.title, scheduled: w.scheduled, when: w.text, where: s.location || DEFAULT_LOCATION, ...(w.scheduled ? { month: w.month, day: w.dayNum } : {}) };
}
export function shareVersion(s) {
  let h = 0x811c9dc5;
  for (const c of JSON.stringify(shareFacts(s))) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return (h >>> 0).toString(36);
}

// One scheduled session as a schema.org Event, part of the AI January series.
function sessionEvent(s, siteUrl, location) {
  const w = when(s);
  const iso = (d) => d.toLocaleString('sv-SE', { timeZone: TIME_ZONE }).replace(' ', 'T') + s.startsAt.slice(-6);
  return {
    '@type': 'Event',
    name: s.title,
    description: s.description,
    url: `${siteUrl}/sessions/${s.slug}`,
    image: `${siteUrl}/og/sessions/${s.slug}.png?v=${shareVersion(s)}`,
    startDate: s.startsAt,
    endDate: iso(w.end),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    isAccessibleForFree: true,
    location: location === DEFAULT_LOCATION ? PLACE : { '@type': 'Place', name: location, address: location },
    // A partner event is run by its guides, and takes sign-ups on its own site.
    organizer: s.signupUrl && s.guides.length ? s.guides.map((g) => ({ '@type': 'Organization', name: g.name, ...(g.url ? { url: g.url } : {}) })) : PRESENTERS,
    ...(s.guides.length ? { performer: s.guides.map((g) => ({ '@type': 'Person', name: g.name, ...(g.url ? { url: g.url } : {}) })) } : {}),
    offers: { ...FREE, url: s.signupUrl || `${siteUrl}/sessions/${s.slug}` },
    // No superEvent link to the home page's EventSeries: Google reads a bare {"@id"} as a second Event with no
    // name, date or place and flags the whole page as invalid.
  };
}

// A guide's name, linked to their faculty page when they have one, or else to their website or LinkedIn
// (in a new tab, like the footer links).
const guideHtml = (g, faculty = []) => {
  const f = facultyFor(faculty, g.name);
  if (f) return `<a href="/faculty/${esc(f.slug)}">${esc(g.name)}</a>`;
  return g.url ? `<a href="${esc(g.url)}" target="_blank" rel="noopener">${esc(g.name)}</a>` : esc(g.name);
};

// Plain text with its web addresses turned into links, escaped. Catches https://… and www.… links and bare
// addresses like hellogravel.com/play, but not email addresses. A period or comma at the end stays text.
const LINK = /(?<![@\w.-])(?:https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|org|net|edu|gov|io|ai|day|dev|app|co|us|info|biz|me|games|xyz|nola)(?![\w@-])(?:\/[^\s<>"]*)?)/gi;
export function linkify(text) {
  let out = '', at = 0;
  for (const m of String(text ?? '').matchAll(LINK)) {
    const link = m[0].replace(/[.,;:!?)'"’”]+$/, '');
    out += esc(text.slice(at, m.index));
    const href = /^https?:/i.test(link) ? link : `https://${link}`;
    out += `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(link)}</a>`;
    at = m.index + link.length;
  }
  return out + esc(String(text ?? '').slice(at));
}

// Search engines show about 60 characters of a title and 160 of a description, so keep inside those.
// The date tells apart sessions that share a name (office hours); the site name goes when there's no room.
export function sessionTitle(s, w = when(s)) {
  const options = w.scheduled ? [`${s.title} · ${w.date} · AI January`, `${s.title} · ${w.date}`] : [];
  return [...options, `${s.title} · AI January`].find((t) => t.length <= 60) || s.title;
}
export function clip(text, max = 160) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,.;:–—-]+$/, '') + '…';
}

// The whole page for one session. t: { session, head, header, footer, sheet } template strings.
export function sessionPage(t, siteUrl, s, faculty = []) {
  const w = when(s);
  const location = s.location || DEFAULT_LOCATION;
  let tileHtml, statusLineHtml, buttonsHtml, summary;
  const host = s.signupUrl ? new URL(s.signupUrl).hostname.replace(/^www\./, '') : '';
  if (w.scheduled && s.signupUrl) {
    // A partner event: run by someone else, sign-ups on their site. No RSVP or count here.
    tileHtml = `<div class="tile" aria-hidden="true"><div class="m">${w.month}</div><div class="d">${w.dayNum}</div></div>`;
    statusLineHtml = `${esc(w.text)}<span id="cnt"></span>`;
    buttonsHtml = `<a class="go ext" href="${esc(s.signupUrl)}" target="_blank" rel="noopener" id="signup">Sign up at ${esc(host)} <span aria-hidden="true">↗</span></a><button class="small" type="button" id="ics">Add to calendar</button>`;
    summary = `${w.text} at ${location}. Free. ${s.description}`;
  } else if (w.scheduled) {
    tileHtml = `<div class="tile" aria-hidden="true"><div class="m">${w.month}</div><div class="d">${w.dayNum}</div></div>`;
    statusLineHtml = `${esc(w.text)}<span id="cnt">${s.count ? ` · ${s.count} going` : ''}</span>`;
    buttonsHtml = '<button class="go" type="button" id="main" aria-pressed="false">RSVP</button><button class="small" type="button" id="ics">Add to calendar</button>';
    summary = `${w.text} at ${location}. Free. ${s.description}`;
  } else {
    // No big count tile on an idea, and no count at all until someone wants it.
    tileHtml = '';
    statusLineHtml = `Not scheduled yet<span id="cnt">${wantLine(s.count)}</span>`;
    buttonsHtml = '<button class="go in" type="button" id="main" aria-pressed="false">I want this</button>';
    summary = `A free AI session idea in New Orleans.${s.count ? ` ${s.count} ${s.count === 1 ? 'person wants' : 'people want'} it.` : ''} ${s.description}`;
  }
  return fill(t.session, {
    head: head(t, siteUrl, {
      path: `/sessions/${s.slug}`, title: sessionTitle(s, w), ogTitle: s.title, description: clip(summary), ogType: w.scheduled ? 'event' : 'website',
      ogImage: `/og/sessions/${s.slug}.png?v=${shareVersion(s)}`, ogImageAlt: `${s.title}. ${w.scheduled ? w.text : 'Not scheduled yet'}. A free AI session in New Orleans.`,
      noindex: s.example,
      jsonLdHtml: w.scheduled && !s.example ? graph(sessionEvent(s, siteUrl, location)) : '',
    }),
    header: header(t),
    footer: footer(t.footer),
    sheet: t.sheet,
    slug: s.slug,
    title: s.title,
    status: s.status,
    count: s.count,
    startsAt: s.startsAt || '',
    location,
    // The usual place links to /where (address, parking, rooms); a guide's own place is plain text.
    locationHtml: location === DEFAULT_LOCATION ? `<a href="/where">${esc(location)}</a>` : esc(location),
    lengthMin: s.lengthMin,
    sideHtml: s.signupUrl
      ? '<p>Bring a laptop if you have one.</p>'
      : `<p>Bring a laptop if you have one, and something real you want to get done.</p>
    <p>Know this stuff? <a href="#" id="guide">${s.guides.length ? 'I could help guide' : 'I could guide this'}</a></p>`,
    descriptionHtml: linkify(s.description),
    when: w.text,
    level: LEVELS[s.level],
    kind: s.kind,
    kindName: KINDS[s.kind].name,
    kindPromise: KINDS[s.kind].promise,
    guidesHtml: s.guides.length ? s.guides.map((g) => guideHtml(g, faculty)).join(', ') : 'Looking for a guide',
    tileHtml,
    statusLineHtml,
    buttonsHtml,
  });
}

// ---------- faculty ----------
// A round photo (or initials on a soft color when there's no photo yet); groups get a rounded square.
export function avatarHtml(f, size = '') {
  const inner = f.photo ? `<img src="${esc(f.photo)}" alt="" loading="lazy">` : esc(initials(f.name));
  return `<span class="av av-${tint(f.slug)}${f.isGroup ? ' grp' : ''}${size ? ` ${size}` : ''}" aria-hidden="true">${inner}</span>`;
}

// One faculty member's page: who they are, their links, the sessions they lead, and what they're working on.
// t: { faculty, head, header, footer, sheet } template strings. sessions: every visible session.
export function facultyPage(t, siteUrl, f, sessions) {
  const mine = allSessionsFor(f, sessions);
  const sessionHtml = ({ s, via }) => {
    const w = when(s);
    const lead = w.scheduled ? `<div class="tile" aria-hidden="true"><div class="m">${w.month}</div><div class="d">${w.dayNum}</div></div>` : '<div class="tile w" aria-hidden="true"><div class="m">idea</div><div class="d">?</div></div>';
    return `<li><a class="fs" href="/sessions/${esc(s.slug)}">${lead}<span class="fs-body"><span class="fs-when"><span class="kind k-${esc(s.kind)}">${esc(KINDS[s.kind].name)}</span>${esc(w.scheduled ? `${w.day} · ${w.startClock}` : 'Not scheduled yet')}</span><span class="fs-title">${esc(s.title)}</span>${via ? `<span class="fs-via">With ${esc(via.name)}</span>` : ''}</span></a></li>`;
  };
  const projectHtml = (p) => `<li class="fproj${p.image ? ' has-img' : ''}">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ''}<div><h3>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)} <span aria-hidden="true">↗</span></a>` : esc(p.name)}</h3>${p.about ? `<p>${linkify(p.about)}</p>` : ''}</div></li>`;
  const people = f.people || [], groups = f.groups || [];
  const personHtml = (p) => `<li><a class="fperson" href="/faculty/${esc(p.slug)}">${avatarHtml(p)}${p.title ? `<span class="ftitle">${esc(p.title)}</span>` : ''}<span class="fc-n">${esc(p.name)}</span><span class="fc-r">${esc(p.role)}</span></a></li>`;
  const groupChip = (g) => `<li><a href="/faculty/${esc(g.slug)}">${avatarHtml(g, 'sm')}${esc(g.name)}</a></li>`;
  const first = f.isGroup ? f.name : f.name.split(/\s+/)[0];
  const type = f.isGroup ? 'Organization' : 'Person';
  return fill(t.faculty, {
    head: head(t, siteUrl, {
      path: `/faculty/${f.slug}`,
      title: clip(`${f.name} · AI January faculty`, 60),
      description: clip(`${f.name}${f.role ? `, ${f.role}` : ''}, ${mine.length ? `leads ${mine.length === 1 ? 'a free AI session' : 'free AI sessions'} at` : 'is on the faculty of'} AI January in New Orleans. ${f.bio}`),
      ogType: f.isGroup ? 'website' : 'profile',
      jsonLdHtml: graph({ '@type': type, name: f.name, url: `${siteUrl}/faculty/${f.slug}`, ...(f.role ? { [f.isGroup ? 'description' : 'jobTitle']: f.role } : {}), ...(f.links.length ? { sameAs: f.links.map((l) => l.url) } : {}), ...(groups.length ? { memberOf: groups.map((g) => ({ '@type': 'Organization', name: g.name, url: `${siteUrl}/faculty/${g.slug}` })) } : {}), ...(people.length ? { member: people.map((p) => ({ '@type': 'Person', name: p.name, url: `${siteUrl}/faculty/${p.slug}` })) } : {}) }),
    }),
    header: header(t),
    footer: footer(t.footer),
    sheet: t.sheet,
    name: f.name,
    role: f.role,
    avatarHtml: avatarHtml(f, 'xl'),
    linksHtml: f.links.length ? `<ul class="flinks">${f.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} <span aria-hidden="true">↗</span></a></li>`).join('')}</ul>` : '',
    groupsHtml: groups.length ? `<div class="fpart"><span class="fpart-h">Part of</span><ul>${groups.map(groupChip).join('')}</ul></div>` : '',
    peopleHtml: people.length ? `<section class="fsec" aria-labelledby="ppl"><h2 class="as-h3" id="ppl">People at ${esc(f.name)}</h2><ul class="fpeople">${people.map(personHtml).join('')}</ul></section>` : '',
    bioHtml: f.bio ? `<p class="fbio">${linkify(f.bio)}</p>` : '',
    // No session yet: leave the section out entirely (no "coming soon").
    sessionsHtml: mine.length ? `<section class="fsec" aria-labelledby="leads"><h2 class="as-h3" id="leads">${f.isGroup ? 'Sessions they lead' : `Sessions ${esc(first)} leads`}</h2><ul class="fsessions">${mine.map(sessionHtml).join('')}</ul></section>` : '',
    projectsHtml: f.projects.length ? `<section class="fsec" aria-labelledby="wo"><h2 class="as-h3" id="wo">What ${esc(f.isGroup ? 'they’re' : `${first}’s`)} working on</h2><ul class="fprojects">${f.projects.map(projectHtml).join('')}</ul></section>` : '',
  });
}

// ---------- sitemap and llms.txt ----------
// The build writes both with a marker where the sessions go; the Worker fills it in from D1 on request.
// Example sessions stay out, so search engines never list made-up guides and dates.
export const SESSIONS_MARK = '<!--sessions-->';
const listed = (sessions) => sessions.filter((s) => !s.example);

// Each session carries <lastmod> from its last edit, so search engines come back when a session changes.
const lastmod = (s) => (s.updatedAt ? `<lastmod>${esc(s.updatedAt.slice(0, 10))}</lastmod>` : '');
export const sitemapWithSessions = (xml, siteUrl, sessions) =>
  xml.replace(SESSIONS_MARK, listed(sessions).map((s) => `  <url><loc>${esc(`${siteUrl}/sessions/${s.slug}`)}</loc>${lastmod(s)}</url>`).join('\n')).replace(/\n\n+/g, '\n');

export function llmsWithSessions(txt, siteUrl, sessions) {
  const lines = listed(sessions).filter((s) => s.status === 'scheduled').map((s) => {
    const w = when(s);
    return `- [${s.title}](${siteUrl}/sessions/${s.slug}): ${w.day}, ${w.startClock}. ${s.description}`;
  });
  return txt.replace(SESSIONS_MARK, lines.length ? `\n## Scheduled sessions\n\n${lines.join('\n')}\n` : '');
}
