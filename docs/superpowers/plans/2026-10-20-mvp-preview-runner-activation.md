# Authenticated MVP Preview — isolated runner activation

**Status:** Prepared and locally verified; hosted deployment and public runner delivery **not yet authorized or executed**. This plan does not approve any Production change.

## Problem

The previously published protected M4 app Preview was compiled before M3's runner integration. An ordinary `production` Vite build also intentionally disables runner execution, so the user sees `Tests have not run` and the Run button is disabled. The `m3-hosted-qa` artifact exercises the runner but intentionally excludes Supabase. No existing hosted artifact supports both authenticated drafts and real isolated test execution.

## Implementation

- New `mvp-preview` Vite mode: source remains the merged app, including Supabase and draft features, while the isolated QuickJS runner is enabled **only** with both `VERCEL_ENV=preview` and `VERCEL_TARGET_ENV=preview`, the dedicated trusted compiler marker, a normal non-development browser at **exact** `https://typescript-lab-m3-app-qa.vercel.app` and runner `https://typescript-lab-m3-runner-qa.vercel.app`.
- An ordinary Vite/Production build erases the marker even when public `VITE_*` variables attempt to override it. The earlier guest-only M3 QA path, local synthetic test sites, the reviewed exact-origin message protocol and the worker VM budgets remain unchanged.
- `scripts/build-mvp-preview.mjs` verifies explicit public Supabase configuration and the Preview target **before** creating any artifact, then produces app Build Output v3 with strict `frame-src R`, exact Supabase `connect-src`, no browser Worker/eval/foreign script allowances, and the separately hosted runner with existing per-Worker WASM CSP. A demo build may use a syntactically valid **fixture** publishable key; that artifact is never deployable for real auth.
- This is an application/runner **Preview pair**, not an authorization to reuse the QA mode for Production. The exact pair is locked to the existing reviewed QA aliases, not randomly generated deployment URLs.
- A new synthetic HTTPS browser regression intercepts the **actual compiled authenticated app/runner Build Output v3** at those exact origins, enforces the emitted CSP, proves real QuickJS 14/14 followed by an honest wrong-answer failure, rejects browser cookie/auth-header/referrer leakage toward the runner, and confirms the same compiled artifact is disabled at a different hostname. This is powerful integration evidence but **not** a replacement for actual Vercel HTTP/TLS/public-runner hosted tests.

## Remaining authorized hosted steps (not executed here)

1. Obtain a **fresh independent security review**, especially because an authenticated parent now embeds the static runner, and confirm no parent cookies, user IDs, auth tokens or private notes cross into iframe/Worker requests.
2. Build from a clean, reviewed SHA using **only the dedicated public Supabase URL/publishable key**, verify a PREVIEW-classified app and runner and exact hashes/headers, and obtain explicit permission to point A/R aliases at those artifacts.
3. Add the exact app QA `/auth/callback` redirect to Supabase **only if explicitly approved** (no wildcard). Obtain permission for a limited, timed public exception on the runner QA alias; do **not** bypass platform protection controls. If public delivery is unavailable, stop — a protected runner's SSO redirect is not valid VM execution.
4. Follow the [reviewed public-runner exposure plan](2026-10-18-m3-public-runner-exposure-review.md): the 30-minute total limit, operator monitoring, request/bandwidth budget and the unconditional **remove exception before alias rollback** ordering.
5. Run normal browser tests under real HTTPS/TLS: signed-in app/runner 14/14, wrong answer, watchdog, cancellation, mobile, third-party cookies blocked, IndexedDB and parent DOM separation, offline/retry, 200% zoom, OAuth/auth draft isolation and no sensitive runner-network data.
6. Verify protection restored (exact SSO probes, empty exceptions list and both QA aliases inert) before declaring QA complete.

**Production:** Define/approve a separate exact A/R origin pair, publicly served static runner protection posture and CSP, build that cannot be activated by `mvp-preview` or `m3-hosted-qa`, Run→Submit E2E, a new independent Production-specific security review and explicit release approval. Existing Production deployments remain inert.

No new secrets, domain aliases, Supabase redirects, Vercel exceptions, publishing permission or auth-provider changes are introduced by the code in this branch.
