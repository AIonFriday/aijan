// Guide a session: sessions that need a guide (from the same data as the home page), and the offer-to-guide form.
// A guide can be a person or a group ("AI Friday crew"). Organizers approve every offer before it shows.
(() => {
  const { $, esc, me, say, needSignIn, wirePills, picked } = window.AJ;
  const { levels: LEVELS, sessions: S } = window.AJ_DATA;

  const needs = S.filter((s) => s.status === 'proposed' && !s.guides.length).slice(0, 4);
  function renderNeeds() {
    $('#needs').innerHTML = needs
      .map((n) => {
        const on = me.guide.has(n.slug);
        return `<li><div><a class="t" href="/sessions/${n.slug}">${esc(n.title)}</a>
          <div class="m">Not scheduled yet · ${n.count} want it · ${LEVELS[n.level]}</div></div>
          <button class="pill" type="button" data-slug="${n.slug}" aria-pressed="${on}">${on ? 'Offered. Thanks!' : 'I could guide this'}</button></li>`;
      })
      .join('');
  }
  $('#needs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-slug]');
    if (!b) return;
    const slug = b.dataset.slug;
    if (me.guide.has(slug)) { say('You already offered. An organizer will be in touch.'); return; }
    needSignIn(() => { me.guide.add(slug); renderNeeds(); say('Thanks. An organizer will reach out about guiding.'); });
  });
  renderNeeds();

  wirePills();
  $('[data-one="g-as"]').addEventListener('pick', (e) => {
    const group = e.detail === 'group';
    $('#g-group').hidden = !group;
    if (group) $('#g-group').focus();
  });

  $('#gform').addEventListener('submit', (e) => {
    e.preventDefault();
    const topics = picked('g-topic');
    const what = $('#g-what').value.trim();
    if (!topics.length && !what) { $('#g-err').hidden = false; return; }
    $('#g-err').hidden = true;
    const groupName = picked('g-as')[0] === 'A group or team' ? $('#g-group').value.trim() : '';
    needSignIn(() => {
      const who = groupName ? esc(groupName) : 'you';
      $('#gform-wrap').innerHTML = `<div class="done" tabindex="-1"><span class="kicker">Offer sent</span><h3>Thanks for offering to guide.</h3>
        <p>An organizer will look it over and email you within a few days. Once you’re approved, sessions you guide will say “Guided by ${who}.”</p></div>`;
      $('#gform-wrap .done').focus();
    });
  });
})();
