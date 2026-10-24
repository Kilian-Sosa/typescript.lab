# Responsive authenticated header implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this bounded fix. No delegated review is required.

**Goal:** Fix issues #12 and #13 while preserving authentication recovery and keyboard access.

**Architecture:** Give header buttons the same control style, reserve a stable account-action slot, and let the header wrap intentionally at constrained CSS widths. Keep auth state handling in AuthControls.

**Tech Stack:** Vue 3, TypeScript, Vitest, Playwright / Microsoft Edge.

**Spec:** Product spec sections 6, 8, REQ-11/12; docs/design/README.md responsive and accessibility contracts; ADR-0001.

**Spec impact:** Update the existing design contract with the owner's explicit account-copy and header alignment requirements. No auth, persistence, runner or shared-contract changes.

## Global constraints

- No horizontal page overflow; preserve theme, repository, brand and account keyboard access.
- Preserve auth checking, async disabling, explicit errors and sign-out retry.
- No deployments, dependencies or environment-variable changes.
- Preserve unrelated working files. Base: 76c1cff on feat/mvp-isolated-runner-activation; implementation branch: fix/header-auth-reflow.

## Review focus

- Checking, guest, signed-in and signing-out transitions must not shift neighboring actions.
- Failed sign-out must still expose retry and announce the error.
- Long auth messages must wrap without pushing controls outside the page.
- Mobile must keep complete accessible names on compact controls.
- Zoom tests must document effective CSS viewports; device scaling or CSS zoom do not prove browser zoom.

### Task 1: Align auth and reflow the header

**Files:** src/features/auth/AuthControls.vue, src/app/components/AppShell.vue, src/app/styles/tokens.css, src/features/auth/AuthControls.test.ts, tests/e2e/auth-recovery.spec.ts, docs/design/README.md.

**Interfaces:** Consume the existing AuthController and router injection. Produce unchanged sign-in/sign-out semantics and a responsive app shell.

- [x] Add component regressions for removed copy, pending states, sign-in errors and failed-sign-out retry.
- [x] Add intercepted browser regressions for authenticated/guest action geometry, keyboard access, no overflow and stable auth transitions. Model a 1280px browser content area at 100/125/150/200% as 1280/1024/853/640 CSS px; also test 390px mobile.
- [x] Run regressions before fixing and confirm failures identify the reported copy/alignment bugs.
- [x] Remove redundant account copy, use a shared header-action style without text-button margins, stabilize the auth slot and allow intentional wrapping.
- [x] Extend the existing design contract with these owner-approved requirements.
- [x] Run component suite, typecheck/build and intercepted browser regressions using installed Edge. Inspect desktop/mobile screenshots and the final diff.

## Verification record — 2026-10-24

- RED: three component failures identified redundant copy, sign-out pending presentation and missing duplicate-sign-in disabling. The browser regression reproduced the connected copy and 6px account-action misalignment before implementation.
- GREEN: `node node_modules/vitest/vitest.mjs run` — 26 files, 198 tests passed.
- GREEN: `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`, then `node node_modules/vite/bin/vite.js build` — passed.
- GREEN: process-only `PLAYWRIGHT_BROWSER_CHANNEL=msedge`, `node scripts/check-recovery.mjs --workers 2` — 26 tests passed across desktop/mobile projects. Auth/Data traffic is fully intercepted at the existing synthetic fixture origin.
- Browser plugin not available; used the existing Playwright suite and installed Edge. Sandbox invocation stalled; approved outside-sandbox execution completed. The first cold navigation timed out and the warmed retry reached the page without timeout changes.
- Verified page identity/content, no framework overlay or console errors in header scenarios, keyboard action order, theme changes, no overflow, aligned 40px controls, stable checking/sign-in/sign-out geometry and failed-sign-out recovery.
- Inspected screenshots at 1280, 640 and 390 CSS px. Equivalent zoom reflow is covered; actual browser zoom and hosted/provider acceptance remain unverified.
- Final self-review maps issue #12 to viewport/geometry/keyboard checks and issue #13 to copy/state/component/browser checks. Updated the existing design contract; shared contracts and environment variables are unchanged.

Publication authorized by the owner through publish-branch-commits-pr. Commit and push only this scoped change and open a PR against feat/mvp-isolated-runner-activation; deployment and merge remain separate actions.
