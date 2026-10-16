# Local Supabase persistence

Use Supabase CLI 2.121.0 and run these commands from the Track D worktree so the isolated `typescript-lab-track-d` configuration is selected:

```powershell
supabase start
supabase db reset --local
supabase test db --local
```

`db reset --local` rebuilds only this worktree's local database from its migrations. The schema is not linked to or pushed to a hosted project. Stop only this local stack with `supabase stop` from the same worktree.

## Persistence contract

`solution_drafts` is private and keyed by `(user_id, challenge_id)`. Clients omit `user_id`, `revision`, and `updated_at`; the database derives ownership from `auth.uid()`, starts a new row at revision `0`, and assigns timestamps. To create, issue an `INSERT` without an upsert; a duplicate key means create-only conflict. To save an existing draft, issue one conditional `UPDATE` for its challenge where `revision` equals `expectedRevision`, changing only `source` and `challenge_version`. The database trigger increments the revision and updates the timestamp. A zero-row update means conflict. Treat `expectedRevision = 0` as a normal revision. RLS limits every operation to the current user, and column grants prevent owner/key or metadata changes.

There is no draft RPC: the single conditional SQL update is the compare-and-swap operation, while a create-only insert enforces the `null` expected-revision case. This keeps the write path atomic under ordinary authenticated table access without a privileged function.

`solution_attempts` stores immutable source, challenge version, notes, nullable declared complexity, a server-generated ID and timestamp, and the exact saved evaluation summary. `test_summary` uses the Shared Contracts v1 shape: either `{"status":"untested"}` or a completed status with integer `totalCases` and `passedCases`. A passed summary must have at least one case and every case passed.

The client adapter maps a duplicate-key error from create or a zero-row conditional update to the shared conflict result. It must test `expectedRevision === null` explicitly so revision zero stays valid, send no owner ID, and mark an evaluation `untested` if its source or challenge version no longer matches the saved snapshot. PostgreSQL validates the summary's shape, not the truth of client-reported test results; those results are educational feedback and cannot authorize trusted scoring.

There is one current draft per user and challenge; draft revisions are concurrency tokens, not a retained draft history. Attempts accumulate as immutable history. Both tables cascade-delete when their auth user is deleted, and this migration adds no time-based retention or backup policy. Schema changes after real user data exists need a forward migration and an independently verified recovery plan; `supabase db reset --local` is destructive to this isolated local database.
