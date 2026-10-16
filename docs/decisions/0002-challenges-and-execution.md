# ADR-0002: Portable challenge packages and untrusted code execution

**Status:** Accepted by owner, 2026-10-16 — runner release still requires security validation
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

The documentation is a proposed contract, not a claim that these files already exist.

## Execution approach

- Use Vitest for local and CI execution of deterministic challenge fixtures.
- Browser editing and `Run tests` require an **actual TypeScript execution pipeline**, with diagnostics and timeouts visible to the learner.
- A constrained browser-side runner is preferred for the first vertical slice, but *must* be validated with a small security spike before implementation. Investigate bundling/transpilation, module allowlists, isolated-origin execution, worker termination and timeouts.
- A Web Worker alone does not provide a robust trust boundary for arbitrary hostile JavaScript. Never execute user code through `eval` / `new Function` in the main application window or as privileged server code.
- If secure self-hosted browser execution proves impractical, prefer an isolated trusted third-party playground for the first release rather than pretending a non-isolated runner is safe.

## Result semantics

Cases must be evaluated against the learner's current source, not the reference implementation. Distinguish `passed`, `failed`, `compile-error`, `timeout`, `execution-error` and `not-run`. Report meaningful failure details without falsely implying public tests are secret.

Client-side passes are an educational convenience; they are not authoritative trusted scores for competitive/public ranking.

## Learning/Interview mode

Use the *same* challenge and suite. The modes change access to hints, historical submissions, topic cues, reference solutions and visualizations, not the underlying algorithm contract.

## Non-goals

No production deployment of arbitrary server-side JavaScript, no user-supplied npm dependencies, no unsupported languages, no AI evaluation, and no arbitrary shell commands in online exercises for MVP.
