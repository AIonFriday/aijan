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
