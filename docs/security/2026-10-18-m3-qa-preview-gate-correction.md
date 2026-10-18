# PR #9 — Preview build metadata correction

Date: 2026-10-18. Branch: `feat/m3-hosted-qa-activation`. Baseline: `8d02893f35d37a42616efddfe8a77ee84465afe0`.

The owner requested correction of the independent review's P2 finding: Vite QA mode and exact aliases alone did not distinguish a Preview build from a build targeting Production.

**Spec impact: no spec change.** This restores the explicit Preview metadata requirement in the [Task 3 isolation plan](../superpowers/plans/2026-10-18-m3-task3-preview-isolation.md), under the [dedicated runner architecture](../superpowers/specs/2026-10-17-dedicated-runner-design.md) and ADR-0002. Product behavior, frozen Shared Contracts v1, message validation and VM/resource limits are unchanged.

## Bounded implementation plan and outcome

1. Add failing activation and build-configuration regressions for absent, Production, Development, custom and conflicting deployment metadata. The activation checks initially returned the runner origin for all five denied metadata values; the original Vite configuration also failed the rejection assertion.
2. Require both `VERCEL_ENV=preview` and `VERCEL_TARGET_ENV=preview` in the QA artifact builder and the QA Vite configuration. Reject before invoking builds or replacing prepared artifacts. Vite emits a Preview marker only for that validated QA mode; ordinary builds explicitly erase that marker even if public `VITE_*` overrides are supplied. The browser gate requires the marker in addition to its existing mode/origin/development checks.
3. Run regression checks, strict typechecking, QA artifact builds and the app/runner suites. CI now runs the build regressions and supplies the two explicit Preview metadata values only to the QA build step. Keep hosted deployment verification separate.

Local/CI QA prebuild in PowerShell, with process-only metadata:

```powershell
$env:VERCEL_ENV = 'preview'
$env:VERCEL_TARGET_ENV = 'preview'
node scripts/build-m3-qa.mjs
```

## Verification

- `node node_modules/vitest/vitest.mjs run`: **192 app tests passed**, including five new denied-metadata cases and the existing exact-origin, development-mode and Production-mode negative controls.
- `node --test scripts/check-m3-qa-build.test.mjs`: **2 tests passed**. Both the Vite configuration and the builder reject eight missing/non-Preview metadata combinations. The builder exits with the policy error before starting either build. The configuration also ignores a public Preview-marker override in ordinary Production mode.
- `node scripts/build-m3-qa.mjs` with both process metadata values set to `preview`: **passed**, including strict app and runner typechecking and both artifact builds.
- Installed runner Vitest suite: **42 tests passed**.
- An in-memory Vite build probe executed the compiled activation function with public enable/origin/Preview-marker overrides: ordinary Production mode returned `null`; validated QA mode returned the exact approved runner origin.
- `git diff --check`: passed.

Requirements-to-code/tests: explicit Preview metadata is enforced by both build entry points and the browser gate, with negative metadata and ordinary-build override coverage. Code-to-specs: the changes implement the existing Task 3 requirement and preserve the approved exact-origin/protocol boundaries.

## Remaining delivery boundary

These are build-time checks. A prebuilt static artifact cannot discover that a publisher later uploads or promotes it to Production. The authorized publisher must explicitly select Preview, verify the actual deployment classification and artifact/source identity, and only then assign the frozen QA aliases, as required by Task 3. There is no publishing implementation in this repository to change; this correction neither uploads artifacts nor changes hosted resources.

No hosted acceptance or fresh independent approval of this correction is claimed by this implementation record. The owner subsequently authorized committing/pushing the correction to draft PR #9 and obtaining fresh independent security approval. Record that assessment separately against the correction commit. Q5/Q6 and Production activation remain separate gates.
