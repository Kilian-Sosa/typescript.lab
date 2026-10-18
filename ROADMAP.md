# typescript.lab — Implementation Roadmap

**Baseline approved:** 2026-10-16

**Current status:** The initial implementation, private Notebook, reference visualizer and [M4 frontend recovery](docs/superpowers/plans/2026-10-17-m4-frontend-recovery.md) are deployed to a protected app Preview pinned to `cf5a040`; its exact OAuth callback is configured. Hosted RLS/schema and the original GitHub session flow were verified separately; the new PKCE/autosave/recovery frontend passes local/intercepted tests. Full hosted Preview acceptance remains pending. M3 corrections on `fix/runner-security` at `83e4889` [passed independent validation](docs/security/2026-10-18-m3-correction-validation.md), clearing only the local Task 1 prerequisite. PR #7 reconciles these corrections with the M4 changes merged through PR #6, including the later sign-out submission fix; the deployed app Preview predates that fix. Runner Preview/deployed proof and final release checks retain their gates. See the [deployment record](docs/superpowers/plans/2026-10-17-preview-preparation.md) and [final M4 security review](docs/security/2026-10-18-final-m4-security-review.md).
**Source of truth:** [Product specification](docs/superpowers/specs/2026-10-16-typescript-lab-design.md), [accepted ADRs](docs/decisions/0001-frontend-platform.md), [design reference](docs/design/mockups/index.html).

## Definition of the MVP

A visitor can find an original TypeScript challenge, understand the contract, write their own solution, run real tests safely, optionally authenticate with GitHub, save a private draft, submit immutable attempts, revisit their notes months later, compare versions and download their work. Guests can use the basic learning flow without an account.

**Do not confuse** a hosted documentation mockup with an implemented MVP, or a browser-side self-reported pass with a trustworthy competitive score.

## Dependencies and parallel execution

```text
M0 Approved design (completed)
   ↓
M0.5 Shared contracts + parallel-agent infrastructure
   ├── Track A: Vue shell + Vercel Git/CI integration
   ├── Track B: versioned challenge packages + local tests
   ├── Track C: isolated runner threat model + security spike
   └── Track D: Supabase local schema + RLS/persistence contracts
               (no remote migrations by individual agents)
   ↓
Progressive merge of challenge UI, approved runner and auth/drafts
   ↓
Notebook, algorithm visualization and integration E2E
   ↓
MVP release gate
```

Milestone IDs M1–M6 designate **deliverables**, not a strict serial launch order. M1 app shell, M2 challenge content, M3 security work, and M4 local schema/policy work can overlap once their minimal shared contracts are frozen. **M3 architecture approved 2026-10-17:** [separate runner site + QuickJS/WASM + disposable Worker](docs/superpowers/specs/2026-10-17-dedicated-runner-design.md); a fresh technical spike, isolation review and approved deployment are still required. **M5 Notebook and M6 Task 1 visualizer can progress in parallel**, saving `untested` where no real evaluation exists. M6's final E2E/release gate and run→submit wiring depend on M3; authenticated/cloud flows also depend on M4/M5. Only one infrastructure owner may mutate hosted Vercel/Supabase state. See the [parallel-agent plan](docs/superpowers/plans/2026-10-16-parallel-agent-infrastructure.md).

## Milestones

| Milestone | Status | Deliverable | Acceptance gate | Implementation plan |
| --- | --- | --- | --- | --- |
| M0 — Design baseline | Approved; publication authorized | Accepted specification, ADRs, UX contract and browser mockup | Docs validation passes; GitHub baseline pushed | This document |
| M0.5 — Parallel agent preparation | Contracts frozen; initial wave executed | Shared v1 interfaces, four parked worktrees, verified read-only Supabase MCP and Vercel access | Identical freeze and checks in every worktree before owner launch decision; no unapproved cloud mutations | [M0.5](docs/superpowers/plans/2026-10-16-parallel-agent-infrastructure.md) |
| M1 — App shell + Vercel | Local app/CI configuration verified; hosted preview pending | Vue 3/Vite/Router/strict TS app, navigation, styles, CI, Vercel preview | Build/typecheck/tests pass; real Vercel URL shows app shell; previews work | [M1](docs/superpowers/plans/2026-10-16-foundation-and-catalog.md) |
| M2 — Challenge + Explore | Local challenge and UI delivered | Portable `longest-window` package, README, cases, canonical solution/tests; searchable catalog and solving skeleton | Canonical local fixtures and rendered examples agree, including ties/empty/`k <= 0` | [M2](docs/superpowers/plans/2026-10-16-challenge-content.md) |
| M3 — Real runner | Corrections independently validated; local prerequisite GO for Task 1; production NO-GO | Dedicated cross-site static runner, QuickJS/WASM Worker, accessible editor/test integration | Complete result validation, single-run throttling, VM/site/cookie/CSP proof and honest results | [M3](docs/superpowers/plans/2026-10-17-quickjs-runner-implementation.md) |
| M4 — Supabase + Auth + drafts | Frontend PKCE/recovery/autosave locally verified; hosted schema/RLS and original sessions verified; live PKCE/preview acceptance pending | Supabase project, GitHub OAuth, RLS-protected schema and resilient private autosaves | Cross-user denial, callback flows and autosave conflict/offline tests pass | [M4](docs/superpowers/plans/2026-10-16-auth-and-drafts.md) |
| M5 — Attempts + Notebook | Local client/UI and authenticated database/browser flows verified; hosted/run integration pending | Immutable versions, notes, history, comparison, retry, export | Old attempts cannot be overwritten; other users cannot read them; `untested` without actual run | [M5](docs/superpowers/plans/2026-10-16-notebook-history.md) |
| M6 — Polish + ship | Task 1 locally verified; Task 2/release blocked by M3 and hosted M4/M5 | Learning visualizer, mobile/keyboard/dark UI, docs/contributor readiness, deployment QA | WCAG-oriented checks, full runner/auth/browser E2E, no leaked secrets; launch gate recorded | [M6](docs/superpowers/plans/2026-10-16-release-polish.md) |

## Environment setup (known at planning time)

- **GitHub repository:** https://github.com/Kilian-Sosa/typescript.lab ; default intended branch `main`.
- **Local folder:** `/typescript.lab` in CoS (resolve the approved native path from the workspace, not from this public document).
- **Vercel:** authenticated Edge tab at `https://vercel.com/kiliansosas-projects`, workspace `kiliansosas-projects` (Hobby at inspection). M1 creates/connects the *typescript.lab* app **after** code exists and confirmation of project/team settings.
- **Supabase:** the dedicated `typescript.lab` project in organization `kiliansosa` is created and healthy in the Paris (`eu-west-3`) region. M4 must reuse this project; do **not** provision another one. Keep its project reference and credentials out of public documentation.
- **Codex MCP:** live nonmutating Vercel queries verified team access and no project matching `typescript`. Supabase project-scoped read-only MCP is configured and OAuth completed; the scoped connection returned `supabase_read_only_user` and `transaction_read_only = on`, with no `public` tables. These are **Codex CLI** settings, verified separately from ChatGPT connectors. No hosted resources were changed.
- **CLIs:** GitHub CLI and Docker CLI are installed. Docker engine 29.8.2 was already running at the current check and was left running; sandbox pipe access required an elevated read-only check. Supabase/Vercel commands are not installed globally. Prefer a pinned project-local Supabase CLI and Git-connected Vercel preview deployments; no CLI dependency or local database stack is installed by M0.5 preparation.
- Browser tabs and account state are **snapshots, not stable identifiers**. Discover active Edge tabs again at execution time. Never treat a signed-in tab as authorization to incur charges, change production DNS, reveal keys, or create additional unrelated resources.
- Vercel dashboard displayed a warning about existing Node 20-or-older projects. **Do not modify those other projects.** Pin/check a modern supported Node runtime for this project.
- Supabase was created with **Automatically expose new tables** disabled, **Enable automatic RLS** enabled, and **Enable Data API** enabled. M4 must verify the effective permissions and explicit per-table RLS regardless of project defaults.

## Global engineering quality gates

Every milestone:

1. Start by reading `AGENTS.md`, the spec, applicable ADRs and the [focused implementation plan](docs/superpowers/plans/README.md). Local Codex handoff prompts are optional and intentionally excluded from the public repository.
2. Confirm branch, remotes and working-tree state. Use an independently owned Git worktree/branch for each parallel track, with one writer per mutable area; follow Superpowers TDD / verification-before-completion and SDD updates.
3. First demonstrate a failing test or another explicitly agreed red check, then implement the smallest passing change.
4. Run typecheck, relevant Vitest tests and production build; report exact commands and results. Verify in browser when UI changes.
5. Update tests, docs and any affected spec/ADR in the same changeset; no silent requirements drift.
6. Keep credentials and database passwords outside Git, model prompts and browser screenshots.
7. Submit focused PR/MR for review. Merge/deploy only when owner authorizes the specific external action.

## Release checklist

- [ ] Guest can browse, understand and practise `longest-window` locally and on the website.
- [ ] Real tests run against the current editor contents, with compile/fail/timeout/infra-error differentiation.
- [ ] Security assessment of runner passes, or isolated external fallback is accepted and accurately labelled.
- [ ] OAuth return URLs work for local, Vercel preview and production environments as intended, without broad redirect allowlists.
- [ ] Private drafts and attempts have deny-by-default RLS and cross-user negative tests.
- [ ] Drafts are recoverable from network failure; attempts are immutable; export works without privileged keys.
- [ ] Interview Mode does not reveal algorithm hints, tags, visualizations or old solutions by accident.
- [ ] Screen-reader, keyboard and mobile flows are verified; no misleading test badges/demo metrics remain.
- [ ] GitHub Actions and Vercel preview/production build pass on an up-to-date Node runtime.
- [ ] A real repository license is chosen and approved before soliciting outside contributors (suggested starting point: MIT, **not selected yet**).
- [ ] Owner explicitly approves production launch; no unapproved billing, domains or scope expansions.

## Out of scope until after MVP

Community solution feeds/likes/comments, moderation tools, leaderboards, AI-generated grading, multi-language execution, GitHub gist synchronization, streaks and spaced-repetition notifications. Add them through new specs rather than slipping them into M1–M6.
