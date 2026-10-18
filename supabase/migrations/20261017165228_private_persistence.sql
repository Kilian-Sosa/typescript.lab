-- Private learner persistence. Ownership is always derived from auth.uid().

create table public.solution_drafts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  challenge_id text not null,
  challenge_version text not null,
  source text not null,
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint solution_drafts_pkey primary key (user_id, challenge_id),
  constraint solution_drafts_challenge_id_format check (
    challenge_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint solution_drafts_challenge_version_nonempty check (
    length(challenge_version) > 0
  ),
  constraint solution_drafts_revision_nonnegative check (revision >= 0)
);

create function public.bump_solution_draft_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.user_id is distinct from old.user_id
    or new.challenge_id is distinct from old.challenge_id then
    raise exception using
      errcode = '42501',
      message = 'draft owner and challenge key are immutable';
  end if;

  new.revision := old.revision + 1;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$function$;

revoke all on function public.bump_solution_draft_revision() from public, anon, authenticated;

create trigger solution_drafts_bump_revision
before update on public.solution_drafts
for each row
execute function public.bump_solution_draft_revision();

alter table public.solution_drafts enable row level security;

create policy solution_drafts_select_own
on public.solution_drafts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy solution_drafts_insert_own
on public.solution_drafts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy solution_drafts_update_own
on public.solution_drafts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy solution_drafts_delete_own
on public.solution_drafts
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.solution_drafts from public, anon, authenticated;
grant select, delete on table public.solution_drafts to authenticated;
grant insert (challenge_id, challenge_version, source)
on table public.solution_drafts to authenticated;
grant update (challenge_version, source)
on table public.solution_drafts to authenticated;

create table public.solution_attempts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  challenge_id text not null,
  challenge_version text not null,
  source text not null,
  notes text not null default '',
  declared_time_complexity text,
  declared_space_complexity text,
  test_summary jsonb not null,
  created_at timestamptz not null default now(),
  constraint solution_attempts_pkey primary key (id),
  constraint solution_attempts_challenge_id_format check (
    challenge_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint solution_attempts_challenge_version_nonempty check (
    length(challenge_version) > 0
  ),
  constraint solution_attempts_test_summary_valid check (
    case
      when jsonb_typeof(test_summary) is distinct from 'object' then false
      when test_summary = '{"status":"untested"}'::jsonb then true
      when test_summary - 'status' - 'totalCases' - 'passedCases' <> '{}'::jsonb then false
      when coalesce(test_summary ->> 'status', '') not in (
        'passed',
        'failed',
        'compile-error',
        'timeout',
        'execution-error',
        'infrastructure-error'
      ) then false
      when jsonb_typeof(test_summary -> 'totalCases') is distinct from 'number' then false
      when jsonb_typeof(test_summary -> 'passedCases') is distinct from 'number' then false
      else
        (test_summary ->> 'totalCases')::numeric >= 0
        and (test_summary ->> 'passedCases')::numeric >= 0
        and trunc((test_summary ->> 'totalCases')::numeric)
          = (test_summary ->> 'totalCases')::numeric
        and trunc((test_summary ->> 'passedCases')::numeric)
          = (test_summary ->> 'passedCases')::numeric
        and (test_summary ->> 'passedCases')::numeric
          <= (test_summary ->> 'totalCases')::numeric
        and (
          test_summary ->> 'status' <> 'passed'
          or (
            (test_summary ->> 'totalCases')::numeric > 0
            and (test_summary ->> 'passedCases')::numeric
              = (test_summary ->> 'totalCases')::numeric
          )
        )
    end
  )
);

create index solution_attempts_owner_challenge_created_idx
on public.solution_attempts (user_id, challenge_id, created_at desc, id desc);

alter table public.solution_attempts enable row level security;

create policy solution_attempts_select_own
on public.solution_attempts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy solution_attempts_insert_own
on public.solution_attempts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

revoke all on table public.solution_attempts from public, anon, authenticated;
grant select on table public.solution_attempts to authenticated;
grant insert (
  challenge_id,
  challenge_version,
  source,
  notes,
  declared_time_complexity,
  declared_space_complexity,
  test_summary
)
on table public.solution_attempts to authenticated;

comment on table public.solution_drafts is
  'Private mutable drafts; owner, revision, and timestamp are database-controlled.';
comment on table public.solution_attempts is
  'Private immutable snapshots of submitted source and its saved evaluation summary.';
