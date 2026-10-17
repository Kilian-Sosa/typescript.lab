# Dedicated QuickJS Runner — Approved Architecture and Security Gates

**Status:** Architecture approved by owner, 2026-10-17. Technical feasibility and deployed security **not yet verified**; production execution remains blocked.

**Authority:** [Product specification](2026-10-16-typescript-lab-design.md) (REQ-03/04/12/13), [Shared Contracts v1](2026-10-16-shared-contracts-design.md), [ADR-0002](../../decisions/0002-challenges-and-execution.md), [original security spike](../../security/execution-spike.md). This focused architecture design supplements these, without changing learner-visible requirements.

**Spec impact:** Add focused security architecture spec. Preserve `shared/contracts/v1.ts` and the existing `RunResult` vocabulary. The initial spike rejected same-origin Workers, port-only isolation and client-reported trusted grading; its findings remain valid. Acceptance of an architecture is **not** verification of its security.

## Goal and deployment boundary

The main Vue SPA and the untrusted runner are **two independent static Vercel projects** connected to the same Git repository, with separate build roots/configuration. Proposed runner source: `apps/runner/`. No server endpoint runs learner code. No app session, Supabase key, OAuth state or privileged environment variable is installed in the runner project.

Initially prefer two unrelated, exact `*.vercel.app` project hostnames (which have a public-suffix isolation boundary), or separate registrable domains. A different port or a sibling subdomain that can receive parent-domain cookies is insufficient. A custom-domain migration needs a new cookie/site isolation review. Runner preview URLs and app preview URLs require **explicit matching allowlists**; avoid permissive wildcard parent/origin rules.

```text
Main Vue app (authenticated; private user state)
  - editor/source buffer, challenge definition, UI result state
  - verify runner origin + iframe source; reject stale revisions
     | exact-target postMessage, no token/cookie/secret
     v
Cross-site runner iframe (static, no auth)
  - sandboxed document, strict CSP, origin/source/schema validation
  - single-run supervisor, input bounds, watchdog and cancellation
     | typed messages; create/dispose one Worker per run
     v
Runner Web Worker (static, strict response CSP)
  - TypeScript syntax + semantic diagnostics and allowed-syntax check
  - transpile supported TS subset to JS
  - instantiate isolated QuickJS/WASM VM with bounded memory/stack
  - evaluate learner function against deterministic cases
  - compare bounded JSON results against canonical expectations outside VM
  - dispose all handles/VM/Worker, including on errors
```

The main app must never directly `eval` transpiled learner code. No privileged third-party code shares the untrusted Worker. If local TypeScript tooling processes source in a trusted renderer, enforce pre-parse input limits and do **not** execute the code; prefer keeping diagnostics/transpilation inside the runner Worker to reduce the main app's attack surface. Test the QuickJS-supported ECMAScript target and reject incompatible language features rather than silently claiming a pass.

## Trust and protocol

1. The parent pins **one expected runner origin** per environment, sends messages only to that target, verifies `event.origin`, `event.source === iframe.contentWindow`, a protocol version, a fresh run identifier/nonce and bounded schemas. The iframe verifies the corresponding parent origin and message source; no wildcard `targetOrigin` or `frame-ancestors`. Use an explicit ready/handshake and bounded startup timeout.
2. Input: exact current source text, `challengeId`/`challengeVersion`, `sourceRevision`/`runId` and only the minimum approved challenge fixtures. Public cases/expected values are not secrets, but learner code should receive **inputs only**, not the expected-output evaluator or reference solution. Validate case count, serialized shape and total size before use.
3. No auth token, session cookie, Supabase client, private draft/notes, persisted user ID or service credentials cross into the iframe/Worker. The runner has no analytics, third-party scripts or persistence. Suppress source in URLs, request logs, exceptions and telemetry.
4. Output: validated `RunResult` matching `shared/contracts/v1.ts`. Cases include honest per-case expected/actual diagnostics where representable. The parent rejects replies for inactive runs or older editor revisions and treats **all** runner messages as untrusted display data. Client-reported passes can be forged by a malicious user; they are **educational feedback**, not authoritative scoring.
5. Cancellation, compile error, runtime error, failed assertion, deadline, unsupported syntax and infrastructure failure have distinct behavior, with the `RunStatus` and `reason` vocabulary preserved. If the iframe crashes, fails to load, cannot establish its origin or returns an invalid message, report an infrastructure/policy error — **never fabricate success**.

## Execution containment

- Runner iframe must be cross-site, with a restrictive `sandbox`. Probe `allow-scripts` without `allow-same-origin` first; if the static supervisor cannot create a Worker in that mode, `allow-scripts allow-same-origin` is permitted **only** on the independently hosted runner site and must be verified against cookie, storage, parent DOM and navigation attacks. Do not use this combination for same-origin app content.
- Main app `frame-src` permits only the approved runner origin. Runner response `frame-ancestors` permits only approved main app origin(s). `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-src 'none'` on the runner, strict `script-src`/`worker-src`/`connect-src` and no unnecessary third-party code. Set restrictive policies on **both page and Worker responses**; a page CSP does not automatically constrain a separate Worker script. Permit same-origin fetch of static WASM bootstrap assets only if empirically required. Any `wasm-unsafe-eval` allowance belongs to the minimal static runner context, not the main app.
- The QuickJS host bridge passes only validated JSON-compatible inputs and receives bounded JSON-compatible results. No native browser objects/callbacks, arbitrary module loader, fetch, storage, timers, host console forwarding or dynamic dependency resolution are exposed. Review transitive dependencies, WASM assets, package license and supply-chain pin.
- A new Worker **and** new QuickJS runtime/context are created for each run; isolate test cases from each other if shared mutable globals affect determinism. Always dispose handles and terminate on success, fail, cancel or deadline. A supervisor that can still run after an infinite loop owns the timeout, not the untrusted VM.
- Initial tunable acceptance budgets (subject to spike evidence): source <= 32 KiB, serialized inputs <= 1 MiB, <= 100 cases, serialized output <= 64 KiB, QuickJS memory <= 32 MiB and max execution <= 2 s with an independent 3 s hard Worker deadline. Document tradeoffs for slow mobile devices. These are **application limits**, not guaranteed total browser process limits. Test CPU/memory growth and concurrent-run throttling before shipping.
- Only pure synchronous TypeScript algorithm functions supported for MVP. Explicitly reject `import`/`require`, dynamic imports, arbitrary dependencies, asynchronous APIs and unsupported VM features; distinguish a source-policy rejection from a compilation error. `transpileModule` alone must never be treated as semantic type-checking.

## Required proof before building Task 1/2

| Gate | Evidence required |
| --- | --- |
| Q1 — Real functionality | Pinned `quickjs-emscripten` executes approved `longest-window` canonical fixtures (ties/empty/nonpositive k/Unicode) on current learner source; semantic type error is caught and distinguished from runtime error |
| Q2 — Isolation | Tested VM code cannot access parent/runner DOM, cookies, app storage, Worker APIs, arbitrary network/imports or sensitive data through the bridge; dedicated **site**, not only port, demonstrated |
| Q3 — Run lifecycle | Infinite loops, expensive built-ins, memory pressure, oversized source/output, invalid JSON, repeated runs and cancellation return honest statuses; main UI stays responsive and Workers are disposed |
| Q4 — Messaging | Foreign origin/window, malformed/oversized messages, forged `passed`, stale revision, delayed/cancelled reply and handshake failure are rejected without trusted-success side effects |
| Q5 — Delivery security | Actual (preview) main/runner origins and TLS/cookie attributes validated; CSP headers for HTML and Worker, static WASM bootstrap, iframe sandbox and frame policies verified in supported browsers |
| Q6 — UX/compatibility | Worker/VM startup and typical runs usable at desktop/mobile; offline/network/cold-cache failures recover; browser compatibility and WASM availability constraints documented |

**Decision gate:** Do a focused, disposable feasibility spike first, with automated malicious fixtures and an honest go/no-go report. If Q1–Q4 fail, do **not** implement the production adapter. Q5 may require approved preview provisioning; without permission, mark Q5 **blocked** and do not declare the runner releasable. Passing a loopback spike is not a production security approval. If the design is impractical, present the reviewed external-playground fallback rather than weakening isolation.

## Dependency impact

- **M5 Notebook:** SQL RLS/immutable attempts, typed repository, auth UI, timelines, comparison, export and fresh retry can proceed independently. Save `untested` while there is no trustworthy current run. Only final live-result-to-attempt wiring and end-to-end run+submit checks wait for M3.
- **M6 Task 1:** reference algorithm stepper, spoiler gates, accessibility and keyboard controls do not depend on learner execution. It may proceed independently if one agent owns edits to the shared challenge page.
- **M6 Task 2:** release readiness and runner-specific editor/timeout/E2E/preview header checks **do** wait for the production runner, deployed-origin verification and M4/M5 integrations. No production release until those checks and owner approval.

All infrastructure writes, extra Vercel projects, DNS, OAuth changes and deployment remain separately owner-approved operations. Do not commit or publish local-only prompts under `docs/prompts/`.
