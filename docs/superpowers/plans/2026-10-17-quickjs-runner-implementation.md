# Dedicated QuickJS/WASM Runner Implementation Plan

> **Codex:** Use Superpowers test-driven-development, scoped plan execution and verification-before-completion. The owner approved the architecture, **not** a production deployment or a security bypass.

**Goal:** Evaluate a learner's *current* TypeScript source against real versioned cases using a separately hosted QuickJS/WebAssembly VM, with honest results, cancellation and isolation.

**Architecture:** A second static Vercel runner project, sourced from `apps/runner/`, is embedded via a cross-site sandboxed iframe. Its trusted supervisor creates a new Worker per run; only the Worker instantiates a new QuickJS/WASM VM and evaluates the learner source. No server functions or browser-native `eval` execute the source.

**Tech stack:** TypeScript semantic checker, pinned `quickjs-emscripten` (exact version selected only after compatibility/license verification), WebAssembly, Workers, Vue integration, Vitest and Playwright.

**Spec:** [Approved runner architecture](../specs/2026-10-17-dedicated-runner-design.md), [REQ-03/04/12/13](../specs/2026-10-16-typescript-lab-design.md), [Shared Contracts v1](../specs/2026-10-16-shared-contracts-design.md), [ADR-0002](../../decisions/0002-challenges-and-execution.md), and [original security spike](../../security/execution-spike.md).

**Status:** Architecture approved 2026-10-17. The [original independent review](../../security/2026-10-17-independent-m3-review.md) identified incomplete Q4 validation and aggregate Worker use. Both corrections, including a follow-up sparse-array blocker, [passed independent reassessment on 2026-10-18](../../security/2026-10-18-m3-correction-validation.md). **Task 1 committed in `7f4164e`; independent review found a P2 JSON-boundary blocker. NO-GO for Task 1 clearance/Task 2 prerequisite until remediation and reassessment.** See the [implementation review](../../security/2026-10-18-m3-task1-independent-review.md) and [execution record](../../security/2026-10-18-m3-task1-runner.md). Q5 deployed proof remains blocked, Q6 partial, and production execution disabled. Tasks 2–3 remain unimplemented; remote Vercel changes require separate owner authorization.

**Ownership:** Runner agent owns `spikes/runner/` and, after a technical go, `apps/runner/`. Coordinator owns root tooling, `shared/contracts/` and Vue integration ownership. Never modify another agent's active `ChallengePage.vue` files; freeze v1 types unless coordinator explicitly approves a version change.

## Review Focus

1. Learner JavaScript executes only inside QuickJS/WASM and cannot reach browser-native APIs through the host bridge.
2. A **separate site** (not merely a separate port) and restrictive page/Worker CSP isolate cookies, storage, network and DOM.
3. Forged/replayed/cross-origin/stale messages cannot create trusted passes or overwrite newer editor results.
4. TypeScript semantic/syntax errors differ from assertion failures, runtime errors and timeouts.
5. Endless loops, expensive built-ins, oversized payloads, cancellation and repeated attempts cannot hang the main UI.
6. No hosted provisioning, secrets, project configuration, cost or deployment without independent owner consent.

## Task 0A — QuickJS compatibility and VM feasibility (mandatory first)

**Files:** `spikes/runner/` probes/tests and a companion report under `docs/security/`. Preserve the original spike evidence.

- [x] Check `quickjs-emscripten` API, license, maintenance, actual VM memory/interrupt capabilities and browser bundle constraints. Pin a tested version; do not invent a pin.
- [x] Red tests first for `longest-window` cases (tie/empty/k<=0/Unicode), learner runtime errors, type mismatch (requiring semantic TS diagnostics), syntax errors and banned import/dependency syntax.
- [x] Minimal Worker+QuickJS runtime: source is data until evaluated by QuickJS; bridge only bounded JSON inputs/results, not browser objects/functions; never expose reference solutions or expected outcomes inside the learner VM.
- [x] Verify independent Worker disposal on completion, timeout, cancellation and failure; include infinite loops and expensive built-ins that VM interrupt hooks might miss. Test memory, stack, repeated runs, output bounds and cleanup.
- [x] Adversarial `postMessage` and invalid-payload tests; preserve source `runId`/`sourceRevision` and distinguish infra vs policy failures.
- [x] Re-run original 6 security probes and new compatibility tests. Record actual evidence and **STOP** for owner/coordinator security review before production Task 1.

## Task 0B — Cross-site iframe/CSP feasibility

- [x] Build an isolated local two-site fixture, but state clearly that port isolation is **not** real cookie/site verification.
- [ ] Try opaque iframe `sandbox="allow-scripts"` first. Only if it cannot bootstrap a Worker, test `allow-scripts allow-same-origin` **on a separately hosted site**; never put untrusted code in that page's native JS realm.
  - Local opaque Worker bootstrap failed; separate `app.test`/`runner.test` hosts passed. Actual hosted-site proof remains blocked and is not represented as complete.
- [x] Test exact `frame-ancestors`/`frame-src`, `event.origin`+`source` validation, nonce/run protocol, restricted Worker script headers, static WASM bootstrap and no unnecessary network access.
- [ ] Test malformed messages, forged `passed`, infinite loop, iframe/Worker crashes, stale revisions, repeated and simultaneous runs, slow/cold loads, mobile browsers where available.
- [x] Prepare real-preview TLS/cookie/site/CSP header verification. If provisioning is not authorized, **mark deployed-origin proof blocked**; do not create/link a second Vercel project.
- [x] Report security **go/no-go**, residual risks, measured performance and fallback. If feasibility fails, keep learner execution disabled; no native-JS downgrade.

## Task 1 — Isolated static runner (only after technical go)

**Files:** `apps/runner/` independent static site, iframe supervisor, typed messages, Worker evaluator, CSP/header deployment config and tests. No Vue edits.

- [x] Red tests for wrong origin/source/nonce, malformed/oversized payloads, forged `passed`, stale/cancelled run, blocked module/network, typecheck/runtime/assertion/timeout and worker disposal.
- [x] Implement the minimum validated protocol and static WASM bundle. TypeScript semantic diagnostics and transpilation target are explicit; evaluator checks *current learner source* against canonical cases outside the VM.
- [x] Use one Worker+VM per run, bounded source/input/case count/output/stack/memory and independent hard watchdog; no secrets, third-party scripts, analytics, persistent state or unsafe host bridges.
- [ ] Complete adversarial verification and independent reassessment. Existing tests/build/local headers pass, but review found unsupported values can be rewritten during JSON serialization. Add focused regressions and correct this boundary before Task 1 clearance. Caps and unsupported features are documented.

## Task 2 — Vue editor/result integration (coordinator-controlled)

**Files:** `src/features/runner/` adapter/editor/results/tests and narrow `src/pages/ChallengePage.vue` changes, **only** after the Challenge page writer releases ownership.

- [ ] Red tests: exact editor buffer, semantic compile-error, unsupported import, failed/passed cases, runtime error, timeout/cancel, stale result discard and recoverable iframe failure.
- [ ] Embed cross-site iframe and use versioned `RunResult` unchanged. Pin allowed runner origin; no tokens, drafts, user IDs or secrets in messages. Lazy-load editor and compiler assets.
- [ ] Render accessible, honest test feedback; preserve local buffer/Interview Mode and avoid depicting the example demonstrator as actual user-code execution.
- [ ] Run unit/typecheck/build, E2E desktop/mobile/keyboard, and all security probes.

## Task 3 — Deployed preview verification and final gate

- [ ] **After separate owner authorization**, connect/provision second Vercel static project and test exact independently isolated main/runner preview sites. No DNS, billing or OAuth changes by default.
- [ ] Verify actual HTTPS, cookie domain behavior, iframe flags, CSP HTML **and Worker responses**, WASM asset behavior, window/message origin checks, storage/network boundaries and browser compatibility.
- [ ] Retest fake passes, cross-site requests, resource abuse, cancellation and cleanup against actual deployed previews; record evidence in `docs/security/`.
- [ ] If any essential isolation/header gate fails or cannot be checked, **NO-GO** for production Run Tests. Request separate owner authorization before enabling production or tagging release.

## What may run concurrently

- **M5 Notebook:** typed repository, immutable history, notes, compare, export, retry, private auth UI and RLS can proceed without runner; persist `untested` if no current-source verified evaluation. Final run+submit adapter/E2E waits for Task 2.
- **M6 Task 1:** reference algorithm stepper, hints/spoiler gates, keyboard and text alternatives can proceed; coordinate shared page edits. It must not pretend to trace learner code.
- **M6 Task 2:** non-runner accessibility/responsiveness QA may start, but runner-dependent E2E, deployed-origin verification and the *overall MVP release* wait for M3 and hosted M4/M5 integration.

**Handoff:** changed files, spec impact, observed failing→passing commands/results, browser/security evidence and limitations, resource costs, STOP/GO decision and next gate. **Do not push, merge, provision or deploy without separate instruction.**
