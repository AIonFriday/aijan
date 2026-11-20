# Sign-in (email first)

[Better Auth](https://www.better-auth.com/) runs inside the Worker, with users stored in D1 (`aijan-db`).

Sign-in options, in this order on the sheet:

1. Continue with Google
2. Continue with Apple
3. Email me a sign-in link (a magic link sent through Resend)

Each button only shows once its keys are set, so the site works while keys are still being made.

## Behavior: email first

Decided Nov 4, 2026: people never "sign in." We ask for an email when they tap, and that's it.

- **Tap, type your email, done.** A tap from someone this device doesn't know yet (RSVP, "I want this", "I could guide this", or a form's submit) opens a small sheet that asks only "Your email". The tap counts as soon as they press the button. There's no link to click first. Continue with Google and Continue with Apple sit under it as one-tap shortcuts.
- **A new email** gets an account and stays in on this device right away (`emailFirst` in `src/auth.js`, called from `POST /api/start`).
- **An email we already know** isn't let in on this device, because anyone could type it. The tap still counts for that person, the button stays pressed on this device (`localStorage`), and the email carries a link back in. To undo a tap there, they open that link.
- **Every email is a note about the tap**: "You're going: …" with a calendar invite (`invite.ics`, `METHOD:REQUEST`, so Gmail, Apple Mail and Outlook show it as an event) and Google Calendar and Outlook links for RSVPs, "Got it: …" for ideas, thanks for guide offers, suggestions, and group requests. Each note has a "See your sessions" button. That button is a one-time link (Better Auth's magic link) that lasts 24 hours. RSVPs from someone already in on the device get the same note and invite, with a plain link to `/me`. Taking an RSVP back sends "You're off the list: …" with a cancel (`METHOD:CANCEL`, same UID) so the event leaves their calendar.
- **On another device**, `/me` asks for the email and sends the link. It never says "sign in."
- **If someone types another person's email**, they can add taps for that person, but they never see or change that person's list. When the real owner opens a link, Better Auth drops every session the account had before its email was proven.
- At most 6 notes go to one address in a day (`canEmail` in `src/api.js`). Taps past that still count, but they don't send email.
- The menu shows **My sessions** only once this device has something to show.
- People stay in for 60 days. "Sign out on this device" is at the bottom of `/me`.
- We only email people about what they picked. The newsletter is a separate opt-in.

## How it's built

| Piece | Where |
| --- | --- |
| Better Auth config | `src/auth.js` |
| Tap notes, calendar invites, and the link email (Resend) | `src/email.js` |
| Taps (RSVP, want, guide, forms), daily email cap | `src/api.js` |
| Email first (`POST /api/start`) | `src/worker.js`, `emailFirst` in `src/auth.js` |
| Routes | `src/worker.js` |
| Tables | `migrations/0001_sign_in_and_taps.sql` |
| Email sheet, saved taps, `/api/me` | `site/assets/app.js`, `site/partials/sheet.html` |
| My sessions page | `site/pages/me.html`, `site/assets/me.js` (served at `/me`) |

The browser talks to Better Auth's own routes with `fetch`, so there's no client library:

- `POST /api/auth/sign-in/social` with `{ provider: "google" | "apple", callbackURL }` returns a URL to send the person to.
- `POST /api/start` with `{ email, tap }` (ours) saves a tap from someone new on this device and sends the note.
- `POST /api/auth/sign-in/magic-link` with `{ email, callbackURL }` sends the link to My sessions (used on `/me`).
- `POST /api/auth/sign-out` signs out.
- `GET /api/me` (ours) returns the person, their taps, live counts, and which sign-in buttons work.

The base URL follows the request host, so sign-in works on production, preview links, and `localhost`. Google and Apple only accept callback URLs registered with them (see below), so on preview links only the emailed link works.

## Keys to create

The site lives at `https://joinaijanuary.com`. The old `https://aijan-web.andrewdunn.workers.dev` address keeps working, so its callback URLs are listed too.

Set every value below in the Cloudflare dashboard: **Workers & Pages → aijan-web → Settings → Variables and Secrets → Add**, type **Secret**. Locally, put them in `.dev.vars` (copy `.dev.vars.example`). Never commit them.

### 1. `BETTER_AUTH_SECRET`

A long random string that signs sign-in cookies. Make one with `openssl rand -base64 32`. Changing it signs everyone out.

### 2. Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project called "AI January".
2. Go to **Google Auth Platform**. Under **Branding**, set the app name "AI January", a support email, and the logo if you like.
3. Under **Audience**, pick **External** and then **Publish app**. Basic sign-in (name, email, photo) doesn't need Google's review.
4. Under **Clients**, create a client of type **Web application**:
   - Authorized JavaScript origins: `https://joinaijanuary.com`, `https://aijan-web.andrewdunn.workers.dev`, and `http://localhost:8787`
   - Authorized redirect URIs: `https://joinaijanuary.com/api/auth/callback/google`, `https://aijan-web.andrewdunn.workers.dev/api/auth/callback/google`, and `http://localhost:8787/api/auth/callback/google`
   - Under **Branding**, add `joinaijanuary.com` as an authorized domain.
5. Copy the Client ID and Client secret.

### 3. Apple: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`

In the [Apple Developer account](https://developer.apple.com/account/resources/identifiers/list), under **Certificates, IDs & Profiles**:

1. **Identifiers → + → App IDs → App.** Description "AI January", bundle ID like `day.aifri.aijan`. Turn on **Sign in with Apple**. Register.
2. **Identifiers → + → Services IDs.** Description "AI January", identifier like `day.aifri.aijan.web`. This identifier is `APPLE_CLIENT_ID`. Register, open it, turn on **Sign in with Apple**, and click **Configure**:
   - Primary App ID: the one from step 1
   - Domains: `joinaijanuary.com` and `aijan-web.andrewdunn.workers.dev`
   - Return URLs: `https://joinaijanuary.com/api/auth/callback/apple` and `https://aijan-web.andrewdunn.workers.dev/api/auth/callback/apple`
   - Apple doesn't allow `localhost`, so Apple sign-in can't be tested locally.
3. **Keys → +.** Name it "AI January sign-in", turn on **Sign in with Apple**, configure it with the App ID from step 1, and register. Download the `.p8` file (Apple only lets you download it once). The **Key ID** on that page is `APPLE_KEY_ID`.
4. Your **Team ID** is in the top right of the developer site (and under Membership). That's `APPLE_TEAM_ID`.
5. `APPLE_PRIVATE_KEY` is the whole text of the `.p8` file, including the `BEGIN` and `END` lines.

The Worker turns the key into Apple's short-lived client secret on its own (`src/auth.js`), so there's nothing to renew every six months.

### 4. Resend: `RESEND_API_KEY` and `EMAIL_FROM`

1. In [Resend](https://resend.com/domains), add and verify `joinaijanuary.com` (DNS records go wherever the domain's DNS lives).
2. Under **API Keys**, create a key with **Sending access** limited to that domain. That's `RESEND_API_KEY`.
3. `EMAIL_FROM` is a plain variable in `wrangler.jsonc` (today `AI January <hello@joinaijanuary.com>`). Change it there if the sending address is different.

## The domain

`joinaijanuary.com` points at the Worker as a Cloudflare custom domain (**Workers & Pages → aijan-web → Settings → Domains & Routes → Add → Custom domain**). Share links and canonical URLs come from `SITE_URL` at build time; it defaults to `https://joinaijanuary.com` in `scripts/build.mjs`.

## Database migrations

Tables live in `migrations/`. `npm run dev` applies them to the local database. In production, the Workers Builds deploy command should be `npm run deploy`, which applies new migrations to `aijan-db` before deploying (**Workers & Pages → aijan-web → Settings → Build → Deploy command**). If that fails on permissions, give the build's API token **D1: Edit**.

Every migration uses `IF NOT EXISTS`, so running one twice is harmless. Preview links use the same `aijan-db` as production, so test with care.

## Local development

```sh
cp .dev.vars.example .dev.vars   # set BETTER_AUTH_SECRET
npm run build
npm run dev                      # http://localhost:8787
```

With `DEV_LOG_LINKS=true` and no `RESEND_API_KEY`, tapping "Email me a sign-in link" prints the link in the terminal instead of sending it. That only works on `localhost`.
