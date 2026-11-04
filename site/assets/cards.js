// Shared session list pieces for the home page and /sessions: topics, date formatting, one list row,
// and the RSVP / "I want this" buttons. Load after app.js and sessions.js. Adds to window.AJ.
(() => {
  const { esc, me, act, countFor, NEEDED } = window.AJ;
  const { levels: LEVELS, timeZone: tz } = window.AJ_DATA;

  // What people want to use AI for. Keys match "topics" in data/sessions.json.
  const TOPICS = [
    ['work', 'My job', 'Your work, business or nonprofit'],
    ['life', 'Home and family', 'Meals, money, kids, trips'],
    ['make', 'Making things', 'Art, writing, a small website'],
    ['curious', 'Just curious', 'See what it can do'],
  ];

  // Every time is shown in New Orleans time, whatever the visitor's clock says.
  const fmt = (iso) => {
    const d = new Date(iso);
    const part = (o) => d.toLocaleString('en-US', { timeZone: tz, ...o });
    return {
      m: part({ month: 'short' }).toUpperCase(),
      d: part({ day: 'numeric' }),
      w: part({ weekday: 'short' }),
      t: part({ hour: 'numeric', minute: '2-digit' }).replace(':00', ''),
      // YYYY-MM-DD in New Orleans, for putting a session on a calendar day.
      key: d.toLocaleDateString('en-CA', { timeZone: tz }),
    };
  };

  const wantLine = (n) => (n >= NEEDED ? 'Enough people · scheduling soon' : `${NEEDED - n} more and we schedule it`);
  const byTime = (a, b) => (a.startsAt > b.startsAt ? 1 : -1);
  const byWant = (a, b) => countFor(b) - countFor(a);

  function card(s) {
    const sched = s.status === 'scheduled';
    const mine = sched ? me.going.has(s.slug) : me.want.has(s.slug);
    const n = countFor(s);
    let lead, when, btn;
    if (sched) {
      const d = fmt(s.startsAt);
      lead = `<div class="cal" aria-hidden="true"><div class="m">${d.m}</div><div class="d">${d.d}</div></div>`;
      when = `${d.w} · ${d.t} · ${n} going`;
      btn = `<button class="go" type="button" data-act="rsvp" aria-pressed="${mine}">${mine ? 'Going ✓' : 'RSVP'}</button>`;
    } else {
      lead = `<div class="want" aria-hidden="true"><div class="d">${n}</div><div class="m">want it</div></div>`;
      when = wantLine(n);
      btn = `<button class="go in" type="button" data-act="want" aria-pressed="${mine}">${mine ? 'Want it ✓' : 'I want this'}</button>`;
    }
    const who = s.guides.length ? `Guided by ${esc(s.guides.join(', '))}` : 'Needs a guide';
    const lvl = s.level === 'all' ? '' : ` · ${LEVELS[s.level]}`;
    return `<li class="s" data-slug="${s.slug}"><div class="lead">${lead}</div>
      <div class="body"><div class="when2">${when}</div>
        <a class="title" href="/sessions/${s.slug}">${esc(s.title)}</a>
        <p class="meta">${who}${lvl}</p></div>
      <div class="act">${btn}</div></li>`;
  }

  // One click handler for every RSVP and "I want this" button inside `root`.
  function wireButtons(root) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const slug = b.closest('[data-slug]').dataset.slug;
      const set = b.dataset.act === 'rsvp' ? me.going : me.want;
      act({ type: b.dataset.act, slug, on: !set.has(slug) });
    });
  }

  Object.assign(window.AJ, { TOPICS, fmt, card, wantLine, byTime, byWant, wireButtons });
})();
