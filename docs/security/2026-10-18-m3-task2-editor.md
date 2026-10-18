# M3 Task 2 — current editor and isolated runner integration

Date: 2026-10-18. Branch: `feat/isolated-quickjs-runner`; clean at task start. The owner requested Task 2 after the [Task 1 JSON-boundary correction](2026-10-18-m3-json-boundary-correction.md) cleared its local prerequisite.

**Spec impact: no spec change.** Implements REQ-03/04/12/13, the [approved dedicated runner design](../superpowers/specs/2026-10-17-dedicated-runner-design.md), ADR-0002 and [Shared Contracts v1](../superpowers/specs/2026-10-16-shared-contracts-design.md). Frozen interfaces, canonical cases and approved product semantics are unchanged.

## Scoped plan and decisions

1. Add adapter regressions for the exact buffer/context, bound handshake, malformed and forged results, cancellation, deadlines and cleanup.
2. Connect the existing draft editor to run controls, increment source revision on every buffer change, discard stale replies and retain Interview Mode behavior.
3. Render accessible, distinct result states and canonical per-case details; preserve focus and enable recovery.
4. Run unit/typecheck/build, real iframe desktop/mobile/keyboard checks and security probes; retain hosted and production gates.

Ruling: the actual editor is owned by `DraftWorkspace.vue`, already mounted by `ChallengePage.vue`. Integrate there rather than duplicating editor state in the page. Local/remote recovery, fresh retries and account changes flow through the same buffer. No simultaneous writer or delegated agent was launched. Challenge-page tests and the real browser flow cover the integration.

Ruling: execute the existing approved plan inline on its named feature branch, using PowerShell and the execution record for the scoped ledger. Do not run Bash bookkeeping or automatically commit, launch an independent reviewer, push, merge or deploy. The owner's review/routing policy takes precedence over optional workflow review delegation. These changes remain uncommitted for review.

Ruling: a fresh iframe session owns each run. Its new nonce/window, listener, startup deadline and result deadline are removed on completion/cancellation/failure. This bounds session lifetime and makes retry independent of a failed frame. Source, challenge/version and account-generation changes invalidate the run immediately, including change-away-and-back edits. Mode switching preserves the buffer and does not invalidate identical source.

Ruling: allow local execution only with Vite development mode, `VITE_ENABLE_LOCAL_RUNNER=1`, an exact `http://runner.test:<port>` origin and `http://app.test:<port>` parent. No same-site, arbitrary URL or hosted origin is accepted by this activation gate. Production builds always keep execution disabled. Hosted preview activation requires Task 3 verification and a separately reviewed activation change; environment variables alone cannot enable production execution.

Ruling: Notebook saving retains its existing explicit `untested` evaluation. Attaching current run summaries to immutable submissions is a separate M5 integration concern, outside this editor/result task. Running tests does not claim to save an evaluation or an attempt.

## Validation boundary

- Pin source/reply identity to run ID, source revision, challenge ID/version, exact frame window, exact runner origin, protocol and per-session nonce. Use targeted `postMessage`, never wildcard destinations.
- Send only current source and run metadata. No credentials, account IDs, repository/session objects, notes, saved drafts or reference solutions cross this boundary. The trusted runner already owns versioned fixtures.
- Validate bounded plain JSON, dense arrays, finite numbers, exact envelope/result/case fields, contract version, terminal statuses, reasons and bounded diagnostics before displaying a result.
- A pass/fail needs all 14 canonical case IDs in order, canonical expected values and actual values consistent with every case status and aggregate status. Empty/partial/duplicate/sparse suites, forged status/actual pairs, nonfinite values, oversize data and extra fields fail closed. Non-evaluated results contain only `not-run` cases and explanatory diagnostics.
- Ignore foreign/old contexts; fail the active run on malformed matching replies. Missing ready/ack/results and frame load errors become recoverable infrastructure failures. The app-side watchdog never labels a lost reply as a learner timeout; learner timeout comes from the isolated supervisor.
- Compile, policy, runtime, timeout, cancellation and infrastructure failures have distinct text. Vue escapes diagnostic/actual text. A polite atomic live status announces updates without moving focus; native text input and buttons support keyboard use. Run remains focusable with `aria-disabled` while its handler prevents duplicate runs. Explicit cancellation returns focus from the disappearing Cancel button to Run; editing does not move focus.

The editor/adapter are in the existing lazy challenge-route chunk. Compiler and QuickJS assets load only inside the iframe Worker. The app never imports the evaluator/compiler or executes learner JavaScript. Browser results remain educational feedback; a malicious user can forge their own browser state and cannot obtain an authoritative grade from these results.

## Verification evidence

- Adapter regressions initially failed because the adapter did not exist. UI regressions likewise preceded the new components. Additional red-to-green checks caught HTTP-local `randomUUID` availability and disabled-Run focus loss. The actual browser first exposed focus loss; the fix uses `aria-disabled` with duplicate-run protection.
- App: `node node_modules/vitest/vitest.mjs run` — **186 tests passed**; `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` and `node node_modules/vite/bin/vite.js build` passed. Editor/result checks cover exact text, all result states, source edits/restoration, retry, cancel, account reset and unmount.
- Runner: installed pinned Vitest from `apps/runner` — **42 tests passed**. `node --test apps/runner/tests/browser.test.mjs` passed with **20 Workers created/terminated, 0 active, maximum 1** and static WASM/header checks.
- `node --test scripts/check-runner-local.mjs` — actual Vue app plus built runner, desktop 1280×900 and mobile 390×844, passed. Exercises canonical pass, wrong answer, semantic compile error, forbidden import, runtime exception, infinite loop, cancel and focus restoration, source invalidation, mode preservation, blocked iframe/retry, an actual protocol-speaking forged empty-suite pass, keyboard focus and no page overflow. Screenshots: ignored `output/playwright/m3-task2-{1280,390}.png`. The final run took about 47 seconds across both viewports and deliberate unavailable-frame waits; it is not a per-run latency benchmark.
- Existing navigation/visualizer browser regression — **22 passed**, with unchanged assertions/deadlines on a verified warm local Vite server and two workers. The initial sandbox invocation stalled; the first outside-sandbox run with eight workers timed out during navigation. A targeted response check returned HTTP 200 in about 150 ms before the successful bounded rerun. Tests/timeouts and caches were not reset or weakened.
- Original six security probes plus corrected QuickJS feasibility browser probe — **7 passed**. The legacy probes need process-only `LAB_RUNNER_PLAYWRIGHT_MODULE` and `LAB_RUNNER_TYPESCRIPT_MODULE` set to the installed root package directories. Sandboxed Edge failed replacing temporary SiteList files; the exact approved outside-sandbox rerun passed. No browser installation or global configuration change was needed.

The actual-app fixture uses separate `.test` hostnames mapped only in its browser process. HTTP origins are marked trustworthy only in that test browser because existing draft recovery uses secure-context APIs. This is local cross-site execution evidence, **not TLS or deployed-site proof**. Tests close their browser and servers. CI now includes the actual-app fixture with installed Chromium, but that remote CI run has not occurred in this session.

## Requirement-to-implementation check and gate

REQ-04 and the runner plan map to adapter identity/schema checks, source-revision invalidation, actual Worker execution and the distinct feedback tests. REQ-03 maps to unchanged spoiler gates and mode/buffer browser checks. Isolation requirements map to the existing supervisor/VM and rerun security probes; no production execution path was added. Changed behavior maps back to these approved requirements; no new shared contract or requirement was introduced.

Local Task 2 is implemented and author-verified. No independent Task 2 security review was requested or performed. Q5 hosted HTTPS/cookie/CSP/header proof and wider browser/device coverage remain outstanding. **Production execution remains NO-GO.** Task 3 needs separate owner authorization before any hosted resource or deployment action. No hosted resources, auth settings, DNS, billing, secrets or Production deployments were changed.
