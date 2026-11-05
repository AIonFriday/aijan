// Page titles and descriptions for session pages stay inside what search engines show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionTitle, clip } from '../src/render.js';

const officeHours = (startsAt) => ({ title: 'Office hours: bring your questions', status: 'scheduled', startsAt, lengthMin: 120 });

test('scheduled sessions with the same name get different titles', () => {
  assert.equal(sessionTitle(officeHours('2027-01-19T09:00:00-06:00')), 'Office hours: bring your questions · Jan 19 · AI January');
  assert.notEqual(sessionTitle(officeHours('2027-01-19T09:00:00-06:00')), sessionTitle(officeHours('2027-01-26T09:00:00-06:00')));
});

test('long titles drop the site name, then the date', () => {
  const s = { title: 'My brain is at capacity: AI for work, life, and everyday chaos', status: 'scheduled', startsAt: '2027-01-21T16:00:00-06:00' };
  assert.equal(sessionTitle(s), s.title);
  const mid = { title: 'Past the chat box: let AI do the whole task', status: 'scheduled', startsAt: '2027-01-21T16:00:00-06:00' };
  assert.equal(sessionTitle(mid), 'Past the chat box: let AI do the whole task · Jan 21');
});

test('ideas keep the plain title', () => {
  assert.equal(sessionTitle({ title: 'AI for teachers', status: 'idea' }), 'AI for teachers · AI January');
});

test('descriptions are cut at a word, under 160 characters', () => {
  const long = 'Bring your laptop or phone and whatever you are stuck on. '.repeat(6);
  const out = clip(long);
  assert.ok(out.length <= 160, out.length);
  assert.ok(out.endsWith('…'));
  assert.ok(!/\s…$/.test(out));
  assert.ok(long.startsWith(out.slice(0, -1)));
  assert.equal(clip('Short and sweet.'), 'Short and sweet.');
});
