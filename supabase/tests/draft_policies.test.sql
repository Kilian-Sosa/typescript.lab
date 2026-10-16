begin;

select plan(19);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'draft-owner-a@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'draft-owner-b@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000001', true);

insert into public.solution_drafts (challenge_id, challenge_version, source)
values ('longest-window', '1.0.0', 'const answer = 1;');

select is(
  (select user_id from public.solution_drafts where challenge_id = 'longest-window'),
  'd0000000-0000-4000-8000-000000000001'::uuid,
  'draft ownership comes from auth.uid()'
);
select is(
  (select revision from public.solution_drafts where challenge_id = 'longest-window'),
  0,
  'a new draft starts at revision zero'
);
select ok(
  (select updated_at is not null from public.solution_drafts where challenge_id = 'longest-window'),
  'draft timestamps are assigned by the database'
);

update public.solution_drafts
set source = 'const answer = 2;', challenge_version = '1.0.1'
where challenge_id = 'longest-window' and revision = 0;

select is(
  (select revision from public.solution_drafts where challenge_id = 'longest-window'),
  1,
  'a matching revision is atomically incremented by the database'
);
select is(
  (select source from public.solution_drafts where challenge_id = 'longest-window'),
  'const answer = 2;',
  'a matching revision saves its source'
);
select lives_ok(
  $command$
  do $block$
  declare affected_rows integer;
  begin
    update public.solution_drafts
    set source = 'stale source'
    where challenge_id = 'longest-window' and revision = 0;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then
      raise exception 'a stale revision unexpectedly updated a row';
    end if;
  end;
  $block$;
  $command$,
  'a stale revision updates no rows'
);
select is(
  (select source from public.solution_drafts where challenge_id = 'longest-window'),
  'const answer = 2;',
  'a stale revision does not overwrite the current source'
);
select throws_ok(
  $$update public.solution_drafts set challenge_id = 'another-challenge' where challenge_id = 'longest-window'$$,
  '42501',
  null::text,
  'draft challenge keys cannot be changed'
);
select throws_ok(
  $$update public.solution_drafts set user_id = 'd0000000-0000-4000-8000-000000000002' where challenge_id = 'longest-window'$$,
  '42501',
  null::text,
  'draft ownership cannot be changed'
);
select throws_ok(
  $$update public.solution_drafts set revision = 99, updated_at = '2000-01-01T00:00:00Z' where challenge_id = 'longest-window'$$,
  '42501',
  null::text,
  'a caller cannot change draft revisions or timestamps'
);
select throws_ok(
  $$insert into public.solution_drafts (user_id, challenge_id, challenge_version, source)
    values ('d0000000-0000-4000-8000-000000000002', 'spoofed', '1.0.0', 'spoofed')$$,
  '42501',
  null::text,
  'a caller cannot provide another owner ID'
);
select throws_ok(
  $$insert into public.solution_drafts (challenge_id, challenge_version, source, revision, updated_at)
    values ('spoofed-metadata', '1.0.0', 'spoofed', 99, '2000-01-01T00:00:00Z')$$,
  '42501',
  null::text,
  'a caller cannot provide draft revisions or timestamps'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.solution_drafts where challenge_id = 'longest-window'),
  0,
  'another signed-in user cannot read a private draft'
);
select lives_ok(
  $command$
  do $block$
  declare affected_rows integer;
  begin
    update public.solution_drafts
    set source = 'cross-user overwrite'
    where challenge_id = 'longest-window';
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then
      raise exception 'cross-user update unexpectedly changed a row';
    end if;
  end;
  $block$;
  $command$,
  'another signed-in user cannot update a private draft'
);
select lives_ok(
  $command$
  do $block$
  declare affected_rows integer;
  begin
    delete from public.solution_drafts
    where challenge_id = 'longest-window';
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then
      raise exception 'cross-user delete unexpectedly changed a row';
    end if;
  end;
  $block$;
  $command$,
  'another signed-in user cannot delete a private draft'
);

reset role;
select is(has_table_privilege('anon', 'public.solution_drafts', 'select'), false, 'anonymous users cannot select drafts');
select is(has_table_privilege('anon', 'public.solution_drafts', 'insert'), false, 'anonymous users cannot insert drafts');
select is(has_table_privilege('anon', 'public.solution_drafts', 'update'), false, 'anonymous users cannot update drafts');
select is(has_table_privilege('anon', 'public.solution_drafts', 'delete'), false, 'anonymous users cannot delete drafts');

select * from finish();
rollback;
