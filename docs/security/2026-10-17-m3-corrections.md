# M3 security corrections

**Scope:** focused corrections to the local runner feasibility spike following the independent M3 review. This does not implement or enable the production learner runner.

**Spec impact: no spec change.** These corrections restore the approved result-validation, completion, and single-active-run invariants in the runner design and execution ADR. They do not change learner-visible behavior or the frozen shared contracts.

## Corrections

- The app-side supervisor now registers each pending run with its nonce, protocol version, contract/challenge identity and versions, source revision, and complete expected case list. It accepts an active result only when the bounded envelope and every case match that registration, in order, with consistent status, diagnostics, and JSON-safe values. A valid result retires the pending run; an invalid active result becomes a generic infrastructure error and retires it. Replays and replies after cancellation are ignored.
- The app-side validator now requires dense own indices in result cases and diagnostics. Nested JSON arrays also require dense indices, and JSON equality uses an explicit dense-array loop rather than `Array.prototype.every`.
- The parent and runner frame now complete a nonce-bound ready/challenge-ack handshake before runs or cancellation are accepted. The parent times out and fails closed if the handshake is missing or invalid.
- The runner frame now permits at most one active Worker. Concurrent requests receive bounded busy/policy-rejected results; the active run is cleaned up before later recovery. Burst evidence records the maximum active Worker count.

## Verification evidence

Before the corrections, the regression probes reproduced both reviewed gaps. The active-result probes accepted malformed, empty, partial, duplicate, oversized, and wrong-version results; a replay could be accepted again; cancellation did not retire the pending run; and results were still accepted without a valid handshake. The burst probe reported `singleActiveWorkerBurstBounded=false` and created multiple Workers for the burst.

The follow-up sparse-array regression recreated holes inside the browser before `postMessage`, then exercised the matching active-run handler after structured cloning. Before the dense-array correction, sparse `result.cases` and `result.diagnostics` were accepted; the nested sparse JSON probe was already rejected by the explicit own-index validation.

The sparse regression run before the fix exited 1 at `activeSparseCasesRejected` (`false !== true`). Its browser evidence showed the holes in `cases` and `diagnostics` survived structured cloning, and both results were accepted. After the fix, the same evidence records all three sparse holes preserved and all three results rejected.

After the corrections:

- `node --test spikes/runner/quickjs-browser.test.mjs` — **1 passed, 0 failed**. The Q4 evidence reports true for malformed, empty, partial, duplicate, sparse, oversized, wrong-version, replay, post-cancel, and missing/invalid-handshake rejection. Evidence confirms the sparse holes survived structured cloning and all three sparse-array cases were rejected with pending runs retired. The burst created exactly one Worker, returned seven busy rejections, reached `maxActiveWorkers=1`, disposed all Workers, and recovered with a subsequent bounded run.
- `node --test spikes/runner/probe.test.mjs` — **6 passed, 0 failed**. The existing origin-isolation and browser-probe checks remain green.
- `node --check` on `quickjs-harness.mjs`, `runner-frame.mjs`, `quickjs-browser.test.mjs`, and `probe.test.mjs` — passed.
- `git diff --check` — passed.

The local QuickJS/browser test used the already-installed workspace modules through test-only environment aliases because the spike's offline dependency install was unavailable. Edge required a narrowly escalated local launch after the sandbox could not write its temporary SiteList files. No hosted resources or credentials were used; generated evidence stays under the ignored `spikes/runner/.artifacts/` directory.

## Remaining gates

The [independent reassessment on 2026-10-18](2026-10-18-m3-correction-validation.md) closes both original local findings and the sparse-array follow-up: GO for the local prerequisite to Task 1 only. Task 1 remains unimplemented. Hosted Q5 proof of the deployed runner origin, TLS, cookies, CSP and iframe isolation, remaining Q6 checks, hosted approval and learner-execution enablement remain outstanding. This local evidence does not authorize a deployment or production activation.
