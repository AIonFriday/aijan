-- Sign-in (Better Auth) and the taps people make: RSVP, "I want this", offer to guide,
-- suggestions, and krewe requests. See docs/schema.md.
--
-- Every statement uses IF NOT EXISTS so this file is safe to run twice.
-- Apply with: npx wrangler d1 migrations apply aijan-db --local   (or --remote)

-- Better Auth's tables. Column names are Better Auth's defaults (camelCase).
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  -- Ours: asked once, later, with a skip. Same five levels as sessions.
  "level" TEXT,
  "newsletter" INTEGER NOT NULL DEFAULT 0,
  "role" TEXT NOT NULL DEFAULT 'member'
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expiresAt" DATE NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATE,
  "refreshTokenExpiresAt" DATE,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATE NOT NULL,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

-- One row per person per session per kind. Sessions still live in data/sessions.json,
-- so session_id holds the session's slug (slugs never change once shared).
CREATE TABLE IF NOT EXISTS attendance (
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('want', 'rsvp', 'guide')),
  guide_as TEXT,
  guide_status TEXT CHECK (guide_status IN ('requested', 'approved', 'declined')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (session_id, user_id, kind)
);
CREATE INDEX IF NOT EXISTS attendance_user_idx ON attendance (user_id);

-- Ideas people send in. Never shown until an organizer turns one into a session.
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'declined')),
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The general "I could guide" form on /guide (not tied to one session).
CREATE TABLE IF NOT EXISTS guide_offers (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  topics TEXT NOT NULL DEFAULT '[]',
  what TEXT,
  guide_as TEXT,
  details TEXT NOT NULL DEFAULT '{}', -- level and good times, as JSON
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'approved', 'declined')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS krewe_requests (
  id TEXT PRIMARY KEY NOT NULL,
  group_name TEXT NOT NULL,
  what TEXT NOT NULL,
  size TEXT,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'matched', 'scheduled')),
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
