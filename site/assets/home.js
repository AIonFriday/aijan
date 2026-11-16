// Home page: the hero's "First up" card (the next session and its RSVP) and topic tiles (pick one or more, then open
// /sessions by topic), then three parts:
// "It starts Friday, Jan 8" (the kickoff big, then the next four), "What do you want to learn?" (top ideas, the AI for…
// buttons, and a box to suggest one), and "Could you lead one?" (the faculty row with "You?" first).
// The page ends with "Ready to come?": RSVP to the same next session, or the calendar. Everything else lives on /sessions. Session data comes from /assets/sessions.js (window.AJ_DATA).
(() => {
  const { $, esc, say, act, countFor, wantText, NEEDED, TOPICS, fmt, wantLine, guideLine, byTime, byWant, me, wireButtons, kindTag } = window.AJ;
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

  const day = (s) => { const d = fmt(s.startsAt); return { ...d, label: `${d.w}, ${d.m.charAt(0)}${d.m.slice(1).toLowerCase()} ${d.d}` }; };
  const { signupLink, timeOf, away, placeName } = window.AJ;
  // A partner event (like Hack Dat) takes sign-ups on its own site, so it gets a link out instead of RSVP.
  const rsvp = (s) => { if (s.signupUrl) return signupLink(s); const on = me.going.has(s.slug); return `<button class="go" type="button" data-act="rsvp" aria-pressed="${on}">${on ? 'Going ✓' : 'RSVP'}</button>`; };
  const going = (s) => (countFor(s) && !s.signupUrl ? ` · ${countFor(s)} going` : '');
  const at = (s) => (away(s) ? ` · At ${esc(placeName(s))}` : '');

  // The first session, big: right now that's the AI Friday kickoff.
  const kick = (s) => `<div class="kick" data-slug="${s.slug}"><div class="when2">${kindTag(s)}${day(s).label} · ${timeOf(s)}</div>
    <a class="title" href="/sessions/${s.slug}">${esc(s.title)}</a><p class="meta">${guideLine(s)}${going(s)}${at(s)}</p><div class="act">${rsvp(s)}</div></div>`;
  // The next few, as list rows like /sessions.
  const row = (s) => { const d = day(s); return `<li class="s" data-slug="${s.slug}"><div class="lead"><div class="cal" aria-hidden="true"><div class="m">${d.m}</div><div class="d">${d.d}</div></div></div>
    <div class="body"><div class="when2">${kindTag(s)}${d.w} · ${timeOf(s)}${going(s)}</div><a class="title" href="/sessions/${s.slug}">${esc(s.title)}</a><p class="meta">${guideLine(s)}${at(s)}</p></div>
    <div class="act">${rsvp(s)}</div></li>`; };

  // An idea: what it is, who'd guide it, how many want it, and "I want this".
  function idea(s) {
    const n = countFor(s);
    const on = me.want.has(s.slug);
    const lvl = s.level === 'all' ? '' : ` · ${LEVELS[s.level]}`;
    return `<li class="hc idea" data-slug="${s.slug}">
      <div class="when2">${kindTag(s)}${n >= NEEDED ? wantLine(n) : ''}</div>
      <a class="title" href="/sessions/${s.slug}">${esc(s.title)}</a>
      <p class="meta">${guideLine(s)}${lvl}</p>
      <div class="hc-row"><span class="meta">${wantText(n)}</span><span class="act"><button class="go in" type="button" data-act="want" aria-pressed="${on}">${on ? 'Want it ✓' : 'I want this'}</button></span></div></li>`;
  }
  // "AI for teachers" and the like: one row of buttons, same as /sessions.
  const groupName = (s) => { const w = s.title.replace(/^AI for (your )?/i, ''); return w.charAt(0).toUpperCase() + w.slice(1); };
  const pill = (s) => { const n = countFor(s); const on = me.want.has(s.slug);
    return `<li data-slug="${s.slug}"><button type="button" class="pill" data-act="want" aria-pressed="${on}" aria-label="${esc(s.title)}${n ? `: ${wantText(n)}` : ''}">${on ? '✓ ' : ''}${esc(groupName(s))}${n ? ` <small>${wantText(n)}</small>` : ''}</button></li>`; };

  function render() {
    const now = new Date().toISOString();
    const next = S.filter((s) => s.status === 'scheduled' && new Date(s.startsAt).toISOString() >= now).sort(byTime);
    const all = S.filter((s) => s.status === 'scheduled').length;
    $('#first').innerHTML = next.length
      ? kick(next[0]) + (next.length > 1 ? `<ul class="list">${next.slice(1, 5).map(row).join('')}</ul>` : '')
      : '<p class="empty">That’s a wrap for this January. Thanks for coming.</p>';
    const f = next[0];
    if (f) {
      const fu = $('#firstup'); fu.hidden = false; fu.dataset.slug = f.slug;
      fu.innerHTML = `<span class="fu-l">First up</span><a class="fu-t" href="/sessions/${f.slug}">${esc(f.title)}</a><span class="fu-w">${day(f).label} · ${timeOf(f)}</span>${rsvp(f)}`;
    }
    // The closing "Ready to come?" box: RSVP to the same next session, then the calendar.
    const end = $('#end-row');
    end.dataset.slug = f ? f.slug : '';
    end.innerHTML = (f && f.signupUrl ? signupLink(f, 'btn-big') : f ? `<button class="btn-big" type="button" data-act="rsvp" aria-pressed="${me.going.has(f.slug)}">${me.going.has(f.slug) ? 'Going ✓' : `RSVP to ${esc(f.title.replace(/^AI Friday: /, ''))}`}</button>` : '') + '<a class="end-link" href="/sessions">See the calendar →</a>';
    $('#more').textContent = all > 5 ? `See all ${all} on the calendar →` : 'See the full calendar →';
    const ideas = S.filter((s) => s.status === 'proposed' && s.kind !== 'group').sort(byWant);
    const groups = S.filter((s) => s.status === 'proposed' && s.kind === 'group').sort(byWant);
    $('#close').innerHTML = ideas.length ? ideas.slice(0, 3).map(idea).join('') : '';
    $('#ai-for').hidden = !groups.length;
    $('#list-for').innerHTML = groups.map(pill).join('');
  }

  // Ideas never create a session. Organizers review every one first.
  $('#post').addEventListener('click', () => {
    const text = $('#idea').value.trim();
    if (!text) { say('Type your idea first.'); $('#idea').focus(); return; }
    act({ type: 'suggest', text });
  });

  // The faculty row: "You?" first (we're looking for more), then everyone leading a session. Swipe on phones, wraps on wide screens.
  (function facultyRow() {
    const F = window.AJ.FACULTY;
    const you = '<li><a class="fac-i fac-open" href="/guide"><span class="av av-open" aria-hidden="true">+</span><span class="fac-n">You?</span><span class="fac-r">Lead a session</span></a></li>';
    const item = (f) => `<li><a class="fac-i" href="/faculty/${f.slug}">${window.AJ.avatar(f)}<span class="fac-n">${esc(f.name)}</span><span class="fac-r">${esc(f.role)}</span></a></li>`;
    $('#fac').innerHTML = you + F.map(item).join('');
    $('#fac-head').hidden = !F.length;
  })();

  wireButtons($('main'));
  wireButtons($('#firstup'));
  wireButtons($('.end-cta'));
  document.addEventListener('aj:change', (e) => {
    render();
    if (e.detail.tap?.type === 'suggest') {
      $('#propose-box').innerHTML = '<div class="thanks"><b>Thanks, got it.</b> We review every idea. If it’s a fit, we’ll post it with you as the first one in and email you.</div>';
      if (e.detail.afterSignIn) $('#propose-box').scrollIntoView({ block: 'center' });
    }
  });
  render();
})();
