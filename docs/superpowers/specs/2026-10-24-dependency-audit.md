# Dependency vulnerability audit

Issue: [#23](https://github.com/Kilian-Sosa/typescript.lab/issues/23).
Spec impact: **add focused spec**. The product design and ADR-0001 require GitHub Actions CI but do not define a dependency advisory gate. No product, runner contract, or deployment behavior changes.

## Requirements

- A named, independent `Dependency vulnerability audit` check runs on pull requests targeting main and pushes to main, including forks, with read-only contents permission, no secrets, no persisted checkout credentials, and no dependency lifecycle scripts.
- Audit both `pnpm-lock.yaml` and `apps/runner/pnpm-lock.yaml`, including direct, transitive, development and optional dependencies, using Node 24 and pnpm 11.25.0. Use pnpm's maintained npm registry bulk advisory integration (GitHub advisory IDs).
- The historical `spikes/runner/pnpm-lock.yaml` is excluded because the retired feasibility experiment is outside current CI install/build boundaries. If reactivated as supported tooling, add its graph to this gate.
- Block every unwaived high/critical advisory, including existing findings and those with no patch. This deliberately strengthens the minimum new-actionable-only policy: no grandfathered baseline or silent unpatched bypass. Lower severities remain visible without blocking.
- Print boundary, package, installed version, GHSA ID, severity, dependency paths and patched range (or explicitly no published fix). Waived findings remain visible.
- Exceptions must match one boundary, package and GHSA, with a reason, accountable owner, tracking issue URL and UTC expiry date. Invalid, duplicate or expired entries fail closed. Maintainers review exceptions through ordinary PR review. Start with no exceptions.
- Do not inherit repository audit ignore configuration: audit isolated temporary copies of each manifest and lockfile. Never install or execute dependency code for scanning.
- Retry unavailable services, invalid reports and execution failures up to three attempts, with a two-second delay and a 60-second command timeout. Exhaustion fails as **audit unavailable**, never clean. Attempt both boundaries even if one fails. Never print raw subprocess errors or registry response bodies.
- Deterministic tests prove clean pass, high/critical failure, nonblocking lower severities, unpatched behavior, waiver validation, service failures/recovery, malformed reports and runner-only coverage. Live scans validate compatibility with the actual pinned pnpm JSON schema.
- Contributor guidance describes the commands, policy and waiver procedure. Dependabot updates and branch-protection administration are separate follow-ups.

## Acceptance mapping

The Node test suite proves policy and orchestration with controlled pnpm-format reports. CI wiring exposes the independent check on both events. Live scans prove both real lockfiles are accepted by the pinned audit tool. A discovered Happy DOM high advisory is remediated with a targeted secure patch, without an override or waiver.

References: [pnpm audit](https://pnpm.io/cli/audit), [npm audit endpoint](https://docs.npmjs.com/cli/commands/npm-audit/), [Happy DOM advisory](https://github.com/advisories/GHSA-834v-8h66-3h79).
