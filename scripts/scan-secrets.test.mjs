import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { installGitleaks, scanDirectory, scanRepository, scanArtifacts } from './scan-secrets.mjs';

let tool;
let root;
before(async () => {
  root = mkdtempSync(join(tmpdir(), 'lab-secret-regression-'));
  tool = await installGitleaks(join(root, 'tool'));
});
after(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});
function fixture(name) {
  const dir = join(root, name);
  mkdirSync(dir);
  return dir;
}
function git(dir, ...args) {
  return execFileSync('git', ['-c', 'safe.directory=' + dir, ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
// Construct a nonfunctional marker at runtime; no real credentials are used.
function marker() {
  return 'gh' + 'p_' + 'aB3dE6gH9jK2mN5pQ8sT1vW4xY7zA0bC3dE6';
}

test('real scanner accepts clean content', () => {
  const dir = fixture('clean');
  writeFileSync(join(dir, 'index.js'), 'console.log("hello");\n');
  assert.equal(scanDirectory(tool, dir).status, 0);
});
test('real scanner rejects a synthetic credential and redacts its value', () => {
  const dir = fixture('leak');
  const value = marker();
  writeFileSync(join(dir, 'ci.yml'), 'token: ' + value);
  const result = scanDirectory(tool, dir);
  assert.equal(result.status, 1);
  assert.ok(!result.output.includes(value));
});
test('tracked current content and removed secrets in commit history both fail', () => {
  const dir = fixture('history');
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'fixture@example.invalid');
  git(dir, 'config', 'user.name', 'Security fixture');
  writeFileSync(join(dir, 'source.js'), 'export const answer = 42;\n');
  git(dir, 'add', 'source.js');
  git(dir, 'commit', '-qm', 'clean baseline');
  assert.equal(scanRepository(tool, dir).status, 0);
  writeFileSync(join(dir, 'source.js'), 'export const token = "' + marker() + '";\n');
  assert.equal(scanRepository(tool, dir).status, 1, 'unstaged tracked content must be scanned');
  git(dir, 'add', 'source.js');
  git(dir, 'commit', '-qm', 'synthetic negative fixture');
  writeFileSync(join(dir, 'source.js'), 'export const answer = 42;\n');
  git(dir, 'add', 'source.js');
  git(dir, 'commit', '-qm', 'remove fixture');
  assert.equal(scanRepository(tool, dir).status, 1, 'deleting a leak must not hide its PR commit');
});
test('built bundle credentials fail independently of tracked source', () => {
  const dir = fixture('bundle');
  writeFileSync(join(dir, 'app.js'), 'const bundled = "' + marker() + '";');
  assert.equal(scanArtifacts(tool, [dir]).status, 1);
});
test('absent and empty build output fail closed', () => {
  assert.throws(() => scanArtifacts(tool, [join(root, 'missing')]), /artifact/i);
  assert.throws(() => scanArtifacts(tool, [fixture('empty')]), /artifact/i);
});
test('missing executable is a scanner error, never a clean result', () => {
  assert.throws(() => scanDirectory(join(root, 'absent-tool'), fixture('error')), /scanner/i);
});

test('synthetic recovery exception is limited to its exact file and value', () => {
  const dir = fixture('exception-scope');
  mkdirSync(join(dir, 'scripts'));
  const value = 'publishable-' + 'm4-' + 'fixture';
  const content = "VITE_SUPABASE_PUBLISHABLE_KEY: '" + value + "'";
  writeFileSync(join(dir, 'scripts', 'check-recovery.mjs'), content);
  assert.equal(scanDirectory(tool, dir).status, 0);
  writeFileSync(join(dir, 'other.mjs'), content);
  assert.equal(scanDirectory(tool, dir).status, 1, 'the fixture value is not globally ignored');
});
