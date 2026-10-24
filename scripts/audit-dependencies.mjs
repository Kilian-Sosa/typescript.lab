import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const ghsaPattern = /^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/;
const unavailable = () => new Error('Audit unavailable: command failed or advisory report is invalid.');
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
// Registry and policy text is untrusted: keep it on one inert Markdown/log line.
const safe = (value) =>
  String(value)
    .replace(/\p{Cc}/gu, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/([\\`*_[\]{}|])/g, '\\$1');

export function parseReport(result) {
  if (result.error || ![0, 1].includes(result.status)) throw unavailable();
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw unavailable();
  }
  const counts = report?.metadata?.vulnerabilities;
  if (
    report?.error ||
    !report?.advisories ||
    typeof report.advisories !== 'object' ||
    Array.isArray(report.advisories) ||
    !counts
  )
    throw unavailable();
  const advisories = Object.values(report.advisories);
  for (const item of advisories) {
    if (
      !item ||
      !nonempty(item.module_name) ||
      !ghsaPattern.test(item.github_advisory_id) ||
      !severities.includes(item.severity) ||
      !(item.patched_versions === null || typeof item.patched_versions === 'string') ||
      !Array.isArray(item.findings) ||
      item.findings.length === 0 ||
      item.findings.some(
        (finding) =>
          !nonempty(finding.version) ||
          !Array.isArray(finding.paths) ||
          finding.paths.length === 0 ||
          finding.paths.some((path) => !nonempty(path)),
      )
    )
      throw unavailable();
  }
  for (const severity of severities) {
    if (
      !Number.isSafeInteger(counts[severity]) ||
      counts[severity] < 0 ||
      counts[severity] !== advisories.filter((item) => item.severity === severity).length
    )
      throw unavailable();
  }
  if (result.status !== (advisories.length ? 1 : 0)) throw unavailable();
  return advisories;
}

export function validateExceptions(exceptions, now = new Date()) {
  if (!Array.isArray(exceptions)) throw new Error('Invalid dependency audit exceptions: expected array.');
  const seen = new Set();
  for (const item of exceptions) {
    if (
      !item ||
      !['root', 'runner'].includes(item.boundary) ||
      typeof item.package !== 'string' ||
      !/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(item.package) ||
      !ghsaPattern.test(item.advisory) ||
      !nonempty(item.reason) ||
      !nonempty(item.owner) ||
      typeof item.issue !== 'string' ||
      !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(item.issue) ||
      typeof item.expires !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.expires)
    ) {
      throw new Error('Invalid dependency audit exception: exact scope, reason, owner, issue and expiry required.');
    }
    const date = new Date(`${item.expires}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== item.expires || date <= now) {
      throw new Error('Invalid dependency audit exception: expired or invalid UTC date.');
    }
    const key = `${item.boundary}:${item.package}:${item.advisory}`;
    if (seen.has(key)) throw new Error('Invalid dependency audit exception: duplicate scope.');
    seen.add(key);
  }
  return exceptions;
}

export function assessReport(advisories, boundary, exceptions) {
  let blocked = false;
  const lines = [];
  for (const advisory of advisories) {
    const waiver = exceptions.find(
      (item) =>
        item.boundary === boundary &&
        item.package === advisory.module_name &&
        item.advisory === advisory.github_advisory_id,
    );
    const blocking = ['high', 'critical'].includes(advisory.severity) && !waiver;
    blocked ||= blocking;
    const patch = advisory.patched_versions;
    const remediation = patch && patch !== '<0.0.0' ? patch : 'no published fix';
    for (const finding of advisory.findings) {
      lines.push(
        `  - ${safe(advisory.module_name)} ${safe(finding.version)} | ${advisory.github_advisory_id}` +
          ` | ${advisory.severity} | remediation: ${safe(remediation)}`,
      );
      for (const path of finding.paths) lines.push(`    - dependency path: ${safe(path)}`);
    }
    if (waiver)
      lines.push(
        `    - WAIVED | owner: ${safe(waiver.owner)} | expires: ${waiver.expires}` +
          ` | reason: ${safe(waiver.reason)} | review: ${safe(waiver.issue)}`,
      );
  }
  return {
    blocked,
    text:
      `${boundary}: ${blocked ? 'BLOCKED' : 'PASS'} (${advisories.length} advisories)\n` +
      (lines.length ? lines.join('\n') : '  No known vulnerabilities reported.'),
  };
}

function executeAudit(cwd) {
  // Arguments are constants; on Windows the pnpm shim requires cmd.exe.
  const args = ['--ignore-workspace', 'audit', '--json', '--audit-level=low', '--registry=https://registry.npmjs.org'];
  return spawnSync(
    process.platform === 'win32' ? 'cmd.exe' : 'pnpm',
    process.platform === 'win32' ? ['/d', '/s', '/c', `pnpm ${args.join(' ')}`] : args,
    { cwd, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
  );
}

export async function auditBoundary(
  boundary,
  directory,
  exceptions,
  { execute = executeAudit, delay = () => setTimeout(2_000) } = {},
) {
  const staging = mkdtempSync(join(tmpdir(), 'typescript-lab-audit-'));
  try {
    // Keep only graph inputs, excluding package-level pnpm config and executable hooks too.
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    writeFileSync(
      join(staging, 'package.json'),
      JSON.stringify({
        name: manifest.name,
        private: true,
        packageManager: 'pnpm@11.25.0',
        dependencies: manifest.dependencies,
        devDependencies: manifest.devDependencies,
        optionalDependencies: manifest.optionalDependencies,
      }),
    );
    copyFileSync(join(directory, 'pnpm-lock.yaml'), join(staging, 'pnpm-lock.yaml'));
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const advisories = parseReport(await execute(staging));
        const assessment = assessReport(advisories, boundary, exceptions);
        return { failed: assessment.blocked, text: assessment.text };
      } catch {
        if (attempt < 3) await delay();
      }
    }
    return { failed: true, text: `${boundary}: AUDIT UNAVAILABLE after 3 attempts; retry the check. No clean result.` };
  } catch {
    return {
      failed: true,
      text: `${boundary}: AUDIT UNAVAILABLE; could not stage the manifest/lockfile. No clean result.`,
    };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export async function auditDependencies(options = {}) {
  const directory = options.root ?? root;
  const exceptions = validateExceptions(
    options.exceptions ??
      JSON.parse(readFileSync(join(directory, 'docs/security/dependency-audit-exceptions.json'), 'utf8')),
    options.now,
  );
  const results = [];
  for (const [boundary, location] of [
    ['root', directory],
    ['runner', join(directory, 'apps/runner')],
  ]) {
    results.push(await auditBoundary(boundary, location, exceptions, options));
  }
  return { failed: results.some((item) => item.failed), text: results.map((item) => item.text).join('\n\n') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let outcome;
  try {
    outcome = await auditDependencies();
  } catch {
    outcome = {
      failed: true,
      text: 'Dependency audit FAILED: invalid or expired exception policy. Review the policy file.',
    };
  }
  console.log(outcome.text);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Dependency vulnerability audit\n\n${outcome.text}\n`);
  }
  process.exitCode = outcome.failed ? 1 : 0;
}
