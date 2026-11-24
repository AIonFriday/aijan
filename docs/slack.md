# Slack notifications

When someone uses a form or taps a button on the site, the organizers get a message in the private `#ai-january-inbox` channel in the AI Friday Slack. The database stays the record; Slack is how the team finds out. If Slack is down or refuses a message, the person's tap still saves and the error goes to the Worker logs.

| What happened | What's posted |
| --- | --- |
| Session idea, offer to guide (form or one session), Bring a group request | A full message with the details and who sent it |
| RSVP | One line with the running count |
| "I want this" | One line with the running count, marked "Ready to schedule" when an idea reaches 5 |
| Undoing a tap, or tapping something again | Nothing |

The channel is private because messages include people's email addresses. Anything a person typed is escaped, so a form can't ping `@channel` or fake a link.

## Setup

The bot is called Beignet. It's the app at https://api.slack.com/apps/A0CFU8MR480, in the AI Friday workspace, and its icon is `site/assets/brand/favicon-512.png`.

- `SLACK_BOT_TOKEN` is a Cloudflare secret. Never commit it. To change it without releasing other code, run `npx wrangler versions secret put SLACK_BOT_TOKEN`; the next deploy picks it up.
- `SLACK_CHANNEL` is the channel's ID, under `vars` in `wrangler.jsonc`. It isn't secret.
- The bot must be a member of the channel. In Slack, type `/invite @Beignet` there.
- Local runs post nothing unless you add `SLACK_BOT_TOKEN` to `.dev.vars`.
- Preview versions use the same secret and channel as production, so a form submitted on a preview link posts for real.

The code is in `src/slack.js`, with tests in `tests/slack.test.mjs`.

## Ask Beignet

In one channel, anyone can @mention Beignet and get an answer in the thread. Beignet calls a model through OpenRouter and can use the organizer tools from the admin MCP (`docs/admin.md`): list sessions and people, add and edit sessions, hide and show them, add and remove people, export a door list. It asks first before it cancels or hides a session or takes someone off one, and a "yes" in the thread confirms.

- The channel is `SLACK_ADMIN_CHANNEL` under `vars` in `wrangler.jsonc`. Right now that's the same private `#ai-january-inbox` channel, so its emails stay private. Mentions anywhere else are ignored.
- Beignet acts as an organizer, never an owner, so it can't make or remove admin keys (a new key would be posted for the whole channel to read). Tool calls are logged with `via: "slack"` and the Slack user's id.
- Mention it in the thread under one of its own posts (like a new session idea) and it reads that post too: "@Beignet add this as an idea for Making things".
- Those posts hold words a visitor typed into a form on the public site, so Beignet is told to read them as information and never as instructions. As a backstop, in a thread under one of those posts it can't use the tools that read who is in a session (`list_people`, `export_people`), so a form can't talk it into putting emails on a public page. To ask who's coming, mention it in a new message.
- The model is `BOT_MODEL` under `vars` in `wrangler.jsonc`, an OpenRouter id, now `anthropic/claude-sonnet-5.5`. Any OpenRouter model that supports tools works; change the id and merge. The OpenRouter key has a $10 a day cap, so each mention is kept small: at most 6 tool rounds, short answers, light thinking, and the last 20 thread messages. That's roughly 5 to 10 cents a mention on Sonnet.

How it works: Slack posts each event to `POST /api/slack/events`. The Worker checks Slack's signature, hands the mention to a Durable Object (`SlackBot`, one per Slack event id, so Slack's retries don't run twice) and answers Slack right away. The Durable Object does the work from an alarm, so a slow answer isn't cut off. It adds :eyes: to the message while it works. The code is `src/slack-bot.js`, with tests in `tests/slack-bot.test.mjs`.

### Setup

Secrets (Cloudflare only, never committed): `SLACK_SIGNING_SECRET` (the app's Basic Information page) and `OPENROUTER_API_KEY`. Beignet stays quiet until both are set, along with `SLACK_BOT_TOKEN`.

In the Slack app (https://api.slack.com/apps/A0CFU8MR480):

1. **OAuth & Permissions**, bot token scopes: `app_mentions:read`, `groups:history` (to read threads in a private channel; `channels:history` for a public one), `reactions:write` and `chat:write`. Reinstall the app when Slack asks; the bot token stays the same. (Done Nov 5, 2026.)
2. **Event Subscriptions**: turn it on, set the Request URL to `https://joinaijanuary.com/api/slack/events` (Slack checks it right away, so this works once the code is live and `SLACK_SIGNING_SECRET` is set), and under bot events add `app_mention`. Save.
3. Make sure Beignet is in the channel (`/invite @Beignet`).
