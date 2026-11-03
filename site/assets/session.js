// One session's page (/sessions/<slug>). The build writes the page's facts into the HTML for search engines
// and link previews; this script only handles the buttons. The session's data sits in data-* attributes on <article>.
(() => {
  const { $, say, needSignIn, siteUrl } = window.AJ;
  const el = $('article.sp');
  const s = { ...el.dataset, count: Number(el.dataset.count), scheduled: el.dataset.status === 'scheduled' };
  const NEEDED = 5;
  const url = `${siteUrl}/sessions/${s.slug}`;
  let on = false;
  const main = $('#main');

  function paint() {
    const n = s.count + (on ? 1 : 0);
    main.setAttribute('aria-pressed', on);
    if (s.scheduled) {
      main.textContent = on ? 'You’re going ✓' : 'RSVP';
      $('#cnt').textContent = n;
    } else {
      main.textContent = on ? 'You want this ✓' : 'I want this';
      $('#cnt').textContent = n;
      $('#more').textContent = n >= NEEDED ? 'enough people, scheduling soon' : `${NEEDED - n} more and we schedule it`;
    }
  }

  main.addEventListener('click', () => {
    if (on) { on = false; paint(); say('Removed. You can change your mind anytime.'); return; }
    needSignIn(() => {
      on = true;
      paint();
      if (s.scheduled) say('You’re going. We’ll email a reminder the day before.');
      else say(s.count + 1 >= NEEDED ? 'That makes five. We’ll email you a date.' : 'Got it. We’ll email you when it’s scheduled.');
    });
  });

  $('#share').addEventListener('click', () => {
    if (navigator.share) navigator.share({ title: s.title, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => say('Link copied'), () => say(url));
  });

  $('#guide').addEventListener('click', (e) => {
    e.preventDefault();
    needSignIn(() => { $('#guide').outerHTML = '<b>Thanks. An organizer will reach out about guiding.</b>'; });
  });

  // Add to calendar: a one-event .ics file, 90 minutes long.
  const ics = $('#ics');
  if (ics) {
    ics.addEventListener('click', () => {
      const start = new Date(s.startsAt);
      const end = new Date(start.getTime() + 90 * 60000);
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
