# Independent validation of M3 corrections

**Decision: GO for the local prerequisite to M3 Task 1 only.** Both findings from the [original independent review](2026-10-17-independent-m3-review.md) are closed in `fix/runner-security`, based on `main` at `249d5e4`. Task 1 is not implemented by this change. Deployed Q5, remaining Q6 checks, hosted approval and production enablement remain separate gates.

**Reviewer:** independent read-only GPT-6.1 Sol Medium security reviewer, explicitly requested by the owner. Reviewed actual handler/supervisor code and tests; no implementation, report edits, commits, hosted resources or credentials were changed by the reviewer. The coordinator records the returned result here.

**Spec impact: no spec change.** Corrections restore the approved complete-suite, bounded-protocol and single-active-Worker invariants in the dedicated runner design, ADR-0002 and frozen Shared Contracts v1. No architecture amendment is required.

## Findings and reassessment

The first correction review independently confirmed that the Worker guard precedes creation and that cleanup removes the active entry before recovery. It found one remaining Medium Q4 blocker: structured-clone messages preserve sparse arrays, while `.some()` and `.every()` skip holes. The actual matching-active handler accepted a `passed` result with an all-hole case array of the expected length, retired the pending run and reported no failure. Existing green tests missed that input.

The original worker then added actual browser/postMessage regressions for all-hole and partially sparse suites, sparse diagnostics and nested sparse JSON. Before the correction, the regression exited 1 at `activeSparseCasesRejected`; holes in cases/diagnostics survived cloning and were accepted. The corrected validator checks every own index before iteration and uses dense JSON equality; no permissive fallback was added.

The same independent reviewer reassessed the material fix and reproduced these results against the actual handler:

| Matching active result | Accepted | Infrastructure failure | Pending retired |
| --- | --- | --- | --- |
| Valid dense suite | Yes | No | Yes |
| All-hole case suite | No | Yes | Yes |
| Partial-hole case suite | No | Yes | Yes |
| Sparse diagnostics | No | Yes | Yes |

No remaining blocking finding was identified in this focused reassessment. Fixture-only instrumentation remains acceptable within the disposable spike; it must be removed from a production runner.

## Independent verification

- QuickJS browser suite and original isolation probes: **7/7 passed** together. Sparse-array holes survive real `postMessage` structured cloning and cases, diagnostics and nested JSON are rejected.
- Single-active-Worker burst limiting, disposal and subsequent recovery remain green: one Worker is created for the burst, seven requests receive busy rejections, and a later bounded run succeeds.
- Four JavaScript syntax checks and `git diff --check`: passed.
- Edge required a narrow approved outside-sandbox invocation after the sandbox failed replacing temporary SiteList files. No approval was bypassed and no dependency was installed for the reassessment.

See the [worker correction evidence](2026-10-17-m3-corrections.md) for the full red/green record. This local decision does not validate deployed TLS, cookie/site separation, actual HTML/Worker CSP, WASM delivery, broader browser/mobile behavior, cold-cache/offline behavior or production activation. Those remain the existing Q5/Q6 and owner approval gates.
