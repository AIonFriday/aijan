# Sign-in plan

**Decided:** [Better Auth](https://www.better-auth.com/) running inside the Worker, with users stored in D1.

Sign-in options, in this order on the sheet:

1. Continue with Google
2. Continue with Apple
3. Email me a sign-in link (a magic link sent through Resend)

## Behavior

- **Tap first, sign in second.** A signed-out person taps RSVP, "I want this", "I could guide this", or a form's submit. The sheet opens. After sign-in, the original tap goes through without asking again.
- Sign-in asks for nothing extra. We may ask for AI level once, later, with a skip.
- We only email people about what they picked. The newsletter is a separate opt-in.

## Setup notes for whoever builds it

- Google: an OAuth client in Google Cloud with the callback `https://<domain>/api/auth/callback/google`.
- Apple: Sign in with Apple needs a Services ID, a key, and a verified domain in the Apple Developer account (the organizers have one).
- Secrets (`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY`, `RESEND_API_KEY`) go in `.dev.vars` locally and `wrangler secret put` in production. Never commit them.
- The domain isn't chosen yet. Callback URLs will change when it is.
