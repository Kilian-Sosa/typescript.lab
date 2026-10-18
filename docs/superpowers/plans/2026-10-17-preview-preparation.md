# App and runner preview preparation

**Status (updated 2026-10-18):** The protected app Preview is READY at the [verified Preview origin](https://typescript-lab-app-preview-mb2mltwhd-kiliansosas-projects.vercel.app), pinned to `cf5a0404cc9d667cfc3cd21ab6f97d1a79fc3f2b`. The owner separately approved an inert, protected static Production bootstrap to satisfy Vercel's first-deployment rule, then the app Preview and its exact OAuth callback. The real app has not been deployed to Production. Full hosted M4 acceptance, runner hosting and production app enablement remain gated. The original blocker below is historical.

**Spec impact: no spec change.** Executes the accepted frontend deployment and auth requirements, ADR-0001/0003, and the dedicated runner's existing security gates. [M4 frontend execution](2026-10-17-m4-frontend-recovery.md) owns the app changes; [M3](2026-10-17-quickjs-runner-implementation.md) owns the separate runner gate.

## Verified target and app source

Read-only Vercel inspection on 2026-10-17 confirmed account `kilian-sosa`, team `kiliansosas-projects`, and no project matching `typescript`. No project or deployment was created. Recheck immediately before a hosted operation.

App project: `typescript-lab-app-preview` in that team, created without a Git connection on 2026-10-18. Deployed app source is commit `cf5a040` on `feat/auth-persistence` from `Kilian-Sosa/typescript.lab`, repository root; subsequent commits refine tests and documentation. The owner authorized its separate M4 PR publication on 2026-10-18. Keep Git disconnected and pin the reviewed source for any subsequent deployment. Vercel's first-deployment Production rule also affects direct uploads; avoiding Git import alone is insufficient.

The root `vercel.json` now specifies Vite, `pnpm run build`, `dist`, and SPA deep-link rewrites including `/auth/callback`. Use Node 24.x and the existing `pnpm@11.25.0` package-manager pin. For the preview environment, propose `ENABLE_EXPERIMENTAL_COREPACK=1`, so the lockfile is consumed by the pinned manager. Leave installation detection in place; a plain `pnpm install` override can select an older manager. Verify the actual manager/version and frozen lockfile in build logs; stop rather than regenerate dependencies remotely.

References: [Vercel package managers](https://vercel.com/docs/package-managers), [Corepack configuration](https://vercel.com/docs/builds/configure-a-build), [Vite deployment](https://vercel.com/docs/frameworks/frontend/vite), and [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## App hosted change package and execution history

### Initial execution and deployment blocker (2026-10-18, superseded)

Created the empty project through the Projects API with no `gitRepository` and `skipGitConnectDuringLink: true`. Verified zero deployments before submitting source. The project uses Node 24.x, Vite, the existing build/output settings and only the three approved variables, each scoped exclusively to Preview. The dashboard continues to offer Connect Git Repository; no Git integration was attached.

Uploaded the 139 tracked files directly from pinned commit `cf5a0404cc9d667cfc3cd21ab6f97d1a79fc3f2b`, with no ignored/local configuration files. The [Deployments API reference](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment) describes an omitted `target` as Preview. Nevertheless, the creation response classified deployment `dpl_6YV4yMXrifCTiZy51WzW9CHC4yFy` as Production. Canceled it immediately through the API while dependencies were still installing. Build logs end before `pnpm run build`; no completed app build or ready deployment was observed. Manager detection matched `pnpm@11.25.0`, and installation reported an unchanged lockfile, but this does not validate a completed hosted build.

The separate [Environments documentation](https://vercel.com/docs/deployments/environments#first-deployment) explains that a new project's first deployment is always Production; ordinary Preview routing applies after that first Production deployment exists. This contradicts using the API's generic default as a first-deployment safety guarantee. Do not retry with an omitted target, explicit Preview target, legacy staging target, Git import, or a placeholder Production bootstrap under the current approval. Obtain a supported first-deployment mechanism that satisfies preview-only classification before another deployment request. A build guard or withholding Production variables can prevent a functioning app build, but cannot by itself prevent creation of a Production-classified record.

The owner explicitly approved deletion of the canceled deployment. Deleted it through the signed-in dashboard. Final API audit and dashboard observation confirmed:

- Project `prj_A9RxaacGe5etNB8Jxp7PCu4dNZW9`, [dashboard](https://vercel.com/kiliansosas-projects/typescript-lab-app-preview).
- Zero deployments, including zero Production deployments; `live: false`, `latestDeployment: null`, and an empty domains list.
- Exactly `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `ENABLE_EXPERIMENTAL_COREPACK`, all targeting Preview only. Values remain outside tracked documents.
- No actual Preview origin exists. No OAuth redirect, GitHub provider, Supabase policy, runner project, plan, paid resource, DNS or production-enablement change was made. Hosted browser/auth acceptance remains pending.

Read-only preflight reverified account `kilian-sosa`, team `kiliansosas-projects`, four preexisting projects, no matching proposed project, and zero deployments in the preceding day. The account and dashboard report Hobby. No plan or billing change was made.

### Authorized package

1. Recheck account/team, project-name availability and Hobby/free limits. Create only the proposed app project, with no DNS, paid features, production domains or automatic production Git connection. Deploy the exact reviewed app commit to **preview**, never production.
2. Preview build environment contains only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the existing approved `typescript.lab` Supabase project, plus the Corepack flag. Retrieve public values privately; never copy credentials or the project reference into public documents. No service-role key, OAuth secret or runner environment value belongs in the app bundle.
3. Capture the actual deployment URL and project identity returned by Vercel. That exact HTTPS origin is currently **unresolved**: a proposed name is not proof of ownership or availability. Prepare the subsequent exact OAuth change for review using that returned URL; do not guess an alias or add a wildcard while waiting for it.
4. For that separately reviewed origin, add precisely `https://<verified-deployment-host>/auth/callback` to the existing Supabase redirect allowlist. Preserve the four approved local redirects and existing Site URL. The GitHub OAuth App's callback remains the existing Supabase Auth callback; it does not become the Vercel callback. Scopes stay `read:user user:email`.
5. Validate deep-link reload, PKCE success, denial/expiry and sanitized URL; local sign-out, same-account recovery, account switch, explicit guest import, CAS conflicts, offline recovery, retry and private Notebook access. Use the owner-authorized GitHub account. Keep real tokens out of logs, screenshots and traces. Remove disposable draft fixtures; do not create immutable attempts merely to clean them up later.

The initial preview-only approval could not cover a Production bootstrap. The owner subsequently approved the narrow exception and exact callback described below. Public source publication, project creation, OAuth configuration and production app enablement remain distinct approvals.

### Approved bootstrap, app Preview and exact callback (2026-10-18)

After the initial blocker, the owner explicitly approved a protected, inert static HTML bootstrap with no application code, API or credentials. Protection had to be enabled before exposure; Git connection, custom domains, DNS, paid infrastructure and production app deployment remained excluded. The owner then authorized the pinned app Preview and separately approved its exact Supabase callback.

| Deployment | Classification / state | Purpose |
| --- | --- | --- |
| `dpl_5EzARJYnoSJFENhECoYYVykkvRHp` | Production / READY | Inert static bootstrap only; never use as the app or an OAuth redirect |
| `dpl_DV2BNTTUZfCiNM4FccdF6yt3Hc55` | Preview / CANCELED | Extra canceled attempt; not the acceptance target |
| `dpl_EkVexBC26QKgBBAzczWHwycKWeBL` | Preview / READY | Application from exact commit `cf5a0404cc9d667cfc3cd21ab6f97d1a79fc3f2b` |

Read-only Vercel reinspection for PR #6 confirmed these three records, the source SHA, and project-wide Vercel Authentication (`ssoProtection.enabled: true`, `deploymentType: all`). The app appears in the Preview-filtered listing with API `target: null`; only the inert bootstrap appears in the Production-filtered listing. The project now has two default Vercel aliases associated with the bootstrap. The old zero-deployment/domain observation above describes only the state before the separately approved bootstrap. The project API's `live: false` field does not mean there is no ready Preview; inspect the deployment and environment explicitly.

The earlier deployment execution record verified the pinned pnpm 11.25.0 build, unchanged lockfile, completed Vite output and unauthenticated HTTP redirects to Vercel SSO. It records only the three approved Preview-scoped variables and no Git connection. This documentation follow-up rechecks classification and protection configuration; it does not repeat real-provider acceptance or inspect secret values.

The exact app URL is [the protected Preview](https://typescript-lab-app-preview-mb2mltwhd-kiliansosas-projects.vercel.app). The subsequent OAuth execution record confirms that the owner-approved redirect `https://typescript-lab-app-preview-mb2mltwhd-kiliansosas-projects.vercel.app/auth/callback` was saved and verified after reloading Supabase URL Configuration. The four existing local redirects and Site URL `http://127.0.0.1:5173` were preserved; no wildcard or bootstrap callback was added. The GitHub OAuth App still returns to Supabase Auth, using `read:user user:email`.

### Remaining acceptance and release gates

- The owner reports sign-in automatically returns using the existing GitHub session. This is limited evidence of the happy path; it does not prove a fresh consent, denial, expiry, account switch or complete persistence/recovery flow.
- A separate browser without Vercel access is stopped by Deployment Protection. Authenticate an authorized tester with Vercel before testing app OAuth. Preserve protection; do not disable it or broaden redirects to complete acceptance.
- Complete real Preview checks for sanitized PKCE callbacks, deep-link reload, private autosave, same-account recovery, sign-out, account isolation, explicit guest import, two-tab CAS conflicts and offline retry. Keep tokens and private source out of screenshots/traces/logs, and clean disposable drafts. Existing local/intercepted tests and the earlier hosted RLS/API baseline remain separate evidence.
- The final PR security review is recorded in the [M4 security report](../../security/2026-10-18-final-m4-security-review.md). A code-review decision does not complete live hosted acceptance, authorize a production app deployment or clear the separate runner gate.

No new deployment, hosted configuration change or broader approval is performed by this documentation update.

## Separate runner preview package (still gated)

The spike corrections are independently validated on separate branch `fix/runner-security` at local commit `83e4889`; that clears the local prerequisite for Task 1 only. They are not integrated into the app's auth branch and do not create `apps/runner/`. Before a runner preview, finish the static runner implementation and its focused tests; then obtain a separate hosted approval for a distinct static runner project.

Record both exact verified app/runner HTTPS origins and prove that they are different **sites**, including the actual hosted public-suffix/cookie behavior. Different project names, ports or arbitrary sibling subdomains are insufficient evidence. Configure strict origin/source/nonce/handshake/result checks; never authorize `*` as an app origin. The runner receives source/challenge data only, with no account IDs, tokens, drafts, notes or secrets. It must not inherit the app's Supabase environment.

The runner's hosted gate must verify actual HTML and Worker CSP response headers, WASM bootstrap, iframe flags, storage/cookie/DOM/navigation/network separation, resource/output limits, single-active-Worker bursts, cancellation/replay attacks and browser/mobile/cold-cache/offline behavior. Opaque-origin failure may use the approved cross-site fallback only after these checks. Q5/Q6 and owner enablement remain explicit gates; no native-JavaScript fallback or production Run Tests activation is included here.
