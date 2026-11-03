// Shared helpers for every page: the sign-in sheet, the toast, and a tiny bit of state.
// Nothing here talks to a server yet. When auth lands (Better Auth: Google, Apple, email link),
// `AJ.signIn()` becomes a real redirect and `AJ.me` comes from the session. See docs/auth.md.
(() => {
  const $ = (q, root = document) => root.querySelector(q);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // What the signed-in person has done on this page. Mock only: resets on reload.
  const me = { signedIn: false, going: new Set(), want: new Set(), guide: new Set() };

  let toastTimer;
  function say(message) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3000);
  }

  // Tap first, sign in second: a signed-out tap opens the sheet, and the tap still counts after sign-in.
  let pending = null;
  function needSignIn(fn) {
    if (me.signedIn) return fn();
    pending = fn;
    const sheet = $('#sheet');
    sheet.hidden = false;
    $('.sso', sheet).focus();
  }

  function closeSheet() {
    $('#sheet').hidden = true;
    pending = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sheet = $('#sheet');
    if (!sheet) return;
    sheet.querySelectorAll('[data-sso]').forEach((b) =>
      b.addEventListener('click', () => {
        me.signedIn = true;
        sheet.hidden = true;
        const f = pending;
        pending = null;
        say('Signed in.');
        if (f) setTimeout(f, 0);
      })
    );
    $('#cancel').addEventListener('click', closeSheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
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
  const picked = (key) =>
    [...document.querySelectorAll(`[data-one="${key}"] [aria-pressed="true"],[data-multi="${key}"] [aria-pressed="true"]`)].map((b) => b.textContent);

  window.AJ = { $, esc, me, say, needSignIn, wirePills, picked, siteUrl: 'https://aijan.example' };
})();
