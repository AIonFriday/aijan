// Home page: the "where do you want to start" chips, the two session lists, and "suggest one".
// Session data comes from /assets/sessions.js (window.AJ_DATA), generated from data/sessions.json by `npm run build`.
(() => {
  const { $, esc, me, say, needSignIn } = window.AJ;
  const { levels: LEVELS, sessions: S } = window.AJ_DATA;
  const NEEDED = 5; // "I want this" count that gets an idea scheduled

  // One row of chips. The same choices appear in the hero; tapping there filters and scrolls here.
  const CHOICES = [
    ['all', 'Everything'],
    ['new', 'Brand new to AI'],
    ['work', 'For my job'],
    ['life', 'Home and family'],
    ['make', 'Making things'],
    ['build', 'I build with it'],
  ];
  let pick = 'all';
  const fits = (s) => {
    if (pick === 'all') return true;
    if (pick === 'new') return s.level === 'new' || s.level === 'all';
    if (pick === 'build') return s.level === 'build' || (s.level === 'all' && s.topics.includes('make'));
    return s.topics.includes(pick);
  };

  $('#show').innerHTML = CHOICES.map(([k, v]) => `<button class="chip" type="button" data-k="${k}">${v}</button>`).join('');
  $('#show').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) { pick = b.dataset.k; render(); }
  });
  $('#ask').innerHTML =
    CHOICES.filter(([k]) => k !== 'all').map(([k, v]) => `<button type="button" data-k="${k}">${v}</button>`).join('') +
    '<button type="button" class="all" data-k="all">Just show me everything</button>';
  $('#ask').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    pick = b.dataset.k;
    render();
    $('#find').scrollIntoView({ behavior: 'smooth' });
  });

  // Every time is shown in New Orleans time, whatever the visitor's clock says.
  const tz = window.AJ_DATA.timeZone;
  const fmt = (iso) => {
    const d = new Date(iso);
    const part = (o) => d.toLocaleString('en-US', { timeZone: tz, ...o });
    return {
      m: part({ month: 'short' }).toUpperCase(),
      d: part({ day: 'numeric' }),
      w: part({ weekday: 'short' }),
      t: part({ hour: 'numeric', minute: '2-digit' }).replace(':00', ''),
    };
  };

  function card(s) {
    const sched = s.status === 'scheduled';
    const mine = sched ? me.going.has(s.slug) : me.want.has(s.slug);
    const n = s.count + (mine ? 1 : 0);
    let lead, when, btn;
    if (sched) {
      const d = fmt(s.startsAt);
      lead = `<div class="cal" aria-hidden="true"><div class="m">${d.m}</div><div class="d">${d.d}</div></div>`;
      when = `${d.w} · ${d.t} · ${n} going`;
      btn = `<button class="go" type="button" data-act="rsvp" aria-pressed="${mine}">${mine ? 'Going ✓' : 'RSVP'}</button>`;
    } else {
      lead = `<div class="want" aria-hidden="true"><div class="d">${n}</div><div class="m">want it</div></div>`;
      when = n >= NEEDED ? 'Enough people · scheduling soon' : `${NEEDED - n} more and we schedule it`;
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

  function render() {
    document.querySelectorAll('#show .chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.k === pick));
    const scheduled = S.filter((s) => s.status === 'scheduled' && fits(s)).sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1));
    const ideas = S.filter((s) => s.status === 'proposed' && fits(s)).sort((a, b) => b.count - a.count);
    $('#list-s').innerHTML = scheduled.length ? scheduled.map(card).join('') : '<li class="empty">Nothing on the calendar for this yet.</li>';
    $('#list-p').innerHTML = ideas.length ? ideas.map(card).join('') : '<li class="empty">No ideas here yet. Suggest one below.</li>';
    $('#n-s').textContent = scheduled.length;
    $('#n-p').textContent = ideas.length;
  }

  document.querySelectorAll('.list').forEach((list) =>
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const slug = b.closest('.s').dataset.slug;
      const s = S.find((x) => x.slug === slug);
      const set = b.dataset.act === 'rsvp' ? me.going : me.want;
      if (set.has(slug)) { set.delete(slug); render(); say('Removed. You can change your mind anytime.'); return; }
      needSignIn(() => {
        set.add(slug);
        render();
        if (b.dataset.act === 'rsvp') say('You’re going. We’ll email a reminder the day before.');
        else say(s.count + 1 >= NEEDED ? 'That makes five. We’ll email you a date.' : 'Got it. We’ll email you when it’s scheduled.');
      });
    })
  );

  // Suggestions never create a session. Organizers review every idea first.
  $('#post').addEventListener('click', () => {
    const text = $('#idea').value.trim();
    if (!text) { say('Type your idea first.'); $('#idea').focus(); return; }
    needSignIn(() => {
      $('#propose-box').innerHTML =
        '<div class="thanks"><b>Thanks, got it.</b> We review every idea. If it’s a fit, we’ll post it with you as the first one in and email you.</div>';
    });
  });

  render();
})();
