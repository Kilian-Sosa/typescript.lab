# Agent instructions — typescript.lab

## Current phase

This repository has an **approved product design** and is ready for phased, specification-driven implementation. Read the authoritative spec and relevant accepted ADRs before writing production code. The browser prototype in `docs/design/mockups/` is a **visual reference**, not a production frontend or a working code runner.

## Source of truth

1. `docs/superpowers/specs/2026-10-16-typescript-lab-design.md` — approved product behaviours and acceptance criteria.
2. `docs/decisions/*.md` — accepted architectural decisions and trade-offs, subordinate to explicit product requirements.
3. `docs/design/README.md` — UX and design tokens / responsive screen contracts.
4. `docs/design/mockups/index.html` — visual and interaction reference for Explore, Solve and Notebook.
5. `ROADMAP.md` — milestone scope and gates; `docs/superpowers/plans/` — scoped executable plans. Any handoff prompts under `docs/prompts/` are **local-only** and deliberately Git-ignored.

If these disagree, surface the conflict and update the authoritative specification and affected dependent docs in the same change. Never infer product requirements solely from the mockup's sample data or placeholder interactions.

## SDD workflow

For every feature, bug fix, refactor or contract change:

1. Read the relevant spec, ADR, and acceptance criteria.
2. Record one spec-impact outcome: update existing spec / add focused spec / no spec change (with reason).
3. Use Superpowers brainstorming for significant design changes. Document approved designs in `docs/superpowers/specs/`.
4. For implementation, follow the scoped plan under `docs/superpowers/plans/` using Superpowers writing-plans/executing-plans or subagent-driven-development.
5. Execute bounded tasks with tests, validating that specs, implementations and tests match in both directions.
6. Revisit the mockups when user-facing behaviour changes; keep the intended experience and code aligned.

## Engineering conventions

- All source-code comments must be written in **English**.
- TypeScript strictness, accessible components, and semantic HTML are expected for the production app.
- Do not evaluate untrusted user TypeScript in the server process or app origin. Design an explicit isolated execution boundary and resource limits first.
- Runner architecture approved 2026-10-17: [dedicated cross-site iframe/Worker/QuickJS-WASM design](docs/superpowers/specs/2026-10-17-dedicated-runner-design.md). This approval is **not** a security validation or deployment authorization. Perform the focused feasibility spike and preserve review gates before implementing/enabling learner execution; never downgrade to native JS evaluation if the gate fails.
- Personal drafts, submissions and notes are private by default. Never trust a client-provided user ID to authorize access.
- Keep published reference solutions separate from user attempts; preserve immutable submission history.
- New challenges must include a precise contract, examples, edge cases, starter implementation, canonical solution and tests.
- Do not introduce unrelated abstractions, services, or cloud dependencies without a supporting requirement.
- Follow the [parallel-agent infrastructure plan](docs/superpowers/plans/2026-10-16-parallel-agent-infrastructure.md) when multiple worktrees are active: shared contracts belong to the coordinator, each mutable path to one agent, and *only one authorized infrastructure owner* may change hosted Vercel/Supabase resources. Do not treat shared MCP OAuth credentials as worktree-specific permissions.
- Consume frozen interfaces from [Shared Contracts v1](shared/contracts/v1.ts) and its [approved contract specification](docs/superpowers/specs/2026-10-16-shared-contracts-design.md). Propose contract/version changes through the coordinator; do not create competing track-local definitions. A prepared worktree does not authorize launching a feature worker.
- Default stack: Vue 3, Vite, Vue Router, TypeScript strict, Vitest, Supabase Auth/PostgreSQL/RLS and Vercel. Nuxt is deferred unless explicitly justified through an ADR amendment.
- For Supabase, never commit passwords, service-role/secret keys, tokens or OAuth client secrets; never disable RLS to make a test pass. Publishable keys are public but still belong in environment-specific configuration.
- For Vercel and Supabase dashboard operations, verify the current account/organization and project names before creating resources. Use the existing signed-in browser or authorized connector, and never publish credentials in logs or chat.
- For preview-only Vercel work, check the [first-deployment rule](https://vercel.com/docs/deployments/environments#first-deployment) before submitting any deployment: a new project's first deployment is forced to Production, including direct uploads without Git. An omitted API target or explicit Preview intent is not a first-deployment safety guarantee. Under preview-only approval, keep the project empty and Git disconnected until a supported mechanism prevents Production classification. Do not bootstrap with a temporary Production deployment. See the [verified execution record](docs/superpowers/plans/2026-10-17-preview-preparation.md).
- The owner later explicitly approved an inert, protected static Production bootstrap for `typescript-lab-app-preview`, followed by its pinned application Preview and exact OAuth callback. That narrow exception is recorded in the execution record above; it does not authorize application code in Production, other bootstraps, removing protection or enabling the runner.
- A GitHub commit/push does not itself authorize production deployment, billing, DNS changes, destructive database changes or expanding OAuth scopes; stop and seek owner approval for material external effects.

## Git workflow

The repository owner approved committing and pushing the **initial documentation + mockup baseline** to the public repository on 2026-10-16. Future implementation may use focused conventional commits as specified in the accepted plans; inspect the branch and working tree first. Do not conflate public Git source publication with making a private account's saved solutions public.
