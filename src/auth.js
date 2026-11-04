// Accounts with Better Auth (https://www.better-auth.com/), stored in D1 (env.DB).
// Email first: a signed-out tap asks only for an email (see emailFirst below and /api/start in worker.js).
// Continue with Google and Continue with Apple are one-tap shortcuts. The emailed link (magic link, sent with
// Resend) is how people get back to My sessions on another device. We never call any of this "signing in".
// A provider only switches on when its secrets are set, so the site works before every key exists.
// See docs/auth.md for the keys and where they go.

import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { sendSignInLink, sendTapNote } from './email.js';

export const BASE_PATH = '/api/auth';

// Which sign-in buttons to show. The sign-in sheet hides the rest.
export function providers(env) {
  const on = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) on.push('google');
  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) on.push('apple');
  if (env.RESEND_API_KEY || env.DEV_LOG_LINKS === 'true') on.push('email');
  return on;
}

// `mail` lets the caller swap the magic-link email for a note about a tap: set mail.tapNote before calling
// auth.api.signInMagicLink, and the link goes out inside that note instead.
export async function makeAuth(env, request, mail = {}) {
  const origin = new URL(request.url).origin;
  const on = providers(env);
  const socialProviders = {};
  if (on.includes('google')) {
    socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' };
  }
  if (on.includes('apple')) {
    socialProviders.apple = { clientId: env.APPLE_CLIENT_ID, clientSecret: await appleClientSecret(env) };
  }

  return betterAuth({
    appName: 'AI January',
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    // The Worker answers on more than one host (production, preview links, localhost), so the base URL
    // follows the request. OAuth providers only accept the callback URLs registered with them.
    baseURL: origin,
    basePath: BASE_PATH,
    // Apple posts its answer back from appleid.apple.com.
    trustedOrigins: [origin, 'https://appleid.apple.com'],
    socialProviders,
    account: { accountLinking: { enabled: true, trustedProviders: ['google', 'apple'] } },
    session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 }, // stay signed in for 60 days
    user: {
      additionalFields: {
        level: { type: 'string', required: false, input: false },
        newsletter: { type: 'boolean', required: false, defaultValue: false, input: false },
        role: { type: 'string', required: false, defaultValue: 'member', input: false },
      },
    },
    plugins: [
      magicLink({
        // The link rides along in "here's what you picked" emails that people open later, so it lasts a day.
        expiresIn: 60 * 60 * 24,
        sendMagicLink: ({ email, url }) =>
          mail.tapNote
            ? sendTapNote(env, { ...mail.tapNote, to: email, url, oneTime: true, origin, local: isLocal(origin) })
            : sendSignInLink(env, { to: email, url, local: isLocal(origin) }),
      }),
      emailFirst(),
    ],
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    telemetry: { enabled: false },
  });
}

// Email first. Server-only (no URL): worker.js calls auth.api.emailFirst for a signed-out tap.
// A new email gets an account and is kept in on this device right away, so the tap counts without a link.
// An email we already know is not let in here (anyone could type it). The tap still counts for that person,
// and the emailed link lets the real owner in. When an unproven account's owner opens a link, Better Auth
// drops every session made before that, so typing someone else's email never keeps you in their account.
function emailFirst() {
  return {
    id: 'email-first',
    endpoints: {
      emailFirst: createAuthEndpoint.serverOnly({ method: 'POST' }, async (ctx) => {
        const email = String(ctx.body?.email || '').trim().toLowerCase();
        const found = await ctx.context.internalAdapter.findUserByEmail(email);
        if (found?.user) return ctx.json({ userId: found.user.id, isNew: false });
        const user = await ctx.context.internalAdapter.createUser({ email, emailVerified: false, name: '' });
        const session = await ctx.context.internalAdapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ userId: user.id, isNew: true });
      }),
    },
  };
}

const isLocal = (origin) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

// Apple wants a client secret that is a short JWT signed with the .p8 key from the Apple Developer account.
// We make it here instead of pasting one in, so it never expires on us. Kept for the life of the isolate.
let appleSecret = null;
async function appleClientSecret(env) {
  const now = Math.floor(Date.now() / 1000);
  if (appleSecret && appleSecret.exp - now > 3600) return appleSecret.jwt;
  const exp = now + 60 * 60 * 24 * 30; // Apple allows up to 6 months; 30 days is plenty
  const b64url = (v) =>
    btoa(typeof v === 'string' ? v : String.fromCharCode(...new Uint8Array(v))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: env.APPLE_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: env.APPLE_TEAM_ID, iat: now, exp, aud: 'https://appleid.apple.com', sub: env.APPLE_CLIENT_ID }));
  const pem = env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto returns the raw r||s signature, which is what a JWT wants.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${claims}`));
  appleSecret = { jwt: `${header}.${claims}.${b64url(sig)}`, exp };
  return appleSecret.jwt;
}
