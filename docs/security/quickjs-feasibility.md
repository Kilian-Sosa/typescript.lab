# QuickJS feasibility spike — M3 Tasks 0A/0B

**Decision: local prerequisite GO for M3 Task 1; production execution remains NO-GO.** The [original review](2026-10-17-independent-m3-review.md) identified incomplete Q4 validation and unbounded aggregate Worker use. Both corrections, including the later sparse-array regression, [passed independent reassessment on 2026-10-18](2026-10-18-m3-correction-validation.md). Preserve the separately authorized deployed-site, Q6 and production-enablement gates. The measurements below describe the original feasibility run unless explicitly updated.

**Spec impact: no spec change.** This is the feasibility investigation required by the [approved runner plan](../superpowers/plans/2026-10-17-quickjs-runner-implementation.md). It changes no product behavior, approved requirements, or frozen shared contracts. The spike follows the [dedicated runner design](../superpowers/specs/2026-10-17-dedicated-runner-design.md) and leaves the historical [security investigation](execution-spike.md) intact.

## What was tested

The disposable harness builds and serves a static Vite runner fixture on a separate local host from the synthetic app, then launches Microsoft Edge and exercises the current longestWindow TypeScript source against the canonical fixtures. A disposable Web Worker owns QuickJS/WASM and creates a runtime for each run, with a fresh context per case. No learner code runs in the app page, the iframe’s native JavaScript realm, or a privileged backend.

QuickJS is pinned exactly to 0.32.0; the package reports an MIT license. This pin was selected after checking the package and license and validating the browser/Vite build locally. The runner implementation and API documentation describe the runtime memory, stack, and interrupt controls used by the spike; those controls supplement the external Worker watchdog and do not establish a browser-process security boundary. See the [package page](https://www.npmjs.com/package/quickjs-emscripten), [runtime API](https://github.com/justjake/quickjs-emscripten/blob/main/doc/quickjs-emscripten/classes/QuickJSRuntime.md), and [project documentation](https://github.com/justjake/quickjs-emscripten/blob/main/README.md).

## Q1–Q6 results

| Gate | Local result |
| --- | --- |
| Q1 — learner source and outcomes | **Pass.** The current challenge implementation passed all 14 canonical cases. The semantic string-for-number mismatch, syntax error, and import attempts were rejected. A deliberate learner exception produced execution-error with its runtime diagnostic. |
| Q2 — VM boundary and state | **Pass for tested paths.** The browser Worker hosted QuickJS; learner code saw no browser host APIs, expected fixture values were omitted from the VM payload, and state did not carry between cases. No host functions were installed in QuickJS. |
| Q3 — caps, termination, and cleanup | **Pass for configured test budgets.** An endless loop returned timeout at about 2.1 seconds while Edge kept processing page ticks. A catastrophic regular expression was separately interrupted by QuickJS, and a test-only run with that interrupt deliberately disabled was terminated by the iframe supervisor at 3 seconds. Memory exhaustion returned execution-error (“out of memory”); recursive stack exhaustion returned execution-error (“stack overflow”); oversized output was rejected. Source, serialized input, case count, cancellation, worker failure, repeated runs, and concurrent worker disposal also passed. All 18 created Workers were terminated and the active-worker count returned to zero. |
| Q4 — parent/runner protocol | **Locally corrected and independently validated.** Registered active runs now enforce bounded schema/version/challenge/case checks, complete dense suites and diagnostics, replay/cancellation retirement and nonce-bound handshake. Structured-clone sparse-array regressions pass. See the [correction validation](2026-10-18-m3-correction-validation.md); browser results remain non-authoritative. |
| Q5 — site, CSP, and WASM feasibility | **Local pass with an opaque-mode limitation; deployed proof blocked.** The opaque frame had event.origin equal to null and matched the expected event.source, but exact-target parent messaging did not reach it. Its QuickJS Worker bootstrap returned worker-error. The harness therefore used sandbox="allow-scripts allow-same-origin" only on the separate runner.test host, with exact pinned origins and no wildcard messaging. In that local cross-host fixture, the app cookie and app storage canary were absent, parent DOM access failed, runner storage was available, page and Worker network probes were blocked, both page and Worker CSP were observed, and static WASM loaded. No request reached the synthetic app probe endpoint. **No deployed TLS site, production cookie policy, or deployed response headers were tested.** |
| Q6 — responsiveness and cleanup | **Partial.** The main page remained responsive during VM timeout (83 ticks over about 2.1 seconds), and browser, local servers, and Workers were closed by the harness. No real-mobile, cold remote-cache, offline/recovery, or cross-browser matrix was run. |

The opaque-origin observations matter: the approved exact-target message protocol did not work with a null origin, and the opaque Worker bootstrap failed. The fallback exercised locally was a separate host, not a production site or a same-host/different-port substitute. Runner storage was available to the trusted fixture frame; no Storage API was bridged into QuickJS, and only synthetic canaries were stored. The owner should review the protocol/isolation trade-off before authorizing implementation.

## Limits and resource observations

The tested budgets were: source 32 KiB; serialized inputs 1 MiB; at most 100 cases; serialized output 64 KiB; QuickJS heap 32 MiB; QuickJS stack 128 KiB; interpreter interrupt at 2 seconds; and independent Worker termination at 3 seconds. The lower 128 KiB stack setting was needed for recursion to return a QuickJS stack-overflow error and dispose cleanly. These are spike values, not approved production policy, and they do not cap the browser process’s total memory, initialization, download, or scheduling costs.

The synthetic fixture’s Worker bundle was 3,581,369 bytes. Across the test suite the server recorded 13 WASM requests totaling 6,540,742 bytes, including repeated Worker startup. The loop watchdog fired at 2,099 ms and the browser recorded 83 responsiveness ticks. This is one local Edge measurement; it does not establish first-run latency, mobile performance, or a production caching budget.

The semantic checker is TypeScript 5.9.3 using an in-memory, noLib program with a **restricted synthetic declaration file**. It provides the challenge’s needed types and explicitly marks browser/Node globals as unavailable; it does not provide the full TypeScript standard library, DOM declarations, filesystem, or module resolution. Do not describe this as full standard-library or DOM type-checking. transpileModule is used only after semantic diagnostics succeed, not as the semantic checker.

The independent-hard-termination case is test-only instrumentation: a trusted fixture message disables QuickJS’s VM interrupt for that one adversarial test so the 3-second supervisor watchdog can be measured separately. That control is absent from any product interface and must not become learner-controlled input.

## Verification

The QuickJS test was observed failing during development before fixes, including the absent browser ts.sys host dependency and a stack-overflow path that aborted during runtime disposal at 512 KiB. The final stack setting and handle cleanup were then exercised in the browser suite.

From the worktree root in Windows PowerShell, after installing the isolated spike dependency:

    pnpm --dir spikes\runner install --ignore-workspace --frozen-lockfile
    $env:LAB_RUNNER_PLAYWRIGHT_MODULE = (Resolve-Path '.\node_modules\@playwright\test').Path
    $env:LAB_RUNNER_TYPESCRIPT_MODULE = (Resolve-Path '.\node_modules\typescript').Path
    node --test spikes\runner\quickjs-browser.test.mjs
    node --test spikes\runner\probe.test.mjs

Worker-checkout results: QuickJS browser gate **1/1 passed** in 11.37 seconds; the original security probe **6/6 passed** in 1.84 seconds. The coordinator then installed the frozen spike lockfile in the integration checkout and reproduced both suites together: **7/7 passed** in 12.22 seconds. Machine-local evidence/logs remain ignored under `docs/prompts/`; the integration log is `wave2-runner-integration.log` and QuickJS evidence is `quickjs-evidence.json`.

## Required follow-up

The [independent correction validation](2026-10-18-m3-correction-validation.md) clears the local prerequisite for bounded Task 1 implementation. The supervisor now rejects additional requests while one Worker is active; burst, cleanup and recovery tests independently pass. Learner execution remains disabled until a separately approved preview establishes actual two-site TLS, host-only cookies, deployed page/Worker headers, static WASM and supported-browser behavior, with the remaining Q6 and enablement gates. Green local tests are not deployment approval or trusted grading authorization. If essential deployed gates fail, return to the external-playground fallback for separate privacy and security review.
