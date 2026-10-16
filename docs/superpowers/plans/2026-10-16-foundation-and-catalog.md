# Foundation and Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a real Vue 3 app, CI, Vercel preview, and a faithful guest-friendly challenge explorer, independent of Supabase.

**Architecture:** Vite + strict TypeScript + Vue Router. Challenge content lives outside view components. GitHub Actions runs checks; Vercel deploys the built SPA with route fallback.

**Tech Stack:** Vue 3, Vite, Vue Router, Vitest, TypeScript, GitHub Actions, Vercel, Node 24 (validate current provider support before pinning).

**Spec:** `docs/superpowers/specs/2026-10-16-typescript-lab-design.md` (`REQ-01`, `REQ-11`, `REQ-12`, `REQ-13`); ADR-0001; `docs/design/README.md`.

**Plan status:** Ready for owner review; implementation starts only when this milestone is selected.

**Parallel ownership:** Track A owns only frontend app-shell/catalog components. The coordinator owns frozen contracts and Track B owns challenge packages. Task 3's **remote Vercel actions** belong to the single infrastructure owner, not the Track A agent.

**Shared contract:** Use the reviewed [v1 interfaces](../specs/2026-10-16-shared-contracts-design.md) from coordinator-owned `shared/contracts/v1.ts`; do not duplicate them. A owns `src/`, app configuration and the initial root manifest/lockfile scaffold; subsequent dependency changes go through the coordinator. `/` redirects to `/explore`, with `/notebook/:slug` reserved for notebook integration. A owns `src/app/styles/tokens.css` and global tokens.

## Global Constraints

- Preserve `docs/design/mockups/` as a reference, not imported production UI.
- All comments in source code are English. No production demo activity counts or fake personalized dashboards.
- Public catalog works when cloud services are unavailable or no account exists.
- No secret can be included in Vite client bundles.
- Do not change unrelated existing Vercel projects; check signed-in team before project creation.
- Implementation follows TDD and produces scoped, independently tested commits.

## Review Focus

1. An anonymous first-time visitor sees a useful empty/resume state without fabricated progress; cover in Task 2.
2. A direct refresh of `/challenges/longest-window` on Vercel loads the SPA, not a 404; cover in Task 3.
3. Invalid challenge slug yields a clear accessible not-found state; cover in Task 2.
4. Small screen width does not cause document-wide horizontal overflow; cover in Task 2.
5. CI and deployment use a supported Node runtime and don't mutate other workspace projects; cover in Task 3.

---

### Task 1: Scaffold the host-neutral Vue application

**Files:** Create `package.json`, `pnpm-lock.yaml`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.ts`, `src/app/App.vue`, `src/router/index.ts`, `src/pages/ExplorePage.vue`, `src/pages/ChallengePage.vue`, `src/pages/NotebookPage.vue`; test `src/router/router.test.ts`.

**Interfaces:** Routes `/explore`, `/challenges/:slug` and `/notebook` render even before data/auth exist. Router exports `router`.

- [ ] Write router tests verifying known and unknown routes, and no cloud dependency for initial render.
- [ ] Run `pnpm test` to observe failing tests; install compatible minimal deps and implement entrypoint/router.
- [ ] Run `pnpm typecheck`, `pnpm test`, `pnpm build` and record output.
- [ ] Commit a focused `feat(app): bootstrap Vue workspace` change.

### Task 2: Implement design shell and challenge discovery

**Files:** Create `src/app/styles/tokens.css`, `src/app/components/AppShell.vue`, `src/features/challenges/ChallengeList.vue`, `src/features/challenges/registry.ts`, `src/features/challenges/ChallengeList.test.ts`; modify `src/pages/ExplorePage.vue` and `src/pages/ChallengePage.vue`.

**Interfaces:** `listChallenges(query?: string, difficulty?: 'easy' | 'medium' | 'hard'): ChallengeSummary[]`. Before M2 supplies real challenge packages, return an empty catalog (with a useful "first challenges coming soon" state) rather than list falsely available content. `ChallengeList` emits a selected slug when available; never fabricates a private solve count.

- [ ] Test search, difficulty filtering, unknown slug, guest empty state and deep links before implementation.
- [ ] Implement mockup-inspired side navigation, reusable surfaces, accessible controls and light/dark tokens.
- [ ] Add responsive Playwright/component assertions at phone and desktop sizes; ensure no horizontal document overflow.
- [ ] Run focused tests, typecheck and build; compare Explore with `docs/design/mockups/index.html`.
- [ ] Commit `feat(explore): add accessible challenge catalog`.

### Task 3: Add CI and Vercel project

**Files:** Create `.github/workflows/ci.yml` and local `vercel.json` only if required for SPA fallback; add a route smoke test in `tests/e2e/navigation.spec.ts`. Send proposed shared `README.md` / `.env.example` updates to the coordinator instead of editing those files concurrently.

**Interfaces:** GitHub push/PR triggers typecheck, tests and build. Vercel Git integration points to `Kilian-Sosa/typescript.lab` / approved workspace `kiliansosas-projects` with `dist` output. Preview and production URL loads direct routes.

- [ ] Add red CI/smoke checks for build and `/challenges/longest-window` refresh behavior.
- [ ] Implement workflow and deployment configuration using Node 24 if provider compatibility validates it; don't alter other old-Node Vercel projects.
- [ ] Locate the existing signed-in Edge Vercel tab; verify account/team/repository/plan and obtain approval for any unexpected permissions/costs before creating or connecting the project.
- [ ] Create the Vercel project only after the repository has buildable code, set framework/root/output correctly, and connect the GitHub repo; note actual project URL without copying tokens.
- [ ] Verify preview, deep-link refresh, and CI results; commit infrastructure/docs changes with `chore(ci): add checks and Vercel deployment`. Push/deploy only with the requested authorization.
