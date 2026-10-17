# Publication, M3 review and M4 completion follow-up

**Owner request:** Fix the two Router test warnings, verify and publish `feat/runner-notebook-visualizer` as a PR to `main`; obtain an independent M3 security decision; prepare and complete M4 with approval before hosted changes.

**Authority:** [Product requirements](../specs/2026-10-16-typescript-lab-design.md), [dedicated runner design](../specs/2026-10-17-dedicated-runner-design.md), [M3 plan](2026-10-17-quickjs-runner-implementation.md), [M4 plan](2026-10-16-auth-and-drafts.md), ADR-0002/0003 and frozen Shared Contracts v1.

**Spec impact: no spec change.** Router warnings are an incomplete test fixture, the independent review evaluates the approved design, and M4 implements existing REQ-05/07/13. Any substantive design conflict found by review must be surfaced before changing accepted intent.

## 1. Publish the integrated implementation

- [x] Confirm the clean requested branch, remote and existing PR status; reproduce both `/explore` warnings in the Notebook empty-state tests.
- [x] Register the missing test-only route, then verify unit tests without Router warnings, strict typecheck, build, canonical solution cases, contracts and desktop/mobile browser tests.
- [x] Inspect and commit explicit paths using conventional messages; push normally and create [PR #5](https://github.com/Kilian-Sosa/typescript.lab/pull/5) targeting `main`. This authorization does not include merging or deployment.

## 2. Independent M3 security gate

- [x] A read-only GPT-6.1 Sol Medium security reviewer examines the actual spike and approved requirements, including VM host bridge, protocol/result validation, CSP, resource limits, lifecycle and opaque-origin failure.
- [x] Validate findings and preserve the [independent report](../../security/2026-10-17-independent-m3-review.md): no architecture amendment, but current Task 1/2 NO-GO pending Q4 correction and proof; aggregate Worker throttling required before shipping.
- [x] Keep learner execution disabled until implementation tests and separately authorized deployed TLS/site/cookie/CSP proof pass. No runner implementation or cloud changes belong to this review task.

## 3. M4 preparation and hosted approval

- [x] Verify the existing `typescript.lab` project in `kiliansosa`: healthy, no application tables/migrations, GitHub provider disabled, default local Site URL and empty redirect allowlist. The security advisor flags client EXECUTE grants on the automatic-RLS event-trigger helper; narrow grant hardening is included in the proposed change package.
- [x] Inspect the tested migration and existing client/session code against M4 requirements; prepare a private local hosted change package under `docs/prompts/` with exact targets, callbacks, migration hash, verification and cleanup. Local `.env.local` is configured with only the verified URL and modern publishable key and is Git-ignored. No app Vercel project/origin is available, so hosted preview/production environment settings remain a separate gate.
- [ ] Obtain explicit approval before hosted migration, OAuth/provider configuration or hosted environment changes. Use only public client configuration locally; never commit environment values or print credentials.
- [ ] After approval, apply the reviewed migration, configure least-privilege GitHub OAuth and public environment settings, then verify real sessions and anonymous/cross-user RLS denial.
- [ ] Complete callback/sign-out recovery and conflict-safe private autosave under the existing M4 plan; verify focused tests, typecheck, build and authenticated browser flows before calling M4 complete.

## Verification and decisions

- Baseline: 96 unit tests pass. Captured verbose output reproduces exactly two `VUE_ROUTER_R0004` warnings for `/explore` in `src/features/solutions/Notebook.test.ts`.
- The production router already defines `/explore`; no production behavior change is needed for the warning fix.
- After the fixture correction: 96/96 tests in 17 files pass with no Router warnings; strict Vue/TypeScript, Vite build, standalone shared-contract compilation, documentation links and whitespace checks pass. The Edge desktop/mobile suite passes 20 tests; two opt-in local-auth tests are intentionally skipped. This publication follow-up does not rerun the earlier disposable database/auth stack.
- The optional learner starter exercise suite was also invoked: its unimplemented starter passes 4/14 cases and fails the remaining 10 as expected. It is excluded from the application verification suite; the canonical solution's 14 cases pass in the main suite.
- Corepack could not download pnpm inside the network-restricted sandbox. Equivalent verification used the already-installed pinned project binaries directly through Node. Browser verification passed outside the sandbox after an interrupted sandbox launch produced no output.
- Hosted project identity is verified as the existing healthy `typescript.lab` project in `kiliansosa`, Paris. Project references and credentials stay out of public documentation.
- One independent reviewer is explicitly requested for M3. No additional reviewer is launched for the test-fixture change or routine publication.
