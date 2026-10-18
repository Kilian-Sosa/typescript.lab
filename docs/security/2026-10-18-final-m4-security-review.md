# Final M4 security review — PR #6

**Date:** 2026-10-18. **Scope:** `feat/auth-persistence` at `1a0d20f636ee14e78177b964a7c3bd0a2e112873` against `main` at `249d5e47ceaa7904c0d98fc18f3bf2de42c002b9`; subsequent changes in this follow-up are documentation only.

**Reviewer:** One independent, read-only GPT-6.1 Sol Medium security reviewer, requested by the owner. The coordinator inspected the implicated submission, workspace, auth and repository paths before recording the finding. No hosted settings or production code were changed during this review.

**Decision: REQUEST CHANGES before merging PR #6.** One confirmed P2 privacy boundary defect remains. This is a code security decision, not hosted acceptance or release authorization.

**Spec impact: no spec change.** The finding concerns existing REQ-07/13 and ADR-0003 private ownership and explicit guest import. Its correction should restore those requirements without changing frozen contracts. The remaining reviewed implementation maps to existing REQ-05/08/12; deployment documentation corrects execution status under ADR-0001/0003.

## Finding — P2: guest submissions can use the previous account during incomplete sign-out

Locations: `src/features/auth/auth.ts:176`, `src/features/solutions/DraftWorkspace.vue:31`, `src/features/solutions/AttemptSubmissionPanel.vue:42` and the SDK-session capture in `src/features/solutions/attemptRepository.ts`.

The auth controller clears its application identity immediately when sign-out begins. DraftWorkspace observes that identity and reconnects the guest editor. However, the attempt submission handler checks only that a repository exists; the repository independently accepts a valid retained SDK session. While sign-out is held, or after a failed sign-out that retains that session, newly entered guest source and notes can therefore be inserted into the previous account's immutable history. This bypasses the guest-to-account consent boundary even though database RLS correctly assigns the row to the JWT owner.

The reviewer reproduced the failed-sign-out path using the actual auth controller and attempt repository modules with synthetic in-memory Auth/Data transports: application owner was `null`, `signOutFailed` was `true`, yet a new guest attempt produced one successful insert owned by account A. The coordinator confirmed the corresponding UI path has no application-auth gate. No real account data was used.

**Required correction:** Before starting a new submission, require a verified signed-in application identity and reject pending/failed sign-out. Ensure the submission belongs to that application account. Preserve the existing handling of token-pinned writes that began before sign-out.

**Required regressions:** Hold logout while keeping account A's SDK session valid, then attempt to save newly entered guest source/notes; assert zero attempt inserts. Repeat after logout returns an error and retains that SDK session. Retain tests for ordinary signed-in submission, successful sign-out and writes already in flight. The current passing suites do not cover these two integrated failure paths.

## Reviewed boundaries and residual risks

The reviewer inspected the PR diff, PKCE capture/exchange and fixed messages, safe return routes, session verification/generations, private UI clearing, token-pinned draft/attempt requests, ownership decoding, revision CAS, recovery storage, explicit guest import, RLS/grants, migration changes and deployment configuration. No other actionable security defect was identified in this scope. No dependency-version changes were introduced; this review does not constitute a fresh dependency advisory scan.

Browser recovery buffers remain local to the browser/origin and separated by account/challenge/tab; they are not an encrypted vault against someone with local browser-profile access. The review does not certify the separate M3 runner or authorize learner execution.

## Deployment evidence and acceptance limits

The [deployment execution record](../superpowers/plans/2026-10-17-preview-preparation.md) now distinguishes the separately approved inert protected Production bootstrap from the application Preview pinned to `cf5a040`. Read-only Vercel inspection confirms READY Preview classification, exact source metadata and Vercel Authentication for all deployments. The later OAuth execution record confirms the fifth exact Preview callback was saved with no wildcard and existing local redirects/Site URL preserved.

The owner's same-browser automatic GitHub login is limited happy-path evidence. A browser without Vercel access stops at Deployment Protection. Neither observation completes live PKCE denial/expiry/replay, source/notes persistence, sign-out, account switch, two-tab conflict or offline recovery acceptance. Preserve Vercel protection while an authorized tester completes those checks. Earlier 47 hosted RLS assertions and seven real-session API assertions are historical evidence documented in the [hosted baseline](2026-10-17-hosted-persistence-verification.md), not rerun by this review.

## Fresh verification

- 141 unit tests pass across 22 files, without Vue/Router warnings.
- Strict Vue/TypeScript checking, Vite production build and shared-contract compilation with the installed project TypeScript pass.
- All ten intercepted authentication/recovery browser flows pass on desktop and mobile using installed Edge. The sandboxed invocation stalled without output and was stopped; the same bounded suite passed outside the sandbox. This suite uses only synthetic Auth/Data transports and does not exercise the two new submission failure cases above.
- Documentation validation passes (157 relative links); whitespace checks pass.
- Independent read-only review and synthetic failure reproduction confirm the P2 finding above.

Full hosted acceptance and release approval remain pending even after the finding is corrected. This documentation update does not change infrastructure, OAuth scopes, schema, application behavior or runner activation.
