# Data model

This is the plan for D1 (`aijan-db`). Today the site reads `data/sessions.json`, which uses the same field names in camelCase.

## sessions

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text | Primary key |
| `slug` | text, unique | From the title. Never changes once shared. Page at `/sessions/<slug>` |
| `title` | text | Short, plain words |
| `description` | text | What you'll do and what to bring |
| `status` | text | `proposed` (shown as "Not scheduled yet"), `scheduled`, `cancelled` |
| `visible` | boolean | Hide without deleting |
| `starts_at` | text, nullable | ISO time with offset. Empty means not set yet |
| `length_min` | integer | Default 90 |
| `location` | text, nullable | Empty means The Nieux, 2040 St. Charles Ave |
| `level` | text | `all`, `new`, `sometimes`, `daily`, `build` |
| `topics` | text (JSON list) | `work`, `life`, `make`, `curious` |
| `tags` | text (JSON list) | Free words like `restaurants`, `faith` |
| `office_hours` | boolean | Back end only, never shown as a category |
| `needed` | integer | Default 5. "I want this" count that gets it scheduled |
| `seats` | integer, nullable | Default empty: no cap |
| `proposed_by` | user id, nullable | |
| `created_at` | text | |

## users

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `name`, `email`, `image` | | From Better Auth (Google, Apple, email link) |
| `level` | text, nullable | Same five levels. Asked once, used to suggest sessions |
| `newsletter` | boolean | Newsletter tool not chosen yet |
| `role` | text | `member` or `organizer` |

Better Auth also creates its own `account`, `session` and `verification` tables.

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

## krewe_requests

`id`, `group_name`, `what`, `size` (`5-10`, `10-20`, `20-40`, `40+`), `user_id`, `status` (`new`, `matched`, `scheduled`), `session_id` (once scheduled), `created_at`. A matched krewe becomes a normal session, with `visible` off when it's private.

## How a session moves

1. Someone suggests an idea. An organizer reviews it and posts it as `proposed`.
2. People tap "I want this". At `needed` with an approved guide, an organizer sets a date and marks it `scheduled`.
3. Everyone who wanted it gets an email: "It's happening Tuesday at 11:30. Can you make it?" One tap turns it into an RSVP.
