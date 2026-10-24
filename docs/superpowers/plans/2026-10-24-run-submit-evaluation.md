# Revision-bound Run → Save → Notebook implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. No delegated implementation or review requested.

**Goal:** Fix issue #20 by saving truthful evaluations of the exact submitted source.
**Architecture:** Keep the validated iframe adapter and authenticated attempt repository. RunnerControls emits a transient source/context-bound summary; DraftWorkspace owns a monotonic invalidation revision and passes only a current summary to Save. Save captures a detached input before awaiting persistence and ignores obsolete completion feedback.
**Tech stack:** Vue 3, TypeScript, Vitest, existing isolated QuickJS runner and local Edge browser checks.
**Spec:** Product design §§4.3–4.5, REQ-04/06/09/10/13; ADR-0002/0003; shared-contracts design and frozen v1 interfaces; M5/M6 runner/notebook plans.

**Spec impact: no spec change.** Restore the already approved current-source evaluation and immutable-history requirements. The temporary always-untested Notebook integration is now replaced by current verified completion. Client evaluations remain educational, never trusted scoring.

## Design and constraints

- Reuse the adapter's complete canonical-case validation before deriving status/counts. Reject incomplete or contradictory passes; strip console output from validation input and persistence.
- Only six completed statuses enter RunResultSummary. Cancellation, unavailable execution, running and absent/stale results yield untested; completed policy rejection remains execution-error.
- Bind summary to exact source, challenge/version, run source revision and workspace revision. Synchronous workspace invalidation covers edits (including batched edit/revert), auth identity/generation/status/sign-out transitions and challenge/version changes. A new run or cancel clears evaluation immediately. Existing unmount/fresh-retry and reset handling remain authoritative.
- Capture source/version/notes/complexity/evaluation and owner at Save activation. Keep token-pinned repository verification. Suppress completion events/messages after source/session changes or unmount; prevent duplicate in-flight submissions. Do not cancel or rewrite an immutable request already sent for its captured owner.
- No shared protocol, database, dependency, environment variable, rollout flag or hosted configuration changes. No deployment. The owner subsequently requested commit, push and PR publication in this chat.
- Existing Notebook detail/export already consume stored summaries; add evaluation to timeline and share readable status formatting.

## Review focus

1. Edit/revert and late runs cannot restore a pass, including synchronous updates before Vue renders.
2. Sign-out failure, same-user generation changes and pending save completions cannot cross contexts.
3. Zero/incomplete/duplicate/contradictory canonical cases cannot become passed.
4. Snapshot data stays consistent during subsequent editing/running; console output and credentials never enter summaries.
5. Error statuses and correct counts survive Save, Notebook and portable export.

### Task 1: Evaluations and invalidation
**Files:** src/features/runner/{runChallenge.ts,runEvaluation.ts,runEvaluation.test.ts,RunnerControls.vue,RunnerControls.test.ts}; src/features/solutions/{DraftWorkspace.vue,DraftWorkspace.test.ts}.
**Interfaces:** SourceEvaluation holds exact source, challenge/version, run sourceRevision, workspace revision and RunResultSummary. Runner emits evaluation or null; workspace accepts only the current binding.
- [x] Add tests for canonical pass/failure/error summaries, malformed/incomplete results and cancellation; observe RED.
- [x] Add component regressions proving run-to-save and invalidation on edits/revert, new run, cancel, auth and version changes; observe RED.
- [x] Implement validated summary projection, synchronous workspace invalidation and runner emission; run focused tests GREEN.

### Task 2: Snapshot submission and historical display
**Files:** src/features/solutions/{AttemptSubmissionPanel.vue,AttemptSubmissionPanel.test.ts,AttemptTimeline.vue,evaluationLabel.ts}; src/pages/NotebookChallengePage.vue; associated tests.
**Interfaces:** optional AttemptEvaluation passed by workspace; detached CreateAttemptInput captured synchronously; returned SolutionAttempt controls success label.
- [x] Add snapshot, duplicate submit, source/auth/unmount stale completion and actual saved summary tests; observe RED.
- [x] Implement submission guards and truthful badge/success/timeline labels without changing repository ownership checks.
- [x] Run root suite, strict typecheck and build GREEN.

### Task 3: Executable browser path and handoff
**Files:** scripts/check-mvp-preview-local.mjs; Notebook plan and this execution record.
- [x] Extend existing local intercepted Preview harness: real iframe → Worker → QuickJS, synthetic authenticated repository save → Notebook → JSON export; verify exact 14/14 source/version/notes, untested after edit, and truthful failures. No hosted requests or real-user data.
- [x] Run the browser regression on installed Edge; run existing runner suite and local browser regression as appropriate, diff whitespace and requirements-to-code review.
- [x] Record evidence and limits. Synthetic auth verifies UI/repository integration, not live OAuth/provider acceptance or database RLS.

## Execution record

- Base: cf6ef5a, clean main; branch fix/run-submit-evaluation.
- Implementation follows the existing approved requirements and issue acceptance criteria; no significant product redesign.

### Verification and review, 2026-10-24

- RED: the original workspace regression saved untested after a validated pass; four snapshot/duplicate/stale-save tests failed before the fix. The new summary module initially did not exist.
- Final app suite: 29 files, 248 tests passed. Runner suite: five files, 167 tests passed. App strict typecheck/build and runner strict typecheck/build passed.
- Local Edge: compiled isolated iframe → disposable Worker → QuickJS → synthetic authenticated repository Save → Notebook detail/timeline → JSON export passed with exact source/version/notes and 14/14 summary. Untested edit/revert and failed saves also passed. Mobile Notebook overflow is checked.
- Existing actual local runner browser regression passed at 1280px/390px, including VM/resource limits, cancellation, stale edits, forged pass rejection, console behavior, storage isolation and restricted third-party cookies.
- Direct author review mapped REQ-04/06/09/10/13 to implementation/tests and checked changed behavior back against specs. Frozen v1, token-pinned ownership verification, recovery, immutable history and export are preserved. No independent review was requested or launched.
- The shared checkout was concurrently switched to chore/ci-code-quality and formatted. Issue #20 was moved to the managed run-submit-evaluation worktree; its duplicate shared edits were removed only after formatter-normalized comparisons, retaining the other task's formatting. No unrelated changes are included.
- Edge sandbox launch failed on the documented temporary SiteList permission issue; the narrow approved outside-sandbox rerun passed. A later approval-service usage-limit failure temporarily blocked a read-only comparison; after the owner's follow-up request, approved access resumed.
- Limits: synthetic auth/storage exercises the real frontend/repository request flow, not live provider acceptance or database RLS. No hosted resources, deployments, dependencies, flags or environment variables changed.
