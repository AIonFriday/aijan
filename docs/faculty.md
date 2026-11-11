# Faculty

"Faculty" is Tim Williamson's word for the people and groups who lead AI January sessions. The rest of the site still calls them **Guides** (see the product rules in `AGENTS.md`); the faculty pages are where we show who they are.

What visitors see:

- **Home page strip** (`site/pages/index.html` `section.fac`, drawn by `facultyStrip()` in `site/assets/home.js`): photos and names sliding slowly sideways under the hero, with "See everyone →" to `/faculty`. It hides itself when there's no faculty. Hover or focus pauses it; with `prefers-reduced-motion` it's a plain row you can swipe.
- **`/faculty`** (`site/pages/faculty.html` + `site/assets/faculty.js`): a card per person, then a card per organization. Each card says what they lead ("Leads 2 sessions", "5 sessions with AI Friday", or "Session coming soon"). With no faculty it says "We're adding the faculty now."
- **`/faculty/<slug>`** (`site/templates/faculty.html`, filled by `facultyPage()` in `src/render.js`, served by `src/site.js`): photo, name, role, the groups they're part of, bio, links, their sessions (plus their groups' sessions, marked "With AI Friday"), the people in a group, and "What they're working on". Person or Organization JSON-LD with `memberOf` / `member`.
- **Session pages and cards**: a guide whose name matches a faculty member (ignoring case) links to their faculty page instead of their website.

## Data

Two D1 tables, from `migrations/0006_faculty.sql`. Read with `src/faculty.js`.

### faculty

| Column | What it is |
| --- | --- |
| `slug` | URL name, like `whitley-rushing`. Never changes once shared. |
| `name` | Unique (ignoring case). **Must match the name in `sessions.guides`** for the two to connect. |
| `is_group` | 1 for a company or group (square badge, "People at …" section). 0 for a person (round photo). |
| `role` | One short line, like "Director of Operations, Hello Gravel". Take it from their LinkedIn headline, shortened. |
| `bio` | A few plain sentences. Ideally their own words; ours are drafts for them to fix. |
| `photo` | `https://…` or `/assets/…`. Empty shows initials on a tinted circle (tint picked from the slug). |
| `links` | JSON `[{ label, url }]`: LinkedIn, Website, Instagram, … |
| `projects` | JSON `[{ name, about, url?, image? }]`. See the rules below. `image` must start with `https://` or `/assets/`. |
| `sort` | Lower shows first. |
| `featured` | 1 shows them in the strip and on `/faculty` even without a session of their own. |
| `visible` | 0 takes them off the site (their page 404s). |

### faculty_members

Ties people to groups: `group_slug`, `person_slug`, `title` (their part in the group, like "Host", shown as a small tag), `sort`. A person can be in several groups and still have their own page. Deleting a faculty row deletes its memberships.

## Rules (Andrew, Nov 11 2026)

- **Who's on the strip and `/faculty`:** only people and groups **named as a session's guide**, plus anyone with `featured = 1`. Everyone else shows only on their group's page. Example: Whitley leads a session, so she's on the main page. Daniel, Michael and Max Cannon are on Hello Gravel's page only.
- **No "spots left"** or any countdown to a faculty goal.
- **Session counts are honest.** A card counts the person's own sessions. Someone who only leads through a group says "5 sessions with AI Friday", not "Leads 5 sessions".
- **Projects are things the person is building**, almost never a job title or an employer. Brook's are Sipped and Precon Playbook, not "COO". Leave `projects` empty rather than pad it.
- **Every project should have a screenshot** (`image`). Prefer a real screenshot of the project's page over a logo.
- **Groups use their real names**, like "Hello Gravel" (not "Hello Gravel Krewe").

## Photos

The repo is public, so **don't commit people's photos** without their OK. Before a photo goes live, it needs a proper home (an `https://` URL we control, or a file under `site/assets/` once the person agrees) and ideally the person's go-ahead. LinkedIn photos are for the local mockup only.

## Linking a session to a faculty member

1. The session's `guides` list has `{ "name": "Rob Gaudet", "url": "…" }`.
2. A `faculty` row has `name = 'Rob Gaudet'`.
3. That's it: the session page links the name to `/faculty/rob-gaudet`, and Rob's page lists the session.

If someone leads as a group (`{ "name": "AI Friday" }`), the group's page lists the session, and so does every member's page ("With AI Friday").

## Adding faculty today

There are no admin tools for faculty yet (see `docs/roadmap.md`). Until then, add rows to `aijan-db` with SQL, like the examples in `scripts/faculty-mock.sql`. Changes show right away, with no deploy.

## Local preview

`npm run preview` (`scripts/preview.mjs`, Node 22.13+, no Wrangler) builds the site and serves it with the Worker's own routes on `http://localhost:8787` (set `PORT` to change it), using a local stand-in for D1 (`tests/d1.mjs`) loaded with every migration plus `scripts/faculty-mock.sql`.

- `scripts/faculty-mock.sql` is **sample data for local use only. Never apply it to `aijan-db`.** It holds the real lineup's faculty with draft bios.
- Photos and project screenshots are listed in `PHOTOS` at the top of `scripts/preview.mjs`. They download once into `site/assets/faculty/` (gitignored) and are copied into `dist/` on each run. A file named `<slug>.jpg|png|webp` there wins over the row's `photo`, so you can drop in a better headshot by hand. Project images that aren't there are left off. Screenshots taken by hand (most of the project images in the sample data) aren't in `PHOTOS`; save them into `site/assets/faculty/` under the name the row uses.
- `/api/*` is stubbed, so taps and sign-in don't work in the preview.
- Some image hosts block cloud machines; run the preview on a laptop if photos don't download.

## Tests

`tests/sessions.test.mjs` covers: the strip data and pages, a database without the faculty tables (everything still works, with no faculty), group and person ties, and who shows on the main page (session leaders and featured only).
