# Parallel Agent Infrastructure and Shared Contracts Plan

> **For agentic workers:** Use Superpowers executing-plans for coordinator setup. Feature workers remain parked until the contract freeze and owner launch review.

**Status:** Owner approved v1 and this coordinator plan on 2026-10-16. Contracts are frozen and verified in four parked worker branches; feature launch remains pending.

**Goal:** Allow independent Codex/CoS agents to work simultaneously without sharing an interactive browser, editing the same files, or racing on the same Vercel/Supabase project.

**Architecture:** One coordinator owns shared interfaces and integration. Four source-isolated worktrees have exclusive mutable paths; one infrastructure owner handles authorized hosted changes. Worktrees do not isolate global MCP credentials.

**Tech Stack:** Git worktrees, Codex CLI MCP, TypeScript 7.0.2 for standalone contract checks, Vercel Git integration, Supabase CLI with Docker/local migrations, Supabase project-scoped read-only MCP.

**Spec:** `docs/superpowers/specs/2026-10-16-typescript-lab-design.md`; ADR-0001/0002/0003. No product contract or behaviour is changed by this coordination plan.

**Spec impact: add a focused spec.** The approved [Shared Contracts v1 specification](../specs/2026-10-16-shared-contracts-design.md) defines previously unwritten interfaces and resolves conflicting type locations. Product behaviours remain unchanged; the approved product specification and ADRs remain authoritative.

## Review Focus

1. Parallel workers cannot commit conflicting edits to shared contract files.
2. Unprivileged workers cannot mutate shared remote infrastructure through their assigned workflow, even when a globally authenticated MCP is present.
3. Git worktrees have isolated source/branches and explicit paths; database work has isolated ports.
4. Cloud integrations are not represented as functional until authenticated permissions are verified in the execution session.

## Verified setup (2026-10-16)

- GitHub: the owner merged the previous setup documentation; `main` was pulled with `--ff-only`. Setup continues on `chore/parallel-agent-setup`; all worker branches start at the merged baseline `43ea215d72c1ebabb0dfcb590e541c5df2f44bc9`. Only approved local freeze/coordination commits and worker-branch fast-forwards were performed; nothing was pushed or merged into `main`.
- Codex Vercel MCP: registered at `https://mcp.vercel.com`. A live nonmutating query confirmed team `kiliansosas-projects`; a scoped search returned no project matching `typescript`. No project was created or linked.
- Supabase management: the existing dedicated `typescript.lab` project was verified `ACTIVE_HEALTHY` in `eu-west-3` (Paris). Reuse it; no further provisioning is needed. Its reference is deliberately excluded from public documentation.
- Supabase Codex MCP: configured with the existing project reference and `read_only=true`; OAuth completed. A query through this connection returned `database_role = supabase_read_only_user` and `transaction_read_only = on`; its `public` table list was empty. This verifies the CLI connection separately from the management connector. OAuth requests broader underlying credential scopes; worker access must retain the scoped read-only endpoint and must never use another endpoint to bypass it.
- Supabase CLI and Vercel CLI: not installed as direct commands. Prefer a pinned project-local Supabase CLI once the project scaffold exists. Vercel project deployments should normally be handled by Git integration, not many agent CLI sessions.
- Docker: live engine check succeeded (29.8.2); Docker was already running and is left running. The initial sandbox denied named-pipe access; a read-only elevated check established engine readiness. No local database stack was started.
- Edge: a fallback for a one-time UI step or verification, not a shared automation dependency.

These are observations, not permanent guarantees: validate connections in the session executing the work. ChatGPT-installed plugins, CoS tools and Codex MCP connections are **separate** surfaces.

## Coordination ownership

| Owner | Can write | Must not write | Start condition |
| --- | --- | --- | --- |
| Coordinator | `shared/contracts/`, governing specs/plans, root shared docs/`.env.example`, integration, dependencies after A's scaffold | Other agents' active files; push/merge without approval | Setup selected |
| Track A — Frontend | `src/`, `index.html`, Vite/TS config, local `vercel.json`, `.github/workflows/`, navigation E2E; initial app manifest/lockfile | `challenges/`, `supabase/`, `shared/`, hosted settings, shared docs | Frozen contracts; explicit scaffold ownership |
| Track B — Challenge content | `challenges/` and challenge-local tests/content | App framework / account persistence | Shared minimal contracts agreed |
| Track C — Runner research | `docs/security/`, disposable `spikes/runner/` and isolated runner tests | Privileged app execution, production server secrets, Supabase schema | Immediately; security decision precedes runner integration |
| Track D — Local DB/RLS | `supabase/` config, migrations and policy tests | `src/`, root manifests/lockfile, hosted schema/OAuth/env | Frozen persistence contracts; pinned CLI and isolated local ports |
| Infrastructure owner | Vercel project settings, Git integration, remote Supabase migrations, OAuth configuration | Feature source code owned by other agents | Explicitly authorized access and reviewed change |

Only the infrastructure owner performs remote writes. **MCP authentication is not a per-agent security sandbox:** any agent inheriting the same Codex configuration may technically have powerful Vercel permissions. Restrict tool access by agent role where supported and enforce the no-remote-write rule through a single coordinator. Do not embed provider tokens in agent prompts.

### Shared contracts to freeze before fan-out

Minimal types, agreed in a brief coordination pass, not an over-engineered abstraction layer:

- Exact definitions, statuses, routes and invariants: [Shared Contracts v1](../specs/2026-10-16-shared-contracts-design.md), frozen contract version `1.0.0`.
- Coordinator-owned module after review: `shared/contracts/v1.ts`. B must not create competing shared types under `src/features/challenges/`; C must not duplicate shared results under `src/features/runner/`.
- Challenge ID/slug `longest-window`, initial challenge version `1.0.0`. Cases use named `input: {events, k}` and the approved `{start, endExclusive}` output with earliest-tie semantics.
- `/` redirects to `/explore`; MVP paths are `/explore`, `/challenges/:slug`, `/notebook`, `/notebook/:slug`. `/patterns` stays deferred. Track A owns global tokens at `src/app/styles/tokens.css` using the approved design reference.
- A selects compatible pinned app dependencies during scaffold, as ADR-0001 requires. Thereafter the coordinator owns root manifest/lockfile updates; B/C/D submit dependency requests. D receives one exact pinned Supabase CLI before local startup. Preparation caches only the pinned standalone TypeScript compiler; no app or Supabase CLI dependencies are installed.

**Freeze commit:** `cdd71a3d67ad13f8309221b1c4498136ed430134` (`chore(contracts): freeze shared interfaces for parallel tracks`). It contains the approved spec, `shared/contracts/v1.ts`, strict compiler config and acceptance fixtures. All four worker branches received this same commit and passed strict checks. Later coordination-only commits retain this freeze unchanged. Agents propose changes through the coordinator; a proposal checksum or an uncommitted snapshot is not a reviewed freeze commit.

## Prepared worktrees and launch matrix

Managed worktrees are attached to the coordinator's chat. Absolute paths and local handoffs live in ignored `docs/prompts/`; no workers have started. All four branches start at the merged setup baseline above. Pending coordinator edits are not silently present in worker checkouts.

| Track / branch | Exclusive write area | Read / remote access | Focused checks | Integration gate |
| --- | --- | --- | --- | --- |
| A / `feat/frontend-foundation` | Frontend/scaffold paths above | Other source/specs; no remote writes | Router/catalog tests, typecheck/test/build, mobile/keyboard navigation | Buildable guest shell; honest empty states |
| B / `feat/challenge-library` | `challenges/` | Shared types; no remote writes | Canonical ties/empty/nonpositive k/Unicode fixtures; portable CLI tests | Site/local fixtures agree; incomplete practice suite excluded from CI |
| C / `chore/runner-security-spike` | `docs/security/`, `spikes/runner/` | Shared types; no cloud credentials or remote writes | Reproducible storage/DOM/network/loop/termination probes and cleanup | Owner approves security report before production runner |
| D / `feat/local-schema-rls` | `supabase/` | Hosted inspection only through scoped read-only MCP; local DB writes | Local reset; anonymous/cross-user denial, draft CAS, immutable attempts, ownership-changing writes | Actual isolated PostgreSQL policy evidence; no hosted migration |

All branches remain **parked** pending an owner launch decision. Local handoffs carry current repository instructions, governing specs/ADRs/plans, the freeze commit, contract checksums and exclusive paths. Workers stop if the reviewed freeze or current instructions are absent. Only the coordinator may synchronize another track's setup files.

### Dependency-aware integration order

1. Review v1 and this plan; materialize/verify types and strict acceptance checks; create one local freeze commit and apply it to all four branches. Verify identical contract content before starting workers.
2. Start at most A/B/C in a four-slot native session: coordinator plus three workers fills capacity. Start D when a slot frees; D can author SQL/tests independently once its persistence contract is frozen. Do not create user-owned chats without an explicit request.
3. A scaffolds the app and exact dependency pins. B authors portable content independently, then verifies with coordinator-approved tooling. The coordinator integrates A/B and owns registry/page adaptation; test portability, catalog, unknown slugs and Interview Mode.
4. C's report receives an owner security decision. Only then schedule a separate bounded runner implementation and editor integration. Shared result types do not approve an execution boundary.
5. D tests migrations/RLS with one pinned CLI and one local stack. The coordinator then schedules auth/draft client work in `src/`. Hosted migrations, OAuth provider settings and environment changes stay with the infrastructure owner under separate authorization.
6. Integrate attempts/notebook, then visualization and release E2E per M5/M6. After each integration run contract checks, typecheck, focused tests and build. A reviewed push/merge still requires owner authorization.

## Parallel launch and integration gates

```text
Approved M0 → M0.5 contracts + tools
                        │
         ┌──────────────┼───────────────┬──────────────┐
         ▼              ▼               ▼              ▼
     Frontend       Challenge        Runner         Supabase
     shell/CI       package          security       local schema
     (Track A)      (Track B)        spike          & RLS (Track D)
         │              │               │              │
         └──────┬───────┘               │              │
                ▼                       │              │
       Challenge UI integration         │              │
                │                       ▼              │
                │              OWNER security gate     │
                │                       │              │
                └────────┬──────────────┘              │
                         ▼                             │
                 Runner UI integration                 │
                         │                             │
                         └─────────────┬───────────────┘
                                       ▼
                           Auth + drafts + notebook
                                       │
                                       ▼
                        Visualizer + E2E + release gate
```

This diagram shows *integration* dependencies, not idle periods. Notebook UI and visualization logic can start earlier after their respective contracts exist; they cannot claim end-to-end completion until persistence and runner boundaries are integrated.

## MCP/CLI policy

### Vercel

- Official Codex MCP endpoint: `https://mcp.vercel.com`; use Codex OAuth. The MCP connection was verified on this machine, but its effective project access should be checked before actions.
- One infrastructure owner creates/links the dedicated Vercel project after app code is buildable, subject to approval for surprise cost/permissions.
- GitHub push/PRs trigger **Git-connected preview deployments**; feature agents do not deploy independently.
- Never allow an agent to change existing unrelated Vercel projects, production domains, billing or auth scopes.

### Supabase

- Development: pin the Supabase CLI version in project tooling, run SQL migrations and RLS tests locally with Docker; no hosted database write permissions needed for schema authors.
- Multiple local Supabase stacks per worktree are possible with the CLI experimental stack configuration, but consume CPU/memory and require separate ports. Start **one** isolated database stack for Track D by default; expand only if parallel database work is justified.
- Hosted inspection: retain the scoped read-only Codex MCP endpoint of the form `https://mcp.supabase.com/mcp?project_ref=PROJECT_REF&read_only=true` for the existing project. The actual reference stays in local configuration. Credential scopes and server restrictions are separate controls; never add a broad org-wide or writable endpoint to worker configuration.
- Remote provisioning, OAuth changes, schema migrations and secrets: one infrastructure owner. GitHub OAuth client ID/secret and database password never enter source control, logs or prompts.
- Local RLS tests must cover anonymous and cross-user denial; don't treat client-side checks as security controls.

## Safety and QA checklist

- [x] Obtain owner review of the exact contract proposal and path ownership before freezing types.
- [x] Verify Codex Vercel MCP with a live nonmutating team/project query; no project creation.
- [x] Create four managed worktrees with dedicated branches at the merged `main` baseline.
- [ ] Pin Supabase CLI after app scaffold and validate Docker locally on Track D.
- [x] Create and verify the dedicated Supabase project (already completed by the owner).
- [x] Configure Supabase scoped read-only MCP and verify OAuth, table listing and read-only SQL role/transaction.
- [ ] Integrate code via reviewed PRs; run required tests after each merge, not just in isolated worktrees.
- [x] Reconcile all six implementation plans and local-only Codex prompts with parallel execution.

## Coordinator execution checklist

- [x] Read the product spec, accepted ADRs and all six scoped plans; inspect branch/dirty state and run existing design checks.
- [x] Prepare the exact focused contract proposal and a dependency-aware ownership matrix; obtain owner approval.
- [x] Materialize `shared/contracts/v1.ts` and strict acceptance checks. Observe a red check before the module exists, then green for valid fixtures and 13 negative assertions covering malformed cases, immutable fields, owner-free writes and transient evaluations.
- [x] Create the narrow local freeze commit, apply it to each worker branch and verify strict checks in all four worktrees.
- [x] Record the launch order and remaining prerequisites below; no implementation workers were spawned.

## Remaining launch prerequisites

- Owner selects/authorizes the implementation wave; recommended native order is A/B/C, then D as a slot frees. All four worktrees already exist and share the approved freeze.
- A's first scaffold selects current compatible app/tooling pins. B can author content before that scaffold; its green Vitest execution waits for the approved test tooling.
- D needs one pinned Supabase CLI and a local port availability check before starting its isolated database. Docker readiness is verified, but no SQL migrations or policy implementation have been written/tested in M0.5.
- C must return a security report for a separate owner decision before any production runner. Hosted OAuth-provider configuration, migrations, Vercel linking/envs, push and production deployment remain separately authorized infrastructure work.

**Verification:** `npm.cmd exec --yes --package=typescript@7.0.2 --call "tsc --project shared/contracts/tsconfig.json"`, `node scripts/check-design.mjs`, `node --check docs/design/mockups/app.js`, and `git diff --check`. Setup used an ignored npm cache; the exact local commands and per-worktree results are recorded in ignored handoffs. Direct invocation of the cached compiler avoided PowerShell/npm argument forwarding problems during per-worktree checks. No application build or Vitest run is claimed before the application scaffold exists.

**Stop condition:** Contracts/ownership reviewed, all branches share the approved freeze, and tool access is honestly verified or reported blocked. No feature components, unapproved cloud resources, hosted schema changes, deployment, push or merge.
