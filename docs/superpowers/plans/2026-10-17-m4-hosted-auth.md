# M4 hosted authentication and persistence execution

**Authority:** Owner approved the five operations in the private hosted change package on 2026-10-17, with explicit account authorization for `Kilian-Sosa`. Follow the [existing M4 plan](2026-10-16-auth-and-drafts.md), ADR-0003 and REQ-05/07/13. Work on `feat/auth-persistence`, based on the integrated Notebook branch; PR #5 stays separate.

**Spec impact: no spec change.** Apply existing private persistence requirements and least-privilege configuration; no new product behavior or contract version is introduced by hosted setup.

## Scope and gates

1. Recheck the existing project identity, empty application schema, migration history and verified migration checksum immediately before application. Stop on unexpected drift.
2. Apply the unchanged tested persistence SQL through migration history, then the separate automatic-RLS helper EXECUTE-grant hardening migration. Keep the helper body/owner and automatic-RLS trigger intact. If the connector assigns migration versions, align local filenames with those recorded versions without changing the verified SQL bytes.
3. Create the dedicated GitHub OAuth App and configure its secret only through the secure provider UI. Use only `read:user user:email`; retain any required credential-generation or consent handoff.
4. Configure only the exact local URLs in the approved package. No wildcard redirect pattern or unverified deployment origin.
5. Verify all 47 existing RLS assertions with rollback-only fixtures, automatic RLS after hardening, real authorized-account GitHub sign-in and session/persistence behavior. Remove transient verification records and report any incomplete gate honestly.

No Vercel provisioning, production deployment, billing, DNS, database reset or runner activation is authorized. Fresh approval is required for material deviations/new permissions. Public client values remain in ignored local configuration; no secret/service credential may enter logs, prompts or Git.

## Execution record

- Initial check: existing healthy project/organization/region verified; no application tables or migrations; only the expected automatic-RLS event-trigger helper in `public`. The tested migration SHA256 matches the approved package.
- OAuth verification account: `Kilian-Sosa`, explicitly authorized by the owner and confirmed by the connected GitHub account.
- Hosted persistence and separate EXECUTE hardening were applied through migration history; local filenames match connector-assigned versions and the persistence SQL checksum is unchanged. All 47 hosted policy assertions pass with rollback-only fixtures; cleanup is verified and the security advisor is clear. See the [verification record](../../security/2026-10-17-hosted-persistence-verification.md).
- The dedicated OAuth App, provider and exact local redirects are configured. Secret generation/entry/submission were performed privately by the owner; the agent never read the secret. The public Auth endpoint confirms GitHub enabled. Owner consent, server-verified real-account identity, seven API assertions with cleanup, reload/refresh and local sign-out/login-gate checks all passed. A final password-protection advisor warning is recorded without changing unapproved auth policy.
- Verification exposed an OAuth-fragment logging path in Router scrolling; it was reproduced with four failing unit cases and fixed without changing authentication authority or hosted settings. See the [finding](../../security/2026-10-17-oauth-fragment-log-incident.md). The owner elected scoped GitHub-authorization revocation; already-issued access-token expiry is a separate gate. No token values belong in the record.
- The [subsequent frontend execution](2026-10-17-m4-frontend-recovery.md) implements callback/sign-out recovery and conflict-safe autosave with local/intercepted proof. Live acceptance of its new PKCE flow and preview/production authentication await the separately approved hosted verification/deployment; the original hosted evidence above is not reclassified as proof of the new frontend.
