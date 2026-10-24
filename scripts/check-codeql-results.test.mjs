import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectSarif, loadAcceptedFindings } from './check-codeql-results.mjs';

function sarif(severity, level = 'warning') {
  return {
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            rules: [
              {
                id: 'fixture',
                properties: severity === undefined ? {} : { 'security-severity': severity },
                defaultConfiguration: { level },
              },
            ],
          },
        },
        results: [{ ruleId: 'fixture', ruleIndex: 0 }],
      },
    ],
  };
}
test('medium and higher security findings fail even if analysis succeeded', () => {
  for (const severity of ['4.0', '7.5', '9.8']) assert.equal(inspectSarif(sarif(severity)), 1);
  assert.equal(inspectSarif(sarif('3.9')), 0);
});
test('non-security errors fail but warnings remain visible nonblocking findings', () => {
  assert.equal(inspectSarif(sarif(undefined, 'error')), 1);
  assert.equal(inspectSarif(sarif(undefined)), 0);
});
test('valid empty analysis passes and missing or malformed analysis fails closed', () => {
  const clean = sarif(undefined);
  clean.runs[0].results = [];
  assert.equal(inspectSarif(clean), 0);
  for (const value of [{}, { runs: [] }, { runs: [{}] }]) assert.throws(() => inspectSarif(value), /analysis|SARIF/i);
});

test('CodeQL extension rule references enforce their real security severity', () => {
  const analysis = sarif('9.8');
  const run = analysis.runs[0];
  run.tool.extensions = [{ name: 'codeql/javascript-queries', rules: run.tool.driver.rules }];
  run.tool.driver.rules = [];
  run.results = [{ ruleId: 'fixture', rule: { id: 'fixture', toolComponent: { index: 0 }, index: 0 } }];
  assert.equal(inspectSarif(analysis), 1);
});

test('accepted findings require an exact rule, source file and line', () => {
  const analysis = sarif('6.3');
  analysis.runs[0].results[0].locations = [
    { physicalLocation: { artifactLocation: { uri: 'scripts/pinned.mjs' }, region: { startLine: 7 } } },
  ];
  const accepted = [{ ruleId: 'fixture', path: 'scripts/pinned.mjs', line: 7 }];
  assert.equal(inspectSarif(analysis, accepted), 0);
  for (const change of [{ ruleId: 'other' }, { path: 'other.mjs' }, { line: 8 }]) {
    assert.equal(inspectSarif(analysis, [{ ...accepted[0], ...change }]), 1);
  }
});
test('accepted findings fail closed on changed source or expired review', () => {
  const root = mkdtempSync(join(tmpdir(), 'lab-codeql-review-'));
  try {
    mkdirSync(join(root, '.github', 'codeql'), { recursive: true });
    writeFileSync(join(root, 'pinned.mjs'), 'verified archive');
    const entry = {
      ruleId: 'fixture',
      path: 'pinned.mjs',
      line: 7,
      owner: 'fixture-owner',
      reason: 'checksum verification',
      expires: '2027-01-24',
      sourceSha256: createHash('sha256').update('verified archive').digest('hex'),
    };
    writeFileSync(join(root, '.github', 'codeql', 'accepted-findings.json'), JSON.stringify([entry]));
    assert.equal(loadAcceptedFindings(root, Date.parse('2026-10-24')).length, 1);
    assert.throws(() => loadAcceptedFindings(root, Date.parse('2027-01-25')), /expired/i);
    writeFileSync(join(root, 'pinned.mjs'), 'changed code');
    assert.throws(() => loadAcceptedFindings(root, Date.parse('2026-10-24')), /source/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
