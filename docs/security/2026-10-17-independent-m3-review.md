# Independent M3 security review

**Date/baseline:** 2026-10-17, `feat/runner-notebook-visualizer` at `e984876`; runner files unchanged by the later test-fixture fix. Independent read-only GPT-6.1 Sol Medium security reviewer, explicitly requested by the owner. The coordinator checked the cited handler, supervisor and accepted gate before recording this report.

**Decision: current NO-GO for production runner implementation.** No critical/high VM escape was found and no architecture redesign is required. Conditional GO for bounded implementation follows closure of the Q4 validation/proof gap below. Deployment and production execution retain separate gates.

**Spec impact: no spec change.** Corrections enforce the [approved design](../superpowers/specs/2026-10-17-dedicated-runner-design.md), [Shared Contracts v1](../superpowers/specs/2026-10-16-shared-contracts-design.md) and REQ-04/12/13. The explicit Q1–Q4 gate cannot be cleared by incomplete Q4 evidence.

## Findings

### Medium: incomplete active-run result validation

The actual synthetic-app message handler in [quickjs-harness.mjs](../../spikes/runner/quickjs-harness.mjs), lines 117–126, checks origin, frame source, pending nonce, run ID and revision. It omits protocol/contract versions, challenge identity/version, result schema, complete nonempty case suite and output bounds. Executing that handler in a Node VM accepted a matching-active-run envelope with `protocol: 999`, wrong challenge/version and `passed` with `cases: []`.

The forged-pass test at lines 563–595 uses an unregistered nonce, so its rejection does not prove validation for an active run. The original Q4 pass overstates the evidence.

**Precondition/impact:** malformed or compromised runner output, or trusted fixture instrumentation, can yield unreliable displayed results. No learner-to-native messaging bridge or account compromise was demonstrated. Browser feedback remains non-authoritative.

**Required before Task 1/2:** validate the full bounded result against pending challenge/case metadata; retire completed/cancelled pending entries. Test matching-active-run malformed/empty/partial/duplicate/oversized suites, wrong protocol/contract/challenge versions, duplicate/replayed replies, replies after cancellation and missing/invalid handshake. Invalid messages must fail honestly without success side effects.

### Medium: unbounded aggregate concurrent Worker use

[runner-frame.mjs](../../spikes/runner/runner-frame.mjs), lines 192–214, rejects duplicate keys but creates Workers for all distinct runs. Each loads compiler/QuickJS assets; a 32 MiB VM cap does not cover compiler, WASM and browser overhead. The harness concurrency test at line 493 demonstrates two simultaneous Workers rather than throttling.

**Precondition/impact:** repeated parent requests, including UI scheduling bugs or local user actions, can exhaust browser resources despite individual deadlines. Learner VM code cannot create these requests.

**Required before shipping:** a single-active-run supervisor using cancel/replace or busy rejection, with burst tests proving maximum active Workers, cleanup and bounded recovery. This can be built within the approved design once the Q4 prerequisite passes.

## Containment and opaque-origin assessment

- Learner evaluation occurs only in QuickJS/WASM; no native callbacks/objects are installed. JSON helpers are captured before evaluation, and expected values are removed from VM inputs.
- Semantic checking precedes transpilation; imports/async syntax are rejected. Synthetic declarations deliberately cover less than the full TypeScript standard library.
- Memory/stack/interrupt controls, output caps and an independent three-second watchdog exist; handles, contexts, runtime and Workers are disposed. These are application budgets, not total browser-process quotas.
- Separate page/Worker CSP excludes native-JavaScript `unsafe-eval`; same-origin static WASM bootstrap access remains permitted. Dependency pins and lockfile integrity are controls, not vulnerability-absence proof.
- The opaque `allow-scripts` attempt produced a null origin, failed exact-target messaging and failed Worker bootstrap. The approved fallback permits `allow-scripts allow-same-origin` only on an independently hosted runner site. The local `app.test`/`runner.test` test is consistent with that decision; app-origin content must never use this fallback.

## Verification and remaining gates

The reviewer read the actual harness, Worker, supervisor, HTML, Vite config, browser test and original probe fixture, plus the design, ADR-0002, contracts and reports.

- QuickJS browser suite: **1/1 passed**, 11.06 seconds for the test.
- Original isolation probes: **6/6 passed**, 1.93 seconds.
- Actual-handler Node VM reproduction: malformed active-run result **accepted**.
- Sandbox Edge launch failed; execution outside the sandbox passed. No production-code or cloud changes were made by the review.

The existing green tests do not close these findings. Correct Q4 proof and update the feasibility record before implementation. Production still requires tested single-run lifecycle/adapter behavior, removal of fixture-only controls, separately authorized two-site HTTPS/cookie/storage/DOM/navigation isolation, actual HTML **and Worker** CSP/WASM verification, browser/mobile/cold-cache/offline checks and owner enablement approval. QuickJS/WASM/browser defects, compromised dependencies and best-effort browser quotas remain residual risks. This is a focused technical review, not a formal proof or full dependency audit.
