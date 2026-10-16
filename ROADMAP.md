# typescript.lab — Implementation Roadmap

**Baseline approved:** 2026-10-16

**Current status:** Design/specification approved; production implementation not started.
**Source of truth:** [Product specification](docs/superpowers/specs/2026-10-16-typescript-lab-design.md), [accepted ADRs](docs/decisions/0001-frontend-platform.md), [design reference](docs/design/mockups/index.html).

## Definition of the MVP

A visitor can find an original TypeScript challenge, understand the contract, write their own solution, run real tests safely, optionally authenticate with GitHub, save a private draft, submit immutable attempts, revisit their notes months later, compare versions and download their work. Guests can use the basic learning flow without an account.

**Do not confuse** a hosted documentation mockup with an implemented MVP, or a browser-side self-reported pass with a trustworthy competitive score.

## Dependencies and execution order

```text
M0 Accepted documentation + GitHub baseline (this repository)
  ↓
M1 Frontend foundation + Vercel Git-connected preview
  ↓
M2 Portable challenge, local tests and challenge UI
  ↓
M3 Code execution security spike → go/no-go decision → actual runner
  ↓
M4 Supabase Auth + private draft persistence
  ↓
M5 Immutable attempts, personal notebook and export
  ↓
M6 Algorithm visualization + accessibility/responsiveness/release QA
  ↓
MVP release gate
```

M3 security validation is a hard gate for publishing an embedded runner. If it fails, use an isolated external playground and revise the runner plan before proceeding; do **not** fall back to unsafe evaluation in the app origin. M4 schema/security design may be prepared independently after M2, but actual M4 implementation follows the M3 security decision so that the evaluation-status contract is stable.

## Milestones

| Milestone | Status | Deliverable | Acceptance gate | Implementation plan |
| --- | --- | --- | --- | --- |
| M0 — Design baseline | Approved; publication authorized | Accepted specification, ADRs, UX contract and browser mockup | Docs validation passes; GitHub baseline pushed | This document |
| M1 — App shell + Vercel | Planned | Vue 3/Vite/Router/strict TS app, navigation, styles, CI, Vercel preview | Build/typecheck/tests pass; real Vercel URL shows app shell; previews work | [M1](docs/superpowers/plans/2026-10-16-foundation-and-catalog.md) |
| M2 — Challenge + Explore | Planned | Portable `longest-window` package, README, cases, canonical solution/tests; searchable catalog and solving skeleton | Canonical local fixtures and rendered examples agree, including ties/empty/`k <= 0` | [M2](docs/superpowers/plans/2026-10-16-challenge-content.md) |
| M3 — Real runner | Planned; security gate | Security spike, owner-reviewed architecture, actual browser editor/test integration OR safely isolated external provider | Malicious/looping code cannot hang or gain privilege; tests report real results, never fabricated passes | [M3](docs/superpowers/plans/2026-10-16-runner-security.md) |
| M4 — Supabase + Auth + drafts | Planned | Supabase project, GitHub OAuth, RLS-protected schema and resilient private autosaves | Cross-user denial, callback flows and autosave conflict/offline tests pass | [M4](docs/superpowers/plans/2026-10-16-auth-and-drafts.md) |
| M5 — Attempts + Notebook | Planned | Immutable versions, notes, history, comparison, retry, export | Old attempts cannot be overwritten; other users cannot read them; export is readable | [M5](docs/superpowers/plans/2026-10-16-notebook-history.md) |
| M6 — Polish + ship | Planned | Learning visualizer, mobile/keyboard/dark UI, docs/contributor readiness, deployment QA | WCAG-oriented checks, browser E2E, no leaked secrets; launch gate recorded | [M6](docs/superpowers/plans/2026-10-16-release-polish.md) |

## Environment setup (known at planning time)

- **GitHub repository:** https://github.com/Kilian-Sosa/typescript.lab ; default intended branch `main`.
- **Local folder:** `/typescript.lab` in CoS (resolve the approved native path from the workspace, not from this public document).
- **Vercel:** authenticated Edge tab at `https://vercel.com/kiliansosas-projects`, workspace `kiliansosas-projects` (Hobby at inspection). M1 creates/connects the *typescript.lab* app **after** code exists and confirmation of project/team settings.
- **Supabase:** authenticated Edge tab at a `supabase.com/dashboard/new/…` form, organization `kiliansosa` (Free at inspection). The project form was **not yet submitted**; its prefilled generic project name is not the desired name. M4 locates the existing tab, verifies the organization/quotas, chooses `typescript-lab` and uses Europe if still suitable. Do not put account-specific dashboard IDs into a public spec.
- Browser tabs and account state are **snapshots, not stable identifiers**. Discover active Edge tabs again at execution time. Never treat a signed-in tab as authorization to incur charges, change production DNS, reveal keys, or create additional unrelated resources.
- Vercel dashboard displayed a warning about existing Node 20-or-older projects. **Do not modify those other projects.** Pin/check a modern supported Node runtime for this project.
- Supabase new-project form at inspection had **Automatically expose new tables** enabled and **Enable automatic RLS** available. M4 should disable auto-exposure for this private-data project, enable automatic RLS if available, and validate explicit per-table RLS regardless of UI defaults.

## Global engineering quality gates

Every milestone:

1. Start by reading `AGENTS.md`, the spec, applicable ADRs and the [focused implementation plan](docs/superpowers/plans/README.md). Local Codex handoff prompts are optional and intentionally excluded from the public repository.
2. Confirm branch, remotes and working-tree state. Work in a focused `feat/<scope>` branch; use Superpowers TDD / verification-before-completion and SDD updates.
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
