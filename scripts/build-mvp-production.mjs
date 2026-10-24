import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionAppHeaders, validateProductionEnvironment } from '../shared/deployment/production.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputParent = resolve(root, 'output');
const output = resolve(outputParent, 'mvp-production');
// This fixed generated directory is the only published pair. Invalidate stale success first.
await rm(output, { recursive: true, force: true });
const policy = validateProductionEnvironment(process.env, true);
await mkdir(outputParent, { recursive: true });
const staging = await mkdtemp(join(outputParent, '.mvp-production-'));

// Child compilers receive OS necessities and the explicitly validated public build inputs only.
const childEnv = {};
for (const name of [
  'PATH',
  'Path',
  'SystemRoot',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'TEMP',
  'TMP',
  'TMPDIR',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'PROCESSOR_ARCHITECTURE',
]) {
  if (process.env[name] !== undefined) childEnv[name] = process.env[name];
}
const metadata = { VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' };
function run(cwd, bin, args, env = {}) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd,
    stdio: 'inherit',
    env: { ...childEnv, ...metadata, ...env },
  });
  if (result.status !== 0) throw new Error(`Production build failed: ${bin} (${result.status}).`);
}
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Cannot record Production source identity.');
  return result.stdout.trim();
}
async function hashes(directory, prefix = '') {
  const files = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(files, await hashes(join(directory, entry.name), name + '/'));
    else if (entry.isFile())
      files[name] = createHash('sha256')
        .update(await readFile(join(directory, entry.name)))
        .digest('hex');
    else throw new Error('Unexpected non-file artifact.');
  }
  return files;
}

async function sourceFingerprint() {
  const digest = createHash('sha256');
  // Include untracked implementation files in local builds, but never generated pair output.
  const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  for (const file of [...new Set(files)].sort()) {
    if (/^(output|dist)\//.test(file) || /(^|\/)(node_modules|\.vercel|\.worktrees)\//.test(file)) continue;
    digest.update(file + '\0');
    try {
      digest.update(
        createHash('sha256')
          .update(await readFile(resolve(root, file)))
          .digest('hex'),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      digest.update('deleted');
    }
    digest.update('\0');
  }
  return digest.digest('hex');
}

try {
  const sourceSha = git(['rev-parse', 'HEAD']);
  const sourceStatus = git(['status', '--porcelain', '--untracked-files=all']);
  const dirty = sourceStatus.length > 0;
  const sourceTreeHash = await sourceFingerprint();
  const appOutput = join(staging, 'app/.vercel/output');
  const runnerOutput = join(staging, 'runner/.vercel/output');
  run(root, 'node_modules/vue-tsc/bin/vue-tsc.js', ['--noEmit']);
  run(
    root,
    'node_modules/vite/bin/vite.js',
    ['build', '--mode', 'mvp-production', '--outDir', join(appOutput, 'static')],
    {
      VITE_SUPABASE_URL: policy.supabaseOrigin,
      VITE_SUPABASE_PUBLISHABLE_KEY: policy.publishableKey,
    },
  );
  await writeFile(
    join(appOutput, 'config.json'),
    JSON.stringify(
      {
        version: 3,
        routes: [
          { src: '/(.*)', headers: productionAppHeaders(policy.supabaseOrigin), continue: true },
          { handle: 'filesystem' },
          { src: '/(.*)', dest: '/index.html' },
        ],
      },
      null,
      2,
    ),
  );
  const runnerRoot = resolve(root, 'apps/runner');
  run(runnerRoot, 'node_modules/typescript/bin/tsc', ['--noEmit']);
  run(runnerRoot, 'node_modules/vite/bin/vite.js', [
    'build',
    '--mode',
    'mvp-production',
    '--outDir',
    join(runnerOutput, 'static'),
  ]);
  const runnerConfig = JSON.parse(await readFile(join(runnerOutput, 'config.json'), 'utf8'));
  const policies = JSON.stringify(runnerConfig.routes);
  if (!policies.includes(`frame-ancestors ${policy.app}`) || !policies.includes('wasm-unsafe-eval')) {
    throw new Error('Production runner policies missing.');
  }
  for (const site of ['app', 'runner']) {
    const index = await readFile(join(staging, site, '.vercel/output/static/index.html'), 'utf8');
    if (!index.includes('/assets/')) throw new Error('Invalid Production static artifact.');
  }
  const manifest = {
    version: 1,
    mode: 'mvp-production',
    sourceSha,
    sourceTreeHash,
    dirty,
    origins: { app: policy.app, runner: policy.runner },
    supabaseOrigin: policy.supabaseOrigin,
    files: await hashes(staging),
    acceptance: 'local-build-only; independent hosted metadata, hashes, aliases and headers must be verified',
  };
  if (git(['rev-parse', 'HEAD']) !== sourceSha) throw new Error('Source HEAD changed during build.');
  if (
    (await sourceFingerprint()) !== sourceTreeHash ||
    git(['status', '--porcelain', '--untracked-files=all']) !== sourceStatus
  ) {
    throw new Error('Source tree changed during build.');
  }
  await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await rename(staging, output);
  console.log('Built isolated MVP Production pair and hash manifest. No deployment or hosted acceptance performed.');
} finally {
  await rm(staging, { recursive: true, force: true });
}
