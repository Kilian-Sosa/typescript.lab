# MVP Production Acceptance Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. PR 2 C4–C7 is owner-authorized; hosted operations and release exposure are not.

**Goal:** Prove the compiled Production learning flow locally and prepare repeatable hosted verification and release/rollback instructions.
**Architecture:** Parameterize the existing compiled Preview harness for both reviewed site pairs. Add a fail-closed, read-only hosted verifier that compares independent platform metadata and HTTP responses with a clean reviewed build manifest. Keep local synthetic evidence and future live acceptance in separate records.
**Tech Stack:** Existing Node 24, Playwright/Edge, Vue/Vite, QuickJS and Node tests; no new dependencies or runtime flags.
**Spec:** `docs/superpowers/specs/2026-10-24-mvp-production-design.md`, C4–C7; product REQ-04/05/06/09/10/12/13; ADR-0002/0003; frozen v1 contracts.

**Spec impact: no spec change.** Implement the approved acceptance requirements and clarify evidence in the existing design/roadmap without changing product behaviour or activation contracts.

## Global constraints

- Branch `test/mvp-production-acceptance` from clean, refreshed `main` at merged PR 1 (`1bbf56e`).
- Origins come from `shared/deployment/production.ts`; Preview retains its current exact QA pair.
- No hosted mutation, real-account test data, private draft access, deployment, promotion, alias/protection/OAuth change or release authorization.
- All five required checks stay intact. New checks run inside existing jobs.
- Local builds with fixture public auth values and synthetic APIs are not OAuth/RLS/real-TLS proof or releasable artifacts.
- The release candidate must be rebuilt from a clean reviewed commit, after checks; its manifest and hosted identities must match.

## Review focus

1. One mode's build must not overwrite assets while another browser test reads them.
2. Timeout/cancel/infrastructure failures must recover without preserving a stale pass or source loss.
3. All three saved statuses must survive Notebook detail, timeline and export, without console data or history rewrites.
4. Hosted verification must reject wrong targets/SHAs/hashes/aliases/headers and refuse redirects or credential forwarding to another origin.
5. No local synthetic pass, arbitrary metadata fixture or dirty build may become a complete hosted release acceptance claim.

### Task 1: Compiled-artifact acceptance (C4–C6)

**Files:** `scripts/check-mvp-preview-local.mjs`, new `scripts/mvp-browser-acceptance.mjs`, `scripts/check-mvp-production-local.mjs`; existing app/runner/browser regression suites.
**Interfaces:** `runMvpBrowserAcceptance({ mode })` registers tests for a validated `mvp-preview` or `mvp-production` pair; thin entrypoints select the mode. Production roots are the PR 1 paired output.
- [x] First run the new Production entrypoint before the shared harness exists and observe RED; then add lifecycle/persistence assertions against the compiled artifacts.
- [x] Extract and parameterize the existing synthetic HTTPS/auth/repository harness without duplicating it. Preserve emitted CSP and actual iframe/Worker/WASM execution.
- [x] Add console escaping/bounds, compile/runtime errors, timeout, cancel/disposal, failed-run retry and infrastructure retry. Assert fresh passing runs after failures; never fabricate runner results.
- [x] Verify saved passed/failed/untested in detail/timeline/JSON with exact source/version/notes and immutable snapshots; cover failed-save recovery and viewport/keyboard/theme/spoiler flows on the compiled Production artifact.
- [x] Run both compiled modes sequentially and the existing broader recovery/privacy/responsive/runner regressions. Record exact scope and limits.

### Task 2: Hosted validation tooling (C6–C7)

**Files:** new `scripts/check-production-hosted.mjs`, `scripts/check-production-hosted.test.mjs`.
**Interfaces:** read-only verifier consumes a reviewed clean pair manifest, explicit deployment/team/project IDs and reviewed SHA; obtains platform metadata independently and compares exact origins/aliases and byte hashes/headers. It reports delivery checks only; real OAuth/RLS/browser acceptance remains separate.
- [x] Write deterministic fixtures for mismatched deployment target, source SHA, project/team, alias, dirty manifest, redirected assets, wrong hashes/CSP and unprotected alternative hostnames; observe RED.
- [x] Implement bounded reads and strict validation; isolate platform credentials from app/runner fetches and redact errors. Never follow redirects carrying credentials. No network requests occur for invalid inputs.
- [x] Run all negative/positive fixtures locally. Document the exact live invocation without executing it or storing credentials.

### Task 3: Release record, rollback, roadmap and CI (C7)

**Files:** `docs/release-checklist.md`, separate local and pending hosted evidence records under `docs/release/`, `ROADMAP.md`, `README.md`, `.github/workflows/ci.yml`, this plan.
- [x] Wire hosted-verifier fixtures and compiled Production acceptance into existing verify job; retain Preview and the other four required contexts.
- [x] Record local checks and their synthetic limits; leave actual OAuth/RLS/HTTPS, assistive-technology/manual checks and owner decisions explicitly pending where not exercised.
- [x] Specify clean reviewed source/artifact identity, protected staging, exact-alias hosted acceptance, runner-first exposure, app release and verified protection after release. Include concrete rollback identity collection, runner/app safety ordering and private-data preservation.
- [x] Align roadmap status with merged PR 1 and measured PR 2 evidence; keep final go/no-go operational, after the two PRs.
- [x] Run focused Node tests, app/runner suites, both typechecks, lint/format and browser regressions; inspect requirements ↔ code/tests and diff. Record unresolved gates honestly.

## Execution ledger

- PR 1 merged as `1bbf56ec7f49ce878148c83da7cc055710c195ec`; local `main` refreshed and clean before branch creation.
- Execute bounded tasks inline, without an automatic extra release reviewer. C4–C7 tests/runbook do not authorize real hosted acceptance or Production exposure.

### Execution and verification, 2026-10-24

- Task 1 complete: extracted the existing Preview harness into one mode-specific registration helper and retained thin Preview/Production entrypoints. Both real compiled modes passed the extended lifecycle, privacy, failure-recovery and three-status Notebook/export assertions. RED was the missing shared helper before extraction; no application runtime behaviour or protocol changed.
- Task 2 complete: eight isolated hosted-verifier tests pass. They validate both operational phases and reject dirty/mismatched manifests, weakened local/remote policies, target/Git SHA/project/team/alias/readiness mismatches, public alternate hosts, redirects, hash/MIME/header/budget errors and sensitive errors. An alias-change regression first failed (missing rejection), then passed after end-of-verification inventory readback. An endpoint-query regression first failed, then passed after limiting withGitRepoInfo to the supported deployment endpoint. Live fetch is never invoked by fixture tests or CI.
- Task 3 local evidence: root 250 tests, strict typecheck and ESLint; runner 167 tests, strict typecheck and ESLint; 25 build/policy/verifier tests; full source formatter and diff whitespace checks passed. The 22 navigation/visualizer cases and 28 synthetic auth/recovery cases passed, as did both adversarial runner browser suites. The built-runner instrumentation finished with 26/26 Workers disposed and none active. See the dedicated local record for exact commands and browser/environment limits.
- CI retains the five existing required contexts and now runs both compiled modes, the hosted-verifier fixtures and synthetic recovery inside verify. No live verifier, provider credential or hosted-account suite is added to CI.
- Roadmap alignment and release/rollback instructions are included. The separate hosted record remains NOT RUN / NO-GO. Missing rollback IDs, platform-linked Git provenance, domain inventory, genuine OAuth/RLS/HTTPS evidence, manual assistive-technology checks and the owner's security/release decision remain operational gates.
- Spec-impact outcome: no behaviour/spec change; implements approved C4-C7. Only design status metadata is updated. Requirements-to-tests and changed-code-to-spec self-review preserve frozen execution/persistence contracts and PR 1 activation/origin policy. No independent release audit was requested or launched inside this implementation slice.
- Environment preservation: documented Edge SiteList sandbox issue handled by narrow approved rerun; a cold Vite response was diagnosed from trace timings and unchanged tests passed warm. No timeout increases, cache resets, browser installation, global setting changes, hosted mutations or private account/draft access.
- At implementation closeout this work was local and uncommitted; GitHub check results and a final reviewed release commit were not asserted. The owner subsequently invoked `publish-branch-commits-pr` to commit/push this scoped change and open PR 2 against `main`. Publication does not authorize merge, hosted acceptance or exposure; the release candidate still requires a clean reviewed-commit rebuild after the required checks.

### Tool-only configuration handoff

No application runtime variables, dependencies or feature flags change. The separately authorized live delivery verifier reads only process `VERCEL_TOKEN` (approved least-privilege Vercel read access; example `<scoped-vercel-read-token>`) and, for protected-app acceptance only, `VERCEL_AUTOMATION_BYPASS_SECRET` (existing explicitly approved app automation bypass; example `<approved-app-bypass-secret>`). Leave them unset for ordinary builds, local tests and CI. Do not put either in VITE variables, env templates, URLs, CLI arguments or Git; no secret/exception is created by this change. Released-phase probes never send an app bypass, and runner/alternate-host requests never receive either credential.

Final artifact check: rebuilt the fixture Production pair successfully and ran the checksum-pinned Gitleaks scan over tracked source, 65-commit history, both emitted static artifacts and the complete scripts directory (including untracked implementation). All scans passed with no leaks. Artifact builds remained dirty/fixture verification evidence; no hosted verifier invocation or release artifact promotion occurred.

Final pair-identity self-review: a new regression changed the app alias identity while runner bytes were being checked. It failed before the fix (missing rejection) and passed after moving final identity/inventory readback for both sites after verification of the entire pair. This prevents accepting an app alias that changed during the runner half of the check. Hosted-verifier fixtures now total eight tests; combined build/policy/verifier command totals 25.

### PR 36 CI follow-up

At `4a0e90a`, verify/lint/dependency auditing/secret scanning passed, but CodeQL and the required static-security gate rejected `js/incomplete-url-substring-sanitization` (severity 7.8) at the hosted-verifier test's URL-substring assertion. The live verifier's API origin construction was already exact. Replace the test's permissive substring checks with parsed URL origin equality and exact deployment path equality. No query suppression, finding waiver, workflow weakening, runtime/environment change or specification change is needed; this strengthens the acceptance assertion. GitHub checks on the follow-up commit remain the authoritative CodeQL verification.
