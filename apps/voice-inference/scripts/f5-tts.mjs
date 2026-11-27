#!/usr/bin/env node
/**
 * Fetch and build the pinned F5-TTS release.
 *
 *   node scripts/f5-tts.mjs fetch    Download the pinned source archive from GitHub
 *   node scripts/f5-tts.mjs wheel    Build a wheel from it (runs fetch first)
 *   node scripts/f5-tts.mjs install  Build the wheel and pip-install it locally
 *
 * The version is pinned in ../f5-tts.json by tag and commit SHA. The archive is
 * downloaded by commit SHA, so the content cannot change under a moved tag. If
 * "sha256" is set in f5-tts.json the download is verified against it; otherwise
 * the computed hash is printed so it can be pinned.
 *
 * Output (under dist/, so it is git-ignored and outside every Nx project root):
 *   dist/third_party/f5-tts/src    extracted source
 *   dist/third_party/f5-tts/wheel  built wheel
 *
 * Set PYTHON to choose the interpreter (defaults to python3, then python).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const outRoot = join(workspaceRoot, 'dist', 'third_party', 'f5-tts');
const srcDir = join(outRoot, 'src');
const wheelDir = join(outRoot, 'wheel');
const markerFile = join(srcDir, '.f5-tts-commit');

const pin = JSON.parse(readFileSync(join(packageRoot, 'f5-tts.json'), 'utf8'));
if (!/^[\w.-]+\/[\w.-]+$/.test(pin.repository) || !/^[0-9a-f]{40}$/.test(pin.commit)) {
  fail('f5-tts.json needs "repository" as owner/name and "commit" as a full 40-character SHA');
}

function fail(message) {
  console.error(`f5-tts: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) fail(`could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status}`);
}

function findPython() {
  const candidates = process.env.PYTHON ? [process.env.PYTHON] : ['python3', 'python'];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'import sys; print(sys.version_info >= (3, 10))'], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim() === 'True') return candidate;
  }
  fail(`Python 3.10+ not found (tried ${candidates.join(', ')}); set PYTHON to its path`);
}

async function fetchSource() {
  if (existsSync(markerFile) && readFileSync(markerFile, 'utf8').trim() === pin.commit) {
    console.log(`f5-tts: ${pin.version} (${pin.commit.slice(0, 7)}) already fetched`);
    return;
  }

  const url = `https://github.com/${pin.repository}/archive/${pin.commit}.tar.gz`;
  console.log(`f5-tts: downloading ${pin.version} from ${url}`);
  const response = await fetch(url);
  if (!response.ok) fail(`download failed: HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());

  const sha256 = createHash('sha256').update(archive).digest('hex');
  if (pin.sha256) {
    if (sha256 !== pin.sha256) fail(`sha256 mismatch: expected ${pin.sha256}, got ${sha256}`);
  } else {
    console.warn(`f5-tts: no sha256 pinned in f5-tts.json; this archive is ${sha256}`);
  }

  // Extract next to the destination so the final rename stays on one filesystem.
  mkdirSync(outRoot, { recursive: true });
  const work = mkdtempSync(join(outRoot, '.download-'));
  try {
    const archivePath = join(work, 'source.tar.gz');
    writeFileSync(archivePath, archive);
    run('tar', ['-xzf', 'source.tar.gz'], { cwd: work });

    // GitHub names the top-level folder <repo>-<commit>.
    const expected = `${pin.repository.split('/')[1]}-${pin.commit}`;
    if (!readdirSync(work).includes(expected)) fail(`archive does not contain ${expected}/`);

    rmSync(srcDir, { recursive: true, force: true });
    renameSync(join(work, expected), srcDir);
    writeFileSync(markerFile, `${pin.commit}\n`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`f5-tts: source ready in ${srcDir}`);
}

function buildWheel(python) {
  rmSync(wheelDir, { recursive: true, force: true });
  mkdirSync(wheelDir, { recursive: true });
  // The archive has no .git, so tell setuptools-scm the version explicitly.
  const env = { ...process.env, SETUPTOOLS_SCM_PRETEND_VERSION: pin.version };
  run(python, ['-m', 'pip', 'wheel', '--no-deps', '--wheel-dir', wheelDir, srcDir], { env });
  const wheel = readdirSync(wheelDir).find((name) => name.endsWith('.whl'));
  if (!wheel) fail(`no wheel produced in ${wheelDir}`);
  console.log(`f5-tts: built ${join(wheelDir, wheel)}`);
  return join(wheelDir, wheel);
}

const command = process.argv[2];
if (command === 'fetch') {
  await fetchSource();
} else if (command === 'wheel') {
  const python = findPython();
  await fetchSource();
  buildWheel(python);
} else if (command === 'install') {
  const python = findPython();
  await fetchSource();
  run(python, ['-m', 'pip', 'install', buildWheel(python)]);
} else {
  fail('usage: node scripts/f5-tts.mjs <fetch|wheel|install>');
}
