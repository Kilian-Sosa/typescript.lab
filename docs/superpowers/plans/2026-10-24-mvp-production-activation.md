# MVP Production Activation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Owner authorized PR 1; PR 2 remains separate.

**Goal:** Implement C1–C3 without exposing Production.
**Architecture:** One small typed Production policy pins origins and validates explicit build inputs. App and runner modes consume it; paired output has a completion manifest and strict separate response policies.
**Tech Stack:** Vue, Vite, TypeScript, Node 24, Vitest, Node test runner, existing QuickJS runner.
**Spec:** `docs/superpowers/specs/2026-10-24-mvp-production-design.md` (approved corrections, C1–C3).

## Global constraints

- Work on `feat/mvp-production-activation`, based on verified clean `main` at b6bcdcb.
- Preserve exact existing Production project domains, Preview gates, execution budgets and frozen v1 contracts.
- No hosted mutations, deployment, new runtime services, dependencies or operational feature flags.
- Production app allows indexing; static runner retains noindex. Generated domains require protection/canonicalization verified separately.
- Keep all five required GitHub checks and CodeQL/dependency policy.

## Review focus

1. Runner `loadEnv` cannot reintroduce developer-local values in Production.
2. Public flags/markers and mixed deployment metadata cannot enable another mode/origin.
3. A failed paired build cannot leave a success manifest or partially published deployable pair.
4. App/runner CSP and compiled origins agree; only Worker permits WASM compilation.
5. Local configuration and hashes are not independent hosted security attestation.

### Task 1: Shared policy and red regressions

**Files:** `shared/deployment/production.ts`; `scripts/check-mvp-production-build.test.mjs`; `src/features/runner/runChallenge.test.ts`.
**Interfaces:** `PRODUCTION_ORIGINS`, `validateProductionEnvironment(env, needsAuth)`, `productionAppHeaders(supabaseOrigin)`; `mvpProductionRunnerOrigin(mode, runner, parent, dev, deploymentEnvironment)`.
- [x] Add tests for explicit Production metadata, canonical URL handling, conflict rejection, injected flags, exact runtime gates and response policies; observe RED.
- [x] Implement minimal typed policy, with a single literal origin pair and no environment-file reads; run tests GREEN.

### Task 2: Mode integration and paired artifact build

**Files:** `vite.config.ts`; `apps/runner/vite.config.ts`; `src/features/runner/{runChallenge.ts,RunnerControls.vue}`; `scripts/build-mvp-production.mjs`.
**Interfaces:** internal `VITE_MVP_PRODUCTION_DEPLOYMENT_ENV` is compiler-defined only; output `output/mvp-production/{app,runner}/.vercel/output` and external `manifest.json`.
- [x] Add regressions against actual Vite configs, poison env files in a temporary isolated runner config fixture, and invoke invalid paired builds; observe RED.
- [x] Integrate dedicated mode: disable both implicit and explicit runner env loading, pin validated origins and marker, and keep ordinary/QA/Preview marker erasure.
- [x] Build both artifacts into a staging area; only publish the complete pair and SHA-256 manifest after success. Clear stale public output before validation; remove staging on failure. Record source SHA/dirty state, paths/hashes and policy metadata without secrets. A dirty/fixture build is local evidence only.
- [x] Verify app and runner strict typecheck/build, positive pair output, mode negatives, env isolation and artifact headers/hashes.

### Task 3: CI, documentation and focused security review

**Files:** `.github/workflows/{ci,security}.yml`; `.env.example`; `README.md`; runner design; this execution record.
- [x] Wire Production regressions/build into existing verify job and scan Production artifacts in existing secret-scan job; preserve five check names and permissions.
- [x] Document explicit build inputs, compiler-owned marker, output/manifest, indexing decision and remaining hosted acceptance/rollback gates.
- [x] Run app/runner suites, strict typechecks, lint/format, relevant tooling/policy and Preview regressions. Review requirements ↔ tests ↔ implementation.
- [x] Obtain one focused security review of C1–C3 (owner-required merge gate), validate findings and rerun affected checks. Do not claim hosted checks or Production readiness.

## Execution record

- Approved corrections A–E incorporated; latest origin decision replaces the earlier non-preview names.
- Implement inline; one focused security reviewer after verification, not an automatic release audit.
- Ruling: use this plan as the execution ledger; Windows PowerShell is required, so do not invoke Bash-only workspace helper scripts.
- Commit/push/PR publication remains a handoff action unless expressly requested; no merge or deployment is authorized.

### Verification and focused review, 2026-10-24

- RED: new Production policy/activation imports initially failed because the implementation was absent. The runner ordinary-mode metadata guard failed its targeted regression before the guard was added.
- GREEN: `node --test scripts/check-mvp-production-build.test.mjs scripts/check-mvp-preview-build.test.mjs scripts/check-m3-qa-build.test.mjs scripts/check-ci-policy.test.mjs scripts/audit-dependencies.test.mjs` — 27 tests passed, including eight Production tests with real builds, emitted headers/hashes, poisoned local-env fixtures and source-change rejection.
- Root app: 30 test files / 250 tests passed; strict typecheck, ordinary Vite build, ESLint and full formatter check passed. Runner: five files / 167 tests, strict typecheck, ESLint and formatter check passed. The Production paired builder runs both typechecks and builds successfully.
- Existing tooling regression command including check-code-quality: 36 tests passed before the additional provenance regression; all 21 quality checks passed. Existing compiled Preview Edge browser regression passed: actual QuickJS 14/14, synthetic auth/repository Save, Notebook/export, failed and untested persistence, no auth leaks, wrong-origin rejection. This preserves Preview and does not claim Production browser acceptance.
- The owner's required focused security review found one P2: HEAD alone did not detect source edits during compilation. Reproduced with a real child build, then fixed by comparing tracked/untracked source-content fingerprints before publication. The same reviewer reassessed it as resolved, with no outstanding actionable C1-C3 findings. A final status comparison also rejects changes in tracked/untracked state. Source and output fingerprints remain local evidence, not hosted attestation.
- Gitleaks tracked working source, 64-commit history and both fresh Production static artifacts passed with no leaks. Sandbox scanner download initially failed; the narrow approved network-enabled rerun of the same scan passed. A final direct directory scan also covered scripts, shared/deployment and src/features/runner, including the new untracked implementation sources; all passed. No scan exclusion or finding waiver was added.
- Requirement-to-code and code-to-spec checks preserve Shared Contracts v1, iframe restrictions, resource limits and privacy semantics. New generated pair/staging/fixture directories are ignored. No dependency, database, hosted protection, alias, OAuth or service changes.
- GitHub-hosted check results are not asserted: this work is local and uncommitted. All five required check contexts remain unchanged. PR 2 C4-C7, genuine OAuth/RLS/HTTPS tests using disposable accounts/data, platform target/SHA/hash/header/alias verification and owner release authorization remain separate gates.

### Build configuration handoff

Owner follow-up: leave `ROADMAP.md` alignment to PR 2. The implementation-stage working tree was intentionally uncommitted and dirty; rebuild the release candidate from a clean, reviewed commit with passing required checks. Those local artifacts remain verification evidence only after source publication, not release inputs. PR 2/release records must identify the fresh build's source commit, manifest and hashes.

Publication authorization: the owner subsequently invoked `publish-branch-commits-pr` to commit this scoped PR 1 change, push `feat/mvp-production-activation` and open its PR against `main`. This does not authorize merge or deployment.

- `VERCEL_ENV` and `VERCEL_TARGET_ENV`: the dedicated mode now requires both to be `production`; Preview retains its Preview-only requirements. These are classification guards, not proof of deployed target.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`: explicitly supplied public inputs for the Production app, e.g. `https://example.supabase.co` and `sb_publishable_<approved-public-key>`. Local env files are ignored; runner children receive neither value. No secret/service-role key is accepted.
- `VITE_RUNNER_PARENT_ORIGIN` and `VITE_RUNNER_ORIGIN`: optional Production assertions; if set, must exactly equal the pinned existing app and runner domains respectively. Normal Production setup leaves them unset and consumes the shared policy.
- `LAB_RUNNER_LOCAL_TEST`: unset/empty for Production; local opt-in such as `1` is rejected there. Local test behaviour is unchanged.
- `VITE_MVP_PRODUCTION_DEPLOYMENT_ENV`: new compiler-owned internal marker with value `production` only in the validated mode. Do not configure it manually; ordinary/Preview/QA builds erase it. No new user-managed feature flag.
