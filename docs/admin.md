# Admin MCP

Organizers update the site by asking Claude (or any MCP client) to use the admin tools at `https://joinaijanuary.com/mcp`. Each admin has their own key. Changes show on the site right away, because sessions live in D1.

The code is `src/mcp.js`, the keys table is `migrations/0003_admin_keys.sql`, and the tests are `tests/mcp.test.mjs`.

## Tools

| Tool | What it does |
| --- | --- |
| `list_sessions` | Every session, including hidden and cancelled ones, with RSVP, want and guide counts |
| `get_session` | One session: every field, its counts and its page link |
| `add_session` | A new session. The slug is made from the title and never changes |
| `edit_session` | Change any field but the slug. Set `status` to `cancelled` to cancel |
| `hide_session` / `show_session` | Take a session off the site and put it back, keeping everyone's taps |
| `list_people` | Who RSVPed, wants it, or is guiding, with names and emails |
| `add_person` | Add someone by email as an RSVP, a want, or an approved guide. Sends no email |
| `remove_person` | Take someone off a session |
| `export_people` | A CSV of one session's people, for a door list |
| `whoami` | Which key you're using. Owners also see every admin key |
| `add_admin` | Make a key for a new admin (shown once). Owner only |
| `remove_admin` | Turn off someone's key right away. Owner only |

RSVPs only go on scheduled sessions and wants only on ideas, the same rule as the buttons on the site.

## Keys

- A key looks like `aj_` plus 43 characters. Only its SHA-256 hash is stored, in `admin_keys`. Nobody can read a key back out, so a lost key is replaced, not recovered.
- Roles: `owner` can add and remove admins; `organizer` can do everything else.
- `remove_admin` turns a key off on its next call. You can't remove your own key.
- The key goes in a header, never in the URL.

### The first key

Run this once, then save the key it prints somewhere safe (a password manager):

```sh
node scripts/admin-key.mjs "Andrew Dunn" andrew@example.com owner
```

It prints the `npx wrangler d1 execute aijan-db --remote --command "INSERT …"` line that stores the hash. After that, owners make keys with `add_admin`.

## Connecting

Claude Code:

```sh
claude mcp add --transport http aijan-admin https://joinaijanuary.com/mcp --header "Authorization: Bearer aj_…"
```

Other clients: point them at `https://joinaijanuary.com/mcp` (Streamable HTTP) and add the header `Authorization: Bearer aj_…`.

claude.ai and the Claude apps only take a request header in a beta, set by an organization Owner, and that header is shared by the whole organization. If organizers need the tools there, the next step is OAuth through Better Auth's MCP plugin; the tools stay the same.

For local testing, `npm run dev`, make a key with `scripts/admin-key.mjs` and run its command with `--local`, then use `http://localhost:8787/mcp`.

## How it works

- Stateless JSON-RPC over `POST /mcp`, answered as JSON. No sessions, no streaming, no packages. `GET` gets a 405.
- A request with an `Origin` from another site is refused, so a web page can't call it from someone's browser.
- Every tool call is logged to the Worker logs with the admin's email.
- New people added by email get the same kind of account a tap on the site makes (Better Auth `user`, not verified). They can get into My sessions later with an emailed link.
