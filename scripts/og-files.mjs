// Reads the files scripts/og.mjs draws with (fonts, map points, logo) from disk, for the build and the tests.
// The Worker imports the same files as modules instead (src/worker.js).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useFiles, FONT_FILES } from './og.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
useFiles({
  fonts: Object.fromEntries(FONT_FILES.map((f) => [f, readFileSync(join(root, 'scripts/fonts', f))])),
  points: readFileSync(join(root, 'site/assets/nola-points.js'), 'utf8'),
  logoSvg: readFileSync(join(root, 'site/assets/brand/ai-january-compact-lockup-color.svg'), 'utf8'),
});
export * from './og.mjs';
