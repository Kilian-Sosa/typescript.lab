# ADR-0002: Portable challenge packages and untrusted code execution

**Status:** Accepted; runner architecture amendment approved by owner, 2026-10-17 — implementation and release still require security validation
**Date:** 2026-10-16

## Decision

Treat every challenge as a portable TypeScript package of content, typed cases, starter code, reference solution and tests. The website renders these files but does not own the educational content.

Suggested future layout:

```text
challenges/
  longest-window/
    README.md
    metadata.ts
    cases.ts
    starter.ts
    solution.ts
    solution.test.ts
    practice.test.ts
```

The portable `longest-window` challenge and its tests were implemented in the initial A–D wave.

## Execution approach

- Use Vitest for local and CI execution of deterministic challenge fixtures.
- Browser editing and `Run tests` require an **actual TypeScript execution pipeline**, with diagnostics and timeouts visible to the learner.
- **Approved architecture (2026-10-17):** host a dedicated, static, unauthenticated runner in a **separate browser site** from the main Vercel application. Embed its tightly sandboxed iframe in the Vue app; the iframe supervises a **fresh disposable Worker per run**, and the Worker hosts **QuickJS compiled to WebAssembly**. Transpiled learner JavaScript executes **only inside QuickJS**, never in the page, the browser's native JS realm or a privileged backend.
- The two sites should initially use distinct, independently isolated `.vercel.app` project hostnames, or separate registrable domains. A different port, a same-site subdomain with shared cookies, or two paths of one project is **not** the chosen boundary. Verify real cookie scopes and deployment headers rather than assuming isolation from hostnames.
- Do not expose DOM, fetch, storage, timers, arbitrary imports, host functions, credentials or secret challenge implementations to learner code via the QuickJS bridge. Use strict schema-validated, origin/source-bound `postMessage` communication, separate page/worker CSP, per-run lifecycle and bounded inputs/results.
- TypeScript semantic checking is separate from transpilation: `transpileModule` alone is **not** a typechecker. Report diagnostic failures as `compile-error`. Preserve the frozen `shared/contracts/v1.ts` result/status interface and reject stale editor revisions.
- QuickJS memory/stack/interrupt controls are defense-in-depth, **not** a complete execution limit; an independently responsive supervisor must terminate the Worker on timeout/cancellation. Browser memory/CPU controls are best-effort, not OS/container quotas.
- **Approval scope:** the owner has selected this architecture and authorized planning/a bounded feasibility spike, **not** declared it production-safe or approved hosted provisioning/deployment. Implement the runner only after the dedicated QuickJS/WASM browser spike and security review meet the explicit gates in the [runner design](../superpowers/specs/2026-10-17-dedicated-runner-design.md) and [runner plan](../superpowers/plans/2026-10-16-runner-security.md).
- A Web Worker alone does not provide a robust trust boundary for arbitrary hostile JavaScript. Never execute user code through `eval` / `new Function` in the main application window or as privileged server code.
- If secure self-hosted browser execution proves impractical, prefer an isolated trusted third-party playground for the first release rather than pretending a non-isolated runner is safe.

**Rejected approaches:** same-origin native Worker; same-host/different-port iframe; arbitrary learner JavaScript in a native Worker even on the dedicated site as the primary approved evaluator; and ad hoc server-side `eval`. See the [original security spike](../security/execution-spike.md) for the empirical cookie, network and forged-message findings.

## Result semantics

Cases must be evaluated against the learner's current source, not the reference implementation. Distinguish `passed`, `failed`, `compile-error`, `timeout`, `execution-error` and `not-run`. Report meaningful failure details without falsely implying public tests are secret.

Client-side passes are an educational convenience; they are not authoritative trusted scores for competitive/public ranking.

## Learning/Interview mode

Use the *same* challenge and suite. The modes change access to hints, historical submissions, topic cues, reference solutions and visualizations, not the underlying algorithm contract.

## Non-goals

No production deployment of arbitrary server-side JavaScript, no user-supplied npm dependencies, no unsupported languages, no AI evaluation, and no arbitrary shell commands in online exercises for MVP.
