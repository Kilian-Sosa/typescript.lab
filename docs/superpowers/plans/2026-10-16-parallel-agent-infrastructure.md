# Parallel Agent Infrastructure and Shared Contracts Plan

**Status:** Proposed orchestration amendment for owner review; no production implementation authorized by this document.

**Goal:** Allow independent Codex/CoS agents to work simultaneously without sharing an interactive browser, editing the same files, or racing on the same Vercel/Supabase project.

**Tech stack:** Git worktrees, Codex CLI MCP, GitHub CLI, Vercel Git integration, Supabase CLI with Docker/local migrations, Supabase project-scoped read-only MCP.

**Spec:** `docs/superpowers/specs/2026-10-16-typescript-lab-design.md`; ADR-0001/0002/0003. No product contract or behaviour is changed by this coordination plan.

**Spec impact:** No change to approved product requirements. This document amends *delivery dependencies*, ownership and infrastructure access only; the product specification and ADRs remain authoritative.

## Review Focus

1. Parallel workers cannot commit conflicting edits to shared contract files.
2. Unprivileged workers cannot mutate shared remote infrastructure through their assigned workflow, even when a globally authenticated MCP is present.
3. Git worktrees have isolated source/branches and explicit paths; database work has isolated ports.
4. Cloud integrations are not represented as functional until authenticated permissions are verified in the execution session.

## Verified setup (2026-10-16)

- GitHub: the source repository exists; CLI authorization is available in the CoS shell.
- Codex CLI: installed, with the Vercel MCP server registered and OAuth authorization completed for `https://mcp.vercel.com`.
- Supabase management: the dedicated `typescript.lab` project exists in organization `kiliansosa`, region `eu-west-3` (Paris), and was verified healthy. Reuse it; no further project provisioning is needed. Its project reference is deliberately not recorded in public documentation.
- Supabase CLI and Vercel CLI: not installed as direct commands. Prefer a pinned project-local Supabase CLI once the project scaffold exists. Vercel project deployments should normally be handled by Git integration, not many agent CLI sessions.
- Docker CLI: present, but Docker daemon was **not running** at validation. Track D's local database stack requires Docker Desktop to be running; this does not block other tracks.
- Edge: a fallback for a one-time UI step or verification, not a shared automation dependency.

These are observations, not permanent guarantees: validate connections in the session executing the work. ChatGPT-installed plugins, CoS tools and Codex MCP connections are **separate** surfaces.

## Coordination ownership

| Owner | Can write | Must not write | Start condition |
| --- | --- | --- | --- |
| Coordinator | Shared contracts/spec updates, integration, PR review/merge | Other agents' active files | Immediately |
| Track A — Frontend | `src/app/`, `src/pages/`, `src/components/`, router, app build files | `challenges/`, `supabase/`, shared runtime contracts after freeze | Shared minimal contracts agreed |
| Track B — Challenge content | `challenges/` and challenge-local tests/content | App framework / account persistence | Shared minimal contracts agreed |
| Track C — Runner research | `docs/security/`, disposable `spikes/runner/` and isolated runner tests | Privileged app execution, production server secrets, Supabase schema | Immediately; security decision precedes runner integration |
| Track D — DB & auth planning | `supabase/` migrations and policy tests, isolated auth contract stubs | Shared Vercel config, live migrations, shared `src/pages/` | Shared auth/draft contracts agreed |
| Infrastructure owner | Vercel project settings, Git integration, remote Supabase migrations, OAuth configuration | Feature source code owned by other agents | Explicitly authorized access and reviewed change |

Only the infrastructure owner performs remote writes. **MCP authentication is not a per-agent security sandbox:** any agent inheriting the same Codex configuration may technically have powerful Vercel permissions. Restrict tool access by agent role where supported and enforce the no-remote-write rule through a single coordinator. Do not embed provider tokens in agent prompts.

### Shared contracts to freeze before fan-out

Minimal types, agreed in a brief coordination pass, not an over-engineered abstraction layer:

- `ChallengeSummary` / `ChallengeDefinition`, `ChallengeCase`, stable IDs and challenge version.
- `RunResult` status vocabulary and per-case result shape.
- `SolutionDraft` and `SolutionAttempt` ownership, version and evaluation-summary types.
- Public routes, responsibilities for repository paths, design tokens and dependency versions.

Create the contracts in one narrow coordinator-owned commit or share exact versioned definitions with each worktree. Agents propose changes through the coordinator; they do not independently edit the same shared types.

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
- Hosted inspection: configure a scoped read-only Codex MCP endpoint of the form `https://mcp.supabase.com/mcp?project_ref=PROJECT_REF&read_only=true` for the existing project. The actual reference is available through authorized Supabase management tools and the owner's local-only Prompt 00; do not add broad org-wide write access to every worker.
- Remote provisioning, OAuth changes, schema migrations and secrets: one infrastructure owner. GitHub OAuth client ID/secret and database password never enter source control, logs or prompts.
- Local RLS tests must cover anonymous and cross-user denial; don't treat client-side checks as security controls.

## Safety and QA checklist

- [ ] Agree on shared contracts and file-path ownership before spawning workers.
- [ ] Verify Codex Vercel MCP auth with a nonmutating project/documentation query; no project creation yet.
- [ ] Confirm Git worktrees can be created under independent directories, each tracking a dedicated feature branch.
- [ ] Pin Supabase CLI after app scaffold and validate Docker locally on Track D.
- [x] Create and verify the dedicated Supabase project (already completed by the owner).
- [ ] Configure Supabase scoped read-only MCP using the existing project's reference, then verify OAuth and read-only access.
- [ ] Integrate code via reviewed PRs; run required tests after each merge, not just in isolated worktrees.
- [ ] Reconcile implementation plans and local-only Codex prompts with parallel execution before launch.

**Stop condition:** Tooling configured, ownership and contracts reviewed, no unexpected cloud resources or billable operations created.
