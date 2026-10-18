# Implementation plans

These six scoped plans translate the approved [product specification](../specs/2026-10-16-typescript-lab-design.md) into test-first deliverables. They are the **public** source of truth for future implementation work.

| Milestone | Plan |
| --- | --- |
| M0.5 — Coordination and tools | [Parallel Agent Infrastructure](2026-10-16-parallel-agent-infrastructure.md) |
| M1 — Frontend and Vercel | [Foundation and Catalog](2026-10-16-foundation-and-catalog.md) |
| M2 — Challenges | [Portable Challenge Content](2026-10-16-challenge-content.md) |
| M3 — Untrusted code execution | [Isolated TypeScript Execution](2026-10-16-runner-security.md) |
| M3 — Approved QuickJS implementation | [Dedicated cross-site runner](2026-10-17-quickjs-runner-implementation.md) |
| M4 — Supabase and drafts | [Authentication and Private Drafts](2026-10-16-auth-and-drafts.md) |
| M4 — Frontend recovery | [Authentication, autosave and recovery execution](2026-10-17-m4-frontend-recovery.md) |
| Preview preparation | [Separate app and runner approval packages](2026-10-17-preview-preparation.md) |
| M5 — Saved solutions | [Immutable Attempts and Notebook](2026-10-16-notebook-history.md) |
| M6 — Launch readiness | [Learning Visualization and MVP Release](2026-10-16-release-polish.md) |
| Current parallel wave | [Runner, Notebook and Reference Visualizer](2026-10-17-runner-notebook-visualizer-wave.md) |

Before implementing a plan, read [AGENTS.md](../../../AGENTS.md), the relevant ADRs, and the current [ROADMAP](../../../ROADMAP.md). Use Superpowers TDD, verification and SDD change tracing. Security, RLS, external service costs and production launch retain their approval gates.

**Current execution:** The initial waves delivered Notebook and reference visualization. Hosted schema/RLS and the original GitHub session flow were verified on 2026-10-17. [M4 frontend recovery](2026-10-17-m4-frontend-recovery.md) is implemented and locally verified on 2026-10-18. Runner corrections require independent validation; live PKCE acceptance and both deployments retain separate gates. The [Shared Contracts v1 specification](../specs/2026-10-16-shared-contracts-design.md) remains unchanged.

**Runner decision (2026-10-17):** dedicated cross-site Vercel runner + sandboxed iframe + disposable Worker + QuickJS/WASM is approved **as an architecture**. The [focused design](../specs/2026-10-17-dedicated-runner-design.md) requires new VM/cross-site feasibility evidence before production code and deployed-origin verification before release. M5 Notebook and M6 reference visualization may proceed in parallel, with shared-page file ownership and final integration gates preserved.

**Local-only Codex prompts:** The repository owner's optional `docs/prompts/` folder is intentionally excluded from Git, GitHub and this documentation's relative-link validation. It is not needed to follow the public plans.
