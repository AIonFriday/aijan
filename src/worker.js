// The aijan-web Worker. Today it only serves the built static site from dist/ (env.ASSETS)
// and answers a health check. API routes (sign-in, RSVPs, "I want this", suggestions) will live here,
// backed by D1 (aijan-db) and Resend. See docs/architecture.md.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, service: 'aijan-web' });
    }

    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Not built yet' }, { status: 501 });
    }

    return env.ASSETS.fetch(request);
  },
};
