# Implementation plans

These six scoped plans translate the approved [product specification](../specs/2026-10-16-typescript-lab-design.md) into test-first deliverables. They are the **public** source of truth for future implementation work.

| Milestone | Plan |
| --- | --- |
| M0.5 — Coordination and tools | [Parallel Agent Infrastructure](2026-10-16-parallel-agent-infrastructure.md) |
| M1 — Frontend and Vercel | [Foundation and Catalog](2026-10-16-foundation-and-catalog.md) |
| M2 — Challenges | [Portable Challenge Content](2026-10-16-challenge-content.md) |
| M3 — Untrusted code execution | [Isolated TypeScript Execution](2026-10-16-runner-security.md) |
| M4 — Supabase and drafts | [Authentication and Private Drafts](2026-10-16-auth-and-drafts.md) |
| M5 — Saved solutions | [Immutable Attempts and Notebook](2026-10-16-notebook-history.md) |
| M6 — Launch readiness | [Learning Visualization and MVP Release](2026-10-16-release-polish.md) |

Before implementing a plan, read [AGENTS.md](../../../AGENTS.md), the relevant ADRs, and the current [ROADMAP](../../../ROADMAP.md). Use Superpowers TDD, verification and SDD change tracing. Security, RLS, external service costs and production launch retain their approval gates.

**Current execution:** The owner selected [the initial A–D wave](2026-10-16-initial-parallel-wave.md) on 2026-10-16. Local frontend/content and persistence work are integrated on a feature branch. Runner production architecture, hosted authentication and deployment retain their separate gates. The [Shared Contracts v1 specification](../specs/2026-10-16-shared-contracts-design.md) remains unchanged.

**Local-only Codex prompts:** The repository owner's optional `docs/prompts/` folder is intentionally excluded from Git, GitHub and this documentation's relative-link validation. It is not needed to follow the public plans.
