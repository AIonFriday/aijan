-- Sessions move from data/sessions.json into D1. See docs/schema.md.
-- The site draws session pages, share images, the session lists, the sitemap and llms.txt from this table on request
-- (src/site.js), so a change here shows up right away with no rebuild.
--
-- id is the slug, so attendance rows (session_id = slug) keep working. Slugs never change once shared.
-- Safe to run twice: IF NOT EXISTS and INSERT OR IGNORE.

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,                 -- same as slug
  slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'scheduled', 'cancelled')),
  visible INTEGER NOT NULL DEFAULT 1,           -- 0 hides it without deleting (private krewe sessions)
  starts_at TEXT,                               -- ISO time with offset, e.g. 2027-01-12T08:00:00-06:00. Empty: not set yet
  length_min INTEGER NOT NULL DEFAULT 90,
  location TEXT,                                -- empty means The Nieux, 2040 St. Charles
  level TEXT NOT NULL CHECK (level IN ('all', 'new', 'sometimes', 'daily')),
  topics TEXT NOT NULL DEFAULT '[]',            -- JSON list: work, life, make, curious
  tags TEXT NOT NULL DEFAULT '[]',              -- JSON list of free words, like "restaurants"
  guides TEXT NOT NULL DEFAULT '[]',            -- JSON list of names shown as the guide, like "Maya" or "AI Friday crew"
  office_hours INTEGER NOT NULL DEFAULT 0,      -- back end only, never shown as a category
  seed_count INTEGER NOT NULL DEFAULT 0,        -- starting count that live taps add to; 0 for real sessions
  example INTEGER NOT NULL DEFAULT 0,           -- 1 = made-up mockup session: noindexed, left out of the sitemap, llms.txt and Event data
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (status != 'scheduled' OR starts_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sessions_starts_idx ON sessions (starts_at);

-- The example sessions the mockup has used so far (example = 1). Delete them when the real lineup lands:
--   DELETE FROM sessions WHERE example = 1;
INSERT OR IGNORE INTO sessions (id, slug, title, description, status, starts_at, location, level, topics, tags, guides, office_hours, seed_count, example, created_at) VALUES
  ('ai-friday-kickoff', 'ai-friday-kickoff', 'AI Friday: the kickoff', 'The month starts here. Demos from people around town, coffee, and a look at what’s on the calendar.', 'scheduled', '2027-01-08T09:00:00-06:00', NULL, 'all', '["curious", "work", "make"]', '[]', '["AI Friday crew"]', 0, 112, 1, '2026-11-05T00:00:00.000Z'),
  ('coffee-office-hours-jan-12', 'coffee-office-hours-jan-12', 'Coffee and AI office hours', 'Bring your laptop and whatever you’re stuck on. Someone will sit down next to you and help.', 'scheduled', '2027-01-12T08:00:00-06:00', NULL, 'all', '["work", "life", "make", "curious"]', '[]', '["Maya", "Jordan"]', 1, 14, 1, '2026-11-05T00:00:01.000Z'),
  ('ai-for-your-restaurant', 'ai-for-your-restaurant', 'AI for your restaurant: menus, schedules, reviews', 'Write menu descriptions, answer reviews, and draft a staff schedule in about an hour.', 'scheduled', '2027-01-13T11:30:00-06:00', NULL, 'new', '["work"]', '["restaurants", "small business"]', '["Dee"]', 0, 9, 1, '2026-11-05T00:00:02.000Z'),
  ('real-estate-listings-follow-ups', 'real-estate-listings-follow-ups', 'Real estate: listings and follow-ups', 'Turn photos and notes into a listing, then set up follow-up emails that sound like you.', 'scheduled', '2027-01-14T11:30:00-06:00', NULL, 'sometimes', '["work"]', '["real estate"]', '["Chris"]', 0, 7, 1, '2026-11-05T00:00:03.000Z'),
  ('beer-and-build-night', 'beer-and-build-night', 'Beer and build night', 'Open table for people making things with AI. Show what you’re building, get unstuck, trade notes.', 'scheduled', '2027-01-14T17:30:00-06:00', NULL, 'daily', '["make"]', '["coding"]', '["Sam", "Priya", "Leo"]', 1, 21, 1, '2026-11-05T00:00:04.000Z'),
  ('grant-writing-nonprofits', 'grant-writing-nonprofits', 'Grant writing for nonprofits', 'Draft a grant narrative from your old applications and a few notes, then check it for gaps.', 'scheduled', '2027-01-19T11:30:00-06:00', 'A guide’s office in the CBD', 'sometimes', '["work"]', '["nonprofits", "writing"]', '["Renee"]', 0, 11, 1, '2026-11-05T00:00:05.000Z'),
  ('ai-friday-closer', 'ai-friday-closer', 'AI Friday: the closer', 'What New Orleans made this month. Short demos from people who came to their first session three weeks ago.', 'scheduled', '2027-01-22T09:00:00-06:00', NULL, 'all', '["curious", "make"]', '[]', '["AI Friday crew"]', 0, 64, 1, '2026-11-05T00:00:06.000Z'),
  ('teachers-lesson-plans', 'teachers-lesson-plans', 'Teachers: lesson plans without the busywork', 'Build a week of lesson plans, quizzes, and parent emails from one standard.', 'proposed', NULL, NULL, 'sometimes', '["work"]', '["education"]', '["Ms. Alvarez"]', 0, 5, 1, '2026-11-05T00:00:07.000Z'),
  ('first-hour-with-chatgpt', 'first-hour-with-chatgpt', 'Your first hour with ChatGPT', 'Never really tried it? We’ll set up an account together and do three useful things with it.', 'proposed', NULL, NULL, 'new', '["curious", "life"]', '[]', '[]', 0, 4, 1, '2026-11-05T00:00:08.000Z'),
  ('ai-for-church-admin', 'ai-for-church-admin', 'Sermons, newsletters, and church admin', 'For clergy and church staff: what AI is good for, what it isn’t, and where to be careful.', 'proposed', NULL, NULL, 'new', '["work"]', '["faith"]', '["Rev. Thomas"]', 0, 3, 1, '2026-11-05T00:00:09.000Z'),
  ('meals-budget-and-trips', 'meals-budget-and-trips', 'Meal plans, a budget, and the summer trip', 'Use AI for the everyday stuff at home: a week of dinners, a household budget, and a trip itinerary.', 'proposed', NULL, NULL, 'new', '["life"]', '[]', '["Tasha"]', 0, 3, 1, '2026-11-05T00:00:10.000Z'),
  ('kids-homework-the-right-way', 'kids-homework-the-right-way', 'Helping your kids use AI for homework, the right way', 'For parents: how to use it as a tutor instead of a shortcut, and what the schools allow.', 'proposed', NULL, NULL, 'sometimes', '["life"]', '["parents"]', '[]', 0, 1, 1, '2026-11-05T00:00:11.000Z'),
  ('agent-that-answers-email', 'agent-that-answers-email', 'Build an agent that answers your email', 'Wire up an assistant that drafts replies to your inbox and asks before it sends.', 'proposed', NULL, NULL, 'daily', '["make", "work"]', '["coding"]', '[]', 0, 2, 1, '2026-11-05T00:00:12.000Z');
