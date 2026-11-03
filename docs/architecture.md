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
- Only `/api/*` runs Worker code (`run_worker_first`). Today that's just `/api/health`.
- Buttons work in the browser only (`site/assets/app.js` keeps a fake signed-in state). Nothing is saved.

## Next

The plan follows the AI Friday stack: Cloudflare Workers, D1, R2, Resend, Umami.

| Piece | Name | Job |
| --- | --- | --- |
| Worker | `aijan-web` | Pages and `/api/*` |
| D1 | `aijan-db` | Users, sessions, attendance, suggestions, krewe requests |
| R2 | `aijan-assets` | Generated share images, uploads later |
| Resend | | Sign-in links and every email about a specific session |
| Umami | `aijan` | Privacy-friendly analytics |

Planned API routes:

| Route | What it does |
| --- | --- |
| `GET /api/sessions` | Visible sessions with counts |
| `POST /api/sessions/:slug/rsvp` | RSVP, or undo it |
| `POST /api/sessions/:slug/want` | "I want this", or undo it |
| `POST /api/sessions/:slug/guide` | Offer to guide (needs approval) |
| `POST /api/suggestions` | Suggest an idea (goes to review) |
| `POST /api/krewes` | Bring-your-krewe request |
| `/api/auth/*` | Better Auth (Google, Apple, email link) |
| `GET /og/sessions/:slug.png` | Share image with the title and date over the map |

When sessions move to D1, the session pages should be rendered by the Worker (or rebuilt on change) so new sessions get pages and share tags right away. Keep `data/sessions.json` as seed data for local development.

## Deploys

- `npm run deploy` runs the build and `wrangler deploy` to the account in your wrangler login. Maintainers only.
- `npx wrangler versions upload` uploads a preview version without sending traffic to it.
- Secrets go in with `wrangler secret put NAME`, never in the repo.
