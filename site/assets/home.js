// Home page: the hero's topic tiles (they open /sessions by topic) and two short highlights:
// "Coming up" (the next three sessions) and "Almost there" (the three ideas closest to five people).
// Everything else lives on /sessions. Session data comes from /assets/sessions.js (window.AJ_DATA).
(() => {
  const { $, esc, countFor, NEEDED, TOPICS, fmt, wantLine, byTime, byWant, me, wireButtons } = window.AJ;
  const { levels: LEVELS, sessions: S } = window.AJ_DATA;

  $('#ask').innerHTML =
    TOPICS.map(([k, v, hint]) => `<a href="/sessions?topic=${k}">${v}<span>${hint}</span></a>`).join('') +
    '<a class="all" href="/sessions">Just show me everything</a>';

  // A short card: when (or how close it is), the title, who guides it, and one button.
  function hcard(s) {
    const sched = s.status === 'scheduled';
    const n = countFor(s);
    const mine = sched ? me.going.has(s.slug) : me.want.has(s.slug);
    const d = sched && fmt(s.startsAt);
    const who = s.guides.length ? `Guided by ${esc(s.guides.join(', '))}` : 'Needs a guide';
    const lvl = s.level === 'all' ? '' : ` · ${LEVELS[s.level]}`;
    const btn = sched
      ? `<button class="go" type="button" data-act="rsvp" aria-pressed="${mine}">${mine ? 'Going ✓' : 'RSVP'}</button>`
      : `<button class="go in" type="button" data-act="want" aria-pressed="${mine}">${mine ? 'Want it ✓' : 'I want this'}</button>`;
    return `<li class="hc${sched ? '' : ' idea'}" data-slug="${s.slug}">
      <div class="when2">${sched ? `${d.w}, ${d.m.charAt(0)}${d.m.slice(1).toLowerCase()} ${d.d} · ${d.t}` : wantLine(n)}</div>
      <a class="title" href="/sessions/${s.slug}">${esc(s.title)}</a>
      <p class="meta">${who}${lvl}</p>
      <div class="hc-row"><span class="meta">${sched ? `${n} going` : `${Math.min(n, NEEDED)} of ${NEEDED} want it`}</span><span class="act">${btn}</span></div></li>`;
  }

  function render() {
    const now = new Date().toISOString();
    const next = S.filter((s) => s.status === 'scheduled' && new Date(s.startsAt).toISOString() >= now).sort(byTime).slice(0, 3);
    const close = S.filter((s) => s.status === 'proposed').sort(byWant).slice(0, 3);
    $('#next').innerHTML = next.length ? next.map(hcard).join('') : '<li class="empty">That’s a wrap for this January. Thanks for coming.</li>';
    $('#close').innerHTML = close.length ? close.map(hcard).join('') : '<li class="empty">No ideas waiting right now. <a href="/sessions#suggest">Suggest one</a>.</li>';
  }

  wireButtons($('.highlights'));
  document.addEventListener('aj:change', render);
  render();
})();
