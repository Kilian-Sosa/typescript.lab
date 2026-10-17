# Learning Visualization and MVP Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete, accessible and responsive learning experience and verify readiness for a user-approved production launch.

**Architecture:** Reference-algorithm stepper is independent of the untrusted code runner and clearly labelled as such. End-to-end tests cover visitor, signer, draft and notebook journeys. Deployment QA validates Vercel/Supabase integration.

**Tech Stack:** Vue 3, Vitest, browser automation, Vercel and Supabase dashboards.

**Spec:** `docs/superpowers/specs/2026-10-16-typescript-lab-design.md` (`REQ-03`, `REQ-09`, `REQ-11`, `REQ-12`); ADR-0001/0002/0003; `docs/design/README.md`.

**Plan status:** Ready for owner review; implementation starts only when this milestone is selected.

**Parallel M3 dependency:** **Task 1 (reference visualizer, spoiler gates and accessibility) can proceed independently of QuickJS** because it traces the canonical algorithm, not learner execution. Most general UI/responsive checks in Task 2 can also start. However, Task 2's live run/compile/timeout E2E, authenticated end-to-end release flows, deployed runner CSP/cookie/origin verification, and the final MVP release gate **cannot pass** until M3 and hosted M4/M5 integration are complete. Assign one owner at a time to `ChallengePage.vue`.

## Global Constraints

**Shared contract and ownership:** Use the reviewed [v1 interfaces and route/token boundaries](../specs/2026-10-16-shared-contracts-design.md). This is a later integration slice; it does not assign a second writer to A's active `src/` paths. Verify the current approved contract version before changing consumers.

- Do not imply the reference visualizer reveals the learner's own runtime state.
- Interview Mode blocks spoilers by default; changing modes never loses draft content.
- No screenshot or sample UI is a substitute for working integration tests.
- The public deployment is a separate owner-approved operation after QA and security gates.

## Review Focus

1. Interview Mode cannot reveal visualizer, tags, hints or historic attempts via keyboard or deep links; Task 1.
2. Visualization has text-only equivalent and keyboard navigation; Task 1.
3. Slow network during draft save cannot lose local code; Task 2.
4. Mobile/200% zoom has no horizontal document overflow or inaccessible Run/Save actions; Task 2.
5. Preview/prod OAuth origins and redirect allowlists are restricted to intended URLs; Task 2.

---

### Task 1: Reference visualizer and hint journey

**Files:** Create `src/features/challenges/LongestWindowStepper.vue`, `longestWindowSteps.ts`, `longestWindowSteps.test.ts`, `src/features/challenges/LearningHints.vue`; modify challenge page.

**Interfaces:** `longestWindowSteps(events: string[], k: number): StepSnapshot[]` with `StepSnapshot { left:number; right:number; counts:Record<string,number>; bestStart:number; bestEndExclusive:number; explanation:string }`. Explicitly a reference implementation trace, not a trace of user code.

- [ ] Write failing step/invariant tests for all cases including empty/k=0 and earliest tie, plus spoiler gates.
- [ ] Implement stepper, hints, keyboard next/previous, reduced-motion and text explanation.
- [ ] Run relevant tests and browser keyboard/screen reader checks.
- [ ] Commit `feat(learn): visualize longest-window reasoning`.

### Task 2: Responsive/privacy/deployment release checks

**Files:** Create `tests/e2e/guest.spec.ts`, `tests/e2e/auth-drafts.spec.ts`, `tests/e2e/notebook.spec.ts`, `docs/release-checklist.md`; adjust approved UI files only as failures dictate.

**Interfaces:** A release record with audited CI/build/test output, browser viewport checks, redacted Vercel URLs, OAuth origins, Supabase RLS verification, and unresolved risks.

- [ ] Write failing E2E cases covering guest/search, live evaluation failures/timeouts, OAuth callback, autosave/network loss, cross-user isolation, notebook compare/export and Interview spoiler gates.
- [ ] Run E2E at desktop/tablet/mobile and keyboard-only, dark/light, high zoom and reduced-motion; fix concrete issues.
- [ ] Inspect Vercel project/preview and Supabase RLS/auth settings using signed-in authorized surfaces. Verify Node runtime, no leaked private env vars, dedicated org/projects, restricted redirect URLs and provider quotas.
- [ ] Record actual evidence and a go/no-go release decision, not optimistic guesses.
- [ ] Commit `test(release): verify MVP accessibility and privacy`. Ask owner before a production deploy, billing, domain changes or release tag.
