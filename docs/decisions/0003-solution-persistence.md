# ADR-0003: Personal solutions, drafts and history

**Status:** Accepted by owner, 2026-10-16
**Date:** 2026-10-16

## Problem

The product's core long-term value is remembering *a developer's own solution*, not just offering a canonical answer. They should be able to return after months, see code and notes as originally written, and compare their new understanding with older attempts.

## Alternatives

| Storage | Strength | Limit |
| --- | --- | --- |
| Files / personal fork | User ownership, standard Git history | Poor experience for autosave from a shared website |
| GitHub Gists | Shareable revisions | OAuth permission management; unlisted is not equivalent to private |
| Supabase PostgreSQL + Auth | Private account data, typed queries, access control, history | External service cost/operations, explicit data export needed |

## Decision

Use **Supabase Auth (GitHub OAuth) + PostgreSQL with enforced Row Level Security** for personal persistence; offer export of all personal solution content to ordinary TypeScript + Markdown/JSON files. No GitHub repo-write OAuth permission is needed for normal sign-in.

Initial conceptual tables (subject to migration design):

```text
profiles
  id (authenticated user ID)
  created_at

solution_drafts
  user_id
  challenge_id
  challenge_version
  source
  updated_at
  revision

solution_attempts
  id
  user_id
  challenge_id
  challenge_version
  source
  notes
  declared_time_complexity
  declared_space_complexity
  test_summary
  created_at
```

Unique draft key is the combination of `user_id + challenge_id` unless requirements later call for concurrent named drafts. Submission IDs are immutable and history is append-only. All note and source fields are explicitly user-owned. `challenge_version` ensures archived attempts retain context even when editorial content changes.

## Safety and correctness rules

1. Apply ownership through RLS using the authenticated identity, never a user ID taken from the request body.
2. A private draft may update in place; a submitted attempt cannot be silently overwritten.
3. Autosave should use an increasing revision/concurrency token to avoid an older network response replacing newer edits.
4. The editor retains unsaved content locally until acknowledged; displaying `Saved` requires a confirmed durable server response.
5. Offline drafts may be locally cached with a visible label. Importing guest state after sign-in must not overwrite another existing draft without an explicit choice.
6. Submission status reflects actual test results or `untested`; do not mark arbitrary saved code `passed`.
7. Export includes challenge ID/version, exact source, timestamp and notes. Users can read exports without a cloud subscription.
8. Publishing community solutions is a separate, deferred consent-based feature. Existing records are never exposed by default.

## Failure cases to test before release

- Session expiry during autosave.
- Network disconnect and reload with a newer local draft.
- Out-of-order autosave responses on rapid edits.
- Concurrent tabs editing one draft.
- Attempts that refer to a now-updated challenge.
- Another authenticated user attempting to read/export the owner’s records.
- Failed submit after successful evaluation; ensure source is not lost.

## Review trigger

Revisit this ADR before deploying a public community gallery, monetization, GitHub synchronization or cross-device offline sync.
