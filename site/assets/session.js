// One session's page (/sessions/<slug>). The build writes the page's facts into the HTML for search engines
// and link previews; this script only handles the buttons. The session's data sits in data-* attributes on <article>.
(() => {
  const { $, me, say, act, countFor, NEEDED } = window.AJ;
  const el = $('article.sp');
  const s = { ...el.dataset, count: Number(el.dataset.count) };
  const scheduled = s.status === 'scheduled';
  const kind = scheduled ? 'rsvp' : 'want';
  const url = `${location.origin}/sessions/${s.slug}`;
  const main = $('#main');
  const mine = () => (scheduled ? me.going : me.want).has(s.slug);

  function paint() {
    const on = mine();
    const n = countFor(s);
    main.setAttribute('aria-pressed', on);
    $('#cnt').textContent = n;
    if (scheduled) main.textContent = on ? 'You’re going ✓' : 'RSVP';
    else {
      main.textContent = on ? 'You want this ✓' : 'I want this';
      $('#more').textContent = n >= NEEDED ? 'enough people, scheduling soon' : `${NEEDED - n} more and we schedule it`;
    }
    const g = $('#guide');
    if (g && me.guide.has(s.slug)) g.outerHTML = '<b>Thanks. An organizer will reach out about guiding.</b>';
  }

  main.addEventListener('click', () => act({ type: kind, slug: s.slug, on: !mine() }));
  $('#guide').addEventListener('click', (e) => { e.preventDefault(); act({ type: 'guide', slug: s.slug, on: true }); });
  document.addEventListener('aj:change', paint);

  $('#share').addEventListener('click', () => {
    if (navigator.share) navigator.share({ title: s.title, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => say('Link copied'), () => say(url));
  });

  // Add to calendar: a one-event .ics file, as long as the session (90 minutes unless it says otherwise).
  const ics = $('#ics');
  if (ics) {
    ics.addEventListener('click', () => {
      const start = new Date(s.startsAt);
      const end = new Date(start.getTime() + (s.lengthMin || 90) * 60000);
      const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const escIcs = (t) => t.replace(/[\\,;]/g, (c) => '\\' + c);
      const text = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AI January//EN', 'BEGIN:VEVENT',
        `UID:${s.slug}@aijan`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
        `SUMMARY:${escIcs(s.title)}`, `LOCATION:${escIcs(s.location)}`, `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR',
      ].join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
      a.download = `${s.slug}.ics`;
      a.click();
    });
  }

  paint();
})();
