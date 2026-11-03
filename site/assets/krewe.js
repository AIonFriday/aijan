// Bring your krewe: three questions only (group name, what you want to learn, how many people).
// Organizers match the group with a guide and a time, then email them.
(() => {
  const { $, esc, needSignIn, wirePills } = window.AJ;
  wirePills();
  $('#kform').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#k-name').value.trim();
    const what = $('#k-what').value.trim();
    if (!name || !what) { $('#k-err').hidden = false; return; }
    $('#k-err').hidden = true;
    needSignIn(() => {
      $('#kform-wrap').innerHTML = `<div class="done" tabindex="-1"><span class="kicker">Request sent</span><h3>${esc(name)} is on the list.</h3>
        <p>We’ll match you with a guide and email you a time within a few days.</p></div>`;
      $('#kform-wrap .done').focus();
    });
  });
})();
