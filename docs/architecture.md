# Architecture

## Today

```
site/pages/   ─┐
site/assets/  ─┴─ scripts/build.mjs ─▶ dist/ ─▶ Worker "aijan-web" ─┬─ static pages from dist/ (ASSETS)
                                                                    ├─ session pages, share images, session list,
D1 aijan-db: sessions ──────────────────────────────────────────────┤  sitemap, llms.txt (src/site.js, on request)
site/templates/session.html ─────────────────────────────────────────┘
```

- The build is one Node script with no dependencies. It copies assets, fills the page templates, and draws the home share image. It knows nothing about sessions.
- Sessions live in D1 (`sessions` table). The Worker draws everything that shows them on each request (`src/site.js`), so a change in the table shows up right away: `/sessions/<slug>` (from `site/templates/session.html`), `/assets/sessions.js` (`window.AJ_DATA` for the browser code), and the session lines in `/sitemap.xml` and `/llms.txt` (the built files have a marker where they go). Pages the build and the Worker both make share `src/render.js`.
- Share images (`scripts/og.mjs`) put the title and date over the street map, with their own small font reader, path filler and PNG writer (only `Buffer` and `zlib`). The build draws `/og/home.png`. The Worker draws `/og/sessions/<slug>.png` on request (a few hundred ms of CPU) and keeps it in the Cache API; the page links it as `?v=<hash of what it shows>`, so a changed session gets a fresh image. Fonts are in `scripts/fonts/`, bundled into the Worker by the `rules` in `wrangler.jsonc`.
- Everything else is plain files from `dist/` through the `ASSETS` binding. Unknown paths get `dist/404.html`.
- Worker code runs for `/api/*` and the session routes above (`run_worker_first`). See the routes below.
- Sign-in is Better Auth with Google, Apple, and an emailed link, stored in D1 (`aijan-db`). See [auth.md](auth.md).
- RSVP, "I want this", "I could guide this", suggestions, guide offers, and krewe requests are saved in D1. The counts people see are a session's `seed_count` plus saved taps.
- `better-auth` is the one runtime dependency. Wrangler bundles it into the Worker. Browser code stays plain JavaScript with no libraries.

## Next

The plan follows the AI Friday stack: Cloudflare Workers, D1, R2, Resend, Umami.

| Piece | Name | Job |
| --- | --- | --- |
| Worker | `aijan-web` | Pages and `/api/*` |
| D1 | `aijan-db` | Users, sessions, attendance, suggestions, krewe requests |
| R2 | `aijan-assets` | Generated share images, uploads later |
| Resend | | Sign-in links and every email about a specific session |
| Slack | | Tells organizers about form submissions and taps. See [slack.md](slack.md) |
| Umami | `AI January` on umami.dunn.us | Privacy-friendly analytics, loaded from `site/partials/head.html` |
| Google Analytics | `AI January` property, `G-DEWHWDYDEB` | Extra analytics alongside Umami, loaded from `site/partials/head.html`. Sets cookies. |

API routes (built ones first):

| Route | What it does |
| --- | --- |
| `/api/auth/*` | Better Auth (Google, Apple, email link). Built |
| `GET /api/me` | Who's signed in, their taps, live counts, which sign-in buttons work. Built |
| `POST /api/start` | A tap from someone new on this device, with just an email. See `docs/auth.md`. Built |
| `POST /api/sessions/:slug/rsvp` | RSVP, or undo it (`{ on: false }`). Built |
| `POST /api/sessions/:slug/want` | "I want this", or undo it. Built |
| `POST /api/sessions/:slug/guide` | Offer to guide one session (needs approval). Built |
| `POST /api/suggestions` | Suggest an idea (goes to review). Built |
| `POST /api/guide-offers` | The offer-to-guide form on `/guide`. Built |
| `POST /api/krewes` | Bring-your-krewe request. Built |
| `GET /api/sessions` | Visible sessions with counts. Planned, once sessions move to D1 |

Writes need a signed-in person, a JSON body, and (when the browser sends one) an `Origin` that matches the site.


## Deploys

Deploys run only through GitHub. Nobody runs `wrangler deploy` by hand.

- The Worker is connected to this repo with [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/).
- A merge to `main` builds the site and deploys it to production. The deploy command should be `npm run deploy`, which applies new D1 migrations first. Until it is, apply a new migration to `aijan-db` by hand before its PR merges.
- Every other branch (including PR branches) gets a preview version with its own URL. Cloudflare posts the link on the PR.
- GitHub Actions (`.github/workflows/ci.yml`) runs the build, the checks and a `wrangler deploy --dry-run` on every PR. It never deploys.
- Secrets are set in the Cloudflare dashboard (or `wrangler secret put` by a maintainer), never in the repo.
