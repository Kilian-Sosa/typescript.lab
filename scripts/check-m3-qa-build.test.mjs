import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const denied = [
  [undefined, undefined],
  ['production', 'production'],
  ['production', 'preview'],
  ['preview', 'production'],
  ['development', 'development'],
  ['preview', undefined],
  [undefined, 'preview'],
  ['preview', 'staging'],
];

test('QA Vite configuration rejects missing or non-Preview deployment metadata', async () => {
  const original = { ...process.env };
  try {
    for (const [environment, target] of denied) {
      if (environment === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = environment;
      if (target === undefined) delete process.env.VERCEL_TARGET_ENV;
      else process.env.VERCEL_TARGET_ENV = target;
      await assert.rejects(
        resolveConfig({ mode: 'm3-hosted-qa', envDir: false, logLevel: 'silent' }, 'build'),
        /requires explicit Preview deployment metadata/,
      );
    }
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_TARGET_ENV = 'preview';
    const config = await resolveConfig({ mode: 'm3-hosted-qa', envDir: false, logLevel: 'silent' }, 'build');
    assert.equal(config.define['import.meta.env.VITE_M3_QA_DEPLOYMENT_ENV'], '"preview"');

    // Public flags cannot turn an ordinary Production-mode artifact into a QA artifact.
    process.env.VITE_M3_QA_DEPLOYMENT_ENV = 'preview';
    process.env.VITE_ENABLE_M3_QA_RUNNER = '1';
    const production = await resolveConfig({ mode: 'production', envDir: false, logLevel: 'silent' }, 'build');
    assert.equal(production.define['import.meta.env.VITE_M3_QA_DEPLOYMENT_ENV'], 'undefined');
  } finally {
    process.env = original;
  }
});

test('QA artifact builder rejects unsafe metadata before starting either build', () => {
  for (const [environment, target] of denied) {
    const env = { ...process.env };
    if (environment === undefined) delete env.VERCEL_ENV;
    else env.VERCEL_ENV = environment;
    if (target === undefined) delete env.VERCEL_TARGET_ENV;
    else env.VERCEL_TARGET_ENV = target;
    const result = spawnSync(process.execPath, ['scripts/build-m3-qa.mjs'], { cwd: root, encoding: 'utf8', env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires explicit Preview deployment metadata/);
    assert.doesNotMatch(result.stdout, /building client environment/);
  }
});
