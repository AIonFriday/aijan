-- The real January lineup replaces the example sessions from 0002. See docs/schema.md.
--
-- On the calendar: the AI Friday kickoff, a game-building session with the Hello Gravel Krewe, and four office hours.
-- Not scheduled yet ("Vote for what's next"): a short list of general topics, plus "AI for…" groups (tag "ai-for"),
-- which /sessions shows as one row of buttons instead of a card each. Every count starts at 0.
--
-- The kickoff keeps its slug from the examples, since that link may already be shared.
-- Safe to run twice: the DELETE only touches example rows, and INSERT OR IGNORE skips rows that exist.

DELETE FROM attendance WHERE session_id IN (SELECT id FROM sessions WHERE example = 1);
DELETE FROM sessions WHERE example = 1;

INSERT OR IGNORE INTO sessions (id, slug, title, description, status, starts_at, length_min, location, level, topics, tags, guides, office_hours, created_at) VALUES
  ('ai-friday-kickoff', 'ai-friday-kickoff', 'AI Friday: the kickoff',
   'The month starts here. Coffee, short demos from people around New Orleans, and a look at what’s on the calendar. Come even if you’ve never tried AI.',
   'scheduled', '2027-01-08T09:00:00-06:00', 90, NULL, 'all', '["curious", "work", "make"]', '[]', '["AI Friday"]', 0, '2026-11-05T12:00:00.000Z'),
  ('build-a-game-with-ai', 'build-a-game-with-ai', 'Build a game with AI',
   'We love building games. Come make one with us: pick an idea, describe it to AI in plain words, and play it before you leave. You can see some of ours at hellogravel.com/play. No coding needed.',
   'scheduled', '2027-01-14T09:00:00-06:00', 90, NULL, 'all', '["make", "curious"]', '["games"]', '["Hello Gravel Krewe"]', 0, '2026-11-05T12:00:01.000Z'),
  ('office-hours-jan-19', 'office-hours-jan-19', 'Office hours: bring your questions',
   'Bring your laptop or phone and whatever you’ve been wondering about. Stuck on something, not sure which tool to try, or don’t know where to start? Sit down with a Guide and work on it together. Stay ten minutes or the whole time.',
   'scheduled', '2027-01-19T09:00:00-06:00', 120, NULL, 'all', '["work", "life", "make", "curious"]', '[]', '["AI Friday"]', 1, '2026-11-05T12:00:02.000Z'),
  ('office-hours-jan-21', 'office-hours-jan-21', 'Office hours: bring your questions',
   'Bring your laptop or phone and whatever you’ve been wondering about. Stuck on something, not sure which tool to try, or don’t know where to start? Sit down with a Guide and work on it together. Stay ten minutes or the whole time.',
   'scheduled', '2027-01-21T15:00:00-06:00', 120, NULL, 'all', '["work", "life", "make", "curious"]', '[]', '["AI Friday"]', 1, '2026-11-05T12:00:03.000Z'),
  ('office-hours-jan-26', 'office-hours-jan-26', 'Office hours: bring your questions',
   'Bring your laptop or phone and whatever you’ve been wondering about. Stuck on something, not sure which tool to try, or don’t know where to start? Sit down with a Guide and work on it together. Stay ten minutes or the whole time.',
   'scheduled', '2027-01-26T09:00:00-06:00', 120, NULL, 'all', '["work", "life", "make", "curious"]', '[]', '["AI Friday"]', 1, '2026-11-05T12:00:04.000Z'),
  ('office-hours-jan-28', 'office-hours-jan-28', 'Office hours: bring your questions',
   'Bring your laptop or phone and whatever you’ve been wondering about. Stuck on something, not sure which tool to try, or don’t know where to start? Sit down with a Guide and work on it together. Stay ten minutes or the whole time.',
   'scheduled', '2027-01-28T15:00:00-06:00', 120, NULL, 'all', '["work", "life", "make", "curious"]', '[]', '["AI Friday"]', 1, '2026-11-05T12:00:05.000Z'),

  -- General topics.
  ('first-hour-with-ai', 'first-hour-with-ai', 'Your first hour with AI',
   'Never really tried it? We’ll set up a free account together and do three useful things with it.',
   'proposed', NULL, 90, NULL, 'new', '["curious", "life"]', '[]', '[]', 0, '2026-11-05T12:01:00.000Z'),
  ('spot-ai-fakes-and-scams', 'spot-ai-fakes-and-scams', 'Spot AI fakes and scams',
   'Fake photos, cloned voices and too-good-to-be-true emails. Learn the signs, and how to talk about it with your family.',
   'proposed', NULL, 90, NULL, 'new', '["life", "curious"]', '[]', '[]', 0, '2026-11-05T12:01:01.000Z'),
  ('write-like-you', 'write-like-you', 'Get AI to write like you',
   'Emails, letters and posts that sound like you, not a robot. Bring a few things you’ve written.',
   'proposed', NULL, 90, NULL, 'sometimes', '["work", "life"]', '["writing"]', '[]', 0, '2026-11-05T12:01:02.000Z'),
  ('past-the-chat-box', 'past-the-chat-box', 'Past the chat box: let AI do the task',
   'Already use it every day? Hand AI a whole task, like a report, a cleanup or a small tool, and check its work.',
   'proposed', NULL, 90, NULL, 'daily', '["work", "make"]', '[]', '[]', 0, '2026-11-05T12:01:03.000Z'),

  -- "AI for…" groups. The page shows the words after "AI for" as the button.
  ('ai-for-small-business', 'ai-for-small-business', 'AI for small business owners',
   'Emails, posts, quotes and the paperwork that eats your evenings.',
   'proposed', NULL, 90, NULL, 'all', '["work"]', '["ai-for"]', '[]', 0, '2026-11-05T12:02:00.000Z'),
  ('ai-for-teachers', 'ai-for-teachers', 'AI for teachers',
   'Lesson plans, quizzes and parent emails, without the busywork.',
   'proposed', NULL, 90, NULL, 'all', '["work"]', '["ai-for"]', '[]', 0, '2026-11-05T12:02:01.000Z'),
  ('ai-for-parents', 'ai-for-parents', 'AI for parents',
   'Meal plans, schedules, and helping your kids use AI for homework the right way.',
   'proposed', NULL, 90, NULL, 'all', '["life"]', '["ai-for"]', '[]', 0, '2026-11-05T12:02:02.000Z'),
  ('ai-for-nonprofits', 'ai-for-nonprofits', 'AI for nonprofits',
   'Grant drafts, donor letters and campaigns, for small teams doing a lot.',
   'proposed', NULL, 90, NULL, 'all', '["work"]', '["ai-for"]', '[]', 0, '2026-11-05T12:02:03.000Z'),
  ('ai-for-restaurants', 'ai-for-restaurants', 'AI for restaurants and bars',
   'Menus, reviews, schedules and specials.',
   'proposed', NULL, 90, NULL, 'all', '["work"]', '["ai-for"]', '[]', 0, '2026-11-05T12:02:04.000Z'),
  ('ai-for-real-estate', 'ai-for-real-estate', 'AI for real estate agents',
   'Listings from your photos and notes, and follow-ups that sound like you.',
   'proposed', NULL, 90, NULL, 'all', '["work"]', '["ai-for"]', '[]', 0, '2026-11-05T12:02:05.000Z');
