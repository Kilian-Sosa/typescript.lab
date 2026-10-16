# typescript.lab

**Practice TypeScript interviews. Understand your solutions. Remember what you learned.**

typescript.lab is a proposed open-source TypeScript interview practice platform. It combines clear coding challenges, interactive examples, a distraction-free solving workspace, and a private notebook that preserves your own solutions and reasoning over time.

> **Status: approved design baseline, implementation not started.** No application or hosted service has been implemented. The HTML mockup is a standalone, browser-openable design prototype; it does not run arbitrary TypeScript or persist data to a backend.

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

M0.5 has prepared four independent worktrees and frozen the [shared v1 interfaces](docs/superpowers/specs/2026-10-16-shared-contracts-design.md). The [coordination plan](docs/superpowers/plans/2026-10-16-parallel-agent-infrastructure.md) defines ownership and integration gates; feature workers have not started. Check the shared types without scaffolding the app:

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

## Approved stack (not installed)

Vue 3 + Vite + Vue Router + TypeScript, Monaco Editor (subject to UX validation), Vitest, PostgreSQL / Supabase Auth and RLS, GitHub Actions, and Vercel. Nuxt remains a documented alternative if SSR becomes necessary. No product dependencies have been installed yet.

## Contributions and licensing

The repository is public, but a license and contribution rules must be selected before accepting external contributions. Until a license is explicitly added, do not assume the content or source is licensed for reuse.

Avoid copying proprietary assessments or third-party problem statements verbatim; submissions should be original and attributable.
