# Portable Challenge Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide the first fully documented TypeScript problem, locally testable and browsable in the real application, without a cloud requirement.

**Architecture:** Versioned TypeScript challenge modules with shared typed cases. Vue pages consume challenge descriptors through a registry and render original Markdown descriptions.

**Tech Stack:** TypeScript, Vitest, Vue 3, existing Vite app from M1.

**Spec:** `docs/superpowers/specs/2026-10-16-typescript-lab-design.md` (`REQ-01`, `REQ-02`, `REQ-03`, `REQ-13`); ADR-0002; `docs/design/README.md`.

**Plan status:** Ready for owner review; implementation starts only when this milestone is selected.

**Parallel ownership:** Track B can begin challenge-local content, metadata and tests when M0.5 contracts are frozen, without waiting for M1. Task 2's Vue page modifications are a **coordinator-controlled integration phase** after Track A completes the shared app shell, not edits performed concurrently in Track A's directory.

## Global Constraints

- `longest-window` selects the earliest maximum-length contiguous window of at most `k` distinct event IDs.
- Empty input or `k <= 0` returns `{start:0,endExclusive:0}`.
- User attempt template and canonical solution live in separate files; no reference solution spoilers in Interview Mode.
- Descriptions and algorithms must be original; don't claim affiliation with Google.
- The local challenge is runnable without Supabase/Vercel.

## Review Focus

1. Empty input and nonpositive `k` return `{0,0}`; include Task 1 fixture.
2. Equal-length tie chooses smallest start index; include Task 1 fixture.
3. `k` greater than distinct count returns entire input; include Task 1 fixture.
4. Unicode/empty-string event IDs retain correct identity in typed inputs; include Task 1 fixture.
5. A bad catalog slug never renders a different challenge's content; include Task 2 test.

---

### Task 1: Versioned source and deterministic contract

**Files:** Create `challenges/longest-window/README.md`, `metadata.ts`, `cases.ts`, `starter.ts`, `solution.ts`, `solution.test.ts`, `practice.test.ts`; create `src/features/challenges/types.ts`.

**Interfaces:** `longestWindow(events: string[], k: number): { start: number; endExclusive: number }`; `ChallengeSummary { id:string; slug:string; version:string; title:string; difficulty:'easy'|'medium'|'hard'; estimatedMinutes:number; tags:string[] }`; `ChallengeCase { name:string; events:string[]; k:number; expected:{start:number;endExclusive:number} }`.

- [ ] Write shared fixtures and failing tests for canonical solution, including all Review Focus cases and `["A","B","A","C","B","B"],2 => {start:0,endExclusive:3}`.
- [ ] Verify red test run. Implement minimal deterministic sliding-window reference solution and original human-facing contract.
- [ ] Keep `starter.ts` incomplete but syntactically valid; practice tests may fail until a learner implements it and should **not** run in CI's green gate.
- [ ] Verify `pnpm vitest run challenges/longest-window/solution.test.ts`, typecheck and CI default test command.
- [ ] Commit `feat(challenges): add longest-window challenge`.

### Task 2: Render challenge content in Explore and Solve

**Files:** Modify `src/features/challenges/registry.ts`, `src/pages/ExplorePage.vue`, `src/pages/ChallengePage.vue`; create `src/features/challenges/ExampleExplorer.vue` and `src/features/challenges/ExampleExplorer.test.ts`.

**Interfaces:** `getChallenge(slug: string): ChallengeDefinition | undefined`; examples derive expected output from typed cases / controlled reference demonstrator, **not** editor source.

- [ ] Test matching metadata, example rendering, editable valid inputs, earliest-tie expected output, invalid input feedback and missing slug.
- [ ] Implement responsive statement, constraints, example explorer and an actual starter-code display (runner/editor is handled in M3).
- [ ] Hide patterns/hints/reference sources when Interview Mode is active; test mode transitions.
- [ ] Verify builds, unit tests and responsive browser screenshots against the approved mockup.
- [ ] Commit `feat(challenges): render versioned learning content`.
