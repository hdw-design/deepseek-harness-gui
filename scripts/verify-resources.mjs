/**
 * verify-resources.mjs — fail-fast check before electron-builder runs.
 *
 * electron-builder silently skips a copy-source root named "node_modules"
 * (see createFilter in app-builder-lib), which once shipped an installer
 * without the dsh dependency tree. This script makes sure the bundled
 * runtime is complete, and auto-runs prepare-resources.mjs if anything
 * is missing. Build aborts if it still is.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const REQUIRED = [
  'resources/node/node.exe',
  'resources/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js',
  // pnpm >= 10 ships a native binary instead of bin/pnpm.cjs; accept either.
  ['resources/pnpm/pnpm-core/pnpm.exe', 'resources/pnpm/pnpm-core/bin/pnpm.mjs'],
  'resources/pnpm/pnpm.cmd',
];

function missing() {
  return REQUIRED.filter((p) => {
    const candidates = Array.isArray(p) ? p : [p];
    return !candidates.some((c) => existsSync(path.join(ROOT, c)));
  }).map((p) => Array.isArray(p) ? p.join(' or ') : p);
}

let lack = missing();
if (lack.length > 0) {
  console.log('resources incomplete, running prepare-resources.mjs first...');
  for (const p of lack) console.log(`  missing: ${p}`);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'prepare-resources.mjs')], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('prepare-resources.mjs failed, aborting build.');
    process.exit(1);
  }
  lack = missing();
}

if (lack.length > 0) {
  console.error('resources still incomplete after prepare, aborting build:');
  for (const p of lack) console.error(`  missing: ${p}`);
  process.exit(1);
}

console.log('resources check OK (node.exe, dsh bin, pnpm all present).');
