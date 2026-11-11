// /faculty: people first, then organizations, a card each. Data: window.AJ_DATA.faculty (session leaders and featured).
(() => {
  const { $, esc, FACULTY: F, avatar } = window.AJ;
  const n = (k) => `${k} session${k === 1 ? '' : 's'}`;
  // Own sessions first; someone who only leads through a group says so ("5 sessions with AI Friday").
  const leads = (f) => (f.leads ? `Leads ${n(f.leads)}` : f.sessions && f.groups ? `${n(f.sessions)} with ${esc(f.groups.join(' and '))}` : f.sessions ? `Leads ${n(f.sessions)}` : 'Session coming soon');
  // A group says how many of its people are faculty too; a person says which groups they're part of.
  const extra = (f) => (f.people ? ` · ${f.people} ${f.people === 1 ? 'person' : 'people'}` : '');
  const part = (f) => (f.groups ? `<span class="fc-g">Part of ${esc(f.groups.join(' and '))}</span>` : '');
  const card = (f) => `<li><a class="fcard" href="/faculty/${f.slug}">${avatar(f, 'lg')}<span class="fc-n">${esc(f.name)}</span><span class="fc-r">${esc(f.role)}</span>${part(f)}<span class="fc-s">${leads(f)}${extra(f)}</span></a></li>`;
  const orgs = F.filter((f) => f.isGroup), people = F.filter((f) => !f.isGroup);
  $('#forgs').innerHTML = orgs.map(card).join('');
  $('#fpeople').innerHTML = people.map(card).join('');
  $('#forgs-sec').hidden = !orgs.length;
})();
