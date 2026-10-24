import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function loadAcceptedFindings(root, now = Date.now()) {
  const entries = JSON.parse(readFileSync(join(root, '.github/codeql/accepted-findings.json'), 'utf8'));
  if (!Array.isArray(entries)) throw new Error('Invalid accepted CodeQL findings.');
  for (const entry of entries) {
    if (!entry.ruleId || !entry.owner || !entry.reason || !Number.isInteger(entry.line) || entry.line < 1)
      throw new Error('Incomplete CodeQL review.');
    if (!Number.isFinite(Date.parse(entry.expires)) || Date.parse(entry.expires) <= now)
      throw new Error('CodeQL finding review expired.');
    const path = resolve(root, entry.path);
    if (!path.startsWith(resolve(root) + sep)) throw new Error('CodeQL reviewed source escapes repository.');
    const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (hash !== entry.sourceSha256) throw new Error('CodeQL reviewed source changed; review must be renewed.');
  }
  return entries;
}

export function inspectSarif(analysis, accepted = []) {
  if (analysis.version !== '2.1.0' || !Array.isArray(analysis.runs) || !analysis.runs.length)
    throw new Error('Missing or invalid SARIF analysis.');
  let blocking = 0;
  for (const run of analysis.runs) {
    if (!run.tool?.driver || !Array.isArray(run.results)) throw new Error('Incomplete SARIF analysis.');
    for (const result of run.results) {
      const componentIndex = result.rule?.toolComponent?.index;
      const component = componentIndex === undefined ? run.tool.driver : run.tool.extensions?.[componentIndex];
      const rules = component?.rules;
      const ruleId = result.rule?.id ?? result.ruleId;
      const rule = rules?.find((item) => item.id === ruleId) ?? rules?.[result.rule?.index ?? result.ruleIndex];
      if (!rule || (ruleId && rule.id !== ruleId)) throw new Error('SARIF result has no analysis rule.');
      const security = rule.properties?.['security-severity'];
      if (
        security !== undefined &&
        (!Number.isFinite(Number(security)) || Number(security) < 0 || Number(security) > 10)
      )
        throw new Error('Invalid SARIF security severity.');
      const location = result.locations?.[0]?.physicalLocation;
      if (
        accepted.some(
          (entry) =>
            entry.ruleId === rule.id &&
            entry.path === location?.artifactLocation?.uri &&
            entry.line === location?.region?.startLine,
        )
      )
        continue;
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
    const root = fileURLToPath(new URL('../', import.meta.url));
    const accepted = loadAcceptedFindings(root);
    let blocking = 0;
    for (const file of files)
      blocking += inspectSarif(JSON.parse(readFileSync(join(directory, file), 'utf8')), accepted);
    console.log(
      'CodeQL: ' +
        blocking +
        ' findings meet the error/medium-security threshold; ' +
        accepted.length +
        ' source-pinned false-positive reviews configured.',
    );
    process.exitCode = blocking ? 1 : 0;
  } catch {
    console.error(
      'CodeQL analysis or reviewed-finding validation failed; see the versioned policy and regression tests.',
    );
    process.exitCode = 2;
  }
}
