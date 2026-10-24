# MVP Production activation and release acceptance

**Status:** PR 1 implementation approved by owner with corrections on 2026-10-24. Production exposure remains gated by hosted validation and security approval. PR 2 is planned separately.

**Authority:** Product design REQ-04/05/06/09/10/12/13; dedicated-runner design; ADR-0002/0003; Shared Contracts v1; existing MVP Preview and Run/Submit evaluation plans.

**Spec impact: add focused spec.** Define the Production build and activation boundary that the existing Preview plan explicitly leaves for separate approval. Preserve learner behaviour, execution budgets, privacy rules and frozen contracts.

## Intent and scope

Prepare a separately classified Production artifact and prove its complete learning flow before any launch. Preview activation must never enable Production execution. Saved evaluations must describe the exact submitted source, with immutable private history.

The owner selected these exact HTTPS origins for build configuration:

- App: `https://typescript-lab-app-preview.vercel.app`
- Runner: `https://typescript-lab-runner-preview.vercel.app`

The owner's final decision supersedes the earlier non-preview hostname selection and reuses the two existing project domains. Existing QA aliases are not members of this pair. The existing inert bootstraps stay protected during implementation. Selecting these names does not establish current project ownership, protection posture or deployed security.

## Approach

Use a dedicated `mvp-production` mode and paired Build Output v3 build, extending the existing reviewed iframe/Worker/QuickJS architecture. This is the proposed approach, following the owner's request for a separate Production mode and two focused PRs.

Reusing Preview activation would mix trust boundaries and violate C1/C3. Making ordinary `production` mode executable would remove the current safe default. Both alternatives are rejected. No new operational feature flag, dependency, runtime service or database migration is needed.

## C1–C3: Build, activation and delivery policy

1. The app and paired builder require both `VERCEL_ENV=production` and `VERCEL_TARGET_ENV=production` for `mvp-production`. Missing, mixed, Preview or custom target metadata fails before producing an executable artifact. Metadata is a build classification guard, not authorization to publish.
2. Both Production app and runner builds disable local env-file loading, including the runner's explicit `loadEnv` call. The runner receives only explicitly validated origins and no Supabase configuration. The app reads explicitly provided public Supabase configuration. Retain strict HTTPS Supabase-origin and publishable-key validation. Validate all required configuration before building either member of the pair. Prevent a failed build from being mistaken for fresh successful paired output.
3. The selected app/runner pair is held in one shared build-policy definition. The builder, compiled app activation and runner configuration consume it. Public environment variables cannot override the pair or inject a trusted deployment marker. A conflicting provided origin is rejected rather than silently used.
4. Only validated `mvp-production` builds receive an internal Production activation marker. Runtime activation additionally requires a non-development build at the exact selected app origin, with the exact selected runner origin. Ordinary builds erase all hosted activation markers; Preview and QA builds retain their existing Preview-only guards. Public Preview flags cannot activate Production execution.
5. Emit paired static artifacts and response policies with the existing Build Output v3 conventions. App CSP permits frames only from the selected runner and connections only to its explicitly configured Supabase endpoints; app Worker execution and native eval remain forbidden. Preserve existing necessary static/avatar/style allowances.
6. Runner HTML allows framing only by the selected app, scripts and Workers only from itself, and no network connections. Its Worker response alone allows the required WASM compilation and same-origin static WASM loading. No wildcard origins, foreign scripts, native learner evaluation or sensitive app configuration in runner assets.
7. Preserve iframe `sandbox="allow-scripts allow-same-origin"`, `referrerpolicy="no-referrer"`, exact origin/window/nonce/schema checks, per-run Worker disposal and existing resource budgets. The permitted sandbox combination depends on the separate-site boundary.
8. Negative tests cover missing/mixed metadata, public-marker injection, ordinary builds, QA/Preview builds at Production origins, wrong parent/runner origin, same-site/same-origin pairs, HTTP, paths, credentials, ports, lookalike suffixes and malformed input. Builds reject invalid configuration; runtime mismatch disables execution without sending learner source.
9. Production has an intentional indexing policy: omit Preview's blanket `X-Robots-Tag: noindex, nofollow` from the public app. Private Notebook/auth pages are not public content; access control remains mandatory. The static runner remains `noindex, nofollow`. Generated immutable and other aliases must remain protected or redirect to the exact canonical alias; an unprotected alternative entry point fails hosted acceptance even though runtime execution is disabled there.

## C4–C6: Acceptance evidence

- Run the actual compiled Production app/iframe/Worker/QuickJS under emitted response policies. Prove current-source canonical 14/14, wrong answers, compile and runtime errors, bounded console output, timeout, cancellation, disposal and successful subsequent runs. No mocked execution result can satisfy these checks.
- Extend the existing compiled-artifact harness to cover Production rather than duplicating its synthetic auth/repository implementation. Keep Preview regression coverage. Verify app cookies, tokens, identity, notes and Supabase configuration do not leak into runner requests/assets.
- Save and reopen `passed`, `failed` and `untested` attempts through Notebook and export. Verify exact source/version/notes/counts and immutable prior history. Editing, edit/revert, cancel, fresh runs or auth changes invalidate stale evaluations. Failed submission preserves recoverable source.
- Run focused auth callback/session, cross-user isolation, recovery/offline, navigation/spoiler, keyboard, desktop/tablet/mobile, zoom and theme regressions. Reuse existing suites and fix demonstrated regressions within scope.
- Synthetic HTTPS interception exercises real compiled execution with synthetic persistence; it does not prove real TLS, hosted headers, OAuth acceptance or database RLS. Record those limits explicitly. Actual deployed-origin, OAuth redirect, protection, restricted-cookie and private database checks require separately authorized hosted access/test data and cannot be marked passed from local evidence.
- Independent hosted acceptance must compare platform-reported Production target, source SHA, immutable deployment IDs, exact aliases, downloaded artifact hashes and HTML/Worker/WASM response headers against the reviewed build manifest. Manually supplied build metadata is never attestation. Any mismatch fails acceptance. Use disposable test accounts/data; never modify the existing private draft.

## Operational sequence (separate authorization)

Stage both reviewed Production artifacts with domains unassigned (`vercel deploy --prod --skip-domain`, or the equivalent approved prebuilt workflow), under verified protection. Validate contents and platform metadata there; exact-origin execution is intentionally disabled at generated URLs. Then deliberately assign the exact runner alias and make only that reviewed static runner public while the exact app alias remains Vercel-authenticated. Run hosted acceptance at the exact aliases. Only after successful evidence and owner release approval expose the app. Keep Preview/generated URLs protected afterward. Verify current plan-specific protection capabilities before each operation; do not assume CLI flags alone establish protection.

References: [staging Production without alias assignment](https://vercel.com/docs/cli/deploy#skip-domain), [promoting staged Production without rebuilding](https://vercel.com/docs/deployments/promoting-a-deployment). PR 2 supplies reusable hosted-validation scripts and a separate hosted evidence record; this specification records no hosted pass.

## C7: Release and rollback

The release candidate must be freshly rebuilt from a clean, reviewed commit after the required checks. Artifacts produced during the intentionally dirty, uncommitted implementation stage are verification evidence only and must not be promoted as the release candidate. Committing or publishing the source does not make those existing artifacts releasable. Record the clean reviewed commit and the newly built pair's manifest/hashes in the release record.

Prepare a release checklist identifying the reviewed source SHA, artifact hashes, exact origin/configuration pair, checks, local versus hosted evidence, unresolved gates, operator and owner decision. Track existing unresolved release prerequisites, including license selection, without silently deciding them.

Rollback instructions identify known safe artifacts for both sites and the affected OAuth redirect/configuration. Prefer disabling new execution delivery first while preserving private drafts/history, then restore the reviewed app/runner pair and verify headers, origin gates and authentication. Do not delete learner records, disable RLS, broaden redirects or reuse the Preview runner as a Production fallback. Hosted rollback actions need explicit authorization and a concrete verified artifact target; placeholders cannot constitute a ready rollback.

Maintain the five existing required checks and repository protection policy. Add Production verification within their current jobs; keep CodeQL, source-pinned finding reviews, secret scanning and dependency auditing effective. Final readiness is tied to a specific reviewed commit and its check results, not a moving branch. Local self-review is separate from the independent Production security review required by the existing Preview plan.

## Delivery and remaining approvals

1. `feat(runner): add fail-closed production activation` — C1–C3, corresponding specs, build/runtime/security tests and configuration documentation. Merge gate: all five required checks and focused security review.
2. `test(release): verify production acceptance and rollback` — C4–C7, integrated acceptance tests, reusable hosted validation and release documentation, based on integrated PR 1. Merge gate: all five required checks and complete local acceptance evidence. Final Production go/no-go follows these PRs as an operational decision, not a third feature PR.

Roadmap alignment (`ROADMAP.md`) belongs to PR 2, alongside the integrated acceptance evidence and remaining operational gates. Keep PR 1 scoped to activation and its security/build regressions.

Implement bounded slices inline, with failing tests first and focused verification. No automatic extra implementation/release reviewer is requested here. The independent Production security review remains a recorded release prerequisite; arrange it explicitly before declaring readiness.

No resource creation, deployment, alias/protection mutation, OAuth changes, database writes against hosted user data, merge or launch is authorized by this document. Build-variable additions or changed semantics must be listed with safe examples in the implementation handoff; compiler-generated markers are not user-set activation flags.
