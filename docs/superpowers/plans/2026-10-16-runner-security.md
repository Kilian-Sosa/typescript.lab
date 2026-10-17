# Isolated TypeScript Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate a safe execution boundary and then run deterministic challenge tests on a learner's **current** TypeScript source with honest result statuses.

**Architecture:** Approved 2026-10-17: **separate static runner site + sandboxed iframe supervisor + fresh Web Worker + QuickJS/WASM VM**. The initial browser-native spike remains evidence, not production approval. Follow the [QuickJS implementation plan](2026-10-17-quickjs-runner-implementation.md) for the mandatory new spike, implementation, and hosted isolation gates.

**Tech Stack:** TypeScript semantic checker, pinned `quickjs-emscripten` after compatibility testing, Vite, browser sandbox, WebAssembly, Worker, Vitest and accessible editor after UX review.

**Spec:** `docs/superpowers/specs/2026-10-16-typescript-lab-design.md` (`REQ-03`, `REQ-04`, `REQ-12`); [dedicated runner spec](../specs/2026-10-17-dedicated-runner-design.md); ADR-0002.

**Plan status:** Original Task 0 verified with six browser probes; see [historical spike](../../security/execution-spike.md). Owner architecture decision **approved** 2026-10-17. A **new** QuickJS/cross-site feasibility spike and a technical security go/no-go are still required before Tasks 1–2. Separate approval is required for Vercel provisioning and deployment.

**Shared contract:** Consume reviewed [v1 interfaces](../specs/2026-10-16-shared-contracts-design.md) from coordinator-owned `shared/contracts/v1.ts`. Track C owns only `docs/security/` and `spikes/runner/` during the parallel wave. Production runner files and UI integration are later, separately assigned work after owner approval of the security report. Shared results do not approve an execution architecture.

**Parallel ownership:** Runner worker owns `spikes/runner/` and `docs/security/` during feasibility, then `apps/runner/` after a technical go. The coordinator grants exclusive ownership of `src/features/runner/` and `ChallengePage.vue` integration after other agents release those files. M5 Notebook and M6 reference visualizer may proceed in parallel.

## Global Constraints

- **Hard stop:** architecture chosen, but do not ship or integrate a production runner until the **new** QuickJS feasibility + isolated-site security gate is reviewed. Hosting requires independent owner approval.
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

- [x] List forbidden abilities: accessing app origin storage/auth token, parent DOM, unapproved network imports, endless CPU usage and ability to submit fake trusted grades.
- [x] Build narrow reproducible adversarial probes against candidate isolation techniques, with cleanup and explicit limitations.
- [x] Compare browser-side isolated origin/iframe, server-backed hardened sandbox (deferred unless strictly necessary) and external playground; do not call a worker alone safe.
- [x] Present the report and stop for the owner's security architecture choice. **Choice made 2026-10-17:** dedicated cross-site QuickJS/WASM; its *new feasibility gates* still block production implementation.

### Task 1: Testable isolated runner contract (after new technical go only)

**Files:** Build `apps/runner/` first, then `src/features/runner/runChallenge.ts` and adapter tests, per the [focused QuickJS plan](2026-10-17-quickjs-runner-implementation.md). Consume `shared/contracts/v1.ts` without duplicate result types.

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

### Task 3: Deployed-site verification (owner authorization required)

- [ ] Verify genuinely separate Vercel app/runner sites, cookies, iframe sandbox, exact messaging origins, CSP on both HTML and Worker scripts, and WASM asset handling in actual previews.
- [ ] Retest malicious source, infinite loops, malformed/forged messages and clean termination against preview origins. If requirements fail or previews are unavailable, execution remains **NO-GO**.
- [ ] Ask the owner separately before creating Vercel resources, enabling production runner execution, deploying or promoting a release.
