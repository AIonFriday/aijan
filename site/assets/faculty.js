// /faculty: a card for everyone leading a session. Data: window.AJ_DATA.faculty (session leaders only).
(() => {
  const { $, esc, FACULTY: F, avatar } = window.AJ;
  const leads = (n) => (n ? `Leads ${n} session${n === 1 ? '' : 's'}` : 'Session coming soon');
  // A group says how many of its people are faculty too; a person says which groups they're part of.
  const extra = (f) => (f.people ? ` · ${f.people} ${f.people === 1 ? 'person' : 'people'}` : '');
  const part = (f) => (f.groups ? `<span class="fc-g">Part of ${esc(f.groups.join(' and '))}</span>` : '');
  $('#fgrid').innerHTML =
    F.map((f) => `<li><a class="fcard" href="/faculty/${f.slug}">${avatar(f, 'lg')}<span class="fc-n">${esc(f.name)}</span><span class="fc-r">${esc(f.role)}</span>${part(f)}<span class="fc-s">${leads(f.sessions)}${extra(f)}</span></a></li>`).join('');
})();
