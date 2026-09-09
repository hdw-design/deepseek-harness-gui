/**
 * prepare-resources.mjs
 *
 * Downloads / installs everything under resources/ so the app can be built
 * and run fully offline-bundled:
 *
 *   resources/node/node.exe   standalone Node.js runtime (Windows x64)
 *   resources/dsh/            @deepseek-ai/dsh with its full dependency tree
 *   resources/pnpm/           pnpm (used by dsh plugin management) + shims
 *
 * Usage:  npm run prepare
 *
 * Mirrors (optional env vars):
 *   NODEJS_MIRROR  e.g. https://npmmirror.com/mirrors/node/
 *   NPM_REGISTRY   e.g. https://registry.npmmirror.com
 */
import { createWriteStream, existsSync, mkdirSync, rmSync, renameSync, writeFileSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import https from 'node:https';

const NODE_VERSION = 'v24.14.0';
const DSH_PACKAGE = '@deepseek-ai/dsh';
const ROOT = path.resolve(import.meta.dirname, '..');
const RES = path.join(ROOT, 'resources');

const nodeMirror = (process.env.NODEJS_MIRROR || 'https://nodejs.org/dist/').replace(/\/$/, '');
const npmRegistry = process.env.NPM_REGISTRY;
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function download(url, dest) {
  console.log(`downloading ${url}`);
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        const out = createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(resolve));
        out.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

function npm(args, cwd) {
  const full = npmRegistry ? [...args, '--registry', npmRegistry] : args;
  const r = spawnSync(npmCmd, full, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`npm ${args.join(' ')} failed with code ${r.status}`);
}

// npm dependency trees ship a lot of files that are useless at runtime
// (readmes, source maps, TypeScript sources/types, test & doc folders).
// They make up over half of the file count and are the main reason the
// NSIS installer takes minutes to extract. LICENSE/COPYING files are
// kept on purpose (license compliance when redistributing).
const PRUNE_FILE_RE = /\.(md|markdown|map|ts|d\.ts|coffee)$/i;
const PRUNE_NAME_RE = /^(changelog|changes|history|authors|contributors|notice|todo|news)(\.|$)/i;
// NOTE: only clearly-safe directory names are pruned — e.g. the "yaml"
// package keeps runtime code in dist/doc/, so "doc"/"docs"/"examples"
// must NOT be deleted.
const PRUNE_DIR_RE = /^(test|tests|__tests__|\.github|\.vscode|coverage|benchmark|benchmarks)$/i;

function pruneNodeModules(dir) {
  let removed = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (PRUNE_DIR_RE.test(entry.name)) {
          rmSync(p, { recursive: true, force: true });
          removed++;
          continue;
        }
        walk(p);
        // drop directories left empty by pruning
        try { if (readdirSync(p).length === 0) rmdirSync(p); } catch {}
      } else if (entry.isFile()) {
        // keep package.json / LICENSE-like files; prune the rest by pattern
        if (entry.name === 'package.json') continue;
        if (/^(licen[cs]e|copying)(\.|$)/i.test(entry.name)) continue;
        if (PRUNE_FILE_RE.test(entry.name) || PRUNE_NAME_RE.test(entry.name)) {
          try { unlinkSync(p); removed++; } catch {}
        }
      }
    }
  };
  walk(dir);
  console.log(`pruned ${removed} runtime-useless files/dirs from dsh node_modules`);
}

async function main() {
  // --prune-only: re-apply the pruning pass to an existing resources/dsh
  if (process.argv.includes('--prune-only')) {
    pruneNodeModules(path.join(RES, 'dsh', 'node_modules'));
    return;
  }

  mkdirSync(RES, { recursive: true });

  // 1. standalone node.exe
  const nodeExe = path.join(RES, 'node', 'node.exe');
  if (!existsSync(nodeExe)) {
    mkdirSync(path.join(RES, 'node'), { recursive: true });
    const zipName = `node-${NODE_VERSION}-win-x64.zip`;
    const zipPath = path.join(RES, zipName);
    await download(`${nodeMirror}/${NODE_VERSION}/${zipName}`, zipPath);
    // extract node.exe from the zip via PowerShell (available on every Windows)
    execFileSync('powershell.exe', [
      '-NoProfile', '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `$zip=[System.IO.Compression.ZipFile]::OpenRead('${zipPath}'); ` +
      `$e=$zip.Entries | Where-Object { $_.FullName -eq 'node-${NODE_VERSION}-win-x64/node.exe' }; ` +
      `[System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, '${nodeExe}', $true); $zip.Dispose()`,
    ], { stdio: 'inherit' });
    rmSync(zipPath, { force: true });
    console.log(`node.exe ${NODE_VERSION} -> resources/node/`);
  } else {
    console.log('resources/node/node.exe already present, skipping');
  }

  // 2. dsh + dependency tree
  // dsh >= 0.1.1's dependency tree sends npm's peer resolver into
  // pathological backtracking (hours of 100% CPU), while --legacy-peer-deps
  // drops required peer deps (e.g. @deepseek-ai/cordis-plugin-group).
  // pnpm resolves the same tree in seconds; --node-linker=hoisted produces
  // a flat npm-style node_modules with no symlinks (required for packaging).
  const dshDir = path.join(RES, 'dsh');
  rmSync(dshDir, { recursive: true, force: true });
  mkdirSync(dshDir, { recursive: true });
  writeFileSync(path.join(dshDir, 'package.json'),
    JSON.stringify({ private: true, dependencies: { [DSH_PACKAGE]: '0.1.5-alpha.1' } }, null, 2));
  {
    const r = spawnSync(npxCmd, ['-y', 'pnpm@10', 'install', '--prod', '--node-linker=hoisted', '--ignore-workspace', ...(npmRegistry ? ['--registry', npmRegistry] : [])], { cwd: dshDir, stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) throw new Error(`pnpm install for dsh failed with code ${r.status}`);
  }
  console.log(`${DSH_PACKAGE} -> resources/dsh/`);
  pruneNodeModules(path.join(dshDir, 'node_modules'));
  console.log(`${DSH_PACKAGE} -> resources/dsh/`);
  pruneNodeModules(path.join(dshDir, 'node_modules'));

  // 3. pnpm (core package + shims that run it with the bundled node)
  const pnpmDir = path.join(RES, 'pnpm');
  const pnpmCore = path.join(pnpmDir, 'pnpm-core');
  rmSync(pnpmDir, { recursive: true, force: true });
  mkdirSync(pnpmDir, { recursive: true });
  npm(['install', '--prefix', pnpmDir, '--omit=dev', 'pnpm'], ROOT);
  renameSync(path.join(pnpmDir, 'node_modules', 'pnpm'), pnpmCore);
  rmSync(path.join(pnpmDir, 'node_modules'), { recursive: true, force: true });
  rmSync(path.join(pnpmDir, 'package.json'), { force: true });
  rmSync(path.join(pnpmDir, 'package-lock.json'), { force: true });
  // pnpm >= 10 ships a native Windows binary (pnpm.exe) plus bin/pnpm.mjs.
  // Prefer the native binary; fallback to node + pnpm.mjs if only that exists.
  const pnpmExe = path.join(pnpmDir, 'pnpm-core', 'pnpm.exe');
  const pnpmMjs = path.join(pnpmDir, 'pnpm-core', 'bin', 'pnpm.mjs');
  if (existsSync(pnpmExe)) {
    writeFileSync(path.join(pnpmDir, 'pnpm.cmd'),
      '@echo off\r\n"%~dp0pnpm-core\\pnpm.exe" %*\r\n');
    writeFileSync(path.join(pnpmDir, 'pnpm'),
      '#!/bin/sh\n"$(dirname "$0")/pnpm-core/pnpm.exe" "$@"\n');
  } else {
    writeFileSync(path.join(pnpmDir, 'pnpm.cmd'),
      '@echo off\r\n"%~dp0..\\node\\node.exe" "%~dp0pnpm-core\\bin\\pnpm.mjs" %*\r\n');
    writeFileSync(path.join(pnpmDir, 'pnpm'),
      '#!/bin/sh\n"$(dirname "$0")/../node/node.exe" "$(dirname "$0")/pnpm-core/bin/pnpm.mjs" "$@"\n');
  }
  console.log('pnpm -> resources/pnpm/');

  console.log('\nresources/ is ready. Next: npm start (dev) or npm run dist (build installers).');
}

main().catch((e) => { console.error(e); process.exit(1); });
