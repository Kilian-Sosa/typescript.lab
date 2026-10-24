# CI code quality implementation plan

> Execute inline with superpowers:executing-plans and test-driven-development. The author owns all writes; no hosted configuration changes or delegated review.

**Goal:** Resolve issue #22 with reproducible, read-only ESLint and Prettier gates for the app and independently installed runner.

**Architecture:** One shared flat-config factory supplies recommended JavaScript/TypeScript rules and Vue essential rules. Thin package entry points resolve tools from their own installations. One root Prettier configuration governs executable sources and machine-readable configuration; generated outputs and dependency lockfiles are excluded explicitly.

**Tech stack:** Node 24, pnpm 11.25.0, pinned ESLint/typescript-eslint/eslint-plugin-vue and Prettier.

**Spec:** [Issue #22](https://github.com/Kilian-Sosa/typescript.lab/issues/22), [product quality requirements](../specs/2026-10-16-typescript-lab-design.md#8-quality-and-non-functional-requirements), [ADR-0001](../../decisions/0001-frontend-platform.md).

**Spec impact: no spec change.** Development/CI checks support existing quality and portability requirements; no approved product behavior, runner boundary, shared contract, runtime configuration or deployment gate changes.

## Constraints and review focus

- Both packages must resolve their own pinned tooling, including a runner-only install.
- Include Vue SFCs, TS/JS, shared contracts, scripts, challenges, spikes and tests; exclude only generated/local output.
- Catch unused variables and Vue template defects without costly typed linting or duplicate stylistic rules.
- Formatting must preserve embedded learner-source fixtures and security-sensitive strings.
- CI must check without modifying source and retain every existing verification step.
- Preserve English source comments and existing isolation and deployment restrictions.

## Task 1 — Reproducible quality gates

Files: package manifests/lockfiles, `tooling/eslint.mjs`, package `eslint.config.mjs` entry points, `prettier.config.mjs`, `.prettierignore`, `.github/workflows/ci.yml`, README files, baseline source files and `scripts/check-code-quality.test.mjs`.

Interfaces: root and runner `lint` / `format:check` scripts; shared `createConfig` factory accepting package-local tool modules.

- [x] Add config regressions for unused JS/TS/Vue bindings, Vue template defects, valid sources, exclusions and both package resolutions; observe failure before configuration exists.
- [x] Pin compatible tooling in both independent lockfiles, implement shared configuration and deterministic formatter scripts.
- [x] Resolve baseline errors with narrow documented exceptions only where semantics require them; apply formatting as a tooling-only baseline.
- [x] Add both checks and config regressions to CI; document local commands, scope and exceptions.
- [x] Run frozen installs, both lint/format commands, deliberate failing CLI probes, app typecheck/tests/build and runner tests/build. Review the diff for semantic changes and verify that all existing CI steps remain.
- [x] Record verification and any limitations here. Leave a reviewable local change on `chore/ci-code-quality-gates` in an isolated worktree based on clean `main` (`cf6ef5a`).

## Execution record

- Published slice isolated from concurrent run/submission and repository-protection edits. Prettier-normalized comparison confirms no production behavior changes. Shared Contracts v1 has formatting changes only.
- Added CI job `lint`; existing `verify` job and push/PR triggers remain intact. No branch rules, hosted resources, runtime variables or deployment gates changed.
- App: typecheck, 220 unit tests and build passed. Runner: 167 unit tests and validation build passed with synthetic origins.
- Both package lint/format checks and 21 quality regressions passed, including CLI exit-1 probes. Frozen lockfiles validated. A disposable runner-only install outside the repository passed both commands without app dependencies; its directory was removed.
- Browser: app 22 passed / 30 opt-in skipped; runner CSP/evaluation/disposal passed; real app-to-runner desktop/mobile integration passed, including console, resource caps, forgery/stale responses, cancellation and cookie/storage/DOM isolation.
- Existing build-policy/probe unit checks: 9 passed. Mockup structural checks passed (25 required files, 216 documentation links, 73 HTML IDs).
- Baseline compatibility fixes: mockup checks tolerate formatter whitespace/quotes; a stale pre-console browser assertion now checks approved real console capture (observed RED then GREEN). Narrow test-only explicit-any exceptions are documented in place.
- The optional historical security spike was attempted without its required preinstalled-module environment paths and did not run; it is outside CI. No new security/deployment approval is implied.
- Final review: author self-review per owner policy; no additional review agent. No deferred findings.
