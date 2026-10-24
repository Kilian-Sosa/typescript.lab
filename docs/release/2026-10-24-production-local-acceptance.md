# Production compiled-artifact local acceptance

**Status:** Local acceptance passed on `test/mvp-production-acceptance`, based on merged PR 1 (`1bbf56e`). This record is not hosted acceptance or a release candidate identity.

## Scope and evidence

The shared browser harness builds the real `mvp-preview` or `mvp-production` artifact, serves its exact emitted bytes and CSP through synthetic HTTPS interception at the respective pinned origins, and executes the actual iframe → disposable Worker → QuickJS/WASM pipeline. It intercepts every auth/data request and uses only synthetic identities and fixture public configuration. Unexpected external requests fail the test.

The local matrix covers current-source 14/14 and wrong answers; VM console levels/escaping/bounds; compile/runtime errors; timeout, cancel/focus/disposal; infrastructure retry; synthetic PKCE callback cleanup; failed-save source/notes preservation; immutable passed/failed/untested snapshots reopened and exported; mobile/tablet/desktop/200%-equivalent reflow, keyboard/theme and Interview spoiler gates.

Broader existing regression suites cover adversarial runner messaging/resource limits, restricted-cookie/storage isolation, auth/session transitions, owner-bound recovery and Notebook privacy. Exact final commands/results are recorded below after execution.

| Check | Result |
| --- | --- |
| Compiled Production browser acceptance | PASS: real emitted artifact/CSP, QuickJS lifecycle and all three saved statuses/detail/timeline/JSON |
| Compiled Preview regression | PASS: same shared harness and lifecycle/persistence assertions |
| Hosted-verifier negative/positive fixtures | Eight tests passed; no network; includes mid-verification alias inventory changes, MIME/header/budget and credential isolation |
| App unit suite / strict typecheck / ESLint | 250 tests and checks passed |
| Runner unit suite / strict typecheck / ESLint | 167 tests and checks passed |
| General responsive/navigation/visualizer browser regressions | 22 desktop/mobile tests passed on unchanged warm-cache retry |
| Synthetic auth/recovery browser regressions | 28 desktop/mobile tests passed, including account switching, multi-tab conflict, offline reload and stale-response privacy |
| Adversarial runner browser regressions | Both suites passed: cookie/localStorage/IndexedDB/DOM isolation, restricted third-party cookies, malicious messaging, bounded resources, desktop/mobile Console and lifecycle; built-runner instrumentation reported 26 Workers created, 26 terminated, zero active, max one |
| Build/policy/verifier tests and formatting | 25 tests passed; full ESLint/formatter and diff whitespace checks passed |
| Fresh fixture Production pair / secret scans | Both builds/typechecks passed; Gitleaks found no leaks in tracked source, 65-commit history, both Production static artifacts and the scripts directory including new untracked test/tool source |

## Executed browser commands and environment notes

Use the installed pinned Node entrypoints, with process-only `PLAYWRIGHT_BROWSER_CHANNEL=msedge` on Windows:

```powershell
node --test scripts/check-mvp-production-local.mjs
node --test scripts/check-mvp-preview-local.mjs
node node_modules/@playwright/test/cli.js test tests/e2e/navigation.spec.ts tests/e2e/visualizer.spec.ts --workers=2
node scripts/check-recovery.mjs --workers=2
node --test scripts/check-runner-local.mjs
node --test apps/runner/tests/browser.test.mjs
```

General navigation/visualizer tests explicitly cleared process `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, preventing developer-local hosted configuration from taking effect. The recovery wrapper supplies its own fully intercepted fixture origin; the compiled harness blocks every unexpected external origin. No real account, provider acceptance or hosted data was exercised.

An Edge sandbox launch hit the documented temporary SiteList permission failure; the narrow approved outside-sandbox rerun passed. The first general browser run had four cold Vite navigation timeouts and 18 passes; network traces showed approximately 11-second document waits and delayed module responses. The unchanged suite passed all 22 tests after the existing dependency cache warmed. No timeout increase, browser reinstall, cache reset or application assertion change was made. Temporary servers/browser contexts were owned and cleaned up by the test tools; no global settings or user services were changed.

## Limits and release identity

Synthetic auth/repository interception does **not** prove genuine GitHub OAuth, Supabase RLS, hosted TLS/headers/protection or real delivery isolation. See the separate [NOT RUN hosted record](production-hosted-acceptance.md). Native screen-reader and any unexercised supported-browser checks remain pending. These tests do not read or modify the existing private draft.

Implementation-stage dirty builds and fixture-auth artifacts are verification evidence only. After review and required checks, rebuild from the clean reviewed commit using approved public configuration, retain its source/tree/artifact hashes, and verify independent platform identities before hosted acceptance. PR source publication alone cannot make earlier local artifacts releasable. No hosted mutation or final release decision is included here.
