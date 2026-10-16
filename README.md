# typescript.lab

**Practice TypeScript interviews. Understand your solutions. Remember what you learned.**

typescript.lab is a TypeScript interview practice platform under development. It combines portable coding challenges with an accessible learning workspace. Private drafts, solution history and browser execution are being introduced behind the approved security and integration gates.

> **Status: initial local implementation.** The Vue application, portable `longest-window` challenge, browser execution security spike and local PostgreSQL/RLS schema are implemented. Browser execution, GitHub sign-in, cloud autosave and Notebook history are not connected. Hosted deployment and runner architecture still require owner approval.

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

The [local database guide](supabase/README.md) covers the pinned Supabase CLI, isolated migrations and `pnpm test:db`. It uses disposable local PostgreSQL, never a hosted migration. The [security report](docs/security/execution-spike.md) records the runner probes and the remaining architecture decision.

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

The [initial A–D wave](docs/superpowers/plans/2026-10-16-initial-parallel-wave.md) follows the [coordination plan](docs/superpowers/plans/2026-10-16-parallel-agent-infrastructure.md) and frozen [shared v1 interfaces](docs/superpowers/specs/2026-10-16-shared-contracts-design.md). Their original standalone compiler check remains:

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
