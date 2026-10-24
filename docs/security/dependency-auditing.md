# Dependency vulnerability checks

CI's independent **Dependency vulnerability audit** job runs on every PR targeting
`main` (including forks) and every push to `main`. It audits the root
`pnpm-lock.yaml` and independently installed `apps/runner/pnpm-lock.yaml`, including
production, development, optional and transitive packages. Unit-test success does
not override this check. Repository administrators may require this named check
in branch protection separately; adding the workflow does not change protection.

Use Node 24 and pnpm 11.25.0:

```powershell
node --test scripts/audit-dependencies.test.mjs
pnpm audit:dependencies
```

No dependency install or credentials are needed for scanning. The script copies
each manifest and lockfile into its own temporary directory, calls the pinned
`pnpm --ignore-workspace audit --json --audit-level=low --registry=https://registry.npmjs.org`,
then removes the copies. Repository `.npmrc` and workspace audit-ignore settings
are intentionally excluded, as are manifest scripts and package-level pnpm settings.
The maintained [pnpm audit](https://pnpm.io/cli/audit)
command queries npm's bulk advisory service and reports GitHub Advisory (GHSA)
IDs; pnpm 11's response does not contain CVE IDs. GHSA links provide CVE details.
Audit results are time-dependent even when lockfiles and tool versions are pinned.

The historical `spikes/runner/pnpm-lock.yaml` is explicitly excluded: it records
the retired feasibility experiment and is not installed or built by current CI.
Reactivating that spike as supported tooling must add it to the audit boundaries.

## Severity and availability policy

- Every **high or critical** finding blocks, including existing findings and
  findings **without a published fix**. There is no grandfathered baseline.
  Unpatched vulnerabilities require investigation and either mitigation/removal or
  an explicit reviewed, time-limited exception.
- Info, low and moderate findings are visible in logs and the GitHub check summary
  without blocking. Waived findings also remain visible, with reason/owner/expiry.
- Each finding includes boundary, package, installed version, GHSA, severity,
  dependency paths and patched version range, or `no published fix`.
- Command errors, timeouts, invalid JSON, missing fields and inconsistent reports
  are **audit unavailable**, never a clean scan. Each boundary gets up to three
  attempts, a 60-second timeout per command and two seconds between failures.
  A valid vulnerability report is not retried. After exhaustion, the check fails;
  rerun it when the service recovers. The other boundary is still audited.
- Raw subprocess output is not printed on errors; it could include credentials.
  Advisory text is escaped for logs and Markdown summaries.

The job uses ordinary `pull_request`, read-only `contents` permission, no secrets,
no deployment tools and `persist-credentials: false`. It does not install project
dependencies or run package lifecycle scripts. Never switch to `pull_request_target`
or supply registry/deployment secrets to make this job pass. Dependabot upgrade PRs
are a separate possible follow-up, not part of this scanner.

## Exception review procedure

Prefer a supported secure patch of the controlling dependency. Do not use blanket
`audit.ignore`, `--ignore-unfixable`, `--ignore-registry-errors`, `continue-on-error`
or arbitrary advisory allowlists. The sole waiver file is
[`dependency-audit-exceptions.json`](dependency-audit-exceptions.json), initially `[]`.

For a legitimate false positive or temporary accepted risk, open a PR adding one
entry per exact boundary/package/GHSA with supporting evidence in a tracking issue:

```json
{
  "boundary": "runner",
  "package": "affected-package",
  "advisory": "GHSA-xxxx-xxxx-xxxx",
  "reason": "Explain exposure, evidence, mitigation and why an upgrade is unavailable",
  "owner": "@responsible-maintainer",
  "issue": "https://github.com/Kilian-Sosa/typescript.lab/issues/123",
  "expires": "2026-11-01"
}
```

This is illustrative, not an approved exception. Use the actual GHSA, package,
accountable owner and a short justified lifetime. A maintainer must review the PR
and evidence before merge; changing expiry requires renewed review. Exceptions
expire at **00:00 UTC on the stated date**. Invalid, duplicate or expired entries
fail the gate, even when no current advisory matches. Waivers apply only to their
exact scope; a root waiver never waives the runner graph. Remove an exception once
the package is fixed or no longer used. Check the policy tests and both live scans
before requesting review.

## Initial remediation

The first live scan identified [GHSA-834v-8h66-3h79](https://github.com/advisories/GHSA-834v-8h66-3h79)
(CVE-2026-115895, high; published October 20 and updated October 23, 2026) in
`happy-dom@21.0.3`, directly and through Vitest's peer resolution. The advisory's
structured patched-version field and npm metadata identify `21.0.4` as the fixed
version; the historical narrative still says no patch. This is the latest patch
on the current 21.0 line as checked October 24, supports Node >=20, and avoids a
minor/major upgrade or dependency override. Exposure requires JavaScript evaluation
of attacker-controlled HTML/modules; Happy DOM is this repository's test DOM, not
the learner execution boundary. The finding is patched rather than waived.
