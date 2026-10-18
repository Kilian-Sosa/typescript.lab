# M3 Task 1 — isolated static runner execution record

Date: 2026-10-18. Base: `main` fast-forwarded to `9bb5bba` after the owner requested pulling main and beginning Task 1. Work branch: `feat/isolated-quickjs-runner`.

**Spec impact: no spec change.** This implements the approved dedicated runner architecture, REQ-04, ADR-0002 and frozen Shared Contracts v1. The prior [correction validation](2026-10-18-m3-correction-validation.md) cleared the local prerequisite. No Vue, authentication, Notebook or shared-contract behavior changes. Accessible result presentation and current-editor integration remain Task 2 responsibilities.

## Implementation plan and execution decisions

1. Test protocol validation, canonical fixture ownership, disposal, cancellation, stale/replayed replies and single-Worker allocation.
2. Implement the static frame supervisor, typed Worker messages, restricted semantic TypeScript compiler and QuickJS evaluator.
3. Generate fail-closed origin configuration and separate page/Worker response policies with a static WASM build.
4. Exercise real built artifacts in Edge, rerun original/corrected security probes, run app regressions, and record limitations.

Ruling: execute only focused QuickJS plan Task 1; Task 2 and hosted Task 3 are separate. The owner’s request selects the existing approved design/plan; no new architecture approval is inferred. Work proceeds in the clean named feature branch in the supplied checkout, retaining installed tooling. No subagents or automatic review were launched under the owner’s cost policy.

Ruling: pin `longest-window@1.0.0` canonical cases in the supervisor. Parent requests contain current source and version metadata, not caller-supplied expectations. Expected outputs remain outside the Worker and learner VM. The internal wire schema is package-owned; shared result contracts remain unchanged.

Ruling: strict input validation silently ignores malformed/unauthorized parent messages without creating a Worker. Busy/exhausted sessions return policy errors; accepted IDs cannot replay, and lower revisions cannot execute. The parent adapter must time out startup and reject late editor results. Error suites expose aggregate diagnostics and unrun cases without reporting partial passes.

Ruling: initial deployable-origin validation permits only separate single-label HTTPS `vercel.app` sites. Other registrable domains await their cookie/site review. Local `app.test`/`runner.test` origins require the explicit build-only test switch. This does not claim deployed proof.

## Observed verification

- RED: the new runner suite first failed on missing modules, then with stub entry points produced 18 failing assertions/tests and two rejection tests passing. The implemented evaluator/supervisor passed the initial 20 tests. Further bounded-input, Worker failure, origin-policy and nonfinite-output checks bring the suite to **25 passing tests**.
- Strict runner TypeScript checking passed. A standalone build emitted HTML, a module Worker, static JS/WASM and Build Output API v3 response routes. It requires both exact origins; no hosted configuration was read or changed.
- Built-artifact Edge regression passed on separate local hosts: **14 canonical cases**; incorrect source assertions; semantic/syntax diagnostics; import rejection; learner exception; host API absence; infinite loop with responsive parent; oversized output; stack/memory pressure; cancellation and recovery.
- An intercepted Worker response containing an unresponsive native loop exercised the actual supervisor’s independent **3-second watchdog**, without a product-protocol limit bypass. A separate trusted Worker probe verified that Worker response CSP blocks cross-origin network and nested Worker loading. The page CSP separately blocked its network probe. App cookie/storage/DOM canaries were inaccessible to the frame. Final browser accounting: **16 created / 16 terminated, zero active, peak one** (including the test CSP probe); **10 WASM requests** in this synthetic run.
- Original six browser probes and corrected QuickJS feasibility test: **7 passing Node tests**. Historical port-only/opaque limitations remain recorded in the original reports.
- Final verification: **25 runner tests**, **153 application tests**, the built-artifact Edge regression, runner strict typecheck/package build, app strict typecheck/build and `git diff --check` passed. The separate original/corrected browser probes passed **7 Node tests**.

The final static build produced an approximately **3.53 MB uncompressed entry Worker**, including TypeScript. The pinned upstream umbrella package emitted four WASM variants (roughly 0.50–1.51 MB each); runtime explicitly selects release synchronous WASM. Unused variant artifacts remain a delivery-size limitation, not extra learner capabilities. The final local browser suite took about eight seconds; that is not a remote/mobile startup benchmark.

Commands use the installed Node entry points when Corepack cannot download pnpm. The runner has its own pinned package and lockfile; the root manifest/lockfile and frozen shared contracts are unchanged. CI now verifies the runner package and synthetic browser suite alongside the existing app checks. The local browser test needs Edge outside the Windows sandbox when temporary SiteList replacement is denied; that exact bounded rerun passed with approval. No browser install/cache reset or global environment change was used.

## Gate outcome

**Author verification completed; the subsequent independent-review P2 is now corrected and closed.** See the [focused correction and reassessment](2026-10-18-m3-json-boundary-correction.md), which clears local Task 1/Task 2 prerequisite only. Historical initial review outcome: The [new implementation review](2026-10-18-m3-task1-independent-review.md) found a P2 JSON-boundary defect: serialization hooks/getters can normalize unsupported values after validation. Earlier non-JSON rejection evidence covers tested direct-value paths, not these bypasses. Task 1 was initially **NO-GO as the Task 2 prerequisite** until that remediation and reassessment; production execution remains **NO-GO**. Task 2 still needs the parent adapter and accessible results; Task 3 still needs separately authorized hosted HTTPS/site/cookie/CSP/WASM verification. Remaining Q6 mobile/cold-cache/offline/cross-browser work is incomplete. Browser passes remain non-authoritative educational feedback.

Resource caps, unsupported source features, wire messages and local build instructions are documented in [apps/runner/README.md](../../apps/runner/README.md). No hosted resources, billing, DNS, OAuth settings, production execution, pushes or merges were performed.

## Commit and independent review handoff

The owner requested a bounded Task 1 commit and a new independent security review on 2026-10-18. The implementation, tests, CI checks and this execution record were committed together in `7f4164e` as `feat(runner): add isolated QuickJS evaluator`. The prior M3 review applies to spike corrections only and is not approval of this implementation. A fresh read-only GPT-6.1 Sol Medium security reviewer inspected this commit and returned the [P2 blocker recorded separately](2026-10-18-m3-task1-independent-review.md). Hosted and production gates remain closed regardless of local test results.
