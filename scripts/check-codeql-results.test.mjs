import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectSarif } from './check-codeql-results.mjs';

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
