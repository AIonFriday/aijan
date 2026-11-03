// Sign-in with Better Auth (https://www.better-auth.com/), stored in D1 (env.DB).
// Three ways in: Continue with Google, Continue with Apple, and an emailed sign-in link (sent with Resend).
// A provider only switches on when its secrets are set, so the site works before every key exists.
// See docs/auth.md for the keys and where they go.

import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { sendSignInLink } from './email.js';

export const BASE_PATH = '/api/auth';

// Which sign-in buttons to show. The sign-in sheet hides the rest.
export function providers(env) {
  const on = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) on.push('google');
  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) on.push('apple');
  if (env.RESEND_API_KEY || env.DEV_LOG_LINKS === 'true') on.push('email');
  return on;
}

export async function makeAuth(env, request) {
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
        expiresIn: 60 * 20, // 20 minutes
        sendMagicLink: ({ email, url }) => sendSignInLink(env, { to: email, url, local: isLocal(origin) }),
      }),
    ],
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    telemetry: { enabled: false },
  });
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
