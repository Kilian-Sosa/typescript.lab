# Recovery buffer deduplication implementation plan

> Execute inline using superpowers:executing-plans and test-driven-development. No delegated review or hosted changes.

**Goal:** Fix #15 so repeated recovery reviews remain bounded and reversible without losing distinct local work.

**Spec:** [Product design](../specs/2026-10-16-typescript-lab-design.md), REQ-05/07/12/13; [ADR-0003](../../decisions/0003-solution-persistence.md); [M4 recovery](2026-10-17-m4-frontend-recovery.md).

**Spec impact: no spec change.** Restore existing local retention, explicit replacement and honest accessible feedback requirements. No schema/shared contract/runtime configuration changes. The mockup provides no recovery-list contract to amend.

**Architecture:** Compare exact owner, challenge/version, source, notes and both complexity fields. Ignore timestamps, tab IDs and synchronization metadata for content grouping. Reuse immutable archives only; a live tab's matching buffer cannot safely substitute for an archive because that tab can overwrite it. Group existing duplicate entries in the recovery view without deleting storage records. Derive current-open labels from content rather than a stale selected tab ID.

**Constraints:** Preserve account/challenge boundaries, CAS conflict review and distinct unsaved content. Abort replacement if preservation fails. No dependency, infrastructure, environment-variable or feature-flag changes. Base: owner-selected `feat/mvp-isolated-runner-activation` at `a39a716` in an isolated worktree; unrelated shared checkout edits are excluded.

## Task 1 — Bounded reversible recovery

Files: `src/features/solutions/draftRecovery.ts`, `draftSync.ts`, `DraftSaveStatus.vue`, `DraftWorkspace.vue`; their focused tests; `tests/e2e/auth-recovery.spec.ts`.

Interfaces: existing `DraftRecovery` and `DraftSync`; add content equality and `current` metadata to local recovery list rows only. Shared Contracts v1 is unchanged.

- [x] Add failing storage/controller regressions: repeated same/alternating review has bounded archives; distinct source/notes/complexity/version survives; live-tab edits cannot destroy an archived snapshot; legacy duplicate view is grouped without deletion; storage failure blocks replacement.
- [x] Add failing UI regression for current-open labels, disabled redundant review and counts; exercise guest/auth/import/reload and two-tab conflict recovery.
- [x] Implement content grouping, immutable archive reuse, no-op same-content recovery and refreshed current-open metadata. Keep exact source/notes and revision handling for explicit conflict review.
- [x] Run focused tests, complete unit suite, typecheck/build, intercepted desktop/mobile Edge recovery suite and whitespace checks.
- [x] Self-review requirement-to-test and changed-behavior-to-spec mappings; record evidence here. Leave changes reviewable on the fix branch.

## Review focus

- Matching live buffers can later change: archive must survive those writes.
- Notes-only and complexity-only variants are distinct even with identical source.
- Reload and account transitions must not relabel unrelated private content as current.
- Quota errors must preserve editor text and prevent unsafe replacement.
- Existing duplicate records must collapse visually without destructive migration.

## Execution record

Pre-flight: one coherent task, no cross-task interfaces. Author owns all writes. Native review templates do not override the owner's no-automatic-review policy.

- RED: both repeated-review regressions grew storage from 3 to 13 entries; archive reuse, complexity-only listing, legacy grouping and current-open presentation failed for the expected missing behavior.
- GREEN: 203 unit tests in 27 files pass. Strict Vue/TypeScript, production Vite build, standalone Shared Contracts compilation, design/documentation checks (207 links) and `git diff --check` pass.
- Browser: 12 intercepted Auth/Data API flows pass across desktop and 390px mobile Edge, including repeated alternating recovery, bounded storage, current-open labeling, notes reload, explicit guest import, account transitions, two-tab CAS conflicts and offline retry. This is local synthetic API verification, not real OAuth/provider acceptance.
- Self-review added a failing cross-tab storage-event regression: matching content must become reviewable when another tab edits it. Workspace now refreshes list metadata on storage events, without replacing editor content. It also verifies recovered challenge versions survive re-archiving and reload.
- Requirement mapping: REQ-05 → bounded review, immutable preservation, exact-content variants, quota failure and two-tab conflict tests; REQ-07/13 → owner partitioning and explicit guest import/account transitions; REQ-12 → visible current-open text and disabled redundant action. Changed behavior restores these requirements; no governing spec amendment or Shared Contracts change is needed.
- Review outcome: author self-review complete; no independent review or deployment performed. Existing duplicate storage records are retained and grouped visually; no destructive cleanup migration was introduced. Follow-up publication is authorized by the owner's explicit publish-branch-commits-pr request; the scoped PR targets `feat/mvp-isolated-runner-activation` while its parent PR remains open.
