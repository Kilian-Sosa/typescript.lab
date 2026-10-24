# MVP release and rollback runbook

**Scope:** Operational go/no-go after the two implementation PRs. This document authorizes no deployment, protection change, alias assignment, OAuth update, data mutation or release.

Authority: [Production design](superpowers/specs/2026-10-24-mvp-production-design.md), [local acceptance](release/2026-10-24-production-local-acceptance.md) and [separate hosted record](release/production-hosted-acceptance.md). Local synthetic evidence cannot fill hosted gates.

## 1. Establish the candidate and rollback identities

- [ ] Both PRs integrated and reviewed; all five exact checks pass on the candidate: `verify`, `lint`, `Dependency vulnerability audit`, `static-security`, `secret-scan`. Preserve CodeQL severities and source-pinned finding reviews.
- [ ] Record the reviewed commit and confirm a clean checkout before building (`git status --porcelain` must be empty). Never reuse implementation-stage dirty artifacts or CI fixture-auth artifacts.
- [ ] Rebuild the pair with the approved public Supabase configuration using `node scripts/build-mvp-production.mjs`. Both deployment metadata values must be `production`; no local env files are read. Inspect manifest `sourceSha`, `sourceTreeHash`, `dirty: false`, origins and every file hash.
- [ ] Retain the reviewed manifest and complete paired artifacts in the controlled release workspace, outside Git. Record their identities in the hosted record; never record keys, auth state or private source/notes.
- [ ] Verify the signed-in Vercel team/account, existing app/runner project names and IDs, Node version, Git/deployment automation and protection settings. Explicitly confirm there is no automatic domain assignment or unapproved deployment from a Git push.
- [ ] Independently identify the known safe app and runner rollback deployments (prefer the existing inert protected bootstraps), their exact immutable IDs, targets, source identities, aliases and protection posture. Inspect their served content and headers; do not use a stale historical URL or choose "latest". Enter both verified IDs in the hosted record. Missing/unverified rollback identities block release.
- [ ] Confirm owner decisions on licensing/contribution posture; do not solicit external contributions before a license is selected. Record outstanding native screen-reader and supported-browser checks.

## 2. Stage without assigning Production domains

Obtain explicit owner permission for the concrete team/projects, reviewed SHA, artifact pair and protection settings before hosted mutations. Verify current plan support for protecting all deployments; Standard Protection alone leaves Production domains public.

- [ ] Protect app and runner staged/generated deployments before uploading code. Do not bootstrap with a temporary public application deployment or weaken protection to troubleshoot.
- [ ] Stage reviewed Production artifacts with domain assignment skipped. For an approved prebuilt workflow, the command is `vercel deploy --prebuilt --prod --skip-domain`, executed separately in each correctly linked project workspace containing its reviewed `.vercel/output`. Do not run it from this repository root against an unspecified project.
- [ ] Confirm independently that each platform deployment is `production`, ready, belongs to the approved project/team and references the reviewed Git source. Record immutable IDs/URLs and inspect the deployed file inventory against the retained manifest, including absence of unexpected files/routes.
- [ ] Confirm generated URLs remain Vercel-authenticated anonymously. Validate uploaded contents using the authorized operator session. An exact-origin-gated app intentionally cannot execute on its immutable generated URL; do not weaken the gate to test it there.
- [ ] Never promote a Preview build as a substitute: promotion may rebuild it. Promote the already reviewed staged Production deployment without rebuilding, then recheck identity.

Official references: [skip-domain](https://vercel.com/docs/cli/deploy#skip-domain), [staged Production promotion](https://vercel.com/docs/deployments/promoting-a-deployment), [protection](https://vercel.com/docs/deployment-protection). Inspect current settings/capabilities at execution time; flags and manually supplied build metadata are not security attestation.

## 3. Hosted acceptance at the exact aliases

- [ ] With owner authorization, deliberately assign only the reviewed pair's exact aliases. Keep the app Vercel-authenticated; make only the reviewed static runner alias public. Keep generated/Preview URLs protected or redirected to the intended canonical alias.
- [ ] Check approved Supabase public configuration and exact app `/auth/callback` allowlist entry. Any redirect/provider change needs separate approval; no wildcards or expanded GitHub scopes.
- [ ] Run the read-only delivery verifier below. It queries Vercel directly for deployment/project/alias identity, requires platform-linked `gitSource.sha` (not arbitrary custom `--meta`), verifies every manifest static file byte/hash and emitted response policy, and probes generated/extra aliases anonymously. It fails if platform Git provenance is unavailable, rather than treating a caller-supplied SHA as attestation. Resolve that gap before acceptance.
- [ ] Independently inspect Vercel's deployment file inventory and complete project domain/Preview inventory. The verifier covers the two selected deployments and their reported aliases, not every historical deployment or a proof that no unlisted endpoint exists.

Example command (IDs and SHA below are placeholders; use the verified release record). Provision only explicitly approved, scoped read access and the app's existing approved automation bypass in the operator process. Do not create a bypass/exception as part of running this script.

```powershell
node scripts/check-production-hosted.mjs `
  --manifest 'C:\release\reviewed-pair\manifest.json' `
  --reviewed-sha '<reviewed-40-character-sha>' `
  --team 'team_<approved-team>' `
  --app-project 'prj_<app-project>' --runner-project 'prj_<runner-project>' `
  --app-deployment 'dpl_<app-candidate>' --runner-deployment 'dpl_<runner-candidate>' `
  --phase acceptance
```

Tool-only process credentials: `VERCEL_TOKEN=<scoped-read-token>` and `VERCEL_AUTOMATION_BYPASS_SECRET=<approved-app-bypass>`. Do not put them in `.env.example`, Vite variables, URLs, command-line arguments, screenshots, records or Git. The token goes only to `api.vercel.com`; the bypass header goes only to the exact app alias. Runner and alternative-host probes are anonymous. Redirects are never followed with credentials. The script has no mutation endpoints; it reports `scope: delivery-only`, not full hosted acceptance. It does not configure either credential automatically.

- [ ] Using dedicated disposable test accounts A/B and disposable data, run genuine GitHub OAuth, callback cleanup/return, sign-out and expiry/recovery. Do not use the existing private draft. Record no tokens or callback query/fragment; capture screenshots only after auth parameters are cleared.
- [ ] Prove RLS with real sessions: A can save/read/export its own records; B and anonymous sessions cannot read/update/export A's draft, attempts or notes by guessing IDs or changing client user IDs. Verify immutable attempts and cleanup only the authorized disposable accounts/data through the approved process. Never disable RLS or expose a service-role key.
- [ ] At the exact aliases under real TLS, run actual QuickJS 14/14, wrong answers, semantic/runtime errors, console bounds/escaping, timeout/cancel/disposal and retry. Run → Save → Notebook → JSON for passed/failed/untested; verify source/version/notes, unchanged history and recovery after failed submit.
- [ ] Verify iframe sandbox/referrer, parent DOM/cookie/localStorage/IndexedDB separation, no credentials/notes/identity in runner traffic, HTML/Worker/WASM policies and startup/recovery with third-party cookies restricted. Keep source and secrets out of URLs/logs/telemetry.
- [ ] Complete desktop/tablet/mobile, keyboard, themes, 200%-equivalent reflow, reduced motion and native assistive-technology checks. Record supported browsers and actual limitations.
- [ ] Record the independent Production security approval, delivered identities, evidence and owner decision. A delivery script pass alone cannot authorize public release.

## 4. Public release and aftercare

- [ ] Obtain the owner's explicit final go decision tied to the exact app/runner IDs and reviewed SHA after all hosted/security gates pass. This is an operational decision, not a third feature PR.
- [ ] Expose the exact app alias without rebuilding; keep the static runner alias public. Re-read both alias mappings and run the verifier with `--phase released` (no app bypass is sent).
- [ ] Verify all other generated and Preview entry points remain protected/canonicalized, including project-level inventories outside the verifier's selected deployments. Check no alternate app entry point becomes public and no new source has been auto-promoted.
- [ ] Monitor authentication, runner startup/errors/timeouts, persistence failures, request volume and operator-agreed provider budgets. Record the operator/contact, observation window and stop conditions. Do not silently expand quotas, billing or protection exceptions.

## 5. Rollback on a mismatch or incident

Stop if identity, hash, policy, protection, OAuth, privacy or runner isolation differs from the accepted record. Preserve learner drafts/attempts and evidence; do not reset the database, rewrite immutable history or broaden redirects.

1. With the approved operator procedure, restore authentication/protection on the exact app alias first to stop new public access. Protect the runner alias next to stop new execution requests; an SSO response is an honest infrastructure failure, not successful execution. Already loaded pages may persist, so do not treat app protection alone as an execution kill switch.
2. Restore only the two explicitly recorded, independently verified safe rollback deployments. For an earlier served Production deployment use the approved `vercel rollback <verified-deployment-id>` workflow for its exact linked project; a never-served staged artifact uses promotion instead. Do not guess IDs or rebuild under the guise of rollback.
3. Keep protection restored while rechecking both alias mappings, target/source identities, inert/disabled execution, actual HTML/Worker policies and anonymous SSO behaviour. Remove any temporary exposure exception before moving aliases; never leave an exception active on the rollback content.
4. Verify the exact approved OAuth redirect posture; revert only changes that were made for this release and are explicitly authorized to revert. Preserve provider scopes and private stored work. Clean up only the designated disposable test accounts/data.
5. Record failure, actions, remaining requests/sessions and independent readback. Vercel rollback can alter automatic domain assignment; verify it remains disabled until a later owner-approved promotion. Reopening the app requires a new explicit operational go decision.

An incomplete rollback identity table or failed protection readback is a **NO-GO**, not an instruction to invent a temporary public fallback.
