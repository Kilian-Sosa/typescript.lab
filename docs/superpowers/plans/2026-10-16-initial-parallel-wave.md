# Initial A–D Implementation Wave

> **For agentic workers:** Use Superpowers subagent-driven-development with the ownership boundaries below. The owner selected and authorized this wave on 2026-10-16. Follow the existing scoped plans; this document records their execution order and integration gates.

**Goal:** Deliver the local frontend and portable first challenge, investigate the runner boundary, and verify private persistence policies on isolated PostgreSQL.

**Architecture:** Four worktrees consume the same frozen shared contracts. A owns the initial Vue scaffold; B owns challenge content; C owns disposable execution research; D owns local migrations and policy tests. The coordinator integrates completed work on a feature branch. This session uses ignored worktrees under `.worktrees/` inside the writable workspace; the previously prepared worktrees remain untouched after synchronization to `main`.

**Tech stack:** Vue 3, Vite, Vue Router, strict TypeScript, Vitest, PostgreSQL and a pinned Supabase CLI. Hosted services remain separate approval gates.

**Spec:** [Approved product design](../specs/2026-10-16-typescript-lab-design.md), [Shared Contracts v1](../specs/2026-10-16-shared-contracts-design.md), and accepted ADR-0001/0002/0003.

**Spec impact: no spec change.** This wave implements approved requirements and collects evidence for an explicitly required security decision. It does not change the product contract or authorize a production execution architecture.

## Global constraints

- Use `shared/contracts/v1.ts` unchanged; the coordinator owns any proposed contract changes.
- Preserve private-by-default data, immutable attempts and identity derived from `auth.uid()`.
- Keep reference solutions separate from learner starters; exclude intentionally incomplete practice tests from the default green suite.
- Never evaluate untrusted source in the application origin or a privileged server process.
- No hosted migration, OAuth configuration, Vercel linking, deployment, push or merge into `main` is part of this wave.
- Run A/B/C first, then D when a worker slot becomes available. Each mutable area has one owner.

## Review Focus

1. Public routes and catalog render without authentication or cloud connectivity; unknown routes/slugs show an accessible empty/not-found state.
2. Local challenge cases, rendered examples and earliest-tie semantics agree, including Unicode, empty input and nonpositive `k`.
3. Interview Mode does not disclose hints, tags, explanations or reference source implicitly.
4. Runner findings distinguish demonstrated isolation from limitations and stop at the owner's architecture decision.
5. Actual PostgreSQL tests exercise anonymous/cross-user denial, ownership reassignment, stale revisions and immutable attempts.

## Task A: Frontend foundation

**Plan:** [Foundation and catalog](2026-10-16-foundation-and-catalog.md), tasks 1–2 and local configuration/tests from task 3.

**Files:** `src/`, `index.html`, Vite/TypeScript configuration, initial root manifest/lockfile, `.github/workflows/`, navigation E2E.

**Interfaces:** frozen routes and `ChallengeSummary`; `listChallenges(query?, difficulty?)`. The catalog remains empty until B is integrated. Initial dependency selection belongs to A, then transfers to the coordinator.

- [x] Implement and test routes, responsive accessible shell, theme controls and honest guest/empty states.
- [x] Add local CI and SPA fallback configuration without creating a hosted project.
- [x] Verify unit tests, typecheck, build and responsive/keyboard navigation.

## Task B: Portable challenge

**Plan:** [Challenge content](2026-10-16-challenge-content.md), task 1.

**Files:** `challenges/longest-window/` metadata, contract, fixtures, starter, canonical implementation and separate canonical/practice suites.

**Interfaces:** `ChallengeDefinition`, named `{ events, k }` inputs and `{ start, endExclusive }` output; challenge version `1.0.0`.

- [x] Observe failing canonical assertions, then implement and verify the approved edge cases and original explanation.
- [x] Verify with A's approved tooling; do not modify root dependencies independently.

## Task C: Runner security evidence

**Plan:** [Runner security](2026-10-16-runner-security.md), task 0 only.

**Files:** `docs/security/`, disposable `spikes/runner/`.

**Interfaces:** evidence report covering threat model, storage/DOM/network/import probes, timeout/termination, transpilation feasibility, alternatives and limitations.

- [x] Execute reproducible adversarial browser probes and document cleanup.
- [x] Provide a go/no-go recommendation for owner review; production runner integration remains gated.

## Task D: Local persistence

**Plans:** local SQL portions of [Auth/drafts](2026-10-16-auth-and-drafts.md) and [Attempts](2026-10-16-notebook-history.md).

**Files:** `supabase/` configuration, CLI-generated migrations, policy tests and local verification instructions.

**Interfaces:** `SaveDraftInput` create-only/null and atomic numeric revision semantics; immutable `CreateAttemptInput` snapshots with server-assigned identity/timestamps and valid evaluation summaries.

- [x] Use one pinned CLI and isolated local ports; record the initial Docker state.
- [x] Test explicit RLS, cross-user/anonymous denial, ownership changes, draft CAS and append-only attempts against actual PostgreSQL.
- [x] Clean up only temporary resources created for this track and leave pre-existing Docker running.

## Coordinator integration and handoff

- [x] Inspect worker diffs and reports; reconcile implementation, tests and approved requirements without launching a duplicate review agent.
- [x] Integrate completed branches locally and connect challenge content to the frontend after A releases its source ownership.
- [x] Update shared tooling/docs, verify contract checks, unit tests, typecheck, production build and relevant browser/database evidence.
- [x] Record completed local deliverables and remaining owner/security/hosted integration gates accurately.
