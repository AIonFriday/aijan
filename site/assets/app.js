// Shared helpers for every page: the email sheet, saving taps, the toast.
//
// Email first: a tap from someone we don't know yet opens a small sheet that asks only for their email
// (Google and Apple are one-tap shortcuts). The tap counts as soon as they hit the button, with no link to
// click first. We never say "sign in". Pages listen for the "aj:change" event to repaint.
//
// The server side is src/worker.js (POST /api/start) and Better Auth's own routes under /api/auth.
(() => {
  const $ = (q, root = document) => root.querySelector(q);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NEEDED = 5;

  // Who's in on this device and what they've tapped. Filled from /api/me, plus taps this device made for an
  // email we already knew (those count on the server, but this device isn't let into that account).
  const me = { signedIn: false, user: null, going: new Set(), want: new Set(), guide: new Set(), counts: {}, providers: [] };
  const changed = (detail = {}) => document.dispatchEvent(new CustomEvent('aj:change', { detail }));

  // ---------- analytics ----------
  // One event name per action, sent to both Umami and Google Analytics. Never send an email, a name or
  // anything someone typed: only event names, session slugs and short labels. The list is in docs/analytics.md.
  function track(name, data = {}) {
    try { window.umami?.track(name, data); } catch {}
    try { window.gtag?.('event', name, data); } catch {}
  }
  const TAP_EVENTS = { rsvp: 'rsvp', want: 'want', guide: 'offer_to_guide', suggest: 'suggest_idea', guideOffer: 'guide_form', krewe: 'group_request' };
  // A tap the server saved. `via` says how we knew who it was: known (already in on this device),
  // email (just typed it in the sheet) or sso (back from Google or Apple).
  function trackTap(tap, via) {
    if (!TAP_EVENTS[tap?.type]) return;
    if (tap.on === false) return track('undo', { type: tap.type, slug: tap.slug });
    track(TAP_EVENTS[tap.type], tap.slug ? { slug: tap.slug, via } : { via });
  }

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
  // A tap is a plain object so it can wait in localStorage during a trip to Google or Apple.
  //   { type: 'rsvp' | 'want' | 'guide', slug, on }  { type: 'suggest', text }
  //   { type: 'guideOffer', topics, what, level, times, guideAs }  { type: 'krewe', groupName, what, size }
  const PENDING = 'aj-pending';
  const savePending = (tap) => { try { localStorage.setItem(PENDING, JSON.stringify({ tap, at: Date.now() })); } catch {} };
  function takePending() {
    try {
      const raw = localStorage.getItem(PENDING);
      localStorage.removeItem(PENDING);
      const p = raw && JSON.parse(raw);
      return p && Date.now() - p.at < 60 * 60 * 1000 ? p.tap : null; // an hour is plenty for Google or Apple
    } catch { return null; }
  }

  // The email typed last time, so the sheet comes pre-filled.
  const EMAIL_KEY = 'aj-email';
  const lastEmail = () => { try { return localStorage.getItem(EMAIL_KEY) || ''; } catch { return ''; } };
  // Taps this device made for an email we already knew, so the buttons stay pressed here.
  const LOCAL = 'aj-local';
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) || {}; } catch { return {}; } };
  function keepLocal(tap) {
    if (!['rsvp', 'want', 'guide'].includes(tap.type)) return;
    const l = readLocal();
    l[tap.type] = [...new Set([...(l[tap.type] || []), tap.slug])];
    try { localStorage.setItem(LOCAL, JSON.stringify(l)); } catch {}
  }

  const sets = () => ({ rsvp: me.going, want: me.want, guide: me.guide });

  // Update what this page knows after the server saved a tap, and say so.
  function saved(tap, r, viaEmail) {
    const set = sets()[tap.type];
    if (set) {
      if (r.on) set.add(tap.slug); else set.delete(tap.slug);
      if (tap.type !== 'guide') (me.counts[tap.slug] ||= {})[tap.type] = r.saved;
    }
    const check = viaEmail ? ' Check your email for the details.' : '';
    if (set && !r.on) say('Removed. You can change your mind anytime.');
    else if (tap.type === 'rsvp') say(viaEmail ? 'You’re going. The calendar invite is in your email.' : 'You’re going. The calendar invite is in your email, and we’ll send a reminder the day before.');
    else if (tap.type === 'want') say((r.count >= NEEDED ? `That makes ${r.count}. We’ll email you a date.` : 'Got it. We’ll email you when it’s scheduled.') );
    else if (tap.type === 'guide') say('Thanks. An organizer will reach out about guiding.' + check);
  }

  async function send(tap) {
    if (sets()[tap.type]) {
      const r = await call(`/api/sessions/${encodeURIComponent(tap.slug)}/${tap.type}`, { on: tap.on !== false, guideAs: tap.guideAs });
      saved(tap, r, false);
      return r;
    }
    const routes = { suggest: '/api/suggestions', guideOffer: '/api/guide-offers', krewe: '/api/krewes' };
    return call(routes[tap.type], tap);
  }

  // Run a tap now if we know who this is, or ask for an email first. Pages repaint on "aj:change".
  let waiting = null; // the tap the sheet is asking an email for
  async function act(tap) {
    await ready;
    if (!me.signedIn) {
      if (tap.on === false) { say('To change this, open the link we emailed you.'); return; }
      waiting = tap;
      savePending(tap);
      openSheet(tap);
      return;
    }
    try {
      const result = await send(tap);
      trackTap(tap, 'known');
      changed({ tap, result });
    } catch (e) {
      if (e.status === 401) { me.signedIn = false; return act(tap); }
      say(e.message);
    }
  }

  // ---------- the email sheet ----------
  const here = () => location.pathname + location.search;
  const SHEET_WORDS = {
    rsvp: ['Save your spot', 'We’ll email the calendar invite and a reminder.', 'Save my spot'],
    want: ['Count me in', 'We’ll email you when it’s on the calendar.', 'Count me in'],
  };
  function openSheet(tap = waiting) {
    const sheet = $('#sheet');
    if (!sheet) return;
    const [title, why, button] = SHEET_WORDS[tap?.type] || ['What’s your email?', 'So an organizer can write back.', 'Send'];
    $('#sh').textContent = title;
    $('#sheet-why').textContent = why;
    $('#sheet-go').textContent = button;
    $('#sheet-email-err').hidden = true;
    const input = $('#sheet-email');
    if (!input.value) input.value = lastEmail();
    sheet.hidden = false;
    track('email_sheet_open', { for: tap?.type || 'other' });
    ($('#sheet-email-form:not([hidden]) input') || $('.sso:not([hidden])', sheet) || $('#cancel', sheet)).focus();
  }
  // Closed without giving an email: the cancel button, a tap outside, or Escape.
  function dismissSheet() {
    track('email_sheet_cancel', { for: waiting?.type || 'other' });
    closeSheet();
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    waiting = null;
    try { localStorage.removeItem(PENDING); } catch {}
  }

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // The sheet's button: save the waiting tap with just this email.
  async function start(form) {
    const input = $('#sheet-email');
    const email = input.value.trim();
    if (!isEmail(email)) { $('#sheet-email-err').hidden = false; input.focus(); return; }
    $('#sheet-email-err').hidden = true;
    const tap = waiting;
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const r = await call('/api/start', { email, tap });
      try { localStorage.setItem(EMAIL_KEY, email); } catch {}
      closeSheet();
      track('email_added', { for: tap.type, new: r.signedIn ? 'yes' : 'no' });
      trackTap(tap, 'email');
      if (r.signedIn) { me.signedIn = true; me.user = { name: '', email }; }
      else keepLocal(tap);
      if (sets()[tap.type]) saved(tap, r, !r.signedIn);
      showAcct();
      changed({ tap, result: r });
    } catch (e) {
      say(e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function social(provider, button) {
    button.disabled = true;
    track('sso_start', { provider });
    try {
      const r = await call('/api/auth/sign-in/social', { provider, callbackURL: here(), errorCallbackURL: withFlag('signin', 'failed') });
      location.href = r.url;
    } catch (e) {
      button.disabled = false;
      say('That didn’t work. Try again, or type your email instead.');
    }
  }

  // Email a one-time link back to My sessions (used on /me). Resolves true once it's sent.
  async function emailLink(email) {
    try {
      await call('/api/auth/sign-in/magic-link', { email, callbackURL: '/me', errorCallbackURL: withFlag('signin', 'expired') });
      track('my_sessions_link');
      try { localStorage.setItem(EMAIL_KEY, email); } catch {}
      return true;
    } catch (e) {
      say('We couldn’t send that. Check the address and try again.');
      return false;
    }
  }

  const withFlag = (k, v) => { const u = new URL(location.href); u.searchParams.set(k, v); return u.pathname + u.search; };

  async function signOut() {
    try { await call('/api/auth/sign-out', {}); } catch {}
    try { localStorage.removeItem(LOCAL); localStorage.removeItem(EMAIL_KEY); } catch {}
    location.reload();
  }

  // "My sessions" in the menu, once there's something to show.
  function showAcct() {
    const acct = $('#acct');
    const local = readLocal();
    if (acct) acct.hidden = !(me.signedIn || Object.values(local).some((l) => l.length));
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
      if (!me.signedIn) {
        const l = readLocal();
        (l.rsvp || []).forEach((x) => me.going.add(x));
        (l.want || []).forEach((x) => me.want.add(x));
        (l.guide || []).forEach((x) => me.guide.add(x));
      } else try { localStorage.removeItem(LOCAL); } catch {}
    })
    .catch(() => {}); // offline or sign-in not set up yet: the site still reads fine

  document.addEventListener('DOMContentLoaded', async () => {
    const sheet = $('#sheet');
    document.querySelectorAll('[data-sso]').forEach((b) => b.addEventListener('click', () => social(b.dataset.sso, b)));
    if (sheet) {
      $('#sheet-email-form').addEventListener('submit', (e) => { e.preventDefault(); start(e.target); });
      $('#cancel').addEventListener('click', dismissSheet);
      sheet.addEventListener('click', (e) => { if (e.target === sheet) dismissSheet(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) dismissSheet(); });
    }
    document.querySelectorAll('[data-signout]').forEach((b) => b.addEventListener('click', signOut));

    await ready;
    document.querySelectorAll('[data-sso]').forEach((b) => (b.hidden = !me.providers.includes(b.dataset.sso)));
    document.querySelectorAll('[data-email-only]').forEach((el) => (el.hidden = !me.providers.includes('email')));
    document.querySelectorAll('[data-or]').forEach((el) => (el.hidden = !(me.providers.includes('email') && me.providers.some((p) => p !== 'email'))));
    if (sheet) $('#sheet-off').hidden = me.providers.length > 0;
    showAcct();

    // Back from Google, Apple, or an emailed link.
    const params = new URLSearchParams(location.search);
    const flag = params.get('signin') || params.get('error');
    if (flag) {
      params.delete('signin');
      params.delete('error');
      history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
      say(flag === 'expired' || /expired|invalid/i.test(flag) ? 'That link was used or expired. Type your email on My sessions for a new one.' : 'That didn’t finish. Try again.');
    }
    const tap = takePending();
    if (tap && me.signedIn) {
      try {
        const result = await send(tap);
        trackTap(tap, 'sso');
        changed({ tap, result, afterSignIn: true });
        showAcct();
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

  window.AJ = { $, esc, me, say, act, track, ready, countFor, openSheet, emailLink, isEmail, lastEmail, signOut, wirePills, picked, pickedValues, NEEDED, siteUrl: location.origin };
})();
