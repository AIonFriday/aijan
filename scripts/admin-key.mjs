// ABOUTME: Makes the first admin key for the admin MCP (later keys come from the add_admin tool).
// ABOUTME: Prints the key once, and the wrangler command that stores only its hash in D1.
//
// Usage: node scripts/admin-key.mjs "Andrew Dunn" andrew@example.com [owner|organizer]
import { newKey, hashKey } from '../src/mcp.js';

const [name, email, role = 'owner'] = process.argv.slice(2);
if (!name || !email || !['owner', 'organizer'].includes(role)) {
  console.error('Usage: node scripts/admin-key.mjs "Name" email@example.com [owner|organizer]');
  process.exit(1);
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const key = newKey();
const sql = `INSERT INTO admin_keys (id, name, email, key_hash, role) VALUES (${q(crypto.randomUUID())}, ${q(name)}, ${q(email.toLowerCase())}, ${q(await hashKey(key))}, ${q(role)});`;

console.log(`Key for ${name} (${role}). Save it now; it isn't stored anywhere:\n\n  ${key}\n`);
console.log('Store its hash (add --local instead of --remote for npm run dev):\n');
console.log(`  npx wrangler d1 execute aijan-db --remote --command ${JSON.stringify(sql)}\n`);
