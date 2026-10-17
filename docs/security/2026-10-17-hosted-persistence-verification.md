# M4 hosted persistence and authentication verification

**Authorization:** Owner approved the five reviewed hosted operations on 2026-10-17 and explicitly authorized `Kilian-Sosa` for real GitHub sign-in. No Vercel provisioning, production deployment, billing, DNS, database reset or runner activation is included.

**Spec impact: no spec change.** This applies existing REQ-05/07/13 and ADR-0003 under the [M4 plan](../superpowers/plans/2026-10-16-auth-and-drafts.md). Hosted setup does not imply completion of frontend callback/sign-out recovery or resilient draft autosave.

## Identity, schema and migration history

Immediately before application, the existing dedicated project, organization, healthy status and region matched the reviewed package. The application schema and migration history were empty; the expected automatic-RLS helper/event trigger remained present. No unexpected drift was found.

The verified persistence migration's contents were unchanged: SHA256 `191E61F7035EC0087BB7DF087101B8EA83729BD08AE27892546EBFF2E235C05F`.

| Recorded version | Migration | Effect |
| --- | --- | --- |
| `20261017165228` | `private_persistence` | Private drafts, revision CAS primitives and immutable attempts, with explicit RLS and narrow grants |
| `20261017165248` | `restrict_auto_rls_execute` | Revoke client EXECUTE on the platform-owned automatic-RLS helper without changing its body, owner or event trigger |

Both operations used migration history. The connector assigned these versions, so local filenames were aligned with the recorded versions. The original persistence filename was `20261016193728_private_persistence.sql`; renaming did not change its verified bytes. The hardening migration skips an absent platform helper in environments that do not install one.

## Hosted database evidence

- **19/19 draft assertions passed:** server-derived ownership/metadata, revision-zero creation, matching/stale CAS, forbidden key/owner/revision spoofing, cross-user read/update/delete denial and anonymous privilege denial.
- **28/28 attempt assertions passed:** exact immutable snapshots, server IDs/timestamps, accepted completed/untested summary shapes, rejected transient/invalid summaries, owner/cross-user update/delete denial and anonymous privilege denial.
- Both suites ran inside rollback-only transactions. pgTAP was installed only within those transactions. `finish(true)` made any failed assertion or count mismatch fatal before a success marker could be returned.
- Two connector requests for the full SQL script returned a transport-state error; neither was counted as a pass. The supported SQL interface completed the assertions. A Monaco replacement issue was caught before a valid rerun; the complete intended script was verified by copy-back before execution.
- Final cleanup checks found **zero fixture users, zero draft/attempt rows, no verification probe table, and no pgTAP extension**.
- A privileged table creation after EXECUTE hardening still enabled automatic RLS. That probe transaction was rolled back. Both client roles lack helper EXECUTE and the automatic-RLS event trigger remains enabled.
- The security advisor returned no findings immediately after the two migrations. After OAuth verification, its final check flags disabled leaked-password protection. Email/password settings were not changed; this warning is recorded below rather than expanding the approved configuration scope.

Cross-user SQL tests use disposable authenticated claims, not two real GitHub accounts. They prove database policy/grant behavior; real OAuth/session evidence is recorded separately below.

## Provider and exact redirects

The dedicated GitHub OAuth App was registered under the authorized owner with the reviewed homepage and Supabase callback, without wildcard matching or device flow. The owner generated and entered its secret directly through GitHub/Supabase UI; the agent did not read, log, write or commit the secret. The public Auth settings endpoint confirms GitHub is enabled. The consent screen requests only read-only profile information and email addresses, matching `read:user user:email`.

Site URL: `http://127.0.0.1:5173`. Exact redirect allowlist:

- `http://127.0.0.1:5173/notebook`
- `http://127.0.0.1:4173/notebook`
- `http://127.0.0.1:5173/auth/callback`
- `http://127.0.0.1:4173/auth/callback`

The public project URL and modern publishable key remain in ignored local environment configuration. No hosted preview/production origin was added.

## Real-session gate

The owner completed the exact-scope GitHub consent for the authorized account. The local Notebook subsequently loaded its real empty private history. A local-only, Git-ignored verifier independently checked `auth.getUser()` and the authorized GitHub identity without displaying/exporting credentials. A separate Router warning later exposed callback tokens in dev-server output; see the [logging finding and containment status](2026-10-17-oauth-fragment-log-incident.md). No credential was committed to Git.

- **7/7 real-session API assertions passed:** server-derived draft ownership/initial revision, exact source round-trip, anonymous draft denial, revision CAS, stale-update denial, duplicate/create-only conflict, authenticated history access and anonymous history denial (the insert/default/source checks are grouped into one assertion).
- The session survived a full reload and a refresh followed by another server identity check.
- The disposable real-account draft was deleted before success was reported. No immutable attempt or persistent test account was created.
- Local-scope sign-out succeeded and the application's Notebook login gate returned. Other sessions were not targeted.
- Final database checks again confirmed zero SQL fixture users/drafts/attempts, no API verification draft, no probe table and no pgTAP extension. Both application tables retain RLS, both client roles lack helper EXECUTE, and automatic RLS remains enabled. Exactly the two approved migration-history entries exist.

During the consent handoff, one observed callback URL contained `bad_oauth_state` with “OAuth state not found or expired.” That callback was not counted as a successful login. On returning to Notebook, an authenticated session was present; the successful identity, persistence, refresh and sign-out claims above rely on independent server/API verification. Explicit expired/denied callback presentation remains frontend work; this setup does not claim that missing UI behavior is implemented.

The final advisor warning is [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). It was left unchanged: this slice configures GitHub OAuth and does not authorize changes to password-auth policy or billing. No RLS/helper findings remain.

Focused session/repository/account-switch tests pass: 14 tests in three files. After fixing the logging finding, all 100 unit tests, strict Vue/TypeScript, production build, documentation links and whitespace checks pass. The verified persistence SQL checksum remains unchanged. Owner-managed provider-token revocation and the already-issued access JWT's expiry remain separate containment gates.

M4 is not marked complete by this report. Explicit callback/denial recovery, editor/session recovery and resilient autosave remain frontend work in the original plan. Preview/production authentication requires a separately authorized app deployment and exact origins.
