# App and runner preview preparation

**Status:** Local preparation only. Hosted creation, deployment, environment changes and redirect changes are **not authorized** by this document.

**Spec impact: no spec change.** Executes the accepted frontend deployment and auth requirements, ADR-0001/0003, and the dedicated runner's existing security gates. [M4 frontend execution](2026-10-17-m4-frontend-recovery.md) owns the app changes; [M3](2026-10-17-quickjs-runner-implementation.md) owns the separate runner gate.

## Verified target and app source

Read-only Vercel inspection on 2026-10-17 confirmed account `kilian-sosa`, team `kiliansosas-projects`, and no project matching `typescript`. No project or deployment was created. Recheck immediately before a hosted operation.

Proposed app project: `typescript-lab-app-preview` in that team. Source is the reviewed `feat/auth-persistence` commit from `Kilian-Sosa/typescript.lab`, repository root. Record the exact final commit after local verification; never deploy a moving branch implicitly. Keep Git-triggered production deployment disabled/unconnected during preview setup; a first Git import can otherwise deploy production automatically.

The root `vercel.json` now specifies Vite, `pnpm run build`, `dist`, and SPA deep-link rewrites including `/auth/callback`. Use Node 24.x and the existing `pnpm@11.25.0` package-manager pin. For the preview environment, propose `ENABLE_EXPERIMENTAL_COREPACK=1`, so the lockfile is consumed by the pinned manager. Leave installation detection in place; a plain `pnpm install` override can select an older manager. Verify the actual manager/version and frozen lockfile in build logs; stop rather than regenerate dependencies remotely.

References: [Vercel package managers](https://vercel.com/docs/package-managers), [Corepack configuration](https://vercel.com/docs/builds/configure-a-build), [Vite deployment](https://vercel.com/docs/frameworks/frontend/vite), and [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## App hosted change package (approval required)

1. Recheck account/team, project-name availability and Hobby/free limits. Create only the proposed app project, with no DNS, paid features, production domains or automatic production Git connection. Deploy the exact reviewed app commit to **preview**, never production.
2. Preview build environment contains only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the existing approved `typescript.lab` Supabase project, plus the Corepack flag. Retrieve public values privately; never copy credentials or the project reference into public documents. No service-role key, OAuth secret or runner environment value belongs in the app bundle.
3. Capture the actual deployment URL and project identity returned by Vercel. That exact HTTPS origin is currently **unresolved**: a proposed name is not proof of ownership or availability. Prepare the subsequent exact OAuth change for review using that returned URL; do not guess an alias or add a wildcard while waiting for it.
4. For that separately reviewed origin, add precisely `https://<verified-deployment-host>/auth/callback` to the existing Supabase redirect allowlist. Preserve the four approved local redirects and existing Site URL. The GitHub OAuth App's callback remains the existing Supabase Auth callback; it does not become the Vercel callback. Scopes stay `read:user user:email`.
5. Validate deep-link reload, PKCE success, denial/expiry and sanitized URL; local sign-out, same-account recovery, account switch, explicit guest import, CAS conflicts, offline recovery, retry and private Notebook access. Use the owner-authorized GitHub account. Keep real tokens out of logs, screenshots and traces. Remove disposable draft fixtures; do not create immutable attempts merely to clean them up later.

This package is ready for review of preview provisioning. OAuth preview activation needs the actual returned origin and its own exact configuration review. Public source publication, project creation, OAuth configuration and production enablement are distinct approvals.

## Separate runner preview package (still gated)

The spike corrections do not create `apps/runner/`. Only independently validated corrections can clear the local prerequisite for M3 Task 1. Before a runner preview, finish the static runner implementation and its focused tests; then obtain a separate hosted approval for a distinct static runner project.

Record both exact verified app/runner HTTPS origins and prove that they are different **sites**, including the actual hosted public-suffix/cookie behavior. Different project names, ports or arbitrary sibling subdomains are insufficient evidence. Configure strict origin/source/nonce/handshake/result checks; never authorize `*` as an app origin. The runner receives source/challenge data only, with no account IDs, tokens, drafts, notes or secrets. It must not inherit the app's Supabase environment.

The runner's hosted gate must verify actual HTML and Worker CSP response headers, WASM bootstrap, iframe flags, storage/cookie/DOM/navigation/network separation, resource/output limits, single-active-Worker bursts, cancellation/replay attacks and browser/mobile/cold-cache/offline behavior. Opaque-origin failure may use the approved cross-site fallback only after these checks. Q5/Q6 and owner enablement remain explicit gates; no native-JavaScript fallback or production Run Tests activation is included here.
