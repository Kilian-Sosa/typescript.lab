import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm, readFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { resolveConfig } from 'vite';
import {
  PRODUCTION_ORIGINS,
  validateProductionEnvironment,
  productionAppHeaders,
} from '../shared/deployment/production.ts';

const valid = {
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
};
const envTest = async (env, fn) => {
  const previous = process.env;
  process.env = { ...env };
  try {
    return await fn();
  } finally {
    process.env = previous;
  }
};

test('Production requires explicit matching metadata and exact pinned origins', () => {
  assert.equal(validateProductionEnvironment(valid, true).supabaseOrigin, valid.VITE_SUPABASE_URL);
  for (const VERCEL_ENV of [undefined, '', 'preview', 'development']) {
    assert.throws(() => validateProductionEnvironment({ ...valid, VERCEL_ENV }, true), /Production metadata/);
  }
  for (const VERCEL_TARGET_ENV of [undefined, '', 'preview', 'staging']) {
    assert.throws(() => validateProductionEnvironment({ ...valid, VERCEL_TARGET_ENV }, true), /Production metadata/);
  }
  for (const [key, expected] of [
    ['VITE_RUNNER_PARENT_ORIGIN', PRODUCTION_ORIGINS.app],
    ['VITE_RUNNER_ORIGIN', PRODUCTION_ORIGINS.runner],
  ]) {
    for (const value of [
      '',
      'https://evil.vercel.app',
      expected + '/',
      expected + ':443',
      expected + '/path',
      expected.replace('https:', 'http:'),
      expected + '.evil.test',
      expected.replace('https://', 'https://user@'),
      PRODUCTION_ORIGINS.app === expected ? PRODUCTION_ORIGINS.runner : PRODUCTION_ORIGINS.app,
    ]) {
      assert.throws(() => validateProductionEnvironment({ ...valid, [key]: value }, true), /origin/);
    }
    assert.doesNotThrow(() => validateProductionEnvironment({ ...valid, [key]: expected }, true));
  }
  assert.throws(() => validateProductionEnvironment({ ...valid, LAB_RUNNER_LOCAL_TEST: '1' }, false), /local/);
});

test('public Supabase configuration is exact and required only for the app', () => {
  for (const value of [
    undefined,
    '',
    'http://example.supabase.co',
    'https://evil.test',
    'https://example.supabase.co/path',
    'https://user@example.supabase.co',
    'https://example.supabase.co:443',
    'https://example.supabase.co?x',
    'https://example.supabase.co#x',
  ]) {
    assert.throws(() => validateProductionEnvironment({ ...valid, VITE_SUPABASE_URL: value }, true), /Supabase/);
  }
  for (const value of [undefined, '', 'sb_secret_fixture', 'service_role']) {
    assert.throws(
      () => validateProductionEnvironment({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: value }, true),
      /Supabase/,
    );
  }
  assert.doesNotThrow(() =>
    validateProductionEnvironment({ VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' }, false),
  );
});

test('only the dedicated app mode receives the Production marker and explicit public config', async () => {
  await envTest(
    {
      ...valid,
      VITE_MVP_PRODUCTION_DEPLOYMENT_ENV: 'spoof',
      VITE_ENABLE_MVP_PREVIEW_RUNNER: '1',
      VITE_MVP_PREVIEW_DEPLOYMENT_ENV: 'preview',
      VITE_ENABLE_M3_QA_RUNNER: '1',
      VITE_UNRELATED_SECRET: 'fixture',
    },
    async () => {
      const config = await resolveConfig({ mode: 'mvp-production', logLevel: 'silent' }, 'build');
      assert.equal(config.envDir, false);
      assert.deepEqual(config.envPrefix, []);
      assert.equal(config.define['import.meta.env.VITE_MVP_PRODUCTION_DEPLOYMENT_ENV'], '"production"');
      assert.equal(config.define['import.meta.env.VITE_RUNNER_ORIGIN'], JSON.stringify(PRODUCTION_ORIGINS.runner));
      assert.equal(config.define['import.meta.env.VITE_ENABLE_MVP_PREVIEW_RUNNER'], 'undefined');
      assert.equal(config.define['import.meta.env.VITE_ENABLE_M3_QA_RUNNER'], 'undefined');
      assert.equal(config.env.VITE_UNRELATED_SECRET, undefined);
      const ordinary = await resolveConfig({ mode: 'production', envDir: false, logLevel: 'silent' }, 'build');
      assert.equal(ordinary.define['import.meta.env.VITE_MVP_PRODUCTION_DEPLOYMENT_ENV'], 'undefined');
      await assert.rejects(resolveConfig({ mode: 'mvp-production', logLevel: 'silent' }, 'serve'), /build/);
    },
  );
  await envTest({ ...valid, VERCEL_ENV: 'preview' }, () =>
    assert.rejects(resolveConfig({ mode: 'mvp-production', logLevel: 'silent' }, 'build'), /Production metadata/),
  );
  await envTest({ ...valid, VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview' }, async () => {
    for (const mode of ['mvp-preview', 'm3-hosted-qa']) {
      const config = await resolveConfig({ mode, envDir: false, logLevel: 'silent' }, 'build');
      assert.equal(config.define['import.meta.env.VITE_MVP_PRODUCTION_DEPLOYMENT_ENV'], 'undefined');
    }
  });
});

test('Production runner ignores poisoned local env files and exposes only validated origins', async () => {
  await mkdir(resolve('output'), { recursive: true });
  const fixture = await mkdtemp(resolve('output/lab-production-config-'));
  try {
    const runner = join(fixture, 'apps/runner');
    await mkdir(runner, { recursive: true });
    await mkdir(join(fixture, 'shared/deployment'), { recursive: true });
    for (const file of ['vite.config.ts', 'deployment.ts'])
      await copyFile(resolve('apps/runner', file), join(runner, file));
    await copyFile(resolve('shared/deployment/production.ts'), join(fixture, 'shared/deployment/production.ts'));
    await writeFile(
      join(runner, '.env.local'),
      'VITE_RUNNER_ORIGIN=https://evil.vercel.app\nLAB_RUNNER_LOCAL_TEST=1\nVITE_POISON=local-secret\n',
    );
    await writeFile(join(runner, '.env.mvp-production'), 'VITE_OTHER_POISON=mode-secret\n');
    await envTest(
      { VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production', VITE_POISON: 'process-secret' },
      async () => {
        const config = await resolveConfig(
          {
            configFile: join(runner, 'vite.config.ts'),
            configLoader: 'runner',
            mode: 'mvp-production',
            logLevel: 'silent',
          },
          'build',
        );
        assert.equal(config.envDir, false);
        assert.deepEqual(config.envPrefix, []);
        assert.equal(
          config.define['import.meta.env.VITE_RUNNER_PARENT_ORIGIN'],
          JSON.stringify(PRODUCTION_ORIGINS.app),
        );
        assert.equal(config.define['import.meta.env.VITE_RUNNER_ORIGIN'], JSON.stringify(PRODUCTION_ORIGINS.runner));
        assert.equal(config.env.VITE_POISON, undefined);
        assert.equal(config.env.VITE_OTHER_POISON, undefined);
        await assert.rejects(
          resolveConfig(
            {
              configFile: join(runner, 'vite.config.ts'),
              configLoader: 'runner',
              mode: 'production',
              logLevel: 'silent',
            },
            'build',
          ),
          /dedicated mvp-production/,
        );
        await assert.rejects(
          resolveConfig(
            {
              configFile: join(runner, 'vite.config.ts'),
              configLoader: 'runner',
              mode: 'mvp-production',
              logLevel: 'silent',
            },
            'serve',
          ),
          /build-only/,
        );
      },
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('Production app headers intentionally permit indexing and constrain execution', () => {
  const headers = productionAppHeaders(valid.VITE_SUPABASE_URL);
  assert.equal(headers['X-Robots-Tag'], undefined);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  const policy = headers['Content-Security-Policy'];
  assert.ok(policy.includes(`frame-src ${PRODUCTION_ORIGINS.runner};`));
  assert.ok(policy.includes("worker-src 'none'"));
  assert.ok(policy.includes("frame-ancestors 'none'"));
  assert.doesNotMatch(policy, /wasm-unsafe-eval|unsafe-eval|\*/);
});

test('paired builder rejects missing metadata before compilation', () => {
  const result = spawnSync(process.execPath, ['scripts/build-mvp-production.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, ...valid, VERCEL_TARGET_ENV: '' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production metadata/);
  assert.doesNotMatch(result.stdout, /building client environment/);
});

test('real paired build emits matching CSP and complete hashes; invalid rebuild removes stale success', async () => {
  const output = resolve('output/mvp-production');
  const result = spawnSync(process.execPath, ['scripts/build-mvp-production.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, ...valid, VITE_UNRELATED_SECRET: 'must-not-reach-artifacts' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.origins, PRODUCTION_ORIGINS);
  assert.match(manifest.sourceSha, /^[a-f0-9]{40}$/);
  assert.equal(typeof manifest.dirty, 'boolean');
  assert.match(manifest.acceptance, /local-build-only/);
  assert.ok(Object.keys(manifest.files).some((file) => file.endsWith('.wasm')));
  for (const [path, hash] of Object.entries(manifest.files)) {
    assert.equal(
      createHash('sha256')
        .update(await readFile(join(output, path)))
        .digest('hex'),
      hash,
      path,
    );
  }
  const appConfig = JSON.parse(await readFile(join(output, 'app/.vercel/output/config.json'), 'utf8'));
  assert.deepEqual(appConfig.routes[0].headers, productionAppHeaders(valid.VITE_SUPABASE_URL));
  const runnerConfig = JSON.parse(await readFile(join(output, 'runner/.vercel/output/config.json'), 'utf8'));
  const [worker, page] = runnerConfig.routes;
  assert.match(worker.headers['Content-Security-Policy'], /script-src 'self' 'wasm-unsafe-eval'/);
  assert.match(worker.headers['Content-Security-Policy'], /connect-src 'self'/);
  assert.ok(page.headers['Content-Security-Policy'].includes(`frame-ancestors ${PRODUCTION_ORIGINS.app}`));
  assert.match(page.headers['Content-Security-Policy'], /connect-src 'none'/);
  assert.doesNotMatch(page.headers['Content-Security-Policy'], /wasm-unsafe-eval/);
  assert.equal(page.headers['X-Robots-Tag'], 'noindex, nofollow');
  for (const site of ['app', 'runner']) {
    const assets = join(output, site, '.vercel/output/static/assets');
    for (const name of await readdir(assets)) {
      if (!name.endsWith('.js')) continue;
      const code = await readFile(join(assets, name), 'utf8');
      assert.ok(!code.includes('must-not-reach-artifacts'));
      if (site === 'runner') {
        assert.ok(!code.includes(valid.VITE_SUPABASE_URL));
        assert.ok(!code.includes(valid.VITE_SUPABASE_PUBLISHABLE_KEY));
      }
    }
  }
  // An invalid subsequent build must invalidate the previous success, not leave deployable stale output.
  const stale = await readFile(join(output, 'manifest.json'), 'utf8');
  const invalid = spawnSync(process.execPath, ['scripts/build-mvp-production.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, ...valid, VERCEL_ENV: 'preview' },
  });
  assert.notEqual(invalid.status, 0);
  await assert.rejects(access(join(output, 'manifest.json')));
  assert.match(stale, /mvp-production/);
});

test('source changes during compilation reject publication even when HEAD does not change', async () => {
  const probe = resolve(`shared/deployment/production-build-probe-${process.pid}.txt`);
  await writeFile(probe, 'before compilation');
  try {
    const child = spawn(process.execPath, ['scripts/build-mvp-production.mjs'], {
      env: { ...process.env, ...valid },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '';
    let changed = null;
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (!changed && stdout.includes('building client environment'))
        changed = writeFile(probe, 'changed during compilation');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const status = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    await changed;
    assert.ok(changed, 'The regression must actually mutate the fixture during compilation');
    assert.notEqual(status, 0, stderr || stdout);
    assert.match(stderr, /Source tree changed during build/);
    await assert.rejects(access(resolve('output/mvp-production/manifest.json')));
  } finally {
    await rm(probe, { force: true });
  }
});
