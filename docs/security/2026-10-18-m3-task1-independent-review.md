# Independent security review — M3 Task 1 implementation

Date: 2026-10-18. Requested explicitly by the owner after the bounded implementation commit.

**Reviewed range:** `9bb5bba..7f4164e536057456513e806ebfede6554fedb046`, on `feat/isolated-quickjs-runner`.

**Reviewer:** independent read-only GPT-6.1 Sol Medium security reviewer. It inspected the new implementation, tests, delivery configuration and governing specifications. It did not edit files, commit, push, deploy, provision resources or launch other agents. This is a new implementation review; the [earlier M3 correction approval](2026-10-18-m3-correction-validation.md) covered the spike corrections only.

**Decision: NO-GO for clearing Task 1 as the Task 2 prerequisite.** One reproducible P2 JSON-boundary conformance blocker remains. No sandbox escape or host API exposure was demonstrated. Production execution remains **NO-GO** independently of this defect.

**Spec impact: no spec change.** Remediation restores the existing finite/plain/dense JSON boundary and documented policy-rejection semantics in the approved runner architecture. Frozen Shared Contracts v1 need no amendment.

## P2 — Serialization can rewrite values after validation

Location at the reviewed commit: `apps/runner/src/evaluator.ts:12–27`, especially lines 22–27.

The VM serializer validates enumerable property values, then independently stringifies the original learner object. It accepts class instances, invokes inherited `toJSON`, and reads getters a second time. Learner-controlled behavior can therefore change the value after validation:

```typescript
class R {
  toJSON() { return NaN; }
}
export function longestWindow() {
  return new R();
}
```

Independent execution returned `status: 'ok'`, with `actual: null` and no diagnostic. Returning `new Array(2)` from the inherited method returned accepted `[null, null]`. A getter that first returns a finite number, then `NaN` during serialization also becomes accepted `null`. Mutating the VM's array iterator bypassed validation traversal in another reviewer probe.

**Impact:** unsupported learner values can be normalized into ordinary JSON and reported as assertion failures instead of policy rejection. This is a contained VM output-policy defect, not evidence of a host escape, private-data exposure or trusted-grading compromise. Current green tests do not cover these bypasses.

**Recommended correction:** construct one bounded inert snapshot using captured intrinsics. Inspect descriptors without invoking accessors; reject unsupported prototypes and serialization hooks. Serialize the snapshot without consulting learner-modified prototypes or iterators. Add regressions for inherited `toJSON`, changing getters, iterator mutation, nonfinite values and sparse arrays. Return the focused fix to the same reviewer for reassessment.

The coordinator independently confirmed both `toJSON` reproductions against the committed evaluator: the nonfinite case returned `ok`/`null`; the sparse case returned `ok`/`[null,null]`. No implementation changes were made during this review handoff.

## Verification and residual scope

- Reviewer ran **25/25 runner tests** and runner strict typecheck; all passed.
- Reviewer reproduced the serializer bypasses, probed constructor-based global access (none of the tested browser/Node APIs exposed), and checked the session cap: **128 Workers created/terminated**, with request 129 rejected.
- Reviewer inspected the browser suite but did **not** rerun it. Author browser evidence remains separately recorded in the [Task 1 execution record](2026-10-18-m3-task1-runner.md).
- Before the implementation commit, the coordinator reran **25 runner tests**, **153 application tests**, and both strict typechecks; all passed.
- Deployed HTTPS/site/cookie/CSP/WASM behavior, parent adapter validation, mobile/cold-cache/offline behavior and cross-browser compatibility remain separate unverified gates.

The implementation commit remains intact for review. This report does not approve Task 2 integration, hosting, production enablement or release. The current requested work commits Task 1 and obtains review; remediation is not included in this handoff.
