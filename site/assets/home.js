// Home page: the hero's topic tiles (pick one or more, then open /sessions by topic) and two short highlights:
// "Coming up" (the next three sessions) and "What should we do next?" (the three most-wanted ideas).
// Everything else lives on /sessions. Session data comes from /assets/sessions.js (window.AJ_DATA).
(() => {
  const { $, esc, countFor, wantText, NEEDED, TOPICS, fmt, wantLine, guideLine, byTime, byWant, me, wireButtons, kindTag } = window.AJ;
  const { levels: LEVELS, sessions: S } = window.AJ_DATA;

  // Pick as many topics as you like, then "Show me sessions" opens /sessions with all of them.
  const picked = new Set();
  $('#ask').innerHTML =
    TOPICS.map(([k, v, hint]) => `<button type="button" data-t="${k}" aria-pressed="false">${v}<span>${hint}</span></button>`).join('') +
    '<div class="ask-foot"><button type="button" class="go" id="ask-go" hidden>Show me sessions</button>' +
    '<a class="all" href="/sessions">Just show me everything</a></div>';
  $('#ask').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (b) {
      picked.has(b.dataset.t) ? picked.delete(b.dataset.t) : picked.add(b.dataset.t);
      b.setAttribute('aria-pressed', picked.has(b.dataset.t));
      $('#ask-go').hidden = !picked.size;
    } else if (e.target.closest('#ask-go')) {
      // Keep the order the tiles are in, so the same picks always make the same link.
      location.href = '/sessions?topic=' + TOPICS.map(([k]) => k).filter((k) => picked.has(k)).join(',');
    }
  });

  // A short card: when (or how close it is), the title, who guides it, and one button.
  function hcard(s) {
    const sched = s.status === 'scheduled';
    const n = countFor(s);
    const mine = sched ? me.going.has(s.slug) : me.want.has(s.slug);
    const d = sched && fmt(s.startsAt);
    const lvl = s.level === 'all' ? '' : ` · ${LEVELS[s.level]}`;
    const btn = sched
      ? `<button class="go" type="button" data-act="rsvp" aria-pressed="${mine}">${mine ? 'Going ✓' : 'RSVP'}</button>`
      : `<button class="go in" type="button" data-act="want" aria-pressed="${mine}">${mine ? 'Want it ✓' : 'I want this'}</button>`;
    return `<li class="hc${sched ? '' : ' idea'}" data-slug="${s.slug}">
      <div class="when2">${kindTag(s)}${sched ? `${d.w}, ${d.m.charAt(0)}${d.m.slice(1).toLowerCase()} ${d.d} · ${d.t}` : n >= NEEDED ? wantLine(n) : ''}</div>
      <a class="title" href="/sessions/${s.slug}">${esc(s.title)}</a>
      <p class="meta">${guideLine(s)}${lvl}</p>
      <div class="hc-row"><span class="meta">${sched ? (n ? `${n} going` : '') : wantText(n)}</span><span class="act">${btn}</span></div></li>`;
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
