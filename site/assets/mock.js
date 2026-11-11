// MOCKUP ONLY (front page flow, Nov 2026): drives /mock-a, /mock-b and /mock-c. Not linked from anywhere; delete once Andrew picks.
// Uses the same data as the home page (window.AJ_DATA), with live counts from Nov 11 laid on top so the screenshots look real.
(() => {
  const { $, esc, countFor, wantText, NEEDED, TOPICS, fmt, guideLine, byTime, byWant, me, wireButtons, kindTag, avatar } = window.AJ;
  const D = window.AJ_DATA;
  const LIVE = { 'ai-friday-kickoff': 5, 'build-a-game-with-ai': 2, 'my-brain-is-at-capacity-ai-for-work-life-and-everyday-chaos': 3, 'ai-for-artists': 1, 'ai-for-nonprofits': 3, 'ai-for-small-business': 2, 'write-like-you': 3, 'past-the-chat-box': 1, 'spot-ai-fakes-and-scams': 1, 'first-hour-with-ai': 1 };
  const S = D.sessions.filter((s) => s.slug !== 'office-hours-jan-21').map((s) => ({ ...s, count: LIVE[s.slug] ?? s.count }));
  const F = window.AJ.FACULTY;
  const V = document.body.dataset.mock;

  // The hero's topic tiles, same as the home page.
  const picked = new Set();
  $('#ask').innerHTML = TOPICS.map(([k, v, hint]) => `<button type="button" data-t="${k}" aria-pressed="false">${v}<span>${hint}</span></button>`).join('') +
    '<div class="ask-foot"><button type="button" class="go" id="ask-go" hidden>Show me sessions</button><a class="all" href="/sessions">Just show me everything</a></div>';
  $('#ask').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (b) { picked.has(b.dataset.t) ? picked.delete(b.dataset.t) : picked.add(b.dataset.t); b.setAttribute('aria-pressed', picked.has(b.dataset.t)); $('#ask-go').hidden = !picked.size; }
    else if (e.target.closest('#ask-go')) location.href = '/sessions?topic=' + TOPICS.map(([k]) => k).filter((k) => picked.has(k)).join(',');
  });

  const sched = S.filter((s) => s.status === 'scheduled').sort(byTime);
  const ideas = S.filter((s) => s.status === 'proposed' && s.kind !== 'group').sort(byWant);
  const groups = S.filter((s) => s.kind === 'group').sort(byWant);
  const nums = { sched: sched.length, ideas: ideas.length + groups.length, faculty: F.length };
  document.querySelectorAll('[data-n]').forEach((el) => { el.textContent = nums[el.dataset.n]; });

  const day = (s) => { const d = fmt(s.startsAt); return `${d.w}, ${d.m.charAt(0)}${d.m.slice(1).toLowerCase()} ${d.d}`; };
  const rsvp = (s) => { const on = me.going.has(s.slug); return `<button class="go" type="button" data-act="rsvp" aria-pressed="${on}">${on ? 'Going ✓' : 'RSVP'}</button>`; };
  const want = (s) => { const on = me.want.has(s.slug); return `<button class="go in" type="button" data-act="want" aria-pressed="${on}">${on ? 'Want it ✓' : 'I want this'}</button>`; };

  // A short line for a scheduled session: date block, title, guide, RSVP.
  const row = (s) => { const d = fmt(s.startsAt); const n = countFor(s); return `<li class="mrow" data-slug="${s.slug}">
    <div class="cal" aria-hidden="true"><div class="m">${d.m}</div><div class="d">${d.d}</div></div>
    <div class="body"><div class="when2">${kindTag(s)}${d.w} · ${d.t}${n ? ` · ${n} going` : ''}</div><a class="title" href="/sessions/${s.slug}">${esc(s.title)}</a><p class="meta">${guideLine(s)}</p></div>
    <div class="act">${rsvp(s)}</div></li>`; };
  // An idea card, same as the home page's.
  const idea = (s) => { const n = countFor(s); return `<li class="hc idea" data-slug="${s.slug}"><div class="when2">${kindTag(s)}${n >= NEEDED ? 'Enough people · scheduling soon' : ''}</div>
    <a class="title" href="/sessions/${s.slug}">${esc(s.title)}</a><p class="meta">${guideLine(s)}</p>
    <div class="hc-row"><span class="meta">${wantText(n)}</span><span class="act">${want(s)}</span></div></li>`; };
  const pill = (s) => { const n = countFor(s); const on = me.want.has(s.slug); return `<li data-slug="${s.slug}"><button type="button" class="pill" data-act="want" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(s.title.replace(/^AI for /, ''))}${n ? ` <small>${wantText(n)}</small>` : ''}</button></li>`; };
  const faces = (list) => list.map((f) => `<li><a class="fac-i" href="/faculty/${f.slug}">${avatar(f)}<span class="fac-n">${esc(f.name)}</span><span class="fac-r">${esc(f.role)}</span></a></li>`).join('');

  function render() {
    if ($('#m-sched')) {
      // A: every scheduled session, grouped by week.
      const weeks = {};
      for (const s of sched) { const d = new Date(s.startsAt); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); (weeks[mon.toISOString().slice(0, 10)] ||= []).push(s); }
      $('#m-sched').innerHTML = Object.entries(weeks).map(([k, list]) => { const m = new Date(k + 'T12:00:00'); return `<li class="mweek"><h4>Week of Jan ${m.getDate()}</h4><ul class="mlist">${list.map(row).join('')}</ul></li>`; }).join('');
    }
    if ($('#m-grid')) {
      // B: the 16 weekdays, Jan 8 to 29. Filled days list their sessions; open days say so.
      const days = [];
      for (let d = 4; d <= 28; d++)  // Jan 29 is off: parades start { const dt = new Date(Date.UTC(2027, 0, d, 18)); const wd = dt.getUTCDay(); if (wd === 0 || wd === 6) continue; days.push(d); }
      $('#m-grid').innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((w) => `<li class="gh" aria-hidden="true">${w}</li>`).join('') + days.map((d) => {
        if (d < 8) return '<li class="gd pre" aria-hidden="true"></li>';
        const list = sched.filter((s) => fmt(s.startsAt).key === `2027-01-${String(d).padStart(2, '0')}`);
        const wd = new Date(Date.UTC(2027, 0, d, 18)).toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });
        if (d === 18) return `<li class="gd off"><span class="gn"><span class="gw">${wd} </span>Jan 18</span><span class="gx">MLK Day</span></li>`;
        if (!list.length) return `<li class="gd open"><span class="gn"><span class="gw">${wd} </span>Jan ${d}</span><span class="gx">Open</span></li>`;
        return `<li class="gd full"><span class="gn"><span class="gw">${wd} </span>Jan ${d}</span>${list.map((s) => `<a class="gs k-${s.kind}" href="/sessions/${s.slug}"><b>${fmt(s.startsAt).t}</b> ${esc(s.title)}</a>`).join('')}</li>`;
      }).join('');
      $('#m-open').textContent = days.filter((d) => d >= 8 && d !== 18 && !sched.some((s) => fmt(s.startsAt).key === `2027-01-${String(d).padStart(2, '0')}`)).length;
    }
    if ($('#m-first')) {
      // C: the kickoff, big, then a short line of what follows.
      const [k, ...rest] = sched;
      $('#m-first').innerHTML = `<div class="kick" data-slug="${k.slug}"><div class="when2">${kindTag(k)}${day(k)} · ${fmt(k.startsAt).t}</div><a class="title" href="/sessions/${k.slug}">${esc(k.title)}</a><p class="meta">${guideLine(k)}${countFor(k) ? ` · ${countFor(k)} going` : ''}</p><div class="act">${rsvp(k)}</div></div>
        <ul class="mlist">${rest.slice(0, 4).map(row).join('')}</ul>`;
      $('#m-more').textContent = `See all ${sched.length} on the calendar →`;
    }
    if ($('#m-ideas')) $('#m-ideas').innerHTML = ideas.slice(0, 3).map(idea).join('');
    if ($('#m-for')) $('#m-for').innerHTML = groups.map(pill).join('');
    if ($('#m-fac')) {
      const you = `<li class="you"><a class="fac-i fac-open" href="/guide"><span class="av av-open" aria-hidden="true">+</span><span class="fac-n">You?</span><span class="fac-r">Lead a session</span></a></li>`;
      // D puts "You?" first, ahead of the people already signed up.
      $('#m-fac').innerHTML = $('#m-fac').classList.contains('you-first') ? you + faces(F) : faces(F) + you;
    }
    if ($('#m-stack')) $('#m-stack').innerHTML = F.filter((f) => f.photo).slice(0, 5).map((f) => avatar(f, 'sm')).join('');
  }
  document.querySelectorAll('.mock-wire').forEach(wireButtons);
  document.addEventListener('aj:change', render);
  render();
  void V;
})();
