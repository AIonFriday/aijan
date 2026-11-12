// Bring your krewe: easy questions first (how many people, what to learn as tap-to-pick topics), then an optional
// sentence and the group name. The topics and the sentence are sent together as `what`.
// Organizers match the group with a guide and a time, then email them.
(() => {
  const { $, esc, act, wirePills, pickedValues } = window.AJ;
  wirePills();
  $('#kform').addEventListener('submit', (e) => {
    e.preventDefault();
    const groupName = $('#k-name').value.trim();
    const topics = pickedValues('k-topic');
    const what = [topics.join(', '), $('#k-what').value.trim()].filter(Boolean).join('. ');
    if (!groupName || !what) { $('#k-err').hidden = false; return; }
    $('#k-err').hidden = true;
    act({ type: 'krewe', groupName, what, size: pickedValues('k-size')[0] || '' });
  });
  document.addEventListener('aj:change', (e) => {
    if (e.detail.tap?.type !== 'krewe') return;
    $('#kform-wrap').innerHTML = `<div class="done" tabindex="-1"><span class="kicker">Request sent</span><h2 class="as-h3">${esc(e.detail.tap.groupName)} is on the list.</h2>
      <p>We’ll match you with a guide and email you a time within a few days.</p></div>`;
    $('#kform-wrap .done').focus();
  });
})();
