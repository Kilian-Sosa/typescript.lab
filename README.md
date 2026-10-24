# typescript.lab

**Practice TypeScript interviews. Understand your solutions. Remember what you learned.**

typescript.lab is a TypeScript interview practice platform under development. It combines portable coding challenges with an accessible learning workspace. Private drafts, solution history and browser execution are being introduced behind the approved security and integration gates.

> **Status: protected app Preview deployed, release gates pending.** The Vue application, private Notebook, reference visualizer and M4 authentication/draft recovery are available in the [protected Preview](https://typescript-lab-app-preview-mb2mltwhd-kiliansosas-projects.vercel.app), pinned to `cf5a040`. Its exact OAuth callback is configured. Hosted schema/RLS and the original GitHub session flow were verified separately; the new frontend passes intercepted desktop/mobile tests. Full live Preview acceptance and runner security gates remain pending. Learner execution remains disabled.

## Run locally

Use Node 24 and pnpm 11.25.0 (pinned in `package.json`):

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The public learning content needs no cloud credentials. Verify the application and canonical challenge suite with:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

On Windows, the browser suite can use installed Edge by setting `PLAYWRIGHT_BROWSER_CHANNEL=msedge`. Set `PLAYWRIGHT_PORT` if the default test port `4173` is occupied.

CI separately audits both the app and runner lockfiles for dependency vulnerabilities.
Run `pnpm audit:dependencies` locally. High/critical findings (including unpatched
advisories) block; lower severities remain visible. See the
[audit policy and exception procedure](docs/security/dependency-auditing.md).
### Lint and formatting

CI runs `pnpm lint` and `pnpm format:check` on every PR targeting `main` and every push to `main`. These commands never rewrite files. The independently installed runner has the same commands:

```sh
pnpm --dir apps/runner install --ignore-workspace --frozen-lockfile
pnpm --dir apps/runner lint
pnpm --dir apps/runner format:check
node --test scripts/check-code-quality.test.mjs
```

ESLint uses shared flat configuration in `tooling/eslint.mjs`: recommended JavaScript and TypeScript correctness rules plus Vue 3 essential rules, without typed linting or stylistic rules. Each package resolves its own pinned dependencies. Browser, Worker and Node globals support the repository's mixed browser/test harnesses. Unused parameters/caught errors may start with `_`; unused rest siblings are allowed for intentional field omission. Three runner protocol/console test files document a single-rule `no-explicit-any` exception for runtime assertions on untrusted messages. Production files retain the rule.

Prettier owns formatting for JS/MJS/CJS, TypeScript, Vue, CSS, HTML, JSON and YAML, including scripts, tests, challenges, shared code, spikes and the design mockup. Markdown, SQL and runner library text are outside this gate. `.prettierignore` and ESLint ignores exclude dependency stores, local worktrees and generated test/build output; generated pnpm lockfiles are excluded from Prettier. One root `prettier.config.mjs` applies to both packages. Embedded language formatting is off to preserve learner-code strings and tagged fixtures. To format deliberately, run `pnpm exec prettier --write "**/*.{js,mjs,cjs,ts,vue,css,html,json,yml,yaml}"` from the root, or format selected files with your editor's Prettier integration. Include formatting with your change; CI only checks it.

For a local exercise, edit [the starter](challenges/longest-window/starter.ts), then run `pnpm test:practice`. That explicit suite fails until the starter is implemented; the default CI suite tests the separate canonical solution. Read the [challenge contract](challenges/longest-window/README.md) first.

The [local database guide](supabase/README.md) covers the pinned Supabase CLI, isolated migrations and `pnpm test:db`. It uses disposable local PostgreSQL, never a hosted migration. The [QuickJS feasibility report](docs/security/quickjs-feasibility.md) records passing local probes and the remaining production NO-GO gates; the [approved design](docs/superpowers/specs/2026-10-17-dedicated-runner-design.md) defines the execution boundary.

### Private Notebook

Copy `.env.example` to an ignored `.env.local` and supply the public URL and publishable key for the intended Supabase environment. Without configuration or a signed-in session, Notebook shows an access gate. The client never uses privileged keys. Hosted GitHub provider setup and exact callback allowlists belong to the separately approved M4 infrastructure work.

The source field supports private revision-based draft autosave and immutable submissions with notes and declared complexity. Save feedback distinguishes durable server acknowledgment, pending/offline work and conflicts. Guest import requires an explicit review/action. Recovery buffers are separated by account, challenge and tab; private text is cleared from the UI on sign-out/expiry and restored only for the matching account. Notes and declared complexity stay local until an attempt is saved. Browser storage failure is visible; keep the page open and download/copy memory-only work before leaving.

GitHub sign-in uses PKCE and returns to the exact same-origin `/auth/callback` URL, which must be authorized for that environment. The app handles denied, expired, missing and replayed callbacks without reflecting provider descriptions. Preview testers first need Vercel access; Vercel Authentication and GitHub sign-in are separate gates. An existing GitHub session may sign in without another consent screen. The [M4 frontend record](docs/superpowers/plans/2026-10-17-m4-frontend-recovery.md), [deployment execution record](docs/superpowers/plans/2026-10-17-preview-preparation.md) and [final M4 security review](docs/security/2026-10-18-final-m4-security-review.md) distinguish local proof, hosted observations and remaining acceptance.

Run the dedicated browser recovery suite with `pnpm test:e2e:recovery` (or `node scripts/check-recovery.mjs --workers=2`). It uses a synthetic, fully intercepted Auth/Data API and exercises callback failures, account switching, explicit import, two-tab conflicts, offline recovery and late responses on desktop/mobile. It never accesses the hosted project. Ordinary browser runs skip these ten opt-in cases; this command executes them.

Every submission is `untested` until a real source-matching runner is integrated. The full runner/editor integration remains pending. Learning Mode preserves the current source and requires a separate action to open the reference visualizer.

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

Vue 3 + Vite + Vue Router + strict TypeScript, Vitest, Playwright and Supabase/PostgreSQL with RLS. The app pins TypeScript 5.9.3 for compatibility with `vue-tsc`; shared contracts also pass their standalone TypeScript 7.0.2 check. GitHub Actions and Vercel SPA configuration are present. The protected app Preview is deployed; full live PKCE/recovery acceptance, production app deployment and learner execution remain gated. Nuxt is deferred.

## Contributions and licensing

The repository is public, but a license and contribution rules must be selected before accepting external contributions. Until a license is explicitly added, do not assume the content or source is licensed for reuse.

Avoid copying proprietary assessments or third-party problem statements verbatim; submissions should be original and attributable.
