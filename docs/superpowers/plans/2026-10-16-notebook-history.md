# Immutable Attempts and Notebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve original solutions with immutable attempts and notes; support retrieval, comparison, fresh retry and portable export.

**Architecture:** Append-only attempts in Supabase PostgreSQL, protected by RLS; personal notebook UI consumes a typed repository; attempt exports are generated client-side from the requesting user's own records.

**Tech Stack:** PostgreSQL migrations/RLS, Supabase client, Vue 3, TypeScript, Vitest and browser E2E.

**Spec:** `docs/superpowers/specs/2026-10-16-typescript-lab-design.md` (`REQ-06`–`REQ-10`); ADR-0003.

**Plan status:** The initial A–D wave verified the local append-only attempts schema and ownership policies. The typed client repository, Notebook UI, comparison, retry and export remain planned.

**Parallel M3 dependency:** Runner architecture and implementation **do not block** Task 1's typed attempt repository, authenticated owner-only history, or Task 2's Notebook listing, comparison, portable export and `Retry from scratch`. The stored `AttemptEvaluation` supports `{ status: 'untested' }` when no current-source execution has occurred. **Do not manufacture passed results** or claim end-to-end run→submit validation before M3 is integrated. Coordinate any shared `ChallengePage.vue` changes with the runner/editor owner. M4 authenticated client/session integration remains a separate dependency for real cloud flows.

## Global Constraints

**Shared contract and ownership:** Consume reviewed [v1 interfaces](../specs/2026-10-16-shared-contracts-design.md) from `shared/contracts/v1.ts`. `SolutionAttempt` and `CreateAttemptInput` are authoritative; write inputs omit user IDs, saved evaluations exclude `not-run`/`running`, and exact source/version matching is required before retaining a prior evaluation. D may prepare local attempts SQL/tests; notebook UI is a later coordinator-assigned integration slice. Generate migration filenames with the pinned CLI rather than using the illustrative filename below literally.

- Submission versions are immutable and carry challenge version, exact source, notes, timestamp, evaluation summary (including `untested`) and optional declared complexity.
- Historic challenge content changes must not rewrite saved source; a missing old challenge revision is clearly flagged.
- Users are private by default. Don't enable community feeds or public reads.
- A user export uses readable filenames and source + Markdown/JSON, no secret/server credentials.

## Review Focus

1. User A never sees User B's submitted source, notes or export, even with guessed IDs; Task 1.
2. `UPDATE`/`DELETE` attempts by ordinary users are denied to preserve immutability; Task 1.
3. A failed/untested save is not marked passed; Task 1.
4. Retry after months opens fresh starter code without disclosing old code; Task 2.
5. Export after a challenge revision still describes the recorded challenge version; Task 2.

---

### Task 1: Append-only attempts persistence

**Files:** Create `supabase/migrations/0002_solution_attempts.sql`, `supabase/tests/attempt_policies.test.sql`, `src/features/solutions/attemptRepository.ts` and `attemptRepository.test.ts`.

**Interfaces:** `createAttempt(input: CreateAttemptInput): Promise<SolutionAttempt>`; `listAttempts(challengeId?: string): Promise<SolutionAttempt[]>`. Inputs use explicit notes and nullable claimed complexity from the shared contract. The database assigns ownership, ID and timestamp; client summaries never authorize trusted scoring.

- [ ] Write SQL and TypeScript tests for append-only policy, row ownership and attempts whose tests are failing/untested.
- [ ] Run failing tests before writing implementation; then create secure schema and a typed repository using the authenticated session.
- [ ] Verify migration tests on actual isolated database plus unit tests/typecheck/build.
- [ ] Commit `feat(solutions): persist immutable attempts`.

### Task 2: My Notebook, compare, retry and export

**Files:** Create `src/pages/NotebookPage.vue`, `src/pages/NotebookChallengePage.vue`, `src/features/solutions/AttemptTimeline.vue`, `AttemptComparison.vue`, `exportAttempts.ts`, `exportAttempts.test.ts`, `src/features/solutions/Notebook.test.ts`; modify router and challenge page.

**Interfaces:** `exportAttempts(attempts: readonly SolutionAttempt[]): Blob` or an explicit portable files/archive representation; `startFreshAttempt(challengeId: string): StarterSession` creates local session from versioned starter without mutating history.

- [ ] Write failing tests for attempt selection, empty state, older challenge version, diff with non-color signifiers, fresh retry, failed export and source/metadata round-trip.
- [ ] Implement notebook matching approved mockup with authenticated-only routing and secure retrieval.
- [ ] Preserve all historic versions while restarting at starter code; never preload old reference or user solution in Interview Mode.
- [ ] Verify complete local and E2E flows and independent export readability; run full checks.
- [ ] Commit `feat(notebook): add attempt history and export`.
