# M3 Task 1 — P2 JSON-boundary correction

Date: 2026-10-18. Branch: `feat/isolated-quickjs-runner`. Correction base: `a755218`; initial implementation: `7f4164e`.

The owner requested remediation of the P2 found in the [independent implementation review](2026-10-18-m3-task1-independent-review.md).

**Spec impact: no spec change.** This restores the approved bounded JSON output boundary and policy-rejection semantics. Frozen Shared Contracts v1, compiler settings, origin/CSP policies and resource limits are unchanged.

## Cause and scoped implementation plan

The old serializer validated the learner's live object, then stringified it separately. Getters could change values between those reads, inherited `toJSON` could return nonfinite/sparse output, and learner-modified iterators could skip validation.

1. Add real QuickJS regressions that reach the output boundary, including the original reproductions.
2. Replace the double traversal with one bounded data-descriptor snapshot using captured VM intrinsics; serialize only inert snapshot containers.
3. Verify canonical behavior, policy failures, typecheck/build, browser disposal and main-app regressions.
4. Return the focused fix to the original independent reviewer for reassessment; retain hosted and production gates.

The snapshot reads each own data descriptor once, without evaluating accessors. Only plain/null-prototype records and dense arrays are accepted; class/custom prototypes, hooks, symbols, extra array properties and non-enumerable record fields are rejected. Ancestor tracking uses a null-prototype record and indexed loops, so Array iterator/indexOf mutations cannot bypass traversal. Snapshot records and arrays have null prototypes. Captured property-definition functions receive null-prototype descriptors, protecting against inherited `get`/`set` pollution. The captured JSON stringifier receives only these inert snapshots, not the original learner objects.

## Verification

- RED: nine new regressions failed against the prior implementation. Eight bypasses returned `ok`; the looping getter ran until the VM timeout. Mutation fixtures were corrected to reach runtime policy checks rather than being rejected by the restricted compiler.
- GREEN: **42 runner tests** pass, including all prior tests, the nine regressions, valid nested/null-prototype data under poisoned intrinsics and additional nonfinite/sparse/cycle/depth/symbol/extra-property cases. All 14 canonical challenge cases still produce their expected values.
- Runner strict TypeScript checking passes.
- The existing application suite passes **153/153 tests**. Runner and application strict typechecks/builds pass; `git diff --check` passes.
- Built-artifact synthetic Edge suite passes, including four new output-boundary cases returning `execution-error`/`policy-rejected`, all 14 canonical cases, VM limits, independent watchdog, CSP, cancellation and recovery. **20 Workers created/terminated, zero active, peak one**; 14 WASM requests in this local run.

## Reassessment

**P2 closed; no new blocking findings. GO for local Task 1 completion and the Task 2 prerequisite.** The same independent read-only GPT-6.1 Sol Medium security reviewer reassessed the working-tree correction against `a755218` after the focused tests passed. No production code changed after reassessment; documentation records the returned result.

The reviewer independently ran **42/42 runner tests**, strict runner typecheck and `git diff --check`. Eleven in-memory probes exercised inherited nonfinite/sparse `toJSON`, changing getters, nonfinite/accessor proxy descriptors, non-enumerable fields, inherited descriptor pollution, late prototype serialization hooks, finite proxy descriptor snapshots, a looping proxy trap and null-prototype arrays. Original bypasses now return `policy-rejected`; valid finite snapshots remain stable; the looping proxy trap returns `timeout` under existing limits. No new blocker was found. Browser regressions were inspected, not independently rerun; the separate author Edge verification above remains clearly attributed.

Hosted/deployed verification and production execution remain **NO-GO** pending their existing gates and owner authorization. Local clearance does not authorize starting Task 2, changing hosted resources, enabling production or releasing. The focused correction, regression tests and this reassessment record are committed together as `fix(runner): snapshot JSON output before serialization`; no push or deployment is included.
