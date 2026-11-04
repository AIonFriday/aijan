// /brand: copy the "About AI January" text and the color codes with one tap.
(() => {
  const say = (m) => window.AJ && window.AJ.say(m);
  async function copy(text, done) {
    try {
      await navigator.clipboard.writeText(text);
      say(done);
    } catch {
      say('Couldn’t copy. Select the text and copy it yourself.');
    }
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy],[data-hex]');
    if (!btn) return;
    if (btn.dataset.hex) copy(btn.dataset.hex, `Copied ${btn.dataset.hex}`);
    else copy(document.getElementById(btn.dataset.copy).textContent.trim(), 'Copied');
  });
})();
