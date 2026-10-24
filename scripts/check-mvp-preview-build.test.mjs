import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const invalid = [
  [undefined, undefined],
  ['production', 'production'],
  ['production', 'preview'],
  ['preview', 'production'],
  [undefined, 'preview'],
  ['preview', undefined],
];

test('MVP build is rejected before producing artifacts unless Preview metadata and public auth config are valid', () => {
  for (const [deployment, target] of invalid) {
    const env = {
      ...process.env,
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    };
    if (deployment === undefined) delete env.VERCEL_ENV;
    else env.VERCEL_ENV = deployment;
    if (target === undefined) delete env.VERCEL_TARGET_ENV;
    else env.VERCEL_TARGET_ENV = target;
    const result = spawnSync(process.execPath, ['scripts/build-mvp-preview.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires explicit Preview deployment metadata/);
    assert.doesNotMatch(result.stdout, /building client environment/);
  }
  for (const changed of [
    { VITE_SUPABASE_URL: '' },
    { VITE_SUPABASE_URL: 'https://evil.example' },
    { VITE_SUPABASE_URL: 'http://example.supabase.co' },
    { VITE_SUPABASE_PUBLISHABLE_KEY: 'service_role_secret' },
  ]) {
    const env = {
      ...process.env,
      VERCEL_ENV: 'preview',
      VERCEL_TARGET_ENV: 'preview',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      ...changed,
    };
    const result = spawnSync(process.execPath, ['scripts/build-mvp-preview.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MVP Preview requires/);
    assert.doesNotMatch(result.stdout, /building client environment/);
  }
});

test('only the dedicated MVP Preview mode receives a trusted build marker', async () => {
  const previous = { ...process.env };
  try {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_TARGET_ENV = 'preview';
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    const config = await resolveConfig({ mode: 'mvp-preview', envDir: false, logLevel: 'silent' }, 'build');
    assert.equal(config.define['import.meta.env.VITE_MVP_PREVIEW_DEPLOYMENT_ENV'], '"preview"');
    assert.equal(config.define['import.meta.env.VITE_ENABLE_MVP_PREVIEW_RUNNER'], '"1"');
    assert.equal(
      config.define['import.meta.env.VITE_RUNNER_ORIGIN'],
      '"https://typescript-lab-m3-runner-qa.vercel.app"',
    );
    process.env.VITE_MVP_PREVIEW_DEPLOYMENT_ENV = 'preview';
    process.env.VITE_ENABLE_MVP_PREVIEW_RUNNER = '1';
    const ordinary = await resolveConfig({ mode: 'production', envDir: false, logLevel: 'silent' }, 'build');
    assert.equal(ordinary.define['import.meta.env.VITE_MVP_PREVIEW_DEPLOYMENT_ENV'], 'undefined');
    assert.equal(ordinary.define['import.meta.env.VITE_ENABLE_MVP_PREVIEW_RUNNER'], 'undefined');
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    await assert.rejects(
      resolveConfig({ mode: 'mvp-preview', envDir: false, logLevel: 'silent' }, 'build'),
      /requires the explicitly configured public Supabase/,
    );
  } finally {
    process.env = previous;
  }
});
