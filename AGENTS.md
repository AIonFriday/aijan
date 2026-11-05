# AGENTS.md

Instructions for AI coding agents (and humans) working in this repo. Read this before changing anything.

## What this is

The website for AI January: free AI sessions in New Orleans, Jan 8–29, 2027. A static site built by a tiny Node script and served by a Cloudflare Worker (`aijan-web`). Most visitors are beginners on phones, so plain words and a fast, calm page matter more than features.

## Commands

```sh
npm install
npm run build    # node scripts/build.mjs: data + site/ -> dist/
npm run check    # check dist/ links, h1s, descriptions, structured data (run build first)
npm test         # the tests in tests/
npm run dev      # apply D1 migrations locally (this seeds the example sessions), then wrangler dev on http://localhost:8787
```

For local sign-in, copy `.dev.vars.example` to `.dev.vars` first. Emailed sign-in links print in the terminal.

Always run `npm run build && npm run check && npm test` before you finish.

## Layout

- Sessions live in D1, in the `sessions` table (`migrations/0002_sessions.sql`). `src/sessions.js` reads and saves them (`listSessions`, `getSession`, `saveSession`, `validate`: slug format, status, level, topics, timezone offset on `startsAt`). The Worker draws everything that shows sessions on request (`src/site.js`): `/sessions/<slug>`, `/og/sessions/<slug>.png`, `/assets/sessions.js` (`window.AJ_DATA`), and the session lines in `/sitemap.xml` and `/llms.txt`. A change in the table shows up right away, with no rebuild. Rows with `example = 1` (the mockup lineup) are noindexed and left out of the sitemap, llms.txt and Event structured data; delete them when the real lineup lands.
- `site/pages/*.html`: page sources with `{{head}}`, `{{header}}`, `{{footer}}`, `{{sheet}}` placeholders. Add a new page to `PAGES` in `scripts/build.mjs`.
- `site/templates/session.html`: the page for one session, filled in by the Worker (`src/render.js`) and served at `/sessions/<slug>`.
- `src/render.js`: page pieces the build and the Worker share (head, header, structured data, the session page).
- `scripts/og.mjs`: draws the 1200x630 share images with fonts from `scripts/fonts/`: `/og/home.png` at build time, `/og/sessions/<slug>.png` in the Worker on request (cached). Only `Buffer` and `zlib`, no packages, no file reads (the caller passes the files; the build uses `scripts/og-files.mjs`).
- `site/assets/`: `site.css` (all styles), `app.js` (the email sheet, saving taps, toast, shared helpers on `window.AJ`), `cards.js` (session rows and buttons shared by the home page and /sessions), `home.js` (hero tiles, "Coming up", "Almost there"), `sessions-page.js` (/sessions: calendar, by topic, vote for what's next), `guide.js`, `krewe.js`, `session.js`, `me.js` (My sessions), `map.js` + `nola-points.js` (hero map).
- `src/worker.js`: serves `dist/` through the `ASSETS` binding. Worker code runs only for `/api/*` (`src/auth.js` Better Auth, `src/api.js` taps, `src/email.js` Resend) the session routes in `src/site.js`, and `/mcp` (`src/mcp.js`, the admin MCP with one key per admin; see `docs/admin.md`). Beignet in Slack (`src/slack-bot.js`, at `/api/slack/events`) uses the same tools; see `docs/slack.md`. Those routes are listed in `run_worker_first` in `wrangler.jsonc` and `ROUTES` in `src/site.js`; keep the two the same.
- `migrations/`: D1 tables. Add a new numbered file; never edit one that has shipped. Production doesn't apply them on deploy yet, so a new migration has to be applied to `aijan-db` before its PR merges.
- `tests/`: Node's test runner. `tests/d1.mjs` is a D1 stand-in over `node:sqlite` with every migration applied.
- `dist/`: build output. Never edit it or commit it.

## Rules

**Product rules (decided, don't change them without an issue):**
- Light theme only. Muted Mardi Gras purple, green and gold on lavender paper. No dark mode, no dark "hacker" backgrounds.
- The word is **Guide**, never "host" or "presenter". Guides can be people or groups.
- An idea needs **5** "I want this" to get scheduled. Show it as a count ("3 want it", "2 more and we schedule it"), not dots or progress bars.
- Suggesting an idea never creates a session. Organizers review first.
- Email first, never "sign in": a tap from someone new asks only for their email and counts right away. Google and Apple are one-tap shortcuts, and the emailed link brings people back to My sessions. Built on Better Auth. See `docs/auth.md`.
- Sessions are grouped by topic (My job, Home and family, Making things, Just curious) and level, not by format. `officeHours` is back-end only.
- Session URLs are `/sessions/<slug>`. Slugs never change once shared.
- All times are New Orleans time (`America/Chicago`). Store `startsAt` with an offset.
- Mobile first. Check every change at 390px wide and at desktop width.
- Search basics: every page has one `<h1>` and a meta description, and structured data is valid JSON. `check-html.mjs` enforces this. The build writes `sitemap.xml`, `robots.txt`, `llms.txt` and schema.org JSON-LD (Organization, EventSeries and FAQPage on the home page; Place on /where; Event on each scheduled session).

**Code rules:**
- No frameworks. Plain HTML, CSS and JavaScript in the browser, with no libraries. The build script uses only Node built-ins. The one runtime dependency is `better-auth`, bundled into the Worker; don't add others without an issue.
- Use the CSS tokens in `:root` (`--purple`, `--green`, `--gold`, `--ink`, and so on). Don't add new colors without updating `docs/design.md`.
- Internal links are root-relative (`/guide`, `/sessions/<slug>`). `check-html.mjs` enforces this.
- Escape anything user-written before putting it in HTML (`AJ.esc` in the browser, `esc` in the build).
- Keep the hero map fast: ~30 fps cap, stops off screen, fewer dots on phones, honors `prefers-reduced-motion`.
- Accessibility: real buttons and links, visible focus, `aria-pressed` on toggles, alt text or `aria-hidden` on images.

**Writing rules (for anything on the site):**
- Plain, friendly words a nervous beginner understands. Short sentences.
- Say "free" plainly. Don't oversell AI.
- Sentence case for headings and buttons.

## Pull requests

- One change per PR, with a short description of what changed and why, plus before/after screenshots for anything visual (phone and desktop).
- Don't commit secrets. Local secrets go in `.dev.vars` (gitignored); production secrets are set with `wrangler secret put`.
- Never deploy by hand (`wrangler deploy` or `wrangler versions upload`). Merging to `main` deploys through Cloudflare Workers Builds, and PR branches get preview URLs automatically.

## Where to look next

- `docs/architecture.md`: how the pieces fit, and what the Worker will do.
- `docs/schema.md`: the data model for D1.
- `docs/design.md`: tokens, type, layout rules.
- `docs/auth.md`: the sign-in plan.
- `docs/admin.md`: the admin MCP: tools, keys, connecting.
- `docs/slack.md`: how form submissions and taps reach the organizers in Slack.
- `docs/roadmap.md`: what's not built yet.
