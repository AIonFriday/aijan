// Email through Resend (https://resend.com). Today that's only the sign-in link.
// Locally, with DEV_LOG_LINKS=true in .dev.vars and no RESEND_API_KEY, the link is printed to the terminal instead.

export async function sendSignInLink(env, { to, url, local }) {
  if (!env.RESEND_API_KEY) {
    if (local && env.DEV_LOG_LINKS === 'true') {
      console.log(`\n  Sign-in link for ${to}:\n  ${url}\n`);
      return;
    }
    throw new Error('RESEND_API_KEY is not set');
  }
  const text = [
    'Tap this link to sign in to AI January:',
    '',
    url,
    '',
    'It works once and expires in 20 minutes.',
    'If you didn’t ask for this, you can ignore this email.',
  ].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:17px;line-height:1.5;color:#2A2035;max-width:30rem">
<p>Tap the button to sign in to AI January.</p>
<p><a href="${escAttr(url)}" style="display:inline-block;background:#6A4C8C;color:#FFFDF6;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Sign in</a></p>
<p style="color:#5E5469;font-size:15px">It works once and expires in 20 minutes. If you didn’t ask for this, you can ignore this email.</p>
</div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject: 'Your AI January sign-in link', text, html }),
  });
  if (!res.ok) throw new Error(`Resend said ${res.status}: ${await res.text()}`);
}

const escAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
