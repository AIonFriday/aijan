-- Faculty: the people and groups who lead sessions ("Guides" on the rest of the site for now).
-- Each gets a page at /faculty/<slug> and a spot in the home page's faculty strip (src/site.js, src/faculty.js).
-- A faculty row is tied to its sessions by name: sessions.guides holds [{ name, url? }], and a guide whose name
-- matches faculty.name (ignoring case) links to the faculty page. Slugs never change once shared.
-- Safe to run twice.

CREATE TABLE IF NOT EXISTS faculty (
  slug TEXT PRIMARY KEY NOT NULL CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- the same name as in sessions.guides, like "Brent McCrossen"
  is_group INTEGER NOT NULL DEFAULT 0,        -- 1 for a group or company (square badge instead of a round photo)
  role TEXT NOT NULL DEFAULT '',              -- one short line under the name, like "Founder, Hello Gravel"
  bio TEXT NOT NULL DEFAULT '',               -- a few plain sentences, in their words
  photo TEXT,                                 -- https:// or /assets/... image. Empty: their initials on a colored circle
  links TEXT NOT NULL DEFAULT '[]',           -- JSON [{ label, url }]: LinkedIn, Website, Instagram, ...
  projects TEXT NOT NULL DEFAULT '[]',        -- JSON [{ name, about, url? }]: what they're working on
  sort INTEGER NOT NULL DEFAULT 100,          -- lower shows first in the strip and on /faculty
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Who's part of which group: a person can be listed on their own and under one or more groups (Andrew is his own
-- faculty member and part of Hello Gravel Krewe and AI Friday). Group pages show their people; person pages show
-- their groups and the groups' sessions.
CREATE TABLE IF NOT EXISTS faculty_members (
  group_slug TEXT NOT NULL REFERENCES faculty (slug) ON DELETE CASCADE,
  person_slug TEXT NOT NULL REFERENCES faculty (slug) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 100,
  PRIMARY KEY (group_slug, person_slug)
);
