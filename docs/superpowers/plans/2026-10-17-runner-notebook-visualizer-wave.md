# Runner, Notebook and Reference Visualizer Parallel Wave

**Owner authorization:** Start M3, M5 and M6 Task 1 in parallel (2026-10-17).

**Baseline:** `main` at `b4adac3`; integration branch `feat/runner-notebook-visualizer`.

**Spec impact: no spec change.** This wave implements existing approved requirements and investigates the approved runner architecture. Product requirements, ADRs and Shared Contracts v1 remain authoritative. This plan does not approve deployment or production execution.

## Scope and ownership

| Track | Branch | Exclusive mutable area | Completion boundary |
| --- | --- | --- | --- |
| M3 | `chore/quickjs-feasibility` | Disposable `spikes/runner/` and companion `docs/security/` report | Tasks 0A/0B evidence, Q1–Q6 findings and security recommendation; stop before production runner |
| M5 | `feat/notebook-history` | `src/features/solutions/`, Notebook pages, Notebook router wiring and dedicated tests | Typed authenticated persistence, immutable history, compare, retry and export |
| M6 | `feat/mvp-release-polish` | Reference stepper/hints components and dedicated tests | Task 1 only: reference trace, progressive hints, spoiler gates and accessible controls |
| Coordinator | `feat/runner-notebook-visualizer` | Shared tooling/docs, `ChallengePage.vue`, app wiring and integration tests | Reconcile interfaces, integrate returned changes, verify combined behavior and record limitations |

Each worker uses a separate workspace-local Git worktree, with one writer per mutable path. Root manifests/lockfiles and frozen `shared/contracts/` belong to the coordinator. No worker may mutate hosted resources. No additional review agent is automatically dispatched; M3's separate technical security review remains a required subsequent gate.

## Execution

1. Confirm a clean baseline, read the three handoffs and authoritative specs/plans, and run baseline tests.
2. Execute the existing scoped plans in parallel with observed failing tests before implementation:
   - [M3 Tasks 0A/0B](2026-10-17-quickjs-runner-implementation.md).
   - [M5 Tasks 1/2](2026-10-16-notebook-history.md), reusing the existing tested SQL schema.
   - [M6 Task 1](2026-10-16-release-polish.md).
3. Add the minimal authenticated client/session support required by the Notebook. Use public environment configuration; keep all reads/writes owner-scoped through authenticated RLS. Without configuration/session, present an honest gate. Hosted GitHub OAuth setup remains M4 work.
4. Integrate components into the challenge page sequentially. Preserve the current editor buffer across learning-mode changes; submissions without an actual matching run are `untested`. Retry loads versioned starter code and resets spoiler presentation.
5. Run focused and combined unit tests, strict typecheck, production build, contract checks and documentation checks. Verify browser keyboard/mobile behavior and local PostgreSQL policies. Keep synthetic/browser fixtures separate from live authenticated evidence.
6. Inspect the integrated diff against requirements in both directions and record coverage and outstanding gates. Keep changes on the scoped integration branch; no push, merge or deployment is included.

## Gates and limitations

- M3 stops after feasibility evidence. A local VM/browser success cannot prove deployed TLS, site/cookie separation or actual hosted CSP headers. Any unverified gate is recorded as blocked.
- No production runner adapter, native-JavaScript fallback, hosted project creation, OAuth changes, remote migrations, billing or DNS changes are authorized.
- M5 must never infer a passing evaluation from saved source. Run-to-submit integration waits for M3; hosted authenticated E2E waits for M4 configuration.
- M6 Task 2 and MVP release approval are outside this wave.
- Temporary services/resources are removed, and Docker Desktop is restored if started solely for these checks.

## Verification record

- Baseline: 34 unit tests passed before implementation.
- Integrated app: 96 unit tests in 17 files; strict Vue/TypeScript check; Vite production build; standalone contract check; documentation/whitespace checks passed. Shared Contracts v1 is unchanged.
- Browser: 20 guest/reference-learning desktop/mobile flows passed, including consent before Interview-to-Notebook navigation. The ordinary suite intentionally skips two local-auth checks; `node scripts/check-notebook-local.mjs --workers=2` separately passed both real local-auth desktop/mobile flows.
- Database: 47 PostgreSQL assertions passed against the disposable local stack, including cross-user denial and historical-attempt update/delete denial. No schema changes were required.
- The local-auth browser flow verifies exact source/notes, `untested` saves, original revision warnings, comparison, download contents excluding another account's canary, fresh retry, keyboard submission and no document overflow. It uses synthetic local password sessions; hosted GitHub OAuth is not claimed as tested.
- Desktop/mobile screenshots were inspected. Native screen-reader and broader real-device/browser release validation remain pending M6 Task 2.
- Disposable database/auth/API containers and data volumes were removed. Docker Desktop was restored to its initial stopped state. The owner-requested first-try startup record is in the private global friction log.

## Traceability and integration decisions

| Requirements | Implementation/evidence | Remaining gate |
| --- | --- | --- |
| REQ-03, REQ-08 | Explicit Learning consent; separate visualizer reveal; reset on return/retry; current source survives mode changes | Full M6 release/assistive-technology audit |
| REQ-06, REQ-07 | Existing immutable RLS schema, token-scoped repository, real two-account API/browser checks, account-switch transport regressions | Hosted M4 schema/provider verification |
| REQ-09, REQ-10 | Owner-only list/detail, immutable notes/version, cursor history, labelled comparison, source/Markdown/JSON exports and round-trip checks | Hosted end-to-end deployment flow |
| REQ-11, REQ-12 | Mobile/desktop responsive/keyboard checks, textual pointer/count/range state and live announcements | Broad manual/device/AT checks |
| REQ-04, REQ-13 | Source field and honest `untested` saves; no production learner evaluator | M3 technical review, implementation and deployed security proof |

- Reused the existing SQL migration and policy suite rather than adding a duplicate attempts schema.
- The plain source textarea supports M5 snapshots only; the measured full editor/runner integration remains M3 Task 2. No custom IDE framework was introduced.
- Retry uses a fresh route query token; no old source or notes enter its URL, and the source/notes form resets to starter/empty values.
- Repository requests capture and verify the authenticated identity/token, then bind the REST client to that token. A later account switch cannot save the previous account's source under the new account.
- History uses an immutable timestamp/ID cursor to avoid row-cap truncation and duplicate/omitted records after a concurrent newest insertion.
- Missing historical challenge statements are identified; the saved source, notes and revision are retained exactly.
- Owner self-review covered privacy, contracts, state clearing, exports and spoiler gates. No additional reviewer was spawned. The runner's required separate technical security review is still a subsequent gate.

## Runner handoff and stop

The [QuickJS report](../../security/quickjs-feasibility.md) records the local investigation. A frozen-lockfile installation in the integration checkout reproduced all seven TAP tests (original six plus the QuickJS harness). The harness exercises 14 canonical fixtures, semantic diagnostics, VM capabilities/state, protocol attacks, memory/output/stack limits, timeout, hard termination, cancellation and disposal.

The spike pins QuickJS 0.32.0, uses restricted in-memory TypeScript declarations, and lowers the tested stack cap to 128 KiB after reproducing a 512 KiB disposal abort. A trusted test-only control proves the independent watchdog with the VM interrupt disabled; it is not a product input. Real deployed TLS/site/cookie/header proof is blocked and Q6 is partial. **Production execution remains NO-GO.** No `apps/runner/` or app runner adapter was implemented.

Local implementation commits: `2ca51d3` reference components, `a908c1d` Notebook/workspace integration and `f774ba0` runner feasibility/report. Work remains on the scoped branch; no push, merge, hosted resource change or deployment was performed.
