# Shared Contracts v1 — Parallel Setup

**Status:** Approved by owner on 2026-10-16; v1 interfaces frozen for coordinated implementation. Feature workers still require a separate launch decision.
**Date:** 2026-10-16
**Contract version:** `1.0.0`

**Intent:** Let the frontend, portable challenges, runner security spike and local database work proceed against the same small interface. This setup does not implement any product feature or choose a runner security architecture.

**Authority:** [Product specification](2026-10-16-typescript-lab-design.md), ADRs [0001](../../decisions/0001-frontend-platform.md), [0002](../../decisions/0002-challenges-and-execution.md) and [0003](../../decisions/0003-solution-persistence.md).

**Spec impact: add a focused spec.** The approved product behaviours remain unchanged. This document specifies previously unwritten shared data shapes and resolves conflicting implementation-plan type locations. REQ-01/02/04/05/06/07/09/10/13 remain the acceptance authority. No additional product design approval is implied by infrastructure setup.

## Approach and boundaries

Use one coordinator-owned, framework-independent module at `shared/contracts/v1.ts`, with no Vue, Supabase or runner imports. Alternatives are duplicated track-local types (easy to start, costly to reconcile) or a separately published package (unnecessary tooling for one repository). A single versioned module is the recommended minimum.

Once this document and its execution plan are approved, the coordinator materializes the types, runs strict compile-time acceptance checks, and records one local freeze commit. All worker branches receive that exact commit before implementation. A change after freeze requires coordinator review, a new contract version and updated consumers; no worker edits the frozen module independently.

The module contains only types and the contract-version constant. It grants no authorization and supplies no evaluator, persistence implementation, application components or dependency choices.

## Exact interfaces

```ts
export const CONTRACT_VERSION = '1.0.0' as const;

export type JsonValue = null | boolean | number | string
  | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ChallengeSummary {
  readonly id: string;
  readonly slug: string;
  readonly version: string;
  readonly title: string;
  readonly objective: string;
  readonly difficulty: Difficulty;
  readonly estimatedMinutes: number;
  readonly tags: readonly string[];
}

export interface ChallengeCase<
  Input extends { readonly [key: string]: JsonValue } = { readonly [key: string]: JsonValue },
  Output extends JsonValue = JsonValue,
> {
  readonly id: string;
  readonly name: string;
  readonly input: Input;
  readonly expected: Output;
}

export interface ChallengeDefinition<
  Input extends { readonly [key: string]: JsonValue } = { readonly [key: string]: JsonValue },
  Output extends JsonValue = JsonValue,
> extends ChallengeSummary {
  readonly signature: string;
  readonly entryPoint: string;
  readonly parameterNames: readonly (keyof Input & string)[];
  readonly statementPath: string;
  readonly starterPath: string;
  readonly constraints: readonly string[];
  readonly edgeCases: readonly string[];
  readonly cases: readonly ChallengeCase<Input, Output>[];
  readonly exampleCaseIds: readonly string[];
  readonly learning: {
    readonly hints: readonly [string, string, string];
    readonly explanationPath: string;
    readonly solutionPath: string;
  };
}

export type RunStatus = 'not-run' | 'running' | 'passed' | 'failed'
  | 'compile-error' | 'timeout' | 'execution-error' | 'infrastructure-error';
export type CompletedRunStatus = Exclude<RunStatus, 'not-run' | 'running'>;

export interface CaseResult {
  readonly caseId: string;
  readonly status: 'not-run' | 'passed' | 'failed' | 'timeout' | 'execution-error';
  readonly expected?: JsonValue;
  readonly actual?: JsonValue;
  readonly message?: string;
}

export interface RunResult {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly runId: string;
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly sourceRevision: number;
  readonly status: RunStatus;
  readonly cases: readonly CaseResult[];
  readonly diagnostics: readonly string[];
  readonly reason?: 'unsupported-code' | 'policy-rejected' | 'runtime-error' | 'cancelled';
}

export interface RunResultSummary {
  readonly status: CompletedRunStatus;
  readonly totalCases: number;
  readonly passedCases: number;
}
export type AttemptEvaluation = RunResultSummary | { readonly status: 'untested' };

export interface SolutionDraft {
  readonly userId: string;
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly source: string;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface SaveDraftInput {
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly source: string;
  readonly expectedRevision: number | null;
}

export interface CreateAttemptInput {
  readonly challengeId: string;
  readonly challengeVersion: string;
  readonly source: string;
  readonly notes: string;
  readonly timeComplexity: string | null;
  readonly spaceComplexity: string | null;
  readonly testSummary: AttemptEvaluation;
}

export interface SolutionAttempt extends CreateAttemptInput {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: string;
}
```

## Invariants consumers must enforce

- **Identity:** the first challenge's ID and slug are both `longest-window`; its initial version is `1.0.0`. Other IDs are lowercase kebab-case, unique and stable. Challenge versions and contract versions are independent. A changed challenge contract creates a new challenge version and preserves the original version's context.
- **Inputs/cases:** for `longest-window`, use `input: { events: string[], k: number }`, `expected: { start: number, endExclusive: number }`, entry point `longestWindow`, and ordered `parameterNames: ['events', 'k']`. Case IDs are unique within a challenge version; `exampleCaseIds` resolve to those same fixtures. The named-input wrapper replaces the plan's challenge-specific top-level `events`/`k` fields without changing algorithm behaviour.
- **Content:** paths are repository-relative static content references inside the owning challenge directory, resolved by a build-time registry. They are never arbitrary user-selected imports. Parameter/return semantics and tie-breaking live in the challenge's Markdown and typed examples. The learning block has exactly three progressive hints; Interview Mode gates hints, tags, explanations and reference-source loading. Public repository content is not secret.
- **JSON boundary:** accept finite numbers and JSON-compatible plain data; reject unsupported values and apply limits in the eventual runner adapter. TypeScript types do not validate untrusted messages or provide a sandbox. The runner spike owns proof and recommendations; the owner approves the security architecture before integration.
- **Runs:** assign a run ID and source revision when allocating a run, including a not-yet-started run. Revision changes whenever the source changes. Match run ID, source revision, challenge ID and challenge version before displaying a result or attaching it to a submission; a new editor session must not reuse an active run ID. Cancellation is an `execution-error` with reason `cancelled`; unsafe/unsupported code uses `policy-rejected`/`unsupported-code`. Infrastructure failure is distinct from learner execution failure. Do not expose raw privileged runtime data in diagnostics.
- **Honest evaluation:** a `passed` result requires a nonempty complete expected suite with every case passed. An attempt summary has integer counts satisfying `0 <= passedCases <= totalCases`; `passed` additionally requires `totalCases > 0` and equality. `not-run` and `running` cannot be persisted as completed evaluations. If the source/version no longer matches the evaluated snapshot, save `untested` rather than recycling a prior pass. Client summaries remain untrusted educational feedback.
- **Ownership:** record `userId` comes from the authenticated database session and is enforced by RLS. Write inputs deliberately omit it. A guest/local buffer is not a `SolutionDraft` and cannot claim durable cloud persistence. No account ID from a client authorizes access.
- **Drafts:** the unique key is `(user_id, challenge_id)`. `expectedRevision: null` means insert only if absent; `0` is a valid expected revision. Updates atomically compare the expected revision, increment the stored revision, and return conflict rather than overwrite on mismatch. SQL timestamps/revisions are server assigned; timestamps are ISO 8601 UTC strings at the TypeScript boundary. Only a matching durable acknowledgment can mark the current source saved.
- **Attempts:** preserve exact source, notes, nullable claimed complexity, challenge version, evaluation and server-assigned ID/timestamp. Fields are immutable historical snapshots. Ordinary users have no attempt UPDATE/DELETE operation; `readonly` is a development aid, not database enforcement. Export includes these fields. No public-sharing flag is introduced.

## Routes, tokens and ownership

- `/` redirects to `/explore`; `/explore`, `/challenges/:slug`, `/notebook` and `/notebook/:slug` are the MVP routes. Unknown slugs get an accessible not-found state. `/patterns` remains deferred. Auth callback details are owned by the later auth integration and are not frozen here.
- Track A alone owns `src/app/styles/tokens.css` and global styling. The approved [design tokens](../../design/README.md) are the starting values; other tracks consume CSS custom properties without redefining global tokens. Track A validates contrast and dark-theme values during implementation; setup creates no CSS.
- Shared contracts, root dependency manifests/lockfile after the initial frontend scaffold, and cross-track integration belong to the coordinator. B/C/D propose required package/version additions through the coordinator; they do not race on a lockfile. Track A selects current compatible app dependencies during its first scaffold, as ADR-0001 requires. Track D gets one exact, pinned Supabase CLI version before starting its local stack.
- The [coordination plan](../plans/2026-10-16-parallel-agent-infrastructure.md) defines worktree paths, exclusive write areas, read-only remote access, tests and integration gates.

## Acceptance of the freeze

1. Strict TypeScript checks accept a typed `longest-window` definition, each result state, a private draft, and failed/untested attempts. Negative checks reject malformed case data, mutable attempt assignment, write inputs with a `userId`, and transient attempt evaluations. Runtime invariants above remain explicit implementation tests for their respective tracks.
2. Every dependent plan references this contract location and vocabulary; no track creates competing shared types in `src/features/`.
3. All four worker branches contain the identical reviewed contract commit and pass its checks before work starts. Uncommitted coordinator documentation is never silently assumed to exist in a worktree.
4. The owner approved this document and the coordination plan before the coordinator materialized executable contracts. Worker launch remains a separate decision; future remote OAuth scope expansion remains a separate approval.

## Freeze verification

The versioned module and compile-time acceptance fixtures live in `shared/contracts/`. Run `npm exec --yes --package=typescript@7.0.2 -- tsc --project shared/contracts/tsconfig.json`; this pins the [official compiler release](https://registry.npmjs.org/typescript/7.0.2) without creating an application scaffold or root dependency manifest. `strict`, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled. These checks verify the shared TypeScript boundary; runtime validation, security isolation and database RLS remain the respective implementation tracks' tests.
