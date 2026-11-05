// ABOUTME: A small stand-in for Cloudflare D1 over Node's built-in SQLite, with every migration applied.
// ABOUTME: Only the calls the Worker uses: prepare().bind().all() / first() / run().
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function fakeD1() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(join(root, 'migrations')).sort()) db.exec(readFileSync(join(root, 'migrations', f), 'utf8'));
  const stmt = (sql, params = []) => ({
    bind: (...p) => stmt(sql, p),
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    first: async () => db.prepare(sql).get(...params) ?? null,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...params).changes) } }),
  });
  return { prepare: (sql) => stmt(sql), raw: db };
}
