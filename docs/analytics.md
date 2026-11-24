# Analytics

Two tools count visits, both loaded from `site/partials/head.html`:

- **Umami** (`AI January` on umami.dunn.us): no cookies. Only counts on joinaijanuary.com (`data-domains`). Replays and heatmaps are on in the website's Umami settings (sample rate 1, mask level moderate, block selector `input, textarea` so text fields never show). They need `recorder.js`, loaded right after `script.js` in `head.html`. Lower the sample rates if traffic gets big.
- **Google Analytics 4** (`G-DEWHWDYDEB`, under andrewedunn@gmail.com): sets cookies. Only loads on joinaijanuary.com, so previews and local dev stay out of the numbers.

Search Console and Bing Webmaster Tools cover search. See the privacy page (`/privacy`) for what we tell visitors.

## Events

Every event goes to both tools through `AJ.track(name, data)` in `site/assets/app.js`. **Never send an email, a name, or anything someone typed.** Only event names, session slugs and short labels.

Taps count once the server saved them, not when the button was pressed.

| Event | When | Data |
| --- | --- | --- |
| `rsvp` | Someone RSVPs to a scheduled session | `slug`, `via` |
| `want` | "I want this" on an idea, including the "AI for…" buttons | `slug`, `via` |
| `offer_to_guide` | "I could guide this" on one session | `slug`, `via` |
| `suggest_idea` | An idea sent from /sessions | `via` |
| `guide_form` | The Teach form (/guide) sent | `via` |
| `group_request` | The Bring a group form (/krewe) sent | `via` |
| `undo` | Someone un-RSVPs or takes back a want | `type`, `slug` |
| `email_sheet_open` | The "what's your email?" sheet opens for someone new | `for` (the tap type) |
| `email_sheet_cancel` | They close it without giving an email | `for` |
| `email_added` | They give an email in the sheet | `for`, `new` (`yes` if this device stays in) |
| `sso_start` | They tap Google or Apple | `provider` |
| `my_sessions_link` | Someone asks for a link to My sessions on /me | |
| `share` | Share on a session page | `slug`, `method` (`native` or `copy`) |
| `add_to_calendar` | Add to calendar on a session page | `slug` |
| `share_kit` | Faculty use the share kit (/share): pick a session, copy a post, save or share an image | `type` (`pick`, `copy`, `save_square`, `share_story`, …), `slug` on `pick` |

`via` says how we knew who it was: `known` (already in on this device), `email` (just typed it in the sheet), or `sso` (back from Google or Apple).

The useful funnel: `email_sheet_open` → `email_added` (or `email_sheet_cancel`). If lots of people cancel, the sheet is asking too much.

### GA4 key events

Mark `rsvp`, `want`, `email_added`, `guide_form` and `group_request` as key events in GA4 (Admin → Events, after each has fired once). Umami needs no setup; events show under Events.

## Links we share: UTM tags

Add UTM tags to every link we post outside the site, so visits show where they came from in both tools. Lowercase, with dashes.

- `utm_source`: where it's posted: `slack`, `instagram`, `linkedin`, `facebook`, `newsletter`, `flyer`, `nieux`, `aifriday`, `text` (a text message), `share` (the plain link from /share).
- `utm_medium`: the kind of link: `social`, `email`, `qr`, `chat`, `partner`.
- `utm_campaign`: what it's for: `launch`, `kickoff`, `office-hours`, `faculty` (the whole month, shared by faculty), or a session slug.
- `utm_content`: who shared it, as a faculty slug. Every link on /share carries one, so we can tell each Guide how many people they brought.

Example: `https://joinaijanuary.com/sessions/ai-friday-kickoff?utm_source=instagram&utm_medium=social&utm_campaign=kickoff`

For a flyer, use a QR code with `utm_medium=qr` and a short `utm_source` for where it hangs.

The button in our own "here's what you picked" emails already carries `utm_source=email&utm_medium=email&utm_campaign=tap_note` (`EMAIL_ME` in `src/worker.js`).
