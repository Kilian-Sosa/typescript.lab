import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const runner = fileURLToPath(new URL('../apps/runner/', import.meta.url));

for (const cwd of [root, runner]) {
  const require = createRequire(join(cwd, 'package.json'));
  const { ESLint } = require('eslint');
  const eslint = new ESLint({ cwd });
  const prettier = require('prettier');

  test(`${cwd}: formatter rejects unformatted source and accepts formatted source`, async () => {
    const filepath = join(cwd, 'src/quality-probe.ts');
    const options = { ...(await prettier.resolveConfig(filepath)), filepath };
    assert.equal(await prettier.check('export const probe={value:1}', options), false);
    assert.equal(await prettier.check('export const probe = { value: 1 };\n', options), true);
  });

  test(`${cwd}: lint and formatter CLIs fail on deliberate violations without rewriting input`, () => {
    const lint = spawnSync(
      process.execPath,
      [
        join(dirname(require.resolve('eslint/package.json')), 'bin/eslint.js'),
        '--stdin',
        '--stdin-filename',
        'src/quality-probe.ts',
        '--max-warnings',
        '0',
      ],
      {
        cwd,
        input: 'const unusedQualityProbe = 1;\n',
        encoding: 'utf8',
      },
    );
    assert.equal(lint.status, 1, lint.stderr);
    assert.match(lint.stdout, /no-unused-vars/);
    const format = spawnSync(
      process.execPath,
      [require.resolve('prettier/bin/prettier.cjs'), '--check', '--stdin-filepath', 'src/quality-probe.ts'],
      {
        cwd,
        input: 'export const probe={value:1}',
        encoding: 'utf8',
      },
    );
    assert.equal(format.status, 1, format.stderr);
  });
  const paths =
    cwd === root
      ? [
          'src/quality-probe.ts',
          'shared/contracts/quality-probe.ts',
          'scripts/quality-probe.mjs',
          'tests/e2e/quality-probe.ts',
          'apps/runner/src/quality-probe.ts',
        ]
      : ['src/quality-probe.ts', 'tests/quality-probe.mjs'];

  for (const filePath of paths) {
    test(`${cwd}: rejects unused bindings in ${filePath}`, async () => {
      const [result] = await eslint.lintText('const unusedQualityProbe = 1;\n', { filePath });
      assert.ok(result.messages.some(({ ruleId }) => ruleId?.endsWith('no-unused-vars')));
    });
    test(`${cwd}: accepts valid source in ${filePath}`, async () => {
      const [result] = await eslint.lintText('export const qualityProbe = 1;\n', { filePath });
      assert.equal(result.errorCount, 0);
      assert.equal(result.warningCount, 0);
    });
  }

  test(`${cwd}: ignores generated output, not source`, async () => {
    assert.equal(await eslint.isPathIgnored('dist/probe.js'), true);
    assert.equal(await eslint.isPathIgnored('.vercel/output/probe.js'), true);
    assert.equal(await eslint.isPathIgnored('src/quality-probe.ts'), false);
  });

  if (cwd === root) {
    test('Vue parser checks script bindings and template defects', async () => {
      const [unused] = await eslint.lintText(
        '<script setup lang="ts">const unusedQualityProbe = 1;</script><template><p>Probe</p></template>',
        { filePath: 'src/QualityProbe.vue' },
      );
      assert.ok(unused.messages.some(({ ruleId }) => ruleId === '@typescript-eslint/no-unused-vars'));
      const [invalid] = await eslint.lintText('<template><p v-if="true" v-else>Probe</p></template>', {
        filePath: 'src/QualityProbe.vue',
      });
      assert.ok(invalid.messages.some(({ ruleId }) => ruleId === 'vue/valid-v-else'));
      const [valid] = await eslint.lintText(
        '<script setup lang="ts">const label: string = "Probe";</script><template><p>{{ label }}</p></template>',
        { filePath: 'src/QualityProbe.vue' },
      );
      assert.deepEqual(valid.messages, []);
    });
  }
}
