# Runner browser console regression implementation plan

> Execute inline with superpowers:executing-plans. No delegated review is requested.

**Goal:** Fix issue #21's obsolete pre-console browser expectation and verify the compiled runner's console contract.
**Architecture:** Test-only changes through the existing built cross-site iframe, supervisor, Worker and QuickJS pipeline.
**Tech stack:** Node test runner, pinned Playwright/Vite, installed Edge locally; CI uses pinned Linux Chromium.
**Specs:** `docs/superpowers/specs/2026-10-24-learner-console-design.md`, dedicated runner design, product REQ-04/REQ-12 and ADR-0002.
**Spec impact: no spec change.** Restore verification of approved console capture and finite plain JSON output rejection; no product or contract change.

## Constraints and review focus

- Preserve production code, CSP, isolation, timeout/memory/output budgets, disposal and forbidden-API regressions.
- Inspect the actual terminal envelope's consoleOutput; keep frozen RunResult unchanged.
- Check exact sequence/case/level/text, HTML-like Unicode text, no host console forwarding, and explicit truncation at count/byte bounds.
- Keep undefined output rejection separate from valid logging and passing canonical answers.
- No configuration, dependencies, hosted changes or deployment.

## Task 1: Restore compiled browser regression coverage

**Files:** `apps/runner/tests/browser.test.mjs` and this execution record.
**Interfaces:** Existing run helper returns RunResult; consoleOutput is a sibling on the terminal run-result envelope.

- [x] Reproduce stale assertion on unchanged main: expected compile-error, received execution-error/policy-rejected for undefined return.
- [x] Replace it with canonical solution logging all four levels; assert all cases/actual answers and exact case-associated transcript as plain text.
- [x] Exercise console floods against the built Worker; assert count <=100, per-message <=2048 UTF-8 bytes, total <=16384 bytes, envelope <=65536 bytes and truncation.
- [x] Add separate no-return source expecting execution-error/policy-rejected and the JSON-policy diagnostic.
- [x] Run built runner browser suite, then local application runner suite sequentially; run runner unit suite and inspect diff.
- [x] Record verification and remaining CI limitations. Leave scoped changes for review.

## Execution record

- Base: cf6ef5a on clean main; branch fix/runner-browser-console.
- RED reproduced on installed Edge outside sandbox after sandbox SiteList permission failure.
- Corepack registry download unavailable; use installed pinned Node entry points as repository instructions specify.

### Verification, 2026-10-24

- Compiled runner browser regression: PASS on installed Edge, including 14 canonical cases, exact four-level transcript, count/UTF-8/envelope bounds, undefined-return policy rejection and all existing security/lifecycle checks. 26 Workers created and terminated, zero active, maximum one concurrent.
- Application runner integration: PASS after the browser step in the isolated worktree, at desktop/mobile widths, including plain-text Console rendering, resource limits, retry/recovery, forged messages and restricted third-party cookies.
- Runner unit tests: 167/167 across five files. Root unit tests: 220/220 across 28 files. git diff --check passed.
- The first application integration attempt in the shared checkout timed out during concurrent live source/dependency changes. A managed worktree was created at the original base; only this test and plan were transferred, and these edits were removed from the shared checkout. Installed dependencies were reused through local ignored junctions.
- One draft byte-flood assertion incorrectly assumed all retained messages belong to the first case. Inspection confirmed per-case collectors may retain short messages in later contexts within the remaining byte budget. The test now checks canonical monotonic case order and valid Unicode instead; production behavior is unchanged.
- Direct self-review confirms both directions of spec/test tracing. Production source, frozen contracts, dependencies, environment variables, workflow configuration and security budgets are unchanged. No delegated review was launched under repository policy.
- Local Node entry points were used because Corepack could not download pnpm. Linux Chromium and full GitHub Actions acceptance on a PR/subsequent main push were unverified at implementation handoff; nothing had been committed, pushed, deployed or merged at that point.

### Publication, 2026-10-24

- Owner invoked publish-branch-commits-pr. Publish only the browser regression and this execution record to fix/runner-browser-console, targeting main with Fixes #21.
- Pre-commit compiled runner browser verification passed again on Edge (26/26 Workers disposed); whitespace checks passed. Earlier application integration and unit-suite evidence above applies to the same test source.
- No spec change: tests restore the approved console/output-policy requirements. No environment-variable changes. Hosted CI acceptance remains pending until the PR workflow completes; subsequent main-push acceptance requires a later authorized merge.
