// Shared helpers for every page: sign-in, the sign-in sheet, saving taps, the toast.
//
// Tap first, sign in second: a signed-out tap is saved in localStorage, the sheet opens, and after sign-in
// (which may leave the page for Google or Apple, or come back through an emailed link) the tap is sent
// for real. Pages listen for the "aj:change" event to repaint.
//
// The server side is src/worker.js. Sign-in uses Better Auth's own routes under /api/auth.
(() => {
  const $ = (q, root = document) => root.querySelector(q);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NEEDED = 5;

  // Who's signed in and what they've tapped. Filled from /api/me.
  const me = { signedIn: false, user: null, going: new Set(), want: new Set(), guide: new Set(), counts: {}, providers: [] };
  const changed = (detail = {}) => document.dispatchEvent(new CustomEvent('aj:change', { detail }));

  let toastTimer;
  function say(message) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3500);
  }

  async function call(path, body) {
    const res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || data.message || 'Something went wrong.'), { status: res.status });
    return data;
  }

  // Live count for a session: the seed count plus taps saved in the database.
  const countFor = (s) => s.count + ((me.counts[s.slug] || {})[s.status === 'scheduled' ? 'rsvp' : 'want'] || 0);

  // ---------- taps ----------
  // A tap is a plain object so it can wait in localStorage while the person signs in.
  //   { type: 'rsvp' | 'want' | 'guide', slug, on }  { type: 'suggest', text }
  //   { type: 'guideOffer', topics, what, level, times, guideAs }  { type: 'krewe', groupName, what, size }
  const PENDING = 'aj-pending';
  const savePending = (tap) => { try { localStorage.setItem(PENDING, JSON.stringify({ tap, at: Date.now() })); } catch {} };
  function takePending() {
    try {
      const raw = localStorage.getItem(PENDING);
      localStorage.removeItem(PENDING);
      const p = raw && JSON.parse(raw);
      return p && Date.now() - p.at < 60 * 60 * 1000 ? p.tap : null; // an hour is long enough to sign in
    } catch { return null; }
  }

  async function send(tap) {
    const sets = { rsvp: me.going, want: me.want, guide: me.guide };
    if (sets[tap.type]) {
      const r = await call(`/api/sessions/${encodeURIComponent(tap.slug)}/${tap.type}`, { on: tap.on !== false, guideAs: tap.guideAs });
      if (r.on) sets[tap.type].add(tap.slug); else sets[tap.type].delete(tap.slug);
      if (tap.type !== 'guide') (me.counts[tap.slug] ||= {})[tap.type] = r.saved;
      if (!r.on) say('Removed. You can change your mind anytime.');
      else if (tap.type === 'rsvp') say('You’re going. We’ll email a reminder the day before.');
      else if (tap.type === 'want') say(r.count >= NEEDED ? `That makes ${r.count}. We’ll email you a date.` : 'Got it. We’ll email you when it’s scheduled.');
      else say('Thanks. An organizer will reach out about guiding.');
      return r;
    }
    const routes = { suggest: '/api/suggestions', guideOffer: '/api/guide-offers', krewe: '/api/krewes' };
    return call(routes[tap.type], tap);
  }

  // Run a tap now if signed in, or after sign-in if not. Resolves once it's saved; pages repaint on "aj:change".
  async function act(tap) {
    await ready;
    if (!me.signedIn) {
      savePending(tap);
      openSheet();
      return;
    }
    try {
      const result = await send(tap);
      changed({ tap, result });
    } catch (e) {
      if (e.status === 401) { me.signedIn = false; savePending(tap); openSheet(); return; }
      say(e.message);
    }
  }

  // ---------- sign-in sheet ----------
  const here = () => location.pathname + location.search;
  function openSheet() {
    const sheet = $('#sheet');
    if (!sheet) return;
    showStep('pick');
    sheet.hidden = false;
    ($('.sso:not([hidden])', sheet) || $('#cancel', sheet)).focus();
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    try { localStorage.removeItem(PENDING); } catch {}
  }
  function showStep(step) {
    const sheet = $('#sheet');
    sheet.querySelectorAll('[data-step]').forEach((el) => (el.hidden = el.dataset.step !== step));
  }

  async function social(provider, button) {
    button.disabled = true;
    try {
      const r = await call('/api/auth/sign-in/social', { provider, callbackURL: here(), errorCallbackURL: withFlag('signin', 'failed') });
      location.href = r.url;
    } catch (e) {
      button.disabled = false;
      say('That didn’t work. Try again, or use another way.');
    }
  }

  async function emailLink(form) {
    const email = $('#sheet-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#sheet-email-err').hidden = false; $('#sheet-email').focus(); return; }
    $('#sheet-email-err').hidden = true;
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      await call('/api/auth/sign-in/magic-link', { email, callbackURL: here(), errorCallbackURL: withFlag('signin', 'expired') });
      $('#sheet-sent-to').textContent = email;
      showStep('sent');
      $('#sheet-done').focus();
    } catch (e) {
      say('We couldn’t send that. Check the address and try again.');
    } finally {
      btn.disabled = false;
    }
  }

  const withFlag = (k, v) => { const u = new URL(location.href); u.searchParams.set(k, v); return u.pathname + u.search; };

  async function signOut() {
    try { await call('/api/auth/sign-out', {}); } catch {}
    location.reload();
  }

  // ---------- start ----------
  const ready = call('/api/me')
    .then((r) => {
      me.signedIn = !!r.user;
      me.user = r.user;
      me.going = new Set(r.rsvp);
      me.want = new Set(r.want);
      me.guide = new Set(r.guide);
      me.counts = r.counts || {};
      me.providers = r.providers || [];
    })
    .catch(() => {}); // offline or sign-in not set up yet: the site still reads fine

  document.addEventListener('DOMContentLoaded', async () => {
    const sheet = $('#sheet');
    if (sheet) {
      sheet.querySelectorAll('[data-sso]').forEach((b) =>
        b.addEventListener('click', () => (b.dataset.sso === 'email' ? (showStep('email'), $('#sheet-email').focus()) : social(b.dataset.sso, b)))
      );
      $('#sheet-email-form').addEventListener('submit', (e) => { e.preventDefault(); emailLink(e.target); });
      sheet.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { showStep('pick'); $('.sso:not([hidden])', sheet)?.focus(); }));
      $('#cancel').addEventListener('click', closeSheet);
      $('#sheet-done').addEventListener('click', () => (sheet.hidden = true)); // keep the tap waiting for the emailed link
      sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
    }
    document.querySelectorAll('[data-signout]').forEach((b) => b.addEventListener('click', signOut));

    await ready;
    if (sheet) {
      sheet.querySelectorAll('[data-sso]').forEach((b) => (b.hidden = !me.providers.includes(b.dataset.sso)));
      $('#sheet-off').hidden = me.providers.length > 0;
    }
    const acct = $('#acct');
    if (acct && me.signedIn) acct.innerHTML = '<span class="long">My sessions</span><span class="short">Mine</span>';

    // Back from Google, Apple, or an emailed link.
    const params = new URLSearchParams(location.search);
    const flag = params.get('signin') || params.get('error');
    if (flag) {
      params.delete('signin');
      params.delete('error');
      history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
      say(flag === 'expired' || /expired|invalid/i.test(flag) ? 'That link expired. Tap again and we’ll send a new one.' : 'Sign-in didn’t finish. Try again.');
    }
    const tap = takePending();
    if (tap && me.signedIn) {
      try {
        const result = await send(tap);
        changed({ tap, result, afterSignIn: true });
        return;
      } catch (e) { say(e.message); }
    }
    changed();
  });

  // Single-choice and multi-choice pill groups used by the forms.
  function wirePills(root = document) {
    root.querySelectorAll('[data-one],[data-multi]').forEach((g) =>
      g.addEventListener('click', (e) => {
        const b = e.target.closest('.opt');
        if (!b) return;
        if (g.dataset.one) g.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-pressed', o === b));
        else b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
        g.dispatchEvent(new CustomEvent('pick', { detail: b.dataset.v }));
      })
    );
  }
  const pickedButtons = (key) => [...document.querySelectorAll(`[data-one="${key}"] [aria-pressed="true"],[data-multi="${key}"] [aria-pressed="true"]`)];
  const picked = (key) => pickedButtons(key).map((b) => b.textContent);
  const pickedValues = (key) => pickedButtons(key).map((b) => b.dataset.v);

  window.AJ = { $, esc, me, say, act, ready, countFor, openSheet, signOut, wirePills, picked, pickedValues, NEEDED, siteUrl: location.origin };
})();
