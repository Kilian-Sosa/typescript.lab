# Supabase Authentication and Private Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Supabase GitHub authentication and durable, private, conflict-aware solution drafts without breaking guest practice.

**Architecture:** Vue 3 consumes Supabase Auth and a least-privilege public client. Postgres RLS enforces ownership; migrations and policy tests live in Git. Draft autosave uses revision-based optimistic concurrency and local recovery.

**Tech Stack:** Supabase Auth/PostgreSQL/RLS, GitHub OAuth, supabase-js, Vue 3, Vitest, Supabase local DB tests where available, Vercel env configuration.

**Spec:** `docs/superpowers/specs/2026-10-16-typescript-lab-design.md` (`REQ-05`, `REQ-07`, `REQ-13`); ADR-0003; `ROADMAP.md`.

**Plan status:** Ready for owner review; implementation starts only when this milestone is selected.

## Global Constraints

- Reuse signed-in Edge Supabase org `kiliansosa`, verify it before creating the `typescript-lab` project.
- UI's prefilled `Kilian-Sosa's Project` is **not** an approved project name. Confirm project, region, quotas and zero unexpected billing.
- Disable automatic exposure of future tables; enable automatic RLS when supported; create strict explicit policies on every private table.
- Never commit/print database passwords, service role/secret keys, OAuth client secrets or auth tokens. Client uses publishable/anon key only.
- No account ID supplied by a client can grant access; RLS must derive ownership from `auth.uid()`.
- URLs for localhost, Vercel preview and production must be narrowly authorized, no permissive wildcards.

## Review Focus

1. Cross-user `SELECT`, `UPDATE`, `DELETE` on drafts denied; Task 1.
2. New user cannot read another user's profile/draft; Task 1.
3. Old autosave response cannot overwrite a newer revision; Task 2.
4. Expired session/offline state preserves the unsynced text locally and never labels it `Saved`; Task 2.
5. OAuth callback failure/denied permission provides clear retry without leaking tokens; Task 1.

---

### Task 1: Project, OAuth and RLS schema

**Files:** Create `supabase/config.toml` (only nonsecret settings), `supabase/migrations/0001_auth_drafts.sql`, `supabase/tests/draft_policies.test.sql`, `src/lib/supabase.ts`, `src/features/auth/auth.ts`, `src/features/auth/AuthCallbackPage.vue`, `.env.example`; modify router.

**Interfaces:** `getSession()`, `signInWithGitHub()`, `signOut()`; `solution_drafts` keyed by `(user_id, challenge_id)` with `revision` and timestamps. Schema documents explicit owner-only policies for read/insert/update/delete. `src/lib/supabase.ts` only consumes public URL/key.

- [ ] Write migration/policy tests simulating two separate users and unauthenticated access; verify tests fail before policies.
- [ ] Inspect the Edge Supabase new-project form; confirm current org, project availability, region, fees and the `Enable automatic RLS` / auto-exposure choices. Provision **only** with explicit approval for unexpected effects.
- [ ] Create secure project and GitHub OAuth provider/callback configuration through supported dashboard/connector flows. Store generated secrets privately, never in output.
- [ ] Write migration with explicit row ownership RLS; apply only to the dedicated project, then run policy tests against actual DB (use secure alternatives if local DB unavailable).
- [ ] Configure public keys/URLs locally and in the correct Vercel environments through provider UI; test local + preview callback/redirect and sign-out.
- [ ] Run typecheck, tests, build and security checks; commit `feat(auth): add GitHub sign-in and private draft schema` (never secrets).

### Task 2: Resilient autosave and guest transition

**Files:** Create `src/features/solutions/draftRepository.ts`, `draftSync.ts`, `draftSync.test.ts`, `DraftSaveStatus.vue`; modify `src/pages/ChallengePage.vue`.

**Interfaces:** `loadDraft(challengeId: string): Promise<Draft | null>`; `saveDraft(challengeId: string, source: string, expectedRevision: number): Promise<Draft | Conflict>`; client-side `DraftSaveState = 'idle'|'saving'|'saved'|'offline'|'error'|'conflict'`.

- [ ] Write failing tests for debounce, revision conflict, two tabs, lost connectivity, expired session, guest state and import prompts.
- [ ] Implement optimistic compare-and-swap via an RLS-safe SQL function or equivalent atomic update; no overwrite on stale revision.
- [ ] Preserve a recoverable local unsynced buffer until server acknowledgment; label local saves honestly.
- [ ] Validate browser experience with network offline/online transitions and failed refresh, then run tests/typecheck/build.
- [ ] Commit `feat(drafts): add conflict-safe private autosave`.
