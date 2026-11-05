-- Keys for the admin MCP at /mcp. One row per key; each admin has their own. See docs/admin.md.
-- Only the SHA-256 hash of a key is stored. The key itself is shown once, when it's made.
-- (0002 is left for the sessions table.)

CREATE TABLE IF NOT EXISTS admin_keys (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'organizer' CHECK (role IN ('owner', 'organizer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS admin_keys_email_idx ON admin_keys (email);
