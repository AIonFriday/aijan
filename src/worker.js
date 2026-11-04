// The aijan-web Worker. It serves the built site from dist/ (env.ASSETS) and answers /api/*:
//   /api/auth/*                      accounts (Better Auth: Google, Apple, emailed link). See src/auth.js.
//   GET  /api/me                     who's in on this device, what they've tapped, live counts, which buttons work
//   POST /api/start                  a signed-out tap with just an email   body { email, tap }
//   POST /api/sessions/:slug/rsvp    RSVP, or undo it            body { on: true|false }
//   POST /api/sessions/:slug/want    "I want this", or undo it   body { on: true|false }
//   POST /api/sessions/:slug/guide   "I could guide this"
//   POST /api/suggestions            suggest an idea (goes to review)
//   POST /api/guide-offers           the offer-to-guide form on /guide
//   POST /api/krewes                 bring-your-krewe request
// Data lives in D1 (aijan-db). See docs/architecture.md and docs/schema.md.

import { makeAuth, providers, BASE_PATH } from './auth.js';
import * as api from './api.js';
import { sendTapNote } from './email.js';
import { postTap } from './slack.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const later = (ctx, p) => ctx?.waitUntil ? ctx.waitUntil(p.catch((e) => console.error(e))) : p.catch((e) => console.error(e));

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/health') return api.json({ ok: true, service: 'aijan-web' });
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      if (!env.DB || !env.BETTER_AUTH_SECRET) return api.err(503, 'Saving isn’t set up yet.');
      const mail = {};
      const auth = await makeAuth(env, request, mail);

      if (path.startsWith(BASE_PATH + '/')) return auth.handler(request);

      const signedIn = await auth.api.getSession({ headers: request.headers });
      const user = signedIn?.user || null;

      if (path === '/api/me' && request.method === 'GET') {
        const [counts, taps] = await Promise.all([api.counts(env), user ? api.mine(env, user.id) : null]);
        return api.json({
          user: user && { name: user.name, email: user.email, image: user.image },
          ...(taps || { rsvp: [], want: [], guide: [] }),
          counts,
          providers: providers(env),
        });
      }

      if (request.method !== 'POST') return api.err(405, 'Method not allowed');
      // Writes only come from our own pages: JSON bodies (which need a CORS preflight from anywhere else)
      // and, when the browser sends one, an Origin that matches.
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return api.err(403, 'Wrong origin');
      if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return api.err(415, 'Send JSON');
      const body = await request.json().catch(() => ({}));
      // Tells the organizers in Slack. Never holds up or breaks the tap itself.
      const tellOrganizers = (tap, person, result) =>
        later(ctx, postTap(env, { tap, person, result, session: api.session(tap.slug), origin: url.origin }));
      // For the routes below, which hand their response straight back to the browser.
      const tellAfter = async (tap, res) => {
        if (res.ok) tellOrganizers(tap, user, await res.clone().json());
        return res;
      };

      // Email first: a signed-out tap with just an email. The tap counts now; the email carries the details
      // and a one-time link to My sessions. See emailFirst in src/auth.js for who stays in on this device.
      if (path === '/api/start') {
        if (user) return api.err(409, 'You’re already in on this device.');
        const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
        if (!EMAIL.test(email)) return api.err(400, 'That doesn’t look like an email address.');
        const tap = body.tap && typeof body.tap === 'object' ? body.tap : {};
        if (!api.TAP_TYPES.includes(tap.type)) return api.err(400, 'Unknown tap.');
        if (!providers(env).includes('email')) return api.err(503, 'Email isn’t set up yet.');

        const { headers: set, response: who } = await auth.api.emailFirst({ body: { email }, headers: request.headers, returnHeaders: true });
        const res = await api.run(env, { id: who.userId }, tap);
        if (!res.ok) return res;
        const result = await res.json();
        tellOrganizers(tap, { email }, result);
        if (await api.canEmail(env, email)) {
          mail.tapNote = { tap, session: api.session(tap.slug), count: result.count };
          later(ctx, auth.api.signInMagicLink({ body: { email, callbackURL: '/me' }, headers: request.headers }));
        }
        const out = api.json({ ...result, signedIn: who.isNew });
        for (const c of set.getSetCookie ? set.getSetCookie() : []) out.headers.append('Set-Cookie', c);
        return out;
      }

      if (!user) return api.err(401, 'Add your email first.');

      const m = path.match(/^\/api\/sessions\/([a-z0-9-]+)\/(rsvp|want|guide)$/);
      if (m) {
        const res = await api.toggle(env, user, m[1], m[2], body);
        // People who are in on this device get the RSVP in writing too, with the calendar invite.
        if (res.ok && m[2] === 'rsvp' && body.on !== false) {
          later(ctx, sendTapNote(env, { to: user.email, tap: { type: 'rsvp', slug: m[1] }, session: api.session(m[1]), origin: url.origin, url: `${url.origin}/me`, oneTime: false, local: /^http:\/\/(localhost|127\.0\.0\.1)/.test(url.origin) }));
        }
        return tellAfter({ ...body, type: m[2], slug: m[1] }, res);
      }
      if (path === '/api/suggestions') return tellAfter({ ...body, type: 'suggest' }, await api.suggest(env, user, body));
      if (path === '/api/guide-offers') return tellAfter({ ...body, type: 'guideOffer' }, await api.offerToGuide(env, user, body));
      if (path === '/api/krewes') return tellAfter({ ...body, type: 'krewe' }, await api.kreweRequest(env, user, body));
      return api.err(404, 'Not found');
    } catch (e) {
      console.error(e);
      return api.err(500, 'Something went wrong on our end.');
    }
  },
};
