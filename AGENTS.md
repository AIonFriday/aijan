# AGENTS.md

Instructions for AI coding agents (and humans) working in this repo. Read this before changing anything.

## What this is

The website for AI January: free AI sessions in New Orleans, Jan 8–28, 2027. A static site built by a tiny Node script and served by a Cloudflare Worker (`aijan-web`). Most visitors are beginners on phones, so plain words and a fast, calm page matter more than features.

## Commands

```sh
npm install
npm run build    # node scripts/build.mjs: data + site/ -> dist/
npm run check    # validate data/sessions.json, then check dist/ links (run build first)
npm run dev      # apply D1 migrations locally, then wrangler dev on http://localhost:8787
```

For local sign-in, copy `.dev.vars.example` to `.dev.vars` first. Emailed sign-in links print in the terminal.

Always run `npm run build && npm run check` before you finish. There are no other tests yet.

## Layout

- `data/sessions.json`: session data. The build validates it (slug format, status, level, topics, timezone offset on `startsAt`).
- `site/pages/*.html`: page sources with `{{head}}`, `{{header}}`, `{{footer}}`, `{{sheet}}` placeholders. Add a new page to `PAGES` in `scripts/build.mjs`.
- `site/templates/session.html`: the page for one session, rendered once per session to `dist/sessions/<slug>.html` and served at `/sessions/<slug>`.
- `site/assets/`: `site.css` (all styles), `app.js` (sign-in, the sheet, saving taps, toast, shared helpers on `window.AJ`), `home.js`, `guide.js`, `krewe.js`, `session.js`, `me.js` (My sessions), `map.js` + `nola-points.js` (hero map).
- `src/worker.js`: serves `dist/` through the `ASSETS` binding. Only `/api/*` runs Worker code: `src/auth.js` (Better Auth), `src/api.js` (taps), `src/email.js` (Resend).
- `migrations/`: D1 tables. Add a new numbered file; never edit one that has shipped.
- `dist/`: build output. Never edit it or commit it.

## Rules

**Product rules (decided, don't change them without an issue):**
- Light theme only. Muted Mardi Gras purple, green and gold on lavender paper. No dark mode, no dark "hacker" backgrounds.
- The word is **Guide**, never "host" or "presenter". Guides can be people or groups.
- An idea needs **5** "I want this" to get scheduled. Show it as a count ("3 want it", "2 more and we schedule it"), not dots or progress bars.
- Suggesting an idea never creates a session. Organizers review first.
- Signed-out taps open sign-in, and the tap still counts afterward ("tap first, sign in second").
- Sign-in will be Better Auth with Google, Apple, and an emailed link. See `docs/auth.md`.
- Sessions are grouped by topic (My job, Home and family, Making things, Just curious) and level, not by format. `officeHours` is back-end only.
- Session URLs are `/sessions/<slug>`. Slugs never change once shared.
- All times are New Orleans time (`America/Chicago`). Store `startsAt` with an offset.
- Mobile first. Check every change at 390px wide and at desktop width.

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
- `docs/roadmap.md`: what's not built yet.
