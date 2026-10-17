# typescript.lab

**Practice TypeScript interviews. Understand your solutions. Remember what you learned.**

typescript.lab is a TypeScript interview practice platform under development. It combines portable coding challenges with an accessible learning workspace. Private drafts, solution history and browser execution are being introduced behind the approved security and integration gates.

> **Status: local implementation, release gates pending.** The Vue application, portable challenge, private Notebook and reference algorithm visualizer are implemented locally. Authenticated saves, history, comparison, exports and fresh retries are verified against disposable local Supabase. Learner execution remains disabled pending the QuickJS feasibility/security gates. Hosted GitHub OAuth, cloud draft autosave and deployment remain pending.

## Run locally

Use Node 24 and pnpm 11.25.0 (pinned in `package.json`):

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The public learning content needs no cloud credentials. Verify the application and canonical challenge suite with:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

On Windows, the browser suite can use installed Edge by setting `PLAYWRIGHT_BROWSER_CHANNEL=msedge`. Set `PLAYWRIGHT_PORT` if the default test port `4173` is occupied.

For a local exercise, edit [the starter](challenges/longest-window/starter.ts), then run `pnpm test:practice`. That explicit suite fails until the starter is implemented; the default CI suite tests the separate canonical solution. Read the [challenge contract](challenges/longest-window/README.md) first.

The [local database guide](supabase/README.md) covers the pinned Supabase CLI, isolated migrations and `pnpm test:db`. It uses disposable local PostgreSQL, never a hosted migration. The [QuickJS feasibility report](docs/security/quickjs-feasibility.md) records passing local probes and the remaining production NO-GO gates; the [approved design](docs/superpowers/specs/2026-10-17-dedicated-runner-design.md) defines the execution boundary.

### Private Notebook

Copy `.env.example` to an ignored `.env.local` and supply the public URL and publishable key for the intended Supabase environment. Without configuration or a signed-in session, Notebook shows an access gate. The client never uses privileged keys. Hosted GitHub provider setup and exact callback allowlists belong to the separately approved M4 infrastructure work.

The source field supports basic text editing and immutable submissions with notes and declared complexity. Draft autosave and the full runner/editor integration remain pending. Every submission is `untested` until a real source-matching runner is integrated. Learning Mode preserves the current source and requires a separate action to open the reference visualizer.

With a disposable local database/auth/API stack running, verify actual authenticated saves, cross-user denial, comparison, exports and retry using:

```powershell
node scripts/check-notebook-local.mjs --workers=2
```

This opt-in check creates synthetic local users and runs desktop/mobile browser flows. It reads generated local keys inside the test process without printing them, refuses a non-loopback API URL, and never accesses the hosted project. Stop/remove the disposable stack afterward using the local database guide. Ordinary browser tests skip this opt-in flow.

## Explore the design

Open [the interactive mockup](docs/design/mockups/index.html) directly in a browser. It previews:

- **Explore:** challenge discovery, recent activity, and meaningful progress.
- **Solve:** a split workspace, problem statement, TypeScript editor mock, example explorer, hints, and tests panel.
- **My Notebook:** personal attempt history, explanations, complexity analysis, and comparison / retry affordances.

The demo contains sample data. Editing or testing code in the prototype is not equivalent to running code in the planned product.

To verify the design documentation and mockup's structural integrity without installing any dependencies:

```sh
node --check docs/design/mockups/app.js
node scripts/check-design.mjs
```

The [initial A–D wave](docs/superpowers/plans/2026-10-16-initial-parallel-wave.md) and [runner/Notebook/visualizer wave](docs/superpowers/plans/2026-10-17-runner-notebook-visualizer-wave.md) follow the [coordination plan](docs/superpowers/plans/2026-10-16-parallel-agent-infrastructure.md) and frozen [shared v1 interfaces](docs/superpowers/specs/2026-10-16-shared-contracts-design.md). Their original standalone compiler check remains:

```powershell
npm.cmd exec --yes --package=typescript@7.0.2 --call "tsc --project shared/contracts/tsconfig.json"
```

## Documentation

| Document | Purpose |
| --- | --- |
| [Product design specification](docs/superpowers/specs/2026-10-16-typescript-lab-design.md) | Approved requirements, behaviours, acceptance criteria and scope |
| [ROADMAP](ROADMAP.md) | Ordered milestones, dependencies and acceptance gates |
| [Superpowers implementation plans](docs/superpowers/plans/README.md) | Scoped TDD tasks and acceptance gates, including Vercel and Supabase setup |
| [Design system and screen contract](docs/design/README.md) | UX layout, responsiveness, states, accessibility and token guidance |
| [Mockup guide](docs/design/mockups/README.md) | What is interactive, what is illustrative, and how to review |
| [Frontend architecture ADR](docs/decisions/0001-frontend-platform.md) | Choice of app framework and deployment approach |
| [Execution and challenge ADR](docs/decisions/0002-challenges-and-execution.md) | Challenge format, testing and security boundaries |
| [Persistence ADR](docs/decisions/0003-solution-persistence.md) | Drafts, immutable attempts, account privacy and export |
| [Repository instructions](AGENTS.md) | Specification-driven development conventions |

## Guiding principles

1. **Learn first.** Interview Mode protects pattern recognition and independent reasoning.
2. **Your solutions belong to you.** Save drafts, preserve attempts, review them later, and export your work.
3. **Open by default for content, private by default for users.** Challenges are open source; an individual submission is private unless deliberately published.
4. **Portable challenges.** Every challenge works as a local TypeScript exercise independently of the website.
5. **Prefer focused quality over feature count.** Begin with one excellent end-to-end challenge.

## Stack

Vue 3 + Vite + Vue Router + strict TypeScript, Vitest, Playwright and a local Supabase/PostgreSQL schema. The app pins TypeScript 5.9.3 for compatibility with `vue-tsc`; shared contracts also pass their standalone TypeScript 7.0.2 check. GitHub Actions and Vercel SPA configuration are present. Hosted Supabase Auth, Vercel integration and an editor/runner remain gated. Nuxt is deferred.

## Contributions and licensing

The repository is public, but a license and contribution rules must be selected before accepting external contributions. Until a license is explicitly added, do not assume the content or source is licensed for reuse.

Avoid copying proprietary assessments or third-party problem statements verbatim; submissions should be original and attributable.
