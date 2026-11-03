// The aijan-web Worker. It serves the built site from dist/ (env.ASSETS) and answers /api/*:
//   /api/auth/*                      sign-in (Better Auth: Google, Apple, emailed link). See src/auth.js.
//   GET  /api/me                     who's signed in, what they've tapped, live counts, which sign-in buttons work
//   POST /api/sessions/:slug/rsvp    RSVP, or undo it            body { on: true|false }
//   POST /api/sessions/:slug/want    "I want this", or undo it   body { on: true|false }
//   POST /api/sessions/:slug/guide   "I could guide this"
//   POST /api/suggestions            suggest an idea (goes to review)
//   POST /api/guide-offers           the offer-to-guide form on /guide
//   POST /api/krewes                 bring-your-krewe request
// Data lives in D1 (aijan-db). See docs/architecture.md and docs/schema.md.

import { makeAuth, providers, BASE_PATH } from './auth.js';
import * as api from './api.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/health') return api.json({ ok: true, service: 'aijan-web' });
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      if (!env.DB || !env.BETTER_AUTH_SECRET) return api.err(503, 'Sign-in isn’t set up yet.');
      const auth = await makeAuth(env, request);

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
      if (!user) return api.err(401, 'Sign in first.');
      const body = await request.json().catch(() => ({}));

      const m = path.match(/^\/api\/sessions\/([a-z0-9-]+)\/(rsvp|want|guide)$/);
      if (m) return api.toggle(env, user, m[1], m[2], body);
      if (path === '/api/suggestions') return api.suggest(env, user, body);
      if (path === '/api/guide-offers') return api.offerToGuide(env, user, body);
      if (path === '/api/krewes') return api.kreweRequest(env, user, body);
      return api.err(404, 'Not found');
    } catch (e) {
      console.error(e);
      return api.err(500, 'Something went wrong on our end.');
    }
  },
};
