# Runner standard globals implementation plan

> Execute inline using Superpowers executing-plans, test-driven-development and verification-before-completion. This is one bounded compiler-library correction for issue #11.

**Completion note (2026-10-24):** This plan records the implementation and tests for issue #11, merged in `ee8625b` (PR #16). The checklist and execution results below describe the state **at the time of that fix**, before bounded learner console support (PR #18) was merged. They are not a claim that current `main` CI is green; the subsequent browser-test expectation regression is tracked in [issue #21](https://github.com/Kilian-Sosa/typescript.lab/issues/21).

**Goal:** Allow supported numeric ECMAScript globals to typecheck and execute in isolated QuickJS.

**Architecture:** Extend the existing explicit synthetic library, retaining `noLib`, strict semantic checks and the unchanged evaluator/protocol. Verify declarations against the installed QuickJS runtime rather than adding ambient DOM/Node libraries or host callbacks.

**Tech stack:** Pinned TypeScript 5.9.3, QuickJS 0.32.0, Vitest.

**Spec impact:** Update the existing dedicated-runner specification with the explicit numeric surface and the console dependency on issue #14. This restores REQ-04 functionality without changing challenge semantics, isolation, deployment gates or shared contracts.

**Spec:** [Dedicated runner](../specs/2026-10-17-dedicated-runner-design.md), [product REQ-04](../specs/2026-10-16-typescript-lab-design.md), [ADR-0002](../../decisions/0002-challenges-and-execution.md).

## Constraints and review focus

- Keep learner execution exclusively in QuickJS; no new host bridge, dependencies or runtime configuration.
- Preserve source/input/output/memory/stack/deadline limits and finite JSON serialization.
- Reject invalid argument types and unsupported browser/Node/import APIs.
- At the time of this fix, console remained undeclared pending issue #14; never add a fake/no-op console. Bounded console support was subsequently merged in PR #18.
- Support deterministic ES2022 Math methods/constants, Number conversion/static numeric helpers/constants, global numeric parsers/predicates and Infinity. Math.random remains outside the declared deterministic subset.
- The current editor is a textarea, with no independent editor type environment.

## Task 1: Correct and verify the explicit numeric library

**Files:** `apps/runner/src/supported-lib.txt`, new `apps/runner/tests/standard-globals.test.ts`, `apps/runner/tests/browser.test.mjs`, `apps/runner/README.md`, dedicated-runner spec, this plan.

**Interfaces:** Consume unchanged `compile(source)` and `evaluate(WorkerRequest)`; produce no new runtime or shared interfaces.

- [x] Add compiler and real QuickJS regression fixtures with literal expected results for every newly declared method/constant/global. Include negative/fractional inputs, NaN/Infinity predicates, parser radix and coercion, nonfinite output rejection and type errors. Run the new test file; expect failures for missing declarations.
- [x] Add only numeric declarations matching the pinned TypeScript standard-library signatures. Run the new file; expect all tests passing in actual QuickJS.
- [x] Verify the canonical implementation with Math.floor/Math.max through all 14 cases, including the built browser Worker. Preserve blocked host APIs, the then-current console rejection and existing runtime errors/budget tests.
- [x] Update the runner spec and README with the precise surface and console dependency. Run full runner tests, runner typecheck/build, app tests/typecheck and local runner browser suite with installed Edge. Expect all checks passing; report any concrete environment limitation.
- [x] Review the scoped diff against the spec in both directions. Leave changes local for review; no commit, push, issue comment or deployment requested.

## Execution record

- Base: `a39a716` (issue #11's reviewed QA revision). Branch: `fix/runner-standard-globals`.
- Pre-flight: one task, unchanged compiler/evaluator/protocol interfaces. Existing untracked `apps/runner/.gitignore` and `output/` belong to prior work and are excluded.
- Execution adaptation: use PowerShell and installed Node entry points; maintain this record in place of POSIX skill scripts. Follow the owner's inline verification/no automatic review delegation policy.
- RED: `node node_modules/vitest/vitest.mjs run tests/standard-globals.test.ts --reporter=dot` in `apps/runner`: 76 failed / 27 passed, with the new numeric expressions and Math-based canonical implementation reporting compile errors. After the declaration correction, 103/103 passed.
- Final runner suite: `node node_modules/vitest/vitest.mjs run --reporter=dot` in `apps/runner`: 145/145 passed, including existing supervisor isolation, deadlines, JSON budgets and runtime-error tests.
- Typechecks: root `node node_modules/typescript/bin/tsc --noEmit -p apps/runner/tsconfig.json` and `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`: both exit 0.
- Built browser suite: process-only `PLAYWRIGHT_BROWSER_CHANNEL=msedge`, `node --test tests/browser.test.mjs` in `apps/runner`: 1/1 passed, 14/14 original and numeric canonical cases, 23 Workers created/terminated, zero active. The test builds actual static assets and checks CSP, isolation, resource abuse, cancellation and recovery. Initial sandbox launch failed on Edge SiteList access; the same suite passed on an approved outside-sandbox rerun. No hosted verification or deployment performed.
- Full app suite: 195 passed / 3 failed. The failures are in the unrelated untracked `src/features/auth/AuthControls.test.ts` added concurrently: `offers sign-out without redundant connected-account copy`, `keeps sign-out disabled while identity is being cleared`, and `disables duplicate sign-in and retains a safe return route and retry after failure`. Root `node node_modules/vitest/vitest.mjs run --exclude src/features/auth/AuthControls.test.ts --reporter=dot`: all 193 existing tests passed. Auth implementation/tests and the concurrently changed `tests/e2e/auth-recovery.spec.ts` are excluded from this fix.
- Spec traceability/self-review: declared numeric members each have compiler + real VM evidence; browser Worker proves Math-based canonical success; negative tests retain strict types, no ambient DOM/Node/import escape, console absence and finite output. Evaluator/protocol/CSP/budgets remain unchanged. No independent review delegated under the owner's policy. No environment variables added or changed.
- Shared-checkout observation: during final verification, another actor committed the scoped fix as `ee8625b` and `origin/fix/runner-standard-globals` advanced to that same commit. This session issued no commit/push/deployment command. The completed verification record added afterward remains a local plan change; concurrent header/auth changes remain outside this task.
