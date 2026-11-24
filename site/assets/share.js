// /share: the faculty share kit. A Guide picks themselves, and a session or the whole month, and gets three share
// images drawn here on a <canvas> (nothing is uploaded) plus posts to copy, each with its own tracked link.
// Data: window.AJ_DATA from /assets/sessions.js. Load after app.js, sessions.js and cards.js.
(() => {
  const { $, esc, say, track, FACULTY, fmt, allDay, placeName } = window.AJ;
  const { sessions: ALL, timeZone: tz } = window.AJ_DATA;
  const SITE = 'joinaijanuary.com';
  const ORIGIN = location.origin;
  const now = new Date().toISOString();

  // Brand colors, the same as the tokens in site.css.
  const C = { paper: '#F1EDF3', card: '#FBF9FC', ink: '#2A2035', soft: '#5E5469', purple: '#6A4C8C', purpleSoft: '#E6DEEF', green: '#4E7A5A', greenSoft: '#DDEADF', gold: '#B08A2E', goldSoft: '#F2E7C9', goldBright: '#D2A63C', btnInk: '#FFFDF6', line: '#DCD4E2' };
  const TINT = { purple: [C.purpleSoft, C.purple], green: [C.greenSoft, C.green], gold: [C.goldSoft, C.gold] };
  const DISPLAY = '"Bricolage Grotesque", "Avenir Next", system-ui, sans-serif';
  const BODY = '"Atkinson Hyperlegible", system-ui, sans-serif';
  const MONO = '"IBM Plex Mono", ui-monospace, monospace';

  // ---------- who and what ----------
  const scheduled = ALL.filter((s) => s.status === 'scheduled' && s.startsAt && !s.example);
  const leads = (name) => (s) => s.guides.some((g) => g.name.toLowerCase() === name.toLowerCase());
  // A person's own sessions plus their groups' sessions; upcoming first, then any that already happened.
  const sessionsOf = (f) => {
    const names = [f.name, ...(f.groups || [])];
    return scheduled.filter((s) => names.some((n) => leads(n)(s))).sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1));
  };
  const people = FACULTY.filter((f) => !f.isGroup), groups = FACULTY.filter((f) => f.isGroup);
  const byName = (a, b) => a.name.localeCompare(b.name);
  const opt = (f) => `<option value="${esc(f.slug)}">${esc(f.name)}</option>`;
  $('#sh-who').innerHTML += (people.length ? `<optgroup label="People">${people.sort(byName).map(opt).join('')}</optgroup>` : '')
    + (groups.length ? `<optgroup label="Organizations">${groups.sort(byName).map(opt).join('')}</optgroup>` : '');
  $('#sh-none').hidden = false;

  // ---------- words ----------
  const day = (s) => new Date(s.startsAt).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' });
  const shortDay = (s) => new Date(s.startsAt).toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
  const time = (s) => (allDay(s) ? 'all day' : fmt(s.startsAt).t.toLowerCase().replace(' ', ''));
  const where = (s) => placeName(s) || 'The Nieux';
  const first = (f) => (f.isGroup ? f.name : f.name.split(' ')[0]);
  // The first sentence of a session's description, for the longer posts. Short enough to read on a phone.
  const blurb = (s) => {
    const t = String(s.description || '').replace(/\s+/g, ' ').trim();
    const m = t.match(/^.{20,220}?[.!?](\s|$)/);
    return m ? m[0].trim() : t.length <= 220 ? t : '';
  };

  // A link that says where it was shared and who shared it (docs/analytics.md).
  const link = (pick, source, medium) => {
    const path = pick.s ? `/sessions/${pick.s.slug}` : '/';
    const q = new URLSearchParams({ utm_source: source, utm_medium: medium, utm_campaign: pick.s ? pick.s.slug : 'faculty', utm_content: pick.f.slug });
    return `${ORIGIN}${path}?${q}`;
  };

  function posts(pick) {
    const { f, s } = pick;
    const I = f.isGroup ? 'We' : 'I', Im = f.isGroup ? 'We’re' : 'I’m', my = f.isGroup ? 'our' : 'my';
    const a = (src, med) => link(pick, src, med);
    if (!s) {
      return [
        ['LinkedIn or Facebook', `This January ${f.isGroup ? 'we’re' : 'I’m'} part of the faculty for AI January: three weeks of free AI sessions in New Orleans, Jan 8–28.\n\nMost are at The Nieux on St. Charles. They’re small and hands-on: someone opens a laptop, shows what they do with AI, and helps you try it. No experience needed.\n\nIt starts with AI Friday on Jan 8 at 9am. If you know someone who keeps meaning to try AI, send them this.\n\n${a('linkedin', 'social')}`],
        ['Instagram caption', `Free AI sessions all January in New Orleans. Beginners welcome. ${I} ${f.isGroup ? 'are' : 'am'} part of the faculty.\n\nJan 8–28, mostly at The Nieux. Link in ${my} bio: ${SITE}`],
        ['Text a friend', `Hey! There’s a month of free AI sessions in New Orleans this January, and ${f.isGroup ? 'we’re' : 'I’m'} helping out. Totally beginner friendly. Thought of you: ${a('text', 'chat')}`],
        ['Your newsletter or Slack', `AI January is three weeks of free AI sessions in New Orleans, Jan 8–28, mostly at The Nieux. ${Im} part of the faculty. Sessions are small and hands-on, and all levels are welcome. See what’s on: ${a('newsletter', 'email')}`],
      ];
    }
    const when = `${day(s)} at ${time(s)}`;
    const b = blurb(s);
    return [
      ['LinkedIn or Facebook', `${Im} leading a free session at AI January: “${s.title},” ${when} at ${where(s)}.\n\n${b ? `${b}\n\n` : ''}No experience needed. Bring a laptop if you have one, or just your phone.\n\nIf you know someone who keeps meaning to try AI, send this their way.\n\n${a('linkedin', 'social')}`],
      ['Instagram caption', `${Im} leading “${s.title}” on ${shortDay(s)} at ${time(s)}. Free, in person in New Orleans, beginners welcome.\n\nPart of AI January. RSVP at the link in ${my} bio, or ${SITE}`],
      ['Text a friend', `Hey! ${Im} leading a free AI session on ${shortDay(s)} at ${time(s)} at ${where(s)}. It’s beginner friendly and ${f.isGroup ? 'we' : 'I'} thought of you. Want to come? ${a('text', 'chat')}`],
      ['Your newsletter or Slack', `${f.isGroup ? f.name + ' is' : Im} leading “${s.title}” on ${when} at ${where(s)}, as part of AI January (three weeks of free AI sessions in New Orleans). All levels welcome. Please RSVP so we know how many chairs to set out: ${a('newsletter', 'email')}`],
    ];
  }

  // ---------- images ----------
  // Fonts come from Google Fonts in the page head; wait for them so the canvas doesn't fall back to system fonts.
  const fontsReady = Promise.race([
    Promise.all([`800 80px ${DISPLAY}`, `700 40px ${DISPLAY}`, `700 30px ${BODY}`, `400 30px ${BODY}`, `600 30px ${MONO}`].map((f) => document.fonts?.load(f))).catch(() => {}),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  const images = {};
  const loadImage = (src) => images[src] || (images[src] = new Promise((resolve) => {
    const img = new Image();
    if (/^https?:/.test(src) && !src.startsWith(ORIGIN)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  }));
  const LOGO = '/assets/brand/ai-january-compact-lockup-color.svg'; // 1960 x 508

  // Breaks text into lines that fit, shrinking the font until it fits in maxLines.
  function fitText(ctx, text, { font, size, min, width, maxLines }) {
    for (let px = size; px >= min; px -= 2) {
      ctx.font = font(px);
      const lines = [];
      let line = '';
      for (const w of text.split(/\s+/)) {
        const tryLine = line ? `${line} ${w}` : w;
        if (ctx.measureText(tryLine).width <= width || !line) line = tryLine;
        else { lines.push(line); line = w; }
      }
      if (line) lines.push(line);
      if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= width)) return { lines, px };
      if (px - 2 < min) return { lines: lines.slice(0, maxLines).map((l, i, a) => (i === a.length - 1 && lines.length > maxLines ? `${l.replace(/\s*\S*$/, '')}…` : l)), px };
    }
    return { lines: [text], px: min };
  }
  const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };

  // The photo in a circle (a group's logo in a rounded square, shown whole), or initials on the person's tint.
  async function drawAvatar(ctx, f, x, y, d) {
    const img = f.photo && (await loadImage(f.photo));
    const [bg, fg] = TINT[f.tint] || TINT.purple;
    ctx.save();
    if (f.isGroup) roundRect(ctx, x, y, d, d, d * 0.18); else { ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); }
    ctx.fillStyle = img && f.isGroup ? '#FFFFFF' : bg;
    ctx.fill();
    ctx.clip();
    if (img) {
      const iw = img.naturalWidth || d, ih = img.naturalHeight || d;
      // People fill the circle; logos fit inside with a little room.
      const k = f.isGroup ? Math.min((d * 0.82) / iw, (d * 0.82) / ih) : Math.max(d / iw, d / ih);
      ctx.drawImage(img, x + (d - iw * k) / 2, y + (d - ih * k) / 2, iw * k, ih * k);
    } else {
      ctx.fillStyle = fg;
      ctx.font = `800 ${Math.round(d * 0.38)}px ${DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.initials || '', x + d / 2, y + d / 2 + d * 0.02);
    }
    ctx.restore();
    ctx.save();
    ctx.lineWidth = Math.max(4, d * 0.025);
    ctx.strokeStyle = C.card;
    if (f.isGroup) roundRect(ctx, x, y, d, d, d * 0.18); else { ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); }
    ctx.stroke();
    ctx.restore();
  }

  // A soft field of dots, like the hero map, so the image isn't a flat color.
  function dots(ctx, W, H) {
    ctx.save();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < (W * H) / 2600; i++) {
      const x = rnd() * W, y = rnd() * H;
      const fade = Math.max(0, 1 - Math.hypot(x - W, y) / (Math.max(W, H) * 1.05));
      if (fade <= 0) continue;
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = [C.purple, C.green, C.goldBright][i % 3];
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // The words every image carries.
  const facts = ({ f, s }) => s
    ? { kicker: `${shortDay(s)} · ${allDay(s) ? 'All day' : fmt(s.startsAt).t} · ${where(s)}`.toUpperCase(), head: s.title, by: `With ${f.name}` }
    : { kicker: 'Jan 8–28, 2027 · New Orleans'.toUpperCase(), head: f.isGroup ? 'Come learn AI with us.' : 'Come learn AI with me.', by: f.isGroup ? f.name : `${f.name}, AI January faculty` };

  // Three sizes: a square post, a phone story, and a wide link image.
  const SIZES = [
    { key: 'square', label: 'Square post', note: 'Instagram, LinkedIn, Facebook', W: 1080, H: 1080 },
    { key: 'story', label: 'Story', note: 'Instagram or Facebook story', W: 1080, H: 1920 },
    { key: 'wide', label: 'Wide', note: 'LinkedIn, X, email', W: 1200, H: 630 },
  ];

  async function draw(canvas, size, pick) {
    await fontsReady;
    const { W, H, key } = size;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const t = facts(pick);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    dots(ctx, W, H);

    const pad = key === 'wide' ? 64 : 84;
    const bar = key === 'story' ? 220 : key === 'wide' ? 96 : 150;
    // The bottom band: free, and where to find it.
    ctx.fillStyle = C.purple;
    ctx.fillRect(0, H - bar, W, bar);
    ctx.fillStyle = C.btnInk;
    ctx.textBaseline = 'middle';
    const barText = key === 'wide' ? 30 : 38;
    ctx.font = `700 ${barText}px ${BODY}`;
    ctx.textAlign = 'left';
    ctx.fillText(pick.s ? 'Free · Beginners welcome' : 'Free · All levels', pad, H - bar / 2);
    ctx.textAlign = 'right';
    ctx.font = `700 ${barText}px ${DISPLAY}`;
    ctx.fillText(SITE, W - pad, H - bar / 2);
    ctx.textAlign = 'left';

    // The lockup, top left.
    const logo = await loadImage(LOGO);
    const lw = key === 'wide' ? 300 : key === 'story' ? 440 : 380;
    if (logo) ctx.drawImage(logo, pad - lw * 0.02, key === 'story' ? 120 : pad - 16, lw, (lw * 508) / 1960);

    const top = key === 'story' ? 120 + (lw * 508) / 1960 + 120 : pad + (lw * 508) / 1960 + (key === 'wide' ? 28 : 56);
    if (key === 'wide') {
      // Photo on the right, words on the left.
      const d = 300;
      await drawAvatar(ctx, pick.f, W - pad - d, (H - bar - d) / 2 + 10, d);
      const tw = W - pad * 2 - d - 48;
      ctx.fillStyle = C.gold; ctx.font = `600 24px ${MONO}`; ctx.textBaseline = 'alphabetic';
      ctx.fillText(t.kicker, pad, top + 20, tw);
      const h = fitText(ctx, t.head, { font: (px) => `800 ${px}px ${DISPLAY}`, size: 64, min: 36, width: tw, maxLines: 3 });
      ctx.fillStyle = C.ink;
      h.lines.forEach((l, i) => ctx.fillText(l, pad, top + 30 + h.px * 1.05 * (i + 1)));
      ctx.fillStyle = C.soft; ctx.font = `700 28px ${BODY}`;
      ctx.fillText(t.by, pad, top + 30 + h.px * 1.05 * h.lines.length + 52, tw);
      return;
    }
    // Square and story: photo, then the kicker, the title and who's leading it.
    const d = key === 'story' ? 420 : 250;
    await drawAvatar(ctx, pick.f, pad, top, d);
    let y = top + d + (key === 'story' ? 110 : 76);
    const tw = W - pad * 2;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.gold; ctx.font = `600 ${key === 'story' ? 36 : 30}px ${MONO}`;
    ctx.fillText(t.kicker, pad, y, tw);
    const h = fitText(ctx, t.head, { font: (px) => `800 ${px}px ${DISPLAY}`, size: key === 'story' ? 112 : 84, min: key === 'story' ? 60 : 44, width: tw, maxLines: key === 'story' ? 5 : 3 });
    ctx.fillStyle = C.ink;
    y += 18;
    h.lines.forEach((l) => { y += h.px * 1.04; ctx.fillText(l, pad, y); });
    ctx.fillStyle = C.soft; ctx.font = `700 ${key === 'story' ? 44 : 34}px ${BODY}`;
    ctx.fillText(t.by, pad, y + (key === 'story' ? 86 : 62), tw);
  }

  const fileName = (pick, size) => `ai-january-${pick.s ? pick.s.slug : pick.f.slug}-${size.key}.png`;
  const blobOf = (canvas) => new Promise((r) => canvas.toBlob(r, 'image/png'));

  // ---------- the page ----------
  let pick = null;
  let drawing = 0;

  async function render() {
    const f = FACULTY.find((x) => x.slug === $('#sh-who').value);
    $('#sh-kit').hidden = !f;
    $('#sh-what-f').hidden = !f;
    $('#sh-none').hidden = !!f;
    if (!f) { history.replaceState(null, '', '/share'); return; }
    const mine = sessionsOf(f);
    const upcoming = mine.filter((s) => s.startsAt >= now);
    const what = $('#sh-what');
    const keep = what.dataset.for === f.slug ? what.value : new URLSearchParams(location.search).get('s');
    what.innerHTML = mine.map((s) => `<option value="${esc(s.slug)}">${esc(shortDay(s))}: ${esc(s.title)}</option>`).join('') + '<option value="">All of AI January</option>';
    what.dataset.for = f.slug;
    what.value = mine.some((s) => s.slug === keep) || keep === '' ? keep : (upcoming[0] || mine[0])?.slug || '';
    const s = mine.find((x) => x.slug === what.value) || null;
    pick = { f, s };
    history.replaceState(null, '', `/share?f=${encodeURIComponent(f.slug)}${s ? `&s=${encodeURIComponent(s.slug)}` : ''}`);

    $('#sh-url').textContent = link(pick, 'share', 'link');
    $('#sh-texts').innerHTML = posts(pick).map(([label, text], i) => `
      <div class="blurb share-post">
        <h3><label for="sh-t${i}">${esc(label)}</label></h3>
        <textarea id="sh-t${i}" rows="${Math.min(12, text.split('\n').length + Math.ceil(text.length / 45))}">${esc(text)}</textarea>
        <button class="small copy" type="button" data-copy-field="sh-t${i}" data-label="${esc(label)}">Copy</button>
      </div>`).join('');

    const run = ++drawing;
    $('#sh-imgs').innerHTML = SIZES.map((z) => `
      <figure class="share-img share-${z.key}">
        <canvas width="${z.W}" height="${z.H}" role="img" aria-label="${esc(`${z.label} share image`)}"></canvas>
        <figcaption><span><b>${esc(z.label)}</b> ${esc(z.note)}</span>
          <span class="share-acts"><a class="go" href="#" data-save="${z.key}" download>Save</a><button class="linkbtn" type="button" data-share="${z.key}" hidden>Share</button></span></figcaption>
      </figure>`).join('');
    await Promise.all(SIZES.map(async (z, i) => {
      const fig = $('#sh-imgs').children[i];
      const canvas = fig.querySelector('canvas');
      await draw(canvas, z, pick);
      if (run !== drawing) return;
      const blob = await blobOf(canvas).catch(() => null);
      if (!blob || run !== drawing) return;
      const a = fig.querySelector('[data-save]');
      a.href = URL.createObjectURL(blob);
      a.download = fileName(pick, z);
      const file = new File([blob], fileName(pick, z), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        const b = fig.querySelector('[data-share]');
        b.hidden = false;
        b.onclick = () => navigator.share({ files: [file] }).then(() => track('share_kit', { type: `share_${z.key}` })).catch(() => {});
      }
    }));
    track('share_kit', { type: 'pick', slug: s ? s.slug : 'month' });
  }

  async function copy(text, done) {
    try { await navigator.clipboard.writeText(text); say(done); } catch { say('Couldn’t copy. Select the text and copy it yourself.'); }
  }
  document.addEventListener('click', (e) => {
    const field = e.target.closest('[data-copy-field]');
    if (field) { copy($(`#${field.dataset.copyField}`).value, 'Copied'); track('share_kit', { type: 'copy' }); return; }
    const plain = e.target.closest('[data-copy]');
    if (plain) { copy($(`#${plain.dataset.copy}`).textContent.trim(), 'Link copied'); return; }
    const save = e.target.closest('[data-save]');
    if (save) {
      if (save.getAttribute('href') === '#') { e.preventDefault(); say('Still drawing. Try again in a second.'); return; }
      track('share_kit', { type: `save_${save.dataset.save}` });
    }
  });
  $('#sh-who').addEventListener('change', render);
  $('#sh-what').addEventListener('change', render);

  // Arriving from a faculty page or an email: /share?f=<slug>&s=<session slug>.
  const start = new URLSearchParams(location.search).get('f');
  if (start && FACULTY.some((f) => f.slug === start)) { $('#sh-who').value = start; render(); }
})();
