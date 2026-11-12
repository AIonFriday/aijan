# Data model

The data model for D1 (`aijan-db`).

**Built:** `migrations/0001_sign_in_and_taps.sql` (Better Auth's `user`, `session`, `account`, `verification`, plus `attendance`, `suggestions`, `guide_offers`, `krewe_requests`) `migrations/0002_sessions.sql` (`sessions`, first seeded with example sessions) and `migrations/0004_real_lineup.sql` (deletes the examples and adds the real January lineup). A session's `id` is its slug, so `attendance.session_id` is the slug too. `src/sessions.js` turns a row into camelCase (`startsAt`, `officeHours`, `count` for `seed_count`) for the pages, the browser and the emails.

## sessions

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text | Primary key. Same as `slug` |
| `slug` | text, unique | From the title. Never changes once shared. Page at `/sessions/<slug>` |
| `title` | text | Short, plain words |
| `description` | text | What you'll do and what to bring |
| `status` | text | `proposed` (shown as "Not scheduled yet"), `scheduled`, `cancelled`. Scheduled needs `starts_at` |
| `visible` | 0/1 | 0 hides it without deleting |
| `starts_at` | text, nullable | ISO time with offset. Empty means not set yet |
| `length_min` | integer | Default 90 |
| `location` | text, nullable | Empty means The Nieux, 2040 St. Charles Ave |
| `level` | text | `all`, `new` (New to AI), `sometimes` (Now and then), `daily` (Daily) |
| `topics` | text (JSON list) | `work`, `life`, `make`, `curious` |
| `tags` | text (JSON list) | Free words like `restaurants`, `faith`. |
| `guides` | text (JSON list) | Who guides it, each `{"name": "Hello Gravel Krewe", "url": "https://hellogravel.com"}`. `url` is optional (a website or LinkedIn) and links the name on the session page. A plain name string still works. Empty means it needs a guide |
| `office_hours` | 0/1 | Back end only, never shown as a category |
| `seed_count` | integer | Starting count that live taps add to. 0 for real sessions |
| `kind` | text | Session type: `talk` (Talks and demos), `office-hours`, `hands-on` (default), `group` (For your group; ideas show as buttons on /sessions). Added in 0005 |
| `example` | 0/1 | 1 = mockup session: noindexed, left out of the sitemap, llms.txt and Event data |
| `created_at`, `updated_at` | text | |

## users

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `name`, `email`, `image` | | From Better Auth (Google, Apple, email link) |
| `level` | text, nullable | Same levels as sessions. Asked once, used to suggest sessions |
| `newsletter` | boolean | Newsletter tool not chosen yet |
| `role` | text | `member` or `organizer` |

The `user` columns from Better Auth are camelCase (`emailVerified`, `createdAt`, `updatedAt`). Better Auth also has its own `account`, `session` and `verification` tables.

## attendance

One row per person per session.

| Field | Values | Notes |
| --- | --- | --- |
| `session_id`, `user_id` | | Unique together with `kind` |
| `kind` | `want`, `rsvp`, `guide` | "I want this", RSVP, or offered to guide |
| `guide_as` | text, nullable | Display name when guiding as a group, like "AI Friday crew" |
| `guide_status` | `requested`, `approved`, `declined` | Guides only. Shown on the session once approved |
| `created_at` | text | |

A session can have any number of guides.

## suggestions

Ideas people send in. Never shown until an organizer turns one into a `proposed` session.

`id`, `text`, `user_id`, `status` (`new`, `accepted`, `declined`), `session_id` (once accepted), `created_at`.

## guide_offers

The offer-to-guide form on `/guide`, not tied to one session. Offers for one session are `attendance` rows with `kind = guide`.

`id`, `user_id`, `topics` (JSON list: `work`, `life`, `make`, `curious`), `what`, `guide_as` (group name, if any), `details` (JSON: `level`, `times`; both empty for offers since the form stopped asking), `status` (`new`, `approved`, `declined`), `created_at`.

## krewe_requests

`id`, `group_name`, `what`, `size` (`5-10`, `10-20`, `20-40`, `40+`), `user_id`, `status` (`new`, `matched`, `scheduled`), `session_id` (once scheduled), `created_at`. A matched krewe becomes a normal session, with `visible` off when it's private.

## faculty and faculty_members

The people and groups who lead sessions, and who's in which group (`migrations/0006_faculty.sql`). Tied to sessions by name: a `sessions.guides` name that matches `faculty.name` (ignoring case). Columns and rules: [faculty.md](faculty.md).

## How a session moves

1. Someone suggests an idea. An organizer reviews it and posts it as `proposed`.
2. People tap "I want this". Once enough people want it and a guide is approved, an organizer sets a date and marks it `scheduled`.
3. Everyone who wanted it gets an email: "It's happening Tuesday at 11:30. Can you make it?" One tap turns it into an RSVP.
