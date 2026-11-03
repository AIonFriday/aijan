# Architecture

## Today

```
data/sessions.json ─┐
site/pages/         ├─ scripts/build.mjs ─▶ dist/ ─▶ Worker "aijan-web" (static assets)
site/templates/     │
site/assets/       ─┘
```

- The build is one Node script with no dependencies. It validates the data, copies assets, fills page templates, and writes one page per session.
- The Worker (`src/worker.js`) serves `dist/` through the `ASSETS` binding. Cloudflare's `auto-trailing-slash` HTML handling serves `/sessions/foo` from `dist/sessions/foo.html`. Unknown paths get `dist/404.html`.
- Only `/api/*` runs Worker code (`run_worker_first`): sign-in and the taps people make. See the routes below.
- Sign-in is Better Auth with Google, Apple, and an emailed link, stored in D1 (`aijan-db`). See [auth.md](auth.md).
- RSVP, "I want this", "I could guide this", suggestions, guide offers, and krewe requests are saved in D1. Sessions themselves still come from `data/sessions.json`; the counts people see are the seed `count` plus saved taps.
- `better-auth` is the one runtime dependency. Wrangler bundles it into the Worker. Browser code stays plain JavaScript with no libraries.

## Next

The plan follows the AI Friday stack: Cloudflare Workers, D1, R2, Resend, Umami.

| Piece | Name | Job |
| --- | --- | --- |
| Worker | `aijan-web` | Pages and `/api/*` |
| D1 | `aijan-db` | Users, sessions, attendance, suggestions, krewe requests |
| R2 | `aijan-assets` | Generated share images, uploads later |
| Resend | | Sign-in links and every email about a specific session |
| Umami | `aijan` | Privacy-friendly analytics |

API routes (built ones first):

| Route | What it does |
| --- | --- |
| `/api/auth/*` | Better Auth (Google, Apple, email link). Built |
| `GET /api/me` | Who's signed in, their taps, live counts, which sign-in buttons work. Built |
| `POST /api/sessions/:slug/rsvp` | RSVP, or undo it (`{ on: false }`). Built |
| `POST /api/sessions/:slug/want` | "I want this", or undo it. Built |
| `POST /api/sessions/:slug/guide` | Offer to guide one session (needs approval). Built |
| `POST /api/suggestions` | Suggest an idea (goes to review). Built |
| `POST /api/guide-offers` | The offer-to-guide form on `/guide`. Built |
| `POST /api/krewes` | Bring-your-krewe request. Built |
| `GET /api/sessions` | Visible sessions with counts. Planned, once sessions move to D1 |
| `GET /og/sessions/:slug.png` | Share image with the title and date over the map. Planned |

Writes need a signed-in person, a JSON body, and (when the browser sends one) an `Origin` that matches the site.

When sessions move to D1, the session pages should be rendered by the Worker (or rebuilt on change) so new sessions get pages and share tags right away. Keep `data/sessions.json` as seed data for local development.

## Deploys

Deploys run only through GitHub. Nobody runs `wrangler deploy` by hand.

- The Worker is connected to this repo with [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/).
- A merge to `main` builds the site and deploys it to production. The deploy command should be `npm run deploy`, which applies new D1 migrations first.
- Every other branch (including PR branches) gets a preview version with its own URL. Cloudflare posts the link on the PR.
- GitHub Actions (`.github/workflows/ci.yml`) runs the build, the checks and a `wrangler deploy --dry-run` on every PR. It never deploys.
- Secrets are set in the Cloudflare dashboard (or `wrangler secret put` by a maintainer), never in the repo.
