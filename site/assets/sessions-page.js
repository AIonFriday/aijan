// The Sessions page (/sessions): a calendar view and a by-topic view of everything scheduled,
// plus "Vote for what's next" (ideas that aren't scheduled yet) and "suggest one".
// Session data comes from /assets/sessions.js (window.AJ_DATA). Shared pieces come from cards.js.
//
// Links in: /sessions?topic=work (or ?topic=work,curious for several) opens "By topic" with those topics picked. /sessions#vote jumps to the ideas.
(() => {
  const { $, esc, say, act, me, countFor, wantText, TOPICS, fmt, card, byTime, byWant, wireButtons, away, placeName, timeOf } = window.AJ;
  const { levels: LEVELS, sessions: S } = window.AJ_DATA;

  // The days sessions can land on (Jan 8–28). Days before FIRST show faded. Parades start Jan 29, so nothing is scheduled then.
  const FIRST = '2027-01-08';
  const LAST = '2027-01-28';
  const NOTES = { '2027-01-06': 'Twelfth Night', '2027-01-18': 'MLK Day', '2027-01-29': 'Parades start' };
  // Jan 29 links to the parade schedule: a card in that day's square, plus a note under the calendar.
  const MG = 'https://mardigras.fyi/';
  const PARADE_DAY = '2027-01-29';
  const noteHtml = (k) => (NOTES[k] && k !== PARADE_DAY ? `<small>${NOTES[k]}</small>` : '');
  const parCell = (k) => (k === PARADE_DAY
    ? `<a class="ev mg" href="${MG}" target="_blank" rel="noopener"><b>Parades start</b>See the parade schedule <span aria-hidden="true">↗</span></a>` : '');

  const scheduled = () => S.filter((s) => s.status === 'scheduled').sort(byTime);
  const ideas = () => S.filter((s) => s.status === 'proposed').sort(byWant);

  // ---------- view switch ----------
  const params = new URLSearchParams(location.search);
  let view = params.has('topic') ? 'topic' : 'cal';
  // The topics picked, any number of them. An empty set means every topic.
  const topics = new Set((params.get('topic') || '').split(',').filter((k) => TOPICS.some(([t]) => t === k)));
  let level = 'any';

  $('#views').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    view = b.dataset.view;
    render();
  });

  // ---------- calendar ----------
  // Dates are plain YYYY-MM-DD strings; the math runs in UTC so no clock change can shift a day.
  const day = (key) => new Date(key + 'T12:00:00Z');
  const keyOf = (d) => d.toISOString().slice(0, 10);
  const addDays = (key, n) => { const d = day(key); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); };
  const dow = (key) => day(key).getUTCDay(); // 0 Sunday
  const label = (key, o) => day(key).toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
  const inMonth = (key) => key >= FIRST && key <= LAST;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: window.AJ_DATA.timeZone });

  function byDay() {
    const m = new Map();
    for (const s of scheduled()) {
      const k = fmt(s.startsAt).key;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    }
    return m;
  }

  // Weekdays only, unless something lands on a weekend.
  function weeks(days) {
    const weekend = [...days.keys()].some((k) => inMonth(k) && [0, 6].includes(dow(k)));
    const cols = weekend ? 7 : 5;
    let start = addDays(FIRST, -((dow(FIRST) + 6) % 7)); // the Monday on or before the first day
    const out = [];
    while (start <= LAST) {
      out.push(Array.from({ length: cols }, (_, i) => addDays(start, i)));
      start = addDays(start, 7);
    }
    return { cols, rows: out };
  }

  // The day picked on the phone calendar: the next day with something on it.
  let picked = null;
  function defaultDay(days) {
    const keys = [...days.keys()].filter(inMonth).sort();
    return keys.find((k) => k >= today) || keys[0] || FIRST;
  }

  function renderCal() {
    const days = byDay();
    if (!picked || !inMonth(picked)) picked = defaultDay(days);
    const { cols, rows } = weeks(days);
    const names = rows[0].map((k) => label(k, { weekday: 'short' }));
    const span = (w) => {
      const ins = w.filter(inMonth);
      const a = label(ins[0], { month: 'short', day: 'numeric' });
      const b = label(ins[ins.length - 1], { day: 'numeric' });
      return ins.length > 1 ? `${a}–${b}` : a;
    };

    // Desktop: the whole month with titles.
    const full = names.map((n) => `<div class="mdow">${n}</div>`).join('') + rows.map((w, i) =>
      `<div class="mwk">Week ${i + 1} · ${span(w)}</div>` + w.map((k) => {
        const evs = days.get(k) || [];
        const note = noteHtml(k);
        // A weekend day with nothing on it stays quiet: the month runs on weekdays.
        const quiet = inMonth(k) && !evs.length && [0, 6].includes(dow(k)) ? ' wk' : '';
        return `<div class="mday${inMonth(k) ? '' : ' out'}${quiet}${parCell(k) ? ' mg-day' : ''}"><span class="n">${label(k, { day: 'numeric' })}${note}</span>${
          inMonth(k) ? evs.map((s) => `<a class="ev k-${s.kind}${away(s) ? ' away' : ''}" href="/sessions/${s.slug}"><b>${timeOf(s)}</b>${esc(s.title)}${away(s) ? `<i>${esc(placeName(s))}</i>` : ''}</a>`).join('') : parCell(k)}</div>`;
      }).join('')).join('');
    $('#month-full').style.setProperty('--cols', cols);
    $('#month-full').innerHTML = full;

    // Phone: a grid of dates with a dot per session. Tap a day to list it below.
    const dots = names.map((n) => `<div class="mdow" aria-hidden="true">${n.slice(0, 1)}</div>`).join('') + rows.flat().map((k) => {
      const d = label(k, { day: 'numeric' });
      if (!inMonth(k)) return `<div class="mday out" aria-hidden="true"><span class="n">${d}</span><span class="pip"></span></div>`;
      const n = (days.get(k) || []).length;
      const name = label(k, { weekday: 'long', month: 'long', day: 'numeric' });
      return `<button type="button" class="mday${!n && [0, 6].includes(dow(k)) ? ' wk' : ''}" data-day="${k}" aria-pressed="${k === picked}" aria-label="${name}, ${n ? `${n} session${n > 1 ? 's' : ''}` : 'nothing yet'}">
        <span class="n">${d}</span><span class="pip">${'<i></i>'.repeat(n)}</span></button>`;
    }).join('');
    $('#month-dots').style.setProperty('--cols', cols);
    $('#month-dots').innerHTML = dots;

    const evs = days.get(picked) || [];
    $('#day-head').textContent = label(picked, { weekday: 'long', month: 'short', day: 'numeric' }) + (NOTES[picked] ? ` · ${NOTES[picked]}` : '');
    $('#day-list').innerHTML = evs.length ? evs.map(card).join('')
      : '<li class="empty">Nothing on this day yet. <a href="#vote">Vote for an idea</a> and help fill it.</li>';
  }

  $('#month-dots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    picked = b.dataset.day;
    renderCal();
  });

  // ---------- by topic ----------
  const chip = (k, v, data) => `<button class="chip" type="button" data-${data}="${k}">${v}</button>`;
  $('#tiles').innerHTML = TOPICS.map(([k, v, hint]) => `<button type="button" data-t="${k}">${v}<span>${hint}</span></button>`).join('') +
    '<button type="button" class="all" data-t="all">Show every topic</button>';
  $('#lvl').insertAdjacentHTML('beforeend', [['any', 'Any level'], ...Object.entries(LEVELS).filter(([k]) => k !== 'all')].map(([k, v]) => chip(k, v, 'l')).join(''));
  $('#tiles').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    if (b.dataset.t === 'all') topics.clear();
    else if (topics.has(b.dataset.t)) topics.delete(b.dataset.t);
    else topics.add(b.dataset.t);
    // Keep the address in step so the page can be shared or reloaded with the same picks.
    const picked = TOPICS.map(([k]) => k).filter((k) => topics.has(k)).join(',');
    history.replaceState(null, '', picked ? `?topic=${picked}` : '?topic=all');
    render();
  });
  $('#lvl').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) { level = b.dataset.l; render(); }
  });
  // A session marked "All levels" fits every level.
  const fitsLevel = (s) => level === 'any' || s.level === level || s.level === 'all';

  function renderTopics() {
    document.querySelectorAll('#tiles [data-t]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === 'all' ? !topics.size : topics.has(b.dataset.t)));
    document.querySelectorAll('#lvl .chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.l === level));
    const groups = TOPICS.filter(([k]) => !topics.size || topics.has(k)).map(([k, name]) => {
      const sc = scheduled().filter((s) => s.topics.includes(k) && fitsLevel(s));
      const id = ideas().filter((s) => s.topics.includes(k) && fitsLevel(s));
      if (!sc.length && !id.length) return '';
      const counts = [sc.length && `${sc.length} on the calendar`, id.length && `${id.length} to vote on`].filter(Boolean).join(' · ');
      return `<div class="group"><div class="ghead"><h3>${name}</h3><span>${counts}</span></div>
        <ul class="list">${sc.map(card).join('')}${id.map(card).join('')}</ul></div>`;
    }).join('');
    $('#topic-groups').innerHTML = groups || '<p class="empty">Nothing here yet. <a href="#suggest">Suggest one</a> below.</p>';
  }

  // ---------- vote ----------
  // "For your group" ideas ("AI for teachers") show as one row of buttons, so the list stays short.
  // Everything else gets a full card.
  const isGroup = (s) => s.kind === 'group';
  const groupName = (s) => {
    const w = s.title.replace(/^AI for (your )?/i, '');
    return w.charAt(0).toUpperCase() + w.slice(1);
  };
  function pill(s) {
    const n = countFor(s);
    const on = me.want.has(s.slug);
    return `<li data-slug="${s.slug}"><button type="button" class="pill" data-act="want" aria-pressed="${on}"
      aria-label="${esc(s.title)}${n ? `: ${wantText(n)}` : ''}">${on ? '✓ ' : ''}${esc(groupName(s))}${n ? ` <small>${wantText(n)}</small>` : ''}</button></li>`;
  }
  function renderVote() {
    const list = ideas();
    const topics = list.filter((s) => !isGroup(s));
    const groups = list.filter(isGroup);
    $('#n-vote').textContent = `${list.length} idea${list.length === 1 ? '' : 's'}`;
    $('#list-vote').innerHTML = topics.length ? topics.map(card).join('') : '<li class="empty">No ideas waiting right now. Suggest one below.</li>';
    $('#ai-for').hidden = !groups.length;
    $('#list-for').innerHTML = groups.map(pill).join('');
  }

  // Suggestions never create a session. Organizers review every idea first.
  $('#post').addEventListener('click', () => {
    const text = $('#idea').value.trim();
    if (!text) { say('Type your idea first.'); $('#idea').focus(); return; }
    act({ type: 'suggest', text });
  });

  function render() {
    document.querySelectorAll('#views [data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === view));
    $('#view-cal').hidden = view !== 'cal';
    $('#view-topic').hidden = view !== 'topic';
    if (view === 'cal') renderCal(); else renderTopics();
    renderVote();
  }

  wireButtons($('#sessions-main'));
  document.addEventListener('aj:change', (e) => {
    render();
    if (e.detail.tap?.type === 'suggest') {
      $('#propose-box').innerHTML =
        '<div class="thanks"><b>Thanks, got it.</b> We review every idea. If it’s a fit, we’ll post it with you as the first one in and email you.</div>';
      if (e.detail.afterSignIn) $('#propose-box').scrollIntoView({ block: 'center' });
    }
  });

  render();
})();
