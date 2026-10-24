# Runner standard globals implementation plan

> Execute inline using Superpowers executing-plans, test-driven-development and verification-before-completion. This is one bounded compiler-library correction for issue #11.

**Goal:** Allow supported numeric ECMAScript globals to typecheck and execute in isolated QuickJS.

**Architecture:** Extend the existing explicit synthetic library, retaining `noLib`, strict semantic checks and the unchanged evaluator/protocol. Verify declarations against the installed QuickJS runtime rather than adding ambient DOM/Node libraries or host callbacks.

**Tech stack:** Pinned TypeScript 5.9.3, QuickJS 0.32.0, Vitest.

**Spec impact:** Update the existing dedicated-runner specification with the explicit numeric surface and the console dependency on issue #14. This restores REQ-04 functionality without changing challenge semantics, isolation, deployment gates or shared contracts.

**Spec:** [Dedicated runner](../specs/2026-10-17-dedicated-runner-design.md), [product REQ-04](../specs/2026-10-16-typescript-lab-design.md), [ADR-0002](../../decisions/0002-challenges-and-execution.md).

## Constraints and review focus

- Keep learner execution exclusively in QuickJS; no new host bridge, dependencies or runtime configuration.
- Preserve source/input/output/memory/stack/deadline limits and finite JSON serialization.
- Reject invalid argument types and unsupported browser/Node/import APIs.
- Console remains undeclared until issue #14 implements bounded capture and display; never add a fake/no-op console.
- Support deterministic ES2022 Math methods/constants, Number conversion/static numeric helpers/constants, global numeric parsers/predicates and Infinity. Math.random remains outside the declared deterministic subset.
- The current editor is a textarea, with no independent editor type environment.

## Task 1: Correct and verify the explicit numeric library

**Files:** `apps/runner/src/supported-lib.txt`, new `apps/runner/tests/standard-globals.test.ts`, `apps/runner/tests/browser.test.mjs`, `apps/runner/README.md`, dedicated-runner spec, this plan.

**Interfaces:** Consume unchanged `compile(source)` and `evaluate(WorkerRequest)`; produce no new runtime or shared interfaces.

- [ ] Add compiler and real QuickJS regression fixtures with literal expected results for every newly declared method/constant/global. Include negative/fractional inputs, NaN/Infinity predicates, parser radix and coercion, nonfinite output rejection and type errors. Run the new test file; expect failures for missing declarations.
- [ ] Add only numeric declarations matching the pinned TypeScript standard-library signatures. Run the new file; expect all tests passing in actual QuickJS.
- [ ] Verify the canonical implementation with Math.floor/Math.max through all 14 cases, including the built browser Worker. Preserve blocked host APIs, console rejection and existing runtime errors/budget tests.
- [ ] Update the runner spec and README with the precise surface and console dependency. Run full runner tests, runner typecheck/build, app tests/typecheck and local runner browser suite with installed Edge. Expect all checks passing; report any concrete environment limitation.
- [ ] Review the scoped diff against the spec in both directions. Leave changes local for review; no commit, push, issue comment or deployment requested.

## Execution record

- Base: `a39a716` (issue #11's reviewed QA revision). Branch: `fix/runner-standard-globals`.
- Pre-flight: one task, unchanged compiler/evaluator/protocol interfaces. Existing untracked `apps/runner/.gitignore` and `output/` belong to prior work and are excluded.
- Execution adaptation: use PowerShell and installed Node entry points; maintain this record in place of POSIX skill scripts. Follow the owner's inline verification/no automatic review delegation policy.
