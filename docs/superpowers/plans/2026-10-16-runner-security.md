# Isolated TypeScript Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate a safe execution boundary and then run deterministic challenge tests on a learner's **current** TypeScript source with honest result statuses.

**Architecture:** Keep compilation/test fixtures separate from the editor. Run adversarial execution experiments in a disposable spike first; only build the runner if the isolation model survives review. An isolated external playground remains the sanctioned fallback.

**Tech Stack:** TypeScript, browser sandbox/isolated origin as validated, Vitest, Monaco or CodeMirror (selected after responsive/a11y check).

**Spec:** `docs/superpowers/specs/2026-10-16-typescript-lab-design.md` (`REQ-03`, `REQ-04`, `REQ-12`); ADR-0002.

**Plan status:** Ready for owner review; its security spike has an additional mandatory go/no-go decision.

**Shared contract:** Consume reviewed [v1 interfaces](../specs/2026-10-16-shared-contracts-design.md) from coordinator-owned `shared/contracts/v1.ts`. Track C owns only `docs/security/` and `spikes/runner/` during the parallel wave. Production runner files and UI integration are later, separately assigned work after owner approval of the security report. Shared results do not approve an execution architecture.

**Parallel ownership:** Track C can begin Task 0 immediately, without a completed challenge UI. Before security approval it owns only disposable spikes and `docs/security/`; implementation and UI integration wait for contracts and the owner's security decision.

## Global Constraints

- **Hard stop:** do not implement a privileged runner until the security spike is reviewed and the owner selects a validated approach.
- A Web Worker by itself is not a security boundary. No direct `eval`/`new Function` of untrusted code in app origin or privileged server contexts.
- Reject arbitrary imports/packages and prohibit access to saved authentication/session material.
- The runner must support timeout/termination, compile diagnostics, cancellation and test case failure detail.
- Browser-supplied passes are educational, not trusted scoring.

## Review Focus

1. Infinite loop freezes only isolated work, never the host app; spike and Task 1.
2. Unauthorized networking/storage/parent DOM access is blocked by isolation where technically enforceable; spike and Task 1.
3. Invalid TS source returns `compile-error`, not `failed`; Task 2.
4. Runtime exception returns `execution-error` and distinguishes from timeout; Task 2.
5. Stale test response never overwrites results for newer editor contents; Task 2.

---

### Task 0: Disposable security spike (mandatory approval gate)

**Files:** Create `docs/security/execution-spike.md`; optionally add a disposable proof of concept under `spikes/runner/` with documented removal/retention decision.

**Interfaces:** A report containing threat model, untrusted capabilities, origin/CSP restrictions, data flow, timeouts, import rules, feasibility of TypeScript transpilation, alternative providers, and a go/no-go recommendation.

- [ ] List forbidden abilities: accessing app origin storage/auth token, parent DOM, unapproved network imports, endless CPU usage and ability to submit fake trusted grades.
- [ ] Build narrow reproducible adversarial probes against candidate isolation techniques, with cleanup and explicit limitations.
- [ ] Compare browser-side isolated origin/iframe, server-backed hardened sandbox (deferred unless strictly necessary) and external playground; do not call a worker alone safe.
- [ ] Present the report and **stop for owner review of security architecture**. If no safe approach is demonstrated, do not continue to Task 1 or 2.

### Task 1: Testable isolated runner contract (after approval only)

**Files:** Create `src/features/runner/runChallenge.ts`, `src/features/runner/runChallenge.test.ts` and approved isolation adapter files; consume `shared/contracts/v1.ts` rather than creating competing result types.

**Interfaces:** Shared `RunStatus`, `RunResult` and `CaseResult`; `runChallenge(source: string, challengeId: string, context: { runId: string; sourceRevision: number; challengeVersion: string }, signal?: AbortSignal): Promise<RunResult>`. Results echo the context and challenge ID; consumers reject stale results before display or submission. Cancellation and unsupported/policy-rejected execution use the shared reason vocabulary. Case results record expected/actual when available.

- [ ] Write failing adapter/timeout/forbidden-access tests and a malformed-source case using the approved isolation model.
- [ ] Run and record red checks; implement isolated execution and fresh-worker cleanup per run as designed.
- [ ] Verify all security probes plus focused Vitest suite, typecheck and build.
- [ ] Commit `feat(runner): add isolated challenge evaluator`.

### Task 2: Integrate accessible editor and results panel

**Files:** Create `src/features/runner/CodeEditor.vue`, `TestResults.vue`, `TestResults.test.ts`; modify `src/pages/ChallengePage.vue`.

**Interfaces:** Submit current source to `runChallenge`; display status, per-case details, cancellation and recoverable retry. Preserve source across tab/pane changes.

- [ ] Write failing UI tests for compile error, timeout, cancellation, stale results, success and failure on the exact editor buffer.
- [ ] Implement editor component with accessibly labelled code input and real test controls; prohibit fabricated green badges.
- [ ] Validate mobile and keyboard paths; run full checks and browser review.
- [ ] Commit `feat(practice): connect editor to real test feedback`.
