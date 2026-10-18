# App and runner preview preparation

**Status:** Owner approved the app hosted change package on 2026-10-18, explicitly requiring preview-only provisioning. The empty app project and Preview variables are provisioned; deployment is **blocked** by Vercel's first-deployment Production rule. An unintended Production-classified build was canceled before the app build and deleted with owner approval. The project has zero deployments/domains and is not live. Exact-origin OAuth activation, runner hosting and production remain gated.

**Spec impact: no spec change.** Executes the accepted frontend deployment and auth requirements, ADR-0001/0003, and the dedicated runner's existing security gates. [M4 frontend execution](2026-10-17-m4-frontend-recovery.md) owns the app changes; [M3](2026-10-17-quickjs-runner-implementation.md) owns the separate runner gate.

## Verified target and app source

Read-only Vercel inspection on 2026-10-17 confirmed account `kilian-sosa`, team `kiliansosas-projects`, and no project matching `typescript`. No project or deployment was created. Recheck immediately before a hosted operation.

App project: `typescript-lab-app-preview` in that team, created without a Git connection on 2026-10-18. Verified app source is commit `cf5a040` on `feat/auth-persistence` from `Kilian-Sosa/typescript.lab`, repository root; subsequent commits refine tests and documentation. The owner authorized its separate M4 PR publication on 2026-10-18. No deployment is live. Pin the reviewed source commit when preparing the hosted change; never deploy a moving branch implicitly. Keep Git disconnected. Vercel's first-deployment Production rule also affects direct uploads; avoiding Git import alone is insufficient.

The root `vercel.json` now specifies Vite, `pnpm run build`, `dist`, and SPA deep-link rewrites including `/auth/callback`. Use Node 24.x and the existing `pnpm@11.25.0` package-manager pin. For the preview environment, propose `ENABLE_EXPERIMENTAL_COREPACK=1`, so the lockfile is consumed by the pinned manager. Leave installation detection in place; a plain `pnpm install` override can select an older manager. Verify the actual manager/version and frozen lockfile in build logs; stop rather than regenerate dependencies remotely.

References: [Vercel package managers](https://vercel.com/docs/package-managers), [Corepack configuration](https://vercel.com/docs/builds/configure-a-build), [Vite deployment](https://vercel.com/docs/frameworks/frontend/vite), and [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## App hosted change package (approved, partially executed)

### Execution record and deployment blocker (2026-10-18)

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

Preview provisioning was approved, but deployment cannot continue with the currently documented first-deployment behavior. OAuth preview activation still needs an actual Preview origin and its own exact configuration review. Public source publication, project creation, OAuth configuration and production enablement are distinct approvals.

## Separate runner preview package (still gated)

The spike corrections are independently validated on separate branch `fix/runner-security` at local commit `83e4889`; that clears the local prerequisite for Task 1 only. They are not integrated into the app's auth branch and do not create `apps/runner/`. Before a runner preview, finish the static runner implementation and its focused tests; then obtain a separate hosted approval for a distinct static runner project.

Record both exact verified app/runner HTTPS origins and prove that they are different **sites**, including the actual hosted public-suffix/cookie behavior. Different project names, ports or arbitrary sibling subdomains are insufficient evidence. Configure strict origin/source/nonce/handshake/result checks; never authorize `*` as an app origin. The runner receives source/challenge data only, with no account IDs, tokens, drafts, notes or secrets. It must not inherit the app's Supabase environment.

The runner's hosted gate must verify actual HTML and Worker CSP response headers, WASM bootstrap, iframe flags, storage/cookie/DOM/navigation/network separation, resource/output limits, single-active-Worker bursts, cancellation/replay attacks and browser/mobile/cold-cache/offline behavior. Opaque-origin failure may use the approved cross-site fallback only after these checks. Q5/Q6 and owner enablement remain explicit gates; no native-JavaScript fallback or production Run Tests activation is included here.
