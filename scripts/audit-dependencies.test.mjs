import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  chmodSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseReport,
  validateExceptions,
  assessReport,
  auditBoundary,
  auditDependencies,
} from './audit-dependencies.mjs';

const ghsa = 'GHSA-834v-8h66-3h79';
const now = new Date('2026-10-24T12:00:00Z');
const root = fileURLToPath(new URL('../', import.meta.url));
function report(severity = 'high', patched = '>=21.0.4') {
  const vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  const advisories = {};
  if (severity) {
    vulnerabilities[severity] = 1;
    advisories['1243084'] = {
      module_name: 'happy-dom',
      severity,
      github_advisory_id: ghsa,
      patched_versions: patched,
      findings: [{ version: '21.0.3', paths: ['.>vitest>happy-dom'] }],
    };
  }
  return { advisories, metadata: { vulnerabilities } };
}
const result = (body, status = 0) => ({ status, stdout: JSON.stringify(body), stderr: '' });
const waiver = () => ({
  boundary: 'root',
  package: 'happy-dom',
  advisory: ghsa,
  reason: 'Reviewed fixture false positive with evidence in tracking issue',
  owner: '@Kilian-Sosa',
  issue: 'https://github.com/Kilian-Sosa/typescript.lab/issues/23',
  expires: '2026-10-25',
});

test('clean passes; high and critical block; all lower severities remain visible', () => {
  assert.equal(assessReport(parseReport(result(report(null))), 'root', []).blocked, false);
  for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
    const assessment = assessReport(parseReport(result(report(severity), 1)), 'root', []);
    assert.equal(assessment.blocked, ['high', 'critical'].includes(severity));
    assert.match(assessment.text, /happy-dom.*21\.0\.3/);
    assert.match(assessment.text, new RegExp(ghsa));
    assert.match(assessment.text, /\.>vitest>happy-dom/);
    assert.match(assessment.text, />=21\.0\.4/);
    assert.match(assessment.text, new RegExp(severity));
  }
});

test('unpatched high is blocked and explicitly reported', () => {
  for (const patched of [null, '<0.0.0', '']) {
    const assessment = assessReport(parseReport(result(report('high', patched), 1)), 'root', []);
    assert.equal(assessment.blocked, true);
    assert.match(assessment.text, /no published fix/i);
  }
});

test('malformed, incomplete, inconsistent reports and process errors fail closed', () => {
  const missingFinding = report();
  missingFinding.advisories['1243084'].findings = [];
  const missingPatch = report();
  delete missingPatch.advisories['1243084'].patched_versions;
  const hidden = report();
  hidden.advisories = {};
  const badSeverity = report();
  badSeverity.advisories['1243084'].severity = 'unknown';
  for (const value of [
    result({}),
    result({ advisories: {} }),
    result(hidden),
    result(missingFinding),
    result(missingPatch),
    result(badSeverity),
    result(report(null), 1),
    result(report(), 0),
    result(report(), 2),
    { status: 0, stdout: '' },
    { status: null, stdout: '{}', error: new Error('secret') },
    result({ ...report(null), error: { message: 'service unavailable' } }),
  ]) {
    assert.throws(() => parseReport(value), /unavailable/i);
  }
});

test('waivers require exact scope, accountable review and future valid UTC expiry', () => {
  const valid = validateExceptions([waiver()], now);
  const assessed = assessReport(parseReport(result(report(), 1)), 'root', valid);
  assert.equal(assessed.blocked, false);
  assert.match(assessed.text, /WAIVED.*@Kilian-Sosa.*2026-10-25/);
  assert.equal(assessReport(parseReport(result(report(), 1)), 'runner', valid).blocked, true);
  const otherPackage = [{ ...waiver(), package: 'other' }];
  assert.equal(assessReport(parseReport(result(report(), 1)), 'root', otherPackage).blocked, true);
  for (const changed of [
    { boundary: '*' },
    { package: '*' },
    { package: undefined },
    { advisory: '*' },
    { reason: '' },
    { owner: '' },
    { issue: 'http://example.com' },
    { expires: '2026-10-24' },
    { expires: '2026-02-30' },
    { expires: 'forever' },
  ]) {
    assert.throws(() => validateExceptions([{ ...waiver(), ...changed }], now), /exception/i);
  }
  assert.throws(() => validateExceptions([waiver(), waiver()], now), /duplicate/i);
  assert.throws(() => validateExceptions({}, now), /exception/i);
});

test('temporary staging includes the exact independent lockfile and excludes ignore settings', async () => {
  const seen = [];
  const output = await auditDependencies({
    root,
    exceptions: [],
    now,
    delay: async () => {},
    execute: (cwd) => {
      seen.push(cwd);
      assert.equal(existsSync(`${cwd}/.npmrc`), false);
      assert.equal(existsSync(`${cwd}/pnpm-workspace.yaml`), false);
      const manifest = JSON.parse(readFileSync(`${cwd}/package.json`, 'utf8'));
      const source = manifest.name === 'typescript-lab-runner' ? 'apps/runner/' : '';
      assert.equal(
        readFileSync(`${cwd}/pnpm-lock.yaml`, 'utf8'),
        readFileSync(`${root}/${source}pnpm-lock.yaml`, 'utf8'),
      );
      return result(source ? report('critical') : report(null), source ? 1 : 0);
    },
  });
  assert.equal(output.failed, true);
  assert.match(output.text, /root: PASS/);
  assert.match(output.text, /runner: BLOCKED/);
  assert.equal(seen.length, 2);
  for (const cwd of seen) assert.equal(existsSync(cwd), false);
});

test('unavailable service retries three times, still scans runner, and hides raw errors', async () => {
  let calls = 0;
  let waits = 0;
  const output = await auditDependencies({
    root,
    exceptions: [],
    now,
    execute: () => {
      calls++;
      return { status: 1, stdout: 'secret-token', stderr: 'credential' };
    },
    delay: async () => {
      waits++;
    },
  });
  assert.equal(calls, 6);
  assert.equal(waits, 4);
  assert.equal(output.failed, true);
  assert.match(output.text, /root: AUDIT UNAVAILABLE/);
  assert.match(output.text, /runner: AUDIT UNAVAILABLE/);
  assert.doesNotMatch(output.text, /secret-token|credential/);
});

test('a transient error recovers; a vulnerability report is never retried', async () => {
  let calls = 0;
  const output = await auditBoundary('root', root, [], {
    execute: () => (++calls === 1 ? result({}) : result(report(null))),
    delay: async () => {},
  });
  assert.equal(output.failed, false);
  assert.equal(calls, 2);
  calls = 0;
  const blocked = await auditBoundary('root', root, [], {
    execute: () => {
      calls++;
      return result(report(), 1);
    },
    delay: async () => {},
  });
  assert.equal(blocked.failed, true);
  assert.equal(calls, 1);
});

test('advisory data cannot create workflow commands or active summary markup', () => {
  const body = report();
  body.advisories['1243084'].findings[0].paths = ['x\n::error::forged <script>alert(1)</script>'];
  const output = assessReport(parseReport(result(body, 1)), 'root', []);
  assert.doesNotMatch(output.text, /\n::error|<script>/i);
});

test('CI exposes a separate read-only check without installs, secrets or privileged PR triggers', () => {
  const workflow = readFileSync(`${root}/.github/workflows/ci.yml`, 'utf8');
  assert.match(workflow, /push:\s+branches: \[main\]/);
  assert.match(workflow, /pull_request:\s+branches: \[main\]/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  const job = workflow.split('  dependency-audit:')[1].split('  verify:')[0];
  assert.match(job, /name: Dependency vulnerability audit/);
  assert.match(job, /contents: read/);
  assert.match(job, /persist-credentials: false/);
  assert.match(job, /node-version: 24/);
  assert.match(job, /version: 11\.25\.0/);
  assert.match(job, /install: false/);
  assert.match(job, /node --test scripts\/audit-dependencies.test.mjs/);
  assert.match(job, /node scripts\/audit-dependencies.mjs/);
  assert.doesNotMatch(job, /needs:|secrets\.|continue-on-error|pnpm install|--ignore-registry-errors/);
});

test('staged manifests cannot inherit package-level audit bypasses or executable hooks', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'audit-manifest-test-'));
  try {
    mkdirSync(join(fixture, 'apps/runner'), { recursive: true });
    for (const location of ['', 'apps/runner']) {
      const original = JSON.parse(readFileSync(join(root, location, 'package.json'), 'utf8'));
      writeFileSync(
        join(fixture, location, 'package.json'),
        JSON.stringify({
          ...original,
          pnpm: { auditConfig: { ignoreGhsas: [ghsa] } },
          scripts: { preinstall: 'malicious' },
        }),
      );
      copyFileSync(join(root, location, 'pnpm-lock.yaml'), join(fixture, location, 'pnpm-lock.yaml'));
    }
    const output = await auditDependencies({
      root: fixture,
      exceptions: [],
      execute: (cwd) => {
        const manifest = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
        assert.equal(manifest.pnpm, undefined);
        assert.equal(manifest.scripts, undefined);
        assert.equal(manifest.packageManager, 'pnpm@11.25.0');
        assert.ok(manifest.dependencies);
        return result(report(null));
      },
      delay: async () => {},
    });
    assert.equal(output.failed, false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('real CLI exits zero for clean graphs and nonzero for a controlled runner-only high advisory', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'audit-cli-test-'));
  try {
    for (const location of ['scripts', 'apps/runner', 'docs/security', 'bin'])
      mkdirSync(join(fixture, location), { recursive: true });
    for (const location of ['', 'apps/runner']) {
      copyFileSync(join(root, location, 'package.json'), join(fixture, location, 'package.json'));
      copyFileSync(join(root, location, 'pnpm-lock.yaml'), join(fixture, location, 'pnpm-lock.yaml'));
    }
    copyFileSync(join(root, 'scripts/audit-dependencies.mjs'), join(fixture, 'scripts/audit-dependencies.mjs'));
    writeFileSync(join(fixture, 'docs/security/dependency-audit-exceptions.json'), '[]');
    const executable = join(fixture, 'bin/pnpm');
    const fakeSource =
      `#!/usr/bin/env node\nimport { readFileSync } from 'node:fs';\n` +
      `const runner = JSON.parse(readFileSync('package.json', 'utf8')).name === 'typescript-lab-runner';\n` +
      `const data = JSON.parse(readFileSync(${JSON.stringify(join(fixture, 'response.json'))}, 'utf8'));\n` +
      `console.log(JSON.stringify(runner ? data : ${JSON.stringify(report(null))}));\n` +
      `process.exitCode = runner && Object.keys(data.advisories).length ? 1 : 0;\n`;
    writeFileSync(`${executable}.mjs`, fakeSource);
    if (process.platform === 'win32') {
      writeFileSync(`${executable}.cmd`, `@"${process.execPath}" "${executable}.mjs"\r\n`);
    } else {
      writeFileSync(executable, fakeSource);
      chmodSync(executable, 0o755);
    }
    const env = { ...process.env };
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
    env[pathKey] = `${join(fixture, 'bin')}${process.platform === 'win32' ? ';' : ':'}${env[pathKey]}`;
    env.GITHUB_STEP_SUMMARY = join(fixture, 'summary.md');
    for (const [body, expected] of [
      [report(null), 0],
      [report(), 1],
    ]) {
      writeFileSync(join(fixture, 'response.json'), JSON.stringify(body));
      const run = spawnSync(process.execPath, [join(fixture, 'scripts/audit-dependencies.mjs')], {
        env,
        encoding: 'utf8',
        timeout: 15_000,
      });
      assert.equal(run.status, expected, run.stdout + run.stderr);
      assert.match(run.stdout, /root: PASS/);
      assert.match(run.stdout, expected ? /runner: BLOCKED/ : /runner: PASS/);
      assert.doesNotMatch(run.stdout, /AUDIT UNAVAILABLE/);
    }
    assert.match(readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8'), /GHSA-834v-8h66-3h79/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
