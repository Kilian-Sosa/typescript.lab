import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function inspectSarif(analysis) {
  if (analysis.version !== '2.1.0' || !Array.isArray(analysis.runs) || !analysis.runs.length)
    throw new Error('Missing or invalid SARIF analysis.');
  let blocking = 0;
  for (const run of analysis.runs) {
    const rules = run.tool?.driver?.rules;
    if (!Array.isArray(rules) || !Array.isArray(run.results)) throw new Error('Incomplete SARIF analysis.');
    for (const result of run.results) {
      const rule = rules.find((item) => item.id === result.ruleId) ?? rules[result.ruleIndex];
      if (!rule) throw new Error('SARIF result has no analysis rule.');
      const security = rule.properties?.['security-severity'];
      if (
        security !== undefined &&
        (!Number.isFinite(Number(security)) || Number(security) < 0 || Number(security) > 10)
      )
        throw new Error('Invalid SARIF security severity.');
      const level = result.level ?? rule.defaultConfiguration?.level ?? 'warning';
      if (security === undefined ? level === 'error' : Number(security) >= 4) blocking++;
    }
  }
  return blocking;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const directory = process.argv[2];
    if (!directory) throw new Error('Usage: node scripts/check-codeql-results.mjs <SARIF directory>');
    const files = readdirSync(directory).filter((name) => name.endsWith('.sarif'));
    if (!files.length) throw new Error('CodeQL produced no SARIF analysis.');
    let blocking = 0;
    for (const file of files) blocking += inspectSarif(JSON.parse(readFileSync(join(directory, file), 'utf8')));
    console.log('CodeQL: ' + blocking + ' findings meet the required error/medium-security threshold.');
    process.exitCode = blocking ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
