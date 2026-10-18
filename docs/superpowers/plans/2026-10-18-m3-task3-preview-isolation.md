# M3 Task 3 — exact Preview deployment and isolation plan

Date: 2026-10-18. **Prepared only; no deployment or hosted configuration change authorized by this document.**

**Spec impact: no spec change.** Implements the existing [dedicated runner security gates](../specs/2026-10-17-dedicated-runner-design.md), ADR-0002, Shared Contracts v1 and [QuickJS plan Task 3](2026-10-17-quickjs-runner-implementation.md). Task 2 remains locally gated. This plan does not approve hosted execution or Production Run tests.

## Read-only preflight evidence

Rechecked through authenticated Vercel tools on 2026-10-18:

| Item | Verified value / state |
| --- | --- |
| Account | `kilian-sosa` |
| Team | `kiliansosas-projects`, `team_pkJIKCPbLKDhKMAQuE9RrAhB` |
| Existing app project | `typescript-lab-app-preview`, `prj_A9RxaacGe5etNB8Jxp7PCu4dNZW9` |
| App protection | Vercel Authentication enabled, `deploymentType: all` |
| App Git connection | None; preserve this |
| Existing app Preview | `dpl_EkVexBC26QKgBBAzczWHwycKWeBL`, READY, Preview-filtered API `target: null` |
| Existing exact app origin | `https://typescript-lab-app-preview-mb2mltwhd-kiliansosas-projects.vercel.app` |
| Existing Preview source | `cf5a0404cc9d667cfc3cd21ab6f97d1a79fc3f2b`; predates runner integration |
| Existing app Production | `dpl_5EzARJYnoSJFENhECoYYVykkvRHp`, READY, inert bootstrap only |
| Proposed separate runner project | `typescript-lab-runner-preview`; absent from the five returned team projects |

The earlier app bootstrap approval is recorded in [preview preparation](2026-10-17-preview-preparation.md). It does **not** authorize another project's bootstrap. Recheck these identities, project-name availability, protection, free limits and Git disconnection immediately before any authorized write. Do not inspect secret values.

## Approval package and first-deployment constraint

Vercel documents that a new project's first deployment is Production, including CLI deployments without `--prod` and non-production branches. Subsequent Preview rules apply only once that Production deployment exists. Direct upload or an omitted API target is not a safe bypass. [Official first-deployment rule](https://vercel.com/docs/deployments/environments#first-deployment).

The concrete package to seek approval for at execution time is:

1. Create only `typescript-lab-runner-preview` in the verified team, without Git, integrations, auth-provider configuration, custom domains, DNS or paid features. Use Node 24 and the existing pinned lockfiles/tooling. One infrastructure owner performs all writes.
2. Before any payload, enable and read back Vercel Authentication on **all** deployments, including Production aliases. Verify the supported free protection setting; stop if it requires billing or cannot be applied to the empty project. [Protection scopes](https://vercel.com/docs/deployment-protection).
3. Obtain a **runner-specific explicit exception** for exactly one protected, inert static Production bootstrap. Its entire payload is a short HTML maintenance notice; no scripts, application code, Worker, WASM, source map, functions, environment values, credentials or redirects. Record its file list/hash, deployment ID and returned URLs. Use `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`, no-store, no-referrer and nosniff response headers. Verify classification and unauthenticated protection before continuing.
4. After that exception is approved and verified, publish only pinned **Preview** artifacts. No runner/app code may replace the inert Production payload or its default Production aliases. No `promote`, `--prod`, staged Production code, Git connection or automatic domain promotion.

If approval is Preview-only, leave the new project empty. Do not bootstrap and call it Preview. Failure of any preflight/protection check is a STOP, not permission to change account, disable protection or weaken isolation.

## Exact origins without guessing generated deployment URLs

The existing M4 Preview cannot exercise Task 2: its source predates the editor adapter. Task 2's production bundle also deliberately refuses hosted origins, so deploying that bundle unchanged cannot complete Q5/Q6. A separately reviewed, Preview-only activation/configuration slice is required before the execution below; this plan does not implement it.

Both builds must know exact communicating origins. The runner's `frame.ts` also checks its configured self-origin. Repeatedly deploying and copying randomly generated immutable URLs into the opposite build would keep changing the pair. Resolve this with two dedicated, frozen Preview aliases, assigned only to verified Preview deployment IDs. Vercel supports `.vercel.app` aliases; an alias is not proof of Preview classification. [Official alias schema](https://github.com/vercel/sdk/blob/main/docs/models/aliases.md), [generated URL purposes](https://vercel.com/docs/deployments/generated-urls), [alias command](https://vercel.com/docs/cli/alias).

Exact **proposals**, currently unreserved and unverified:

| Role | Proposed exact QA origin | Project |
| --- | --- | --- |
| A — app host for this isolated QA | `https://typescript-lab-m3-app-qa.vercel.app` | Existing app Preview project |
| R — runner iframe | `https://typescript-lab-m3-runner-qa.vercel.app` | New runner Preview project |

These are not existing deployments, ownership claims or approved allowlist entries. During an authorized execution:

1. After the runner bootstrap, create inert **Preview** discovery deployments in each project. The existing app project needs no new Production bootstrap. Reserve each proposed alias to its corresponding inert Preview only; inspect alias ownership, TLS and deployment target. If either name is unavailable or resolves to another resource, stop for an exact replacement; do not guess suffixes or broaden origins.
2. Capture an approval manifest with `account`, `teamId`, both `projectId`s, exact A/R aliases, discovery IDs, protection, source SHA and artifact hashes. Obtain approval of that concrete pair before source-bearing deployments/activation. No wildcard, dynamic query-string origin, referrer-derived origin or message-supplied configuration.
3. Prepare/review the Preview-only app activation: explicit Preview build metadata plus approved A/R pair; production defaults remain disabled even when variables are present. The QA Vite configuration and `scripts/build-m3-qa.mjs` require both `VERCEL_ENV=preview` and `VERCEL_TARGET_ENV=preview`; missing, Production, Development, custom or conflicting metadata must abort before artifact generation. Only this validated QA configuration supplies the browser gate's Preview marker; public `VITE_*` variables cannot supply it to an ordinary build. Reject same-site/unknown origins. Retain exact origin/window/nonce/context/schema checks. Unit/build tests must prove Production cannot enable execution. Keep the local `.test` opt-in separate.
4. Build app and runner from the exact reviewed activation SHA, based on the CI-green runner PR. App `frame-src` permits only R. Runner `frame-ancestors` and parent origin permit only A; configured runner self-origin is R. Both artifacts must reject communication through alternate deployment/Production URLs. Source is sent only after the exact handshake.
5. Assign A/R to the final READY **Preview** deployments, then read back alias → deployment → project → source SHA → environment. Keep Git disconnected and aliases frozen throughout testing. Record unique deployment URLs too, but execute tests using A/R. Recheck mappings before and after every test batch; any reassignment or source/header change invalidates evidence. Never attach A/R to Production deployments.

Do not modify the existing pinned M4 Preview or its exact OAuth callback. Use synthetic guest source in a fresh browser context for M3 QA, with Supabase client configuration omitted from the separately prepared QA app artifact. No private account data, new OAuth redirects, scopes or database writes are needed. This does not claim real-provider/persistence acceptance.

## Reproducible artifacts and configuration

Use a clean checkout of the final reviewed SHA. Record its full hash and the exact pinned Node/pnpm/Vercel publishing-tool versions before uploading; do not use `latest` or regenerate lockfiles. Select the authenticated connector or a reviewed pinned CLI at execution time. Local Git source publication does not authorize a hosted upload.

| Artifact | Build boundary / allowed values | Delivery |
| --- | --- | --- |
| App QA | Repository root; reviewed Preview-only activation and A/R pair; no Supabase/account credentials | Pinned static Preview in existing app project; SPA deep-link rewrites retained |
| Runner | `apps/runner`; exact lockfile; `VITE_RUNNER_PARENT_ORIGIN=A`, `VITE_RUNNER_ORIGIN=R`; `LAB_RUNNER_LOCAL_TEST` absent | Generated `.vercel/output/static` **and** `.vercel/output/config.json` through Build Output API v3 |
| Production bootstrap | Reviewed inert HTML/header manifest, no code/environment | Sole new Production payload, only under its explicit exception |

Use a reviewed prebuilt upload preserving the Build Output API routes, or verify equivalent platform build behavior. Uploading only the runner's static files would drop its separate HTML/Worker response policies and fails the gate. `apps/runner` imports approved cases and shared contracts outside that root; a remote build must include those reviewed source files. No functions, server runtime evaluator or extra dependencies are needed. [Build Output routing configuration](https://vercel.com/docs/build-output-api/configuration#routes).

For a local/CI prebuild, set the two Preview metadata values in that process only, then run `node scripts/build-m3-qa.mjs`. They record build intent, not evidence of a hosted destination. Before upload, the authorized publisher must explicitly select Preview and reject any Production/default-first-deployment path; before attaching either QA alias, read back the actual deployment's Preview classification and source/artifact identity as required above. A static artifact cannot detect that it was later uploaded or promoted to Production. No publishing command is implemented or authorized by this build script. [Vercel system environment metadata](https://vercel.com/docs/environment-variables/system-environment-variables).

Runner page policy is the current `deploymentPolicy`: default/object/base/form/frame denied, scripts/workers self, connections none, ancestors A. Worker policy separately permits only self scripts plus minimal WASM compilation and same-origin WASM fetch; nested Workers and frames denied. Verify headers on the **actual hashed Worker response**, not just HTML or configuration files. App origin must not inherit `wasm-unsafe-eval` or native learner evaluation.

## Protected cross-site iframe access preflight

Keep Vercel protection enabled. Authenticate the authorized tester at both exact aliases and try an inert iframe before sending any source. Authentication is URL-specific; logging into an immutable URL need not authorize its alias. Third-party cookie restrictions can still block embedding. [Vercel Authentication considerations](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication#vercel-authentication-security-considerations).

An SSO HTML page or redirect in place of runner/Worker/WASM content is an access failure, not execution evidence. If ordinary authorized-browser access is insufficient, stop and request approval for a narrowly scoped automation access method. A supported automation method can use project-specific protection-bypass HTTP headers from the external test controller, matched to the exact origin and never forwarded across redirects. Do not use global browser headers for all sites. Obtain any required credential through the supported private auth flow; never commit, display or inject it into app JS, iframe messages, VM, URLs, screenshots or traces. Do not create new bypass secrets or trusted-source rules without separate authorization. [Official automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

Header-authenticated automation proves only that access path. It does not prove ordinary cross-site iframe cookies work. If protected-browser embedding cannot work within the approved access method, Q6 stays blocked. Do not disable protection, enable public runner access, pay for a feature or add a bypass query parameter to make a test green.

## Hosted verification matrix

Run against the recorded A/R pair, with normal HTTPS and browser security: **no** local host mapping, ignore-certificate flags or insecure-origin-as-secure switch. Preserve raw observations privately; publish sanitized evidence without source, auth state, bypass headers or private identifiers.

| Gate | Required observed evidence / negative control |
| --- | --- |
| Provenance | Both deployments READY and Preview-classified (including API filter checks if target is null); exact source/artifact hashes; aliases frozen; bootstrap still inert and protected |
| TLS and site | Valid certificates, distinct registrable sites under the current public-suffix list, synthetic host-only cookie/localStorage/IndexedDB canaries isolated; attempted `Domain=vercel.app` cookie rejected; no app state in runner requests |
| Response policies | HTML, hashed Worker, WASM and failure/404 paths checked; exact ancestors/frame-src; nosniff/no-referrer; no third-party scripts/analytics; no redirects to unapproved origins or HTML masquerading as JS/WASM |
| Isolation | Runner cannot read parent DOM/storage or navigate parent/open popups; page network denied, Worker arbitrary network/imports/nested Workers denied; learner VM browser/host APIs absent; only inputs cross into VM |
| Real results | Current-source canonical pass and wrong answer; tie/empty/nonpositive/fractional/Unicode cases; semantic and syntax compile errors; import policy; runtime exception; expected/actual diagnostics |
| Messaging | Wrong source/origin/nonce/protocol/contract, empty/partial/duplicate/sparse/oversized/nonfinite results, forged case and aggregate statuses, old revisions, cancelled/replayed results, iframe reload/crash/slow handshake; no fake pass |
| Resource lifecycle | VM interrupt and independent hard watchdog (including expensive built-ins), memory/stack/output/source budgets, single-active-Worker bursts, fresh VM/Worker per run, cancel/unmount disposal and bounded retry; app remains responsive |
| UX and delivery | Desktop/mobile sizes, keyboard/live feedback/focus, 200% zoom, cold/warm cache, offline/blocked asset/reconnect and cancellation during startup; record versions, real timings and any unsupported browser/device |
| Privacy | No auth tokens, IDs, notes, persisted draft objects, reference source or telemetry in protocol; no source in URLs/network requests/logging; fresh guest QA context; immutable Notebook saving remains explicitly untested |

Capture Q5 separately from Q6; local CI and one Chromium/mobile-size emulation do not prove all browser/device behavior. A desktop/mobile screenshot is not a cookie or CSP proof. Any essential failure is **NO-GO**, with the concrete artifact/origin/browser and repro recorded.

## Completion, rollback and next approval

- Write a hosted execution report with full source SHA, project/deployment IDs, exact URLs, artifact/header hashes, browser versions, test commands/results, startup/run timings, limitations and Q1–Q6 outcomes. Record both positive and failed controls. Reconcile requirements → code/tests and changed behavior → specs in the same handoff.
- Obtain focused independent reassessment of the actual hosted evidence and the Preview-only activation slice. A Task 2 local code approval does not approve these new changes or Q5.
- On failure, disable the new QA activation/stop testing and point only the dedicated QA aliases back to their inert Preview discovery deployments after recording the failed IDs. Preserve the existing M4 Preview, production bootstraps and protection. Do not delete unrelated deployments or evidence. Close temporary test contexts and remove local test credentials/artifacts safely.
- On success, keep the reviewed pair frozen for the acceptance window. Ask separately before production activation, app/runner Production deployment, public access, broader auth changes or release. No merge or production deployment follows automatically from a green PR.

**Current stop condition:** Task 3 plan prepared. Runner project, runner bootstrap exception, concrete alias ownership, Preview activation and hosted probes are not executed or approved here. Approval of this plan's text alone is not proof that the proposed URLs exist.
