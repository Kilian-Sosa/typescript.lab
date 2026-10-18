# M4 frontend recovery execution

**Current checkpoint (2026-10-18):** The pinned app commit `cf5a040` is now deployed to a protected Preview and its exact OAuth callback is configured. The earlier local-only/unresolved-origin observations below are historical. Full live acceptance remains pending; see the [deployment record](2026-10-17-preview-preparation.md) and [final M4 security review](../../security/2026-10-18-final-m4-security-review.md).

**Authority:** Owner requested completion of M4 frontend functionality on `feat/auth-persistence`, the two M3 corrections in parallel, and local preview preparation. Executes the approved [auth/drafts plan](2026-10-16-auth-and-drafts.md), [product requirements](../specs/2026-10-16-typescript-lab-design.md) REQ-05/07/08/12/13, [ADR-0003](../../decisions/0003-solution-persistence.md) and frozen Shared Contracts v1.

**Spec impact: no spec change.** Implement existing callback, private CAS, honest persistence, explicit guest import and recovery requirements; no schema, shared contract or approved runner architecture changes.

## Scope and ownership

- Coordinator owns M4 `src/`, focused app/browser tests, root configuration and this execution record. Existing `feat/auth-persistence` is clean and has merged the newly fetched `origin/main` (`249d5e4`) without conflict.
- One bounded worker owns only the M3 spike and a new correction report in `.worktrees/m3-security` on `fix/runner-security`. Existing dirty feasibility worktree is preserved. Project-local worktree placement follows the accepted coordination plan; the native worktree tool cannot select that location.
- A separately requested read-only security reviewer validates M3 corrections before any Task 1 work. No production runner or hosted changes in this execution.
- Use existing installed, pinned tools through Node. No new dependencies, hosted credentials, OAuth scopes, migrations or infrastructure provisioning.

## Task 1 — Explicit authentication lifecycle

Files: `src/features/auth/`, existing `src/features/solutions/session.ts`, router, bootstrap and app shell.

- [x] Add failing tests for PKCE callback success, denial, expired/missing/replayed state, sanitized URLs, safe return routes, failed sign-out, expiry and account changes during verification.
- [x] Use explicit PKCE exchange at `/auth/callback` (both exact local URLs already approved), scrub callback material before Router mounts, and present fixed safe messages. Keep return location in tab storage, never source or credentials in URLs.
- [x] Observe auth changes synchronously for clearing private UI; perform verification outside SDK auth callbacks. Expose account/sign-in/sign-out/retry controls. Preserve local buffers before redirect, expiry or account transition.
- [x] Verify focused authentication tests before integration.

## Task 2 — Private repository and recovery state machine

Files: `src/features/solutions/draftRepository.ts`, `draftRecovery.ts`, `draftSync.ts` and corresponding tests.

- [x] Add failing transport tests for create-only insert, revision-zero CAS, stale conflict, cross-account reads/responses and a session switch before/during a token-pinned write.
- [x] Use existing RLS and revision trigger with insert-only creation and an atomic filtered update. No user ID in write payloads. Verify owner/response shape and matching durable acknowledgments.
- [x] Add failing state-machine tests for debounce, edits during load/save, conflicts between two controllers, offline/retry, reload after interruption, uncertain acknowledgments, account changes and explicit guest import.
- [x] Keep account/challenge/tab-scoped local recovery. Debounce serial writes; an older acknowledgment advances its base revision without labelling newer text Saved. Stale account/route generations cannot mutate current state. Conflicts stop automatic writes and expose both versions for explicit review.
- [x] Preserve failed/unacknowledged text and local notes; report storage failure honestly. Guest text never becomes an account draft without an explicit action.

## Task 3 — Editor integration and browser proof

Files: challenge page, draft status/recovery controls, submission notes and browser fixtures/tests.

- [x] Add failing UI/browser tests for callback failure presentation, guest reload, explicit import/conflict review, sign-out/account switch, two tabs and interrupted/offline sessions.
- [x] Mount the recovery lifecycle around the existing source editor, preserve Retry from scratch, and reset private source/notes immediately on account change. Keep status and comparison controls keyboard accessible.
- [x] Run focused tests, full unit suite, strict typecheck, build, shared contracts, documentation/whitespace checks and desktop/mobile browser tests.

## Task 4 — Preview preparation and handoff

- [x] Prepare a reviewable app preview package with pinned build commands, SPA callback routing and exact OAuth/origin fields; record unresolved hosted target/origin values honestly.
- [x] Preserve separate hosted approval for app and runner. Runner preview additionally awaits deployed security proof and owner enablement; no production execution activation here.
- [x] Record requirements-to-tests and changed-behavior-to-spec traceability, verification results and remaining gates. No automatic M4 independent reviewer; the user requested M3 validation only.

## Progress

- Baseline: 100/100 unit tests pass; clean requested branch before changes. Main merge was conflict-free. No substantive spec conflicts found.
- Completed locally on 2026-10-18: 141/141 unit tests in 22 files; strict Vue/TypeScript, production Vite build, standalone shared-contract compilation, documentation links and whitespace checks pass.
- Existing Edge desktop/mobile regressions: 22 passed, 12 intentionally skipped. Ten skipped cases are the separately executed intercepted recovery suite below; the other two require a disposable local Supabase stack and were not rerun in this slice.
- Dedicated intercepted Auth/Data API suite: 10/10 passed on desktop and 390px mobile, including actual supabase-js PKCE exchange wiring, callback URL cleanup, denial/expiry, source/notes reload, explicit guest import, account A→B→A recovery, two-tab CAS conflicts, offline recovery/retry and sign-out during a held write. Conflict screenshots were inspected and document overflow checks pass. This fixture does not validate the real GitHub provider or hosted database anew.
- Browser checks initially exposed callback URL restoration by Router history and a lost account-specific pointer after multiple OAuth navigations. Both were corrected and the same flows passed. Delaying the whole app mount caused a keyboard-focus regression; the shell now mounts immediately while account actions wait for the route to resolve, and the keyboard suite passes. A separate cold-server timeout was traced to a 22-second HTML response; no deadline was increased.
- Storage-failure tests also preserve the in-memory source/notes across retry and same-page account changes. The unavailable-storage warning remains visible while any account has memory-only work. A full reload cannot preserve memory when browser storage is unavailable; download/copy and leave-confirmation controls make that limit explicit.
- Self-review: requests capture a verified account and pin its token; stale account/route generations cannot update the current editor or Notebook. Callback values are scrubbed before Web history construction and provider descriptions are not reflected. Local caches are account/challenge/page scoped; copied tabs write separate buffers, and replacement actions archive unsynced text before replacing it. No schema, migration, frozen contract, dependency version, privileged key or hosted setting changed.
- Commit ruling: keep the frontend lifecycle, draft repository/state machine, UI and their tests in one focused local commit, because the account transition boundary is shared and intermediate integration would omit its recovery protection. Preview configuration/docs belong to the same reviewable local handoff; no remote publication follows automatically.
- [Preview preparation](2026-10-17-preview-preparation.md) records verified read-only account/team inspection and proposed project/build settings. The actual preview origin is unresolved until an approved deployment returns it. Live PKCE/provider acceptance, exact hosted redirects and both deployments remain gates. M3 corrections independently passed on separate `fix/runner-security` commit `83e4889`, including an extra sparse-array regression found by the reviewer; only its local Task 1 prerequisite is GO. The runner corrections are not integrated into this auth branch. No push, hosted deployment, Task 1 implementation or learner execution activation is included.

## Requirements and change traceability

| Requirement / authority | Implementation and proof |
| --- | --- |
| REQ-05, ADR-0003 concurrency/recovery | `draftRepository` uses insert-only creation and revision-filtered CAS; transport tests exercise revision zero, stale/create-only conflicts, wrong-owner data and switches before/during writes. `draftSync` tests debounce, in-flight edits, uncertain acknowledgments, interrupted/offline saves and quota failure. |
| REQ-07 and frozen ownership contract | Server RLS/schema is reused unchanged; writes omit client ownership, verify returned owner/content/revision and remain token-pinned. Account transitions clear source, notes, Notebook history and exports; unit/browser regressions exercise these boundaries. |
| REQ-13, ADR-0003 guest transition | Guest buffers are labelled local; import shows both versions, requires an explicit action and uses CAS. Original buffers remain recoverable. Browser tests prove sign-in alone makes no guest write. |
| REQ-08 / retry fidelity | Fresh route tokens use separate buffers and suppress cloud source restoration; state-machine tests and existing Notebook/browser tests keep old attempts and spoilers separate. |
| REQ-12 / feedback | Labelled source/notes, announced save/conflict/error states, native details/buttons, explicit conflict versions and download fallback; desktop/mobile keyboard and overflow tests pass. |
| OAuth recovery under M4 plan | PKCE fixed callback, safe same-site return state, denial/expiry/replay handling, local sign-out, expiry deadline and stale verification/callback cancellation tests. Both local callback URLs already exist in the approved allowlist. |

All changed behavior maps to these existing requirements or their specified failure cases. **Spec impact remains no spec change.** Production runner execution, offline application-shell delivery, full IDE integration and release approval are outside this scoped frontend completion.

## Fixture cleanup and separate publication — 2026-10-18

The owner requested removal of two non-fatal Vue Router warnings, then two separate PRs to `main`: M4 from `feat/auth-persistence` and the independently validated M3 corrections from `fix/runner-security`. The reviewed scopes remain separate; neither branch is merged into the other or into `main` by this publication.

**Spec impact: no spec change.** Both `VUE_ROUTER_R0020` warnings came from mounting `DraftWorkspace` outside `RouterView` in its unit fixture, so `onBeforeRouteLeave` lacked an active route record. Rendering the actual workspace as the test route component through `RouterView` fixes the context without changing production behavior or suppressing diagnostics. The focused tests still pass and the full 141-test suite now reports zero Vue/Router warnings. Strict typecheck, build, shared contracts and documentation/whitespace checks pass. The unchanged M3 branch also passed all seven browser/security tests in a fresh rerun before publication.

PR publication is authorized; hosted deployment, OAuth/origin changes and production learner execution retain their existing approval gates. The exact app production source remains `cf5a040`; this follow-up changes only its unit fixture and publication documentation.

## PR #6 deployment documentation and final security review — 2026-10-18

**Plan:** Reconcile the later owner-approved bootstrap, protected app Preview and exact OAuth callback against Vercel read-only evidence; update current status documents and PR metadata while retaining historical checkpoints; run focused verification and one independent M4 security review; preserve findings and remaining acceptance gates.

**Spec impact: no spec change.** Documentation corrects execution status under existing REQ-05/07/13 and ADR-0001/0003. The review checks implementation against existing requirements; it does not authorize changes to behavior, deployment protection, hosted settings, production app deployment or the runner.

- [x] Confirm the clean `feat/auth-persistence` branch matches PR #6 and its current head.
- [x] Reinspect the exact project, source commit, Preview/Production deployment listings and Vercel Authentication settings; reconcile later approval/execution evidence.
- [x] Correct the deployment record, README, roadmap, plan index and historical-report pointers without claiming complete hosted acceptance.
- [x] Record the final security decision and fresh verification in the security report, and prepare the scoped documentation update for PR #6 publication. One P2 finding requires correction before merge; 141 unit tests, ten synthetic desktop/mobile recovery flows, typecheck, build, shared contracts and documentation/whitespace checks pass. No claim of full hosted acceptance follows from these checks.
