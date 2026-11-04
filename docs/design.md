# Design rules

The feeling to aim for: a friendly invitation, not a tech product. A nervous beginner should think "this is for me, it's free, and I'm welcome."

## Logo

The AI January identity kit (IO2-v1) lives in `site/assets/brand/`, with its own README and the full usage guide (`AI-January-IO2-Usage.pdf`). The crown is purple ironwork with "AI" in the negative space; the name is Bricolage Grotesque Bold in ink.

- **Header:** the compact crown (transparent, so the map shows through) with "AI January" typed beside it in Bricolage Bold, the wordmark's font. No backing box. The crown alone on phones under 480px (60px) so the nav fits. The home hero's dateline starts with "AI January" so phones still see the name.
- **Share images:** `scripts/og.mjs` draws the compact lockup from its SVG paths, 300px wide, top left.
- **Icons:** `/favicon.ico` (16, 32, 48), `favicon.svg` and `favicon-32.png` for tabs, all on a transparent background with a thin paper edge around the crown. `favicon-192.png` for home screens keeps its solid paper square.
- **Kit rules:** light backgrounds only (white or `--paper`), keep space around it, never stretch, crop, rotate or recolor parts. Smallest sizes: master lockup 320px, master crown 160px, compact lockup 240px, compact crown 48px. Use the master versions for big places like posters and slides.

The kit's colors are the site's: purple `#6A4C8C`, ink `#2A2035`, paper `#F1EDF3`.

## Color

Light theme only. Muted Mardi Gras colors on lavender paper. Never a dark background.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#F1EDF3` | Page background |
| `--card` | `#FBF9FC` | Cards, inputs |
| `--ink` | `#2A2035` | Text |
| `--ink-soft` | `#5E5469` | Secondary text |
| `--line` | `#DCD4E2` | Borders, dividers |
| `--purple` / `--purple-soft` | `#6A4C8C` / `#E6DEEF` | Main actions, scheduled sessions, guides |
| `--green` / `--green-soft` | `#4E7A5A` / `#DDEADF` | "I want this", krewes |
| `--gold` / `--gold-soft` | `#B08A2E` / `#F2E7C9` | Accents, focus rings, underlines |

## Type

- Headings: Bricolage Grotesque (700–800).
- Body: Atkinson Hyperlegible, 17px. Chosen for readability.
- Small labels and dates: IBM Plex Mono.
- Sentence case everywhere. No all-caps sentences (short mono labels are fine).

## Layout

- Mobile first. One readable column, max width about 46rem.
- 16px side gutters on phones, respecting safe areas.
- One main action per card. Secondary actions live on the session page.
- Counts in words ("3 want it", "2 more and we schedule it"), not gauges.

## The hero map

Real street intersections of greater New Orleans from OpenStreetMap, lit outward from The Nieux. No place names. It sits behind the headline. Keep the OpenStreetMap credit visible.

## Share images

1200x630 PNGs drawn by `scripts/og.mjs` with the same tokens and fonts. The map sits on the right with a paper wash on the left so the words read clearly. Sessions show the title (it shrinks, then trims with "…" past three lines), a date tile like the session page, and the time and place. Ideas show a green tile with "?" and "Not scheduled yet". Keep each image under about 300 KB so WhatsApp and iMessage show it.

## Words

Plain, warm, short. "Guide," not "host." "Free," said plainly. Don't oversell AI.
