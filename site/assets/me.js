// My sessions (/me): what someone has RSVPed to, wants, and offered to guide. Someone we don't know on this
// device types their email and gets a one-time link here.
// Session details come from /assets/sessions.js (window.AJ_DATA); what they picked comes from /api/me.
(() => {
  const { $, esc, me, act, emailLink, isEmail, lastEmail, countFor, wantText, NEEDED } = window.AJ;
  const { sessions: S, timeZone: tz } = window.AJ_DATA;
  const bySlug = new Map(S.map((s) => [s.slug, s]));

  const fmt = (iso) => {
    const d = new Date(iso);
    const part = (o) => d.toLocaleString('en-US', { timeZone: tz, ...o });
    return { m: part({ month: 'short' }).toUpperCase(), d: part({ day: 'numeric' }), w: part({ weekday: 'short' }), t: part({ hour: 'numeric', minute: '2-digit' }).replace(':00', '') };
  };

  function row(s, kind) {
    const n = countFor(s);
    let lead = '', when, btn = '';
    if (s.status === 'scheduled') {
      const d = fmt(s.startsAt);
      lead = `<div class="cal" aria-hidden="true"><div class="m">${d.m}</div><div class="d">${d.d}</div></div>`;
      when = `${d.w} · ${d.t}${n ? ` · ${n} going` : ''}`;
    } else {
      when = n >= NEEDED ? 'Enough people · scheduling soon' : wantText(n) || 'Not scheduled yet';
    }
    if (kind === 'rsvp') btn = '<button class="go" type="button" data-act="rsvp" aria-pressed="true">Going ✓</button>';
    if (kind === 'want') btn = '<button class="go in" type="button" data-act="want" aria-pressed="true">Want it ✓</button>';
    return `<li class="s${lead ? '' : ' idea'}" data-slug="${s.slug}">${lead ? `<div class="lead">${lead}</div>` : ''}
      <div class="body"><div class="when2">${when}</div><a class="title" href="/sessions/${s.slug}">${esc(s.title)}</a></div>
      <div class="act">${btn}</div></li>`;
  }

  const list = (slugs, kind) => slugs.map((x) => bySlug.get(x)).filter(Boolean);

  function render() {
    $('#mine-wait').hidden = true;
    $('#mine-out').hidden = me.signedIn;
    $('#mine-in').hidden = !me.signedIn;
    if (!me.signedIn) return;
    const first = (me.user.name || '').split(' ')[0];
    $('#mine-hi').textContent = `${first ? `Hi, ${first}. ` : ''}These are the sessions for ${me.user.email}. Tap a button to change your mind.`;

    const going = list([...me.going]).sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1));
    const want = list([...me.want]).sort((a, b) => countFor(b) - countFor(a));
    const guide = list([...me.guide]);
    $('#list-go').innerHTML = going.length ? going.map((s) => row(s, 'rsvp')).join('') : '<li class="empty">Nothing yet. RSVP to a session on the calendar and it shows up here.</li>';
    $('#list-want').innerHTML = want.length ? want.map((s) => row(s, 'want')).join('') : '<li class="empty">Nothing yet. Tap “I want this” on an idea and it shows up here.</li>';
    $('#n-go').textContent = going.length;
    $('#n-want').textContent = want.length;
    $('#g-guide').hidden = !guide.length;
    $('#list-guide').innerHTML = guide.map((s) => row(s, 'guide')).join('');
    $('#n-guide').textContent = guide.length;
  }

  document.querySelector('.mine').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) act({ type: b.dataset.act, slug: b.closest('.s').dataset.slug, on: false });
  });
  const input = $('#mine-email');
  input.value = lastEmail();
  $('#mine-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    $('#mine-email-err').hidden = isEmail(email);
    if (!isEmail(email)) { input.focus(); return; }
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    if (await emailLink(email)) {
      $('#mine-sent-to').textContent = email;
      $('#mine-sent').hidden = false;
      $('#mine-sent').focus();
    }
    btn.disabled = false;
  });
  document.addEventListener('aj:change', render);
})();
