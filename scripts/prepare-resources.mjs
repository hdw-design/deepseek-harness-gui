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
import { createWriteStream, existsSync, mkdirSync, rmSync, renameSync, writeFileSync } from 'node:fs';
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

async function main() {
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
  const dshDir = path.join(RES, 'dsh');
  rmSync(dshDir, { recursive: true, force: true });
  mkdirSync(dshDir, { recursive: true });
  npm(['install', '--prefix', dshDir, '--omit=dev', DSH_PACKAGE], ROOT);
  console.log(`${DSH_PACKAGE} -> resources/dsh/`);

  // 3. pnpm (core package + shims that run it with the bundled node)
  const pnpmDir = path.join(RES, 'pnpm');
  const pnpmCore = path.join(pnpmDir, 'pnpm-core');
  rmSync(pnpmDir, { recursive: true, force: true });
  mkdirSync(pnpmCore, { recursive: true });
  npm(['install', '--prefix', pnpmDir, '--omit=dev', 'pnpm'], ROOT);
  renameSync(path.join(pnpmDir, 'node_modules', 'pnpm'), pnpmCore);
  rmSync(path.join(pnpmDir, 'node_modules'), { recursive: true, force: true });
  rmSync(path.join(pnpmDir, 'package.json'), { force: true });
  rmSync(path.join(pnpmDir, 'package-lock.json'), { force: true });
  writeFileSync(path.join(pnpmDir, 'pnpm.cmd'),
    '@echo off\r\n"%~dp0..\\node\\node.exe" "%~dp0pnpm-core\\bin\\pnpm.cjs" %*\r\n');
  writeFileSync(path.join(pnpmDir, 'pnpm'),
    '#!/bin/sh\n"$(dirname "$0")/../node/node.exe" "$(dirname "$0")/pnpm-core/bin/pnpm.cjs" "$@"\n');
  console.log('pnpm -> resources/pnpm/');

  console.log('\nresources/ is ready. Next: npm start (dev) or npm run dist (build installers).');
}

main().catch((e) => { console.error(e); process.exit(1); });
