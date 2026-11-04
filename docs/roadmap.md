# Roadmap

Rough order. Open an issue before starting anything large.

## Next

- [x] D1 database (`aijan-db`) with sign-in and tap tables.
- [ ] Sessions in D1, seeded from `data/sessions.json`.
- [x] Sign-in with Better Auth: Google, Apple, email link. See [auth.md](auth.md). (Needs its keys set in Cloudflare.)
- [x] Real RSVP, "I want this", offer to guide, suggestions, and krewe requests through `/api/*`.
- [ ] Emails through Resend: ~~sign-in link~~ (done), confirmations, "it's happening, can you make it?", day-before reminder with a calendar invite, changes and cancellations.
- [ ] A simple organizer view: review suggestions, approve guides, schedule sessions, match krewes.

## Soon

- [x] Share images per session (title and date over the map), served at `/og/sessions/<slug>.png`. Drawn at build time by `scripts/og.mjs`.
- [ ] Session pages rendered from D1 so new sessions get pages right away.
- [x] "My sessions" for signed-in people (`/me`).
- [ ] Practical info about The Nieux: parking, access, Wi-Fi.
- [ ] Umami analytics.
- [x] Choose the domain: joinaijanuary.com.

## Later

- [ ] Newsletter (tool not chosen).
- [ ] Real photos from AI Friday and The Nieux.
