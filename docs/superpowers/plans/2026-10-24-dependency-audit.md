# Dependency Audit Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task in the current session.

**Goal:** Close issue #23 with an independent vulnerability gate for both lockfiles.
**Architecture:** A dependency-free Node script stages each lockfile/manifest in isolation, invokes pinned pnpm audit, validates its report, applies explicit expiring waivers and emits readable logs/check summary. CI runs policy tests and the live gate without installing project dependencies.
**Tech stack:** Node 24, pnpm 11.25.0, node:test, GitHub Actions.
**Spec:** [Dependency audit](../specs/2026-10-24-dependency-audit.md).

## Global constraints

- No secrets, deploy privileges, lifecycle execution, blanket audit ignores or new application environment variables.
- Both independent install boundaries must run even when the other fails.
- Unpatched high/critical findings block unless explicitly waived.

## Review focus

- A malformed/empty or partially populated report must never look clean.
- A runner-only transitive advisory must block independently of the root graph.
- Expired or overly broad exceptions must not hide findings.
- Registry errors and subprocess failures must remain distinguishable from findings.
- Advisory text and subprocess errors must not inject workflow commands or expose credentials.

## Task 1: Audit policy and CI integration

Files: create `scripts/audit-dependencies.mjs`, `scripts/audit-dependencies.test.mjs`, `docs/security/dependency-audit-exceptions.json`, `docs/security/dependency-auditing.md`; modify `.github/workflows/ci.yml`, `package.json`, `README.md`.

- [x] Write deterministic tests for parsing, severity policy, exceptions, unavailable retries, independent boundaries and safe output; run and observe failure before implementation.
- [x] Implement exported `parseReport`, `validateExceptions`, `assessReport`, `auditBoundary` and `auditDependencies`, plus the CLI entry point. Use isolated temporary copies and cleanup in `finally`.
- [x] Add a named CI job on the existing PR/main events with Node/pnpm pinned, read-only permissions, credential persistence disabled and no project installation. Run Node tests before scanning.
- [x] Document thresholds, no-fix policy, troubleshooting and precise waiver procedure; link from README and add `pnpm audit:dependencies`.
- [x] Run Node tests, live audits for both lockfiles and inspect the workflow/diff.

## Task 2: Resolve the discovered high advisory

Files: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.

- [x] Verify the maintained advisory and choose the narrow compatible patch on the current minor line.
- [x] Update Happy DOM 21.0.3 to 21.0.4 and replace its obsolete release-age exception with the patched version if required by pnpm.
- [x] Validate frozen installs, root unit tests/typecheck/build, runner frozen install and live dependency audits. Record exact results here.

## Execution record

Base: synchronized local main at `cf6ef5a`. Isolated managed worktree, branch `fix/dependency-cve-audit`; shared checkout is being used by other work.
Ruling: implement inline and perform direct review without another agent, per owner routing policy. Issue #23 supplies the requested CI scope; routine policy choices above implement its acceptance criteria.
Initial live audit: root fails with GHSA-834v-8h66-3h79 (Happy DOM 21.0.3, high, patched >=21.0.4).

Final local validation (2026-10-24): 11 audit policy/CLI tests pass; controlled runner-only high advisory exits 1 while clean graphs exit 0 and produce a summary. Both live lockfile scans pass with zero advisories. Root and runner frozen installations pass without lifecycle scripts. Root: 220 tests, typecheck and build pass. Runner: 167 tests, typecheck and build pass. The runner lockfile is unchanged. Corepack and Vite sandbox access required narrow outside-sandbox verification; no global configuration changes were made.

Direct review: all issue #23 acceptance criteria map to the focused spec, tests, CI job and contributor policy. The historical spike lockfile is explicitly excluded as inactive tooling. The separate issue #24 owner will retain the exact check name `Dependency vulnerability audit` and owns action runtime/SHA migrations and repository protection. No deployment or hosted-account access occurred. No application environment variables changed.

Hosted CI follow-up: the new audit check passed on Ubuntu. The existing `verify` job failed at `check-mvp-preview-local.mjs:139`: the synthetic session had rendered Sign out while the callback route was still redirecting. `completeCallback` installs/verifies the session before its caller awaits `router.replace`, so the button is not a navigation-completion signal. Added `page.waitForURL` before retaining the exact path/query assertions; no timeout increase or production change. Spec impact: **no spec change**, because this synchronizes the test with the already required return-to-work behavior. The unchanged test passed locally on Edge, confirming the timing-sensitive nature of the hosted failure.

The next hosted run passed that callback test and the app E2E suite, then exposed a stale runner browser assertion expecting `console.log` to fail compilation. Reproduced the same failure locally. The [approved bounded-console spec](../specs/2026-10-24-learner-console-design.md) already requires console support; updated the fixture to return valid challenge output and assert all 14 captured log entries. Spec impact: **no spec change**, restores test alignment with that existing approved requirement. No production runner files or security-policy assertions were changed.
