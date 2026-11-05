-- Every session gets a type ("kind"), shown as a small tag on cards, in the calendar and on its page, so people
-- can tell what they'd walk into. See docs/schema.md and KINDS in src/sessions.js.
--   talk          Talks and demos: keynotes, panels, AI Friday
--   office-hours  Office hours: drop in with questions
--   hands-on      Hands-on: make something with a Guide (the default)
--   group         For your group: "AI for…" sessions made for one kind of person
-- office_hours and the "ai-for" tag stay for now, kept in step with kind.

ALTER TABLE sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'hands-on' CHECK (kind IN ('talk', 'office-hours', 'hands-on', 'group'));

UPDATE sessions SET kind = 'office-hours' WHERE office_hours = 1;
UPDATE sessions SET kind = 'group' WHERE tags LIKE '%"ai-for"%';
UPDATE sessions SET kind = 'talk' WHERE slug = 'ai-friday-kickoff';
