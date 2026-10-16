begin;

select plan(28);

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
    'd0000000-0000-4000-8000-000000000011',
    'authenticated',
    'authenticated',
    'attempt-owner-a@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'd0000000-0000-4000-8000-000000000012',
    'authenticated',
    'authenticated',
    'attempt-owner-b@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000011', true);

insert into public.solution_attempts (
  challenge_id,
  challenge_version,
  source,
  notes,
  declared_time_complexity,
  declared_space_complexity,
  test_summary
)
values (
  'longest-window',
  '1.0.0',
  'function longestWindow() { return { start: 0, endExclusive: 0 }; }',
  'Saved before running tests.',
  null,
  null,
  '{"status":"untested"}'::jsonb
);

select is(
  (select user_id from public.solution_attempts where source like 'function longestWindow%'),
  'd0000000-0000-4000-8000-000000000011'::uuid,
  'attempt ownership comes from auth.uid()'
);
select ok(
  (select id is not null from public.solution_attempts where source like 'function longestWindow%'),
  'attempt IDs are assigned by the database'
);
select ok(
  (select created_at is not null from public.solution_attempts where source like 'function longestWindow%'),
  'attempt timestamps are assigned by the database'
);
select is(
  (select source from public.solution_attempts where source like 'function longestWindow%'),
  'function longestWindow() { return { start: 0, endExclusive: 0 }; }',
  'the exact source snapshot is preserved'
);
select is(
  (select test_summary from public.solution_attempts where source like 'function longestWindow%'),
  '{"status":"untested"}'::jsonb,
  'an untested attempt may be saved'
);

insert into public.solution_attempts (
  challenge_id,
  challenge_version,
  source,
  notes,
  declared_time_complexity,
  declared_space_complexity,
  test_summary
)
values (
  'longest-window',
  '1.0.0',
  'function longestWindow() { return { start: 1, endExclusive: 2 }; }',
  'One case failed.',
  'O(n)',
  'O(1)',
  '{"status":"failed","totalCases":3,"passedCases":2}'::jsonb
);

select is((select count(*)::integer from public.solution_attempts), 2, 'a failed attempt may be saved');
select is(
  (
    select declared_time_complexity is null and declared_space_complexity is null
    from public.solution_attempts
    where test_summary = '{"status":"untested"}'::jsonb
  ),
  true,
  'claimed complexity may be null'
);
select is(
  (
    select declared_time_complexity || '/' || declared_space_complexity
    from public.solution_attempts
    where test_summary ->> 'status' = 'failed'
  ),
  'O(n)/O(1)',
  'claimed complexity is retained with the attempt'
);

insert into public.solution_attempts (
  challenge_id,
  challenge_version,
  source,
  notes,
  declared_time_complexity,
  declared_space_complexity,
  test_summary
)
values (
  'longest-window',
  '1.0.0',
  'function longestWindow() { return { start: 0, endExclusive: 3 }; }',
  'All cases passed.',
  'O(n)',
  'O(k)',
  '{"status":"passed","totalCases":3,"passedCases":3}'::jsonb
);

select is(
  (select count(*)::integer from public.solution_attempts where test_summary ->> 'status' = 'passed'),
  1,
  'a complete all-passed summary may be saved'
);
select throws_ok(
  $$insert into public.solution_attempts (
      id, challenge_id, challenge_version, source, notes,
      declared_time_complexity, declared_space_complexity, test_summary, created_at
    ) values (
      'd0000000-0000-4000-8000-000000000099', 'spoofed-id', '1.0.0', 'source', '',
      null, null, '{"status":"untested"}'::jsonb, '2000-01-01T00:00:00Z'
    )$$,
  '42501',
  null::text,
  'a caller cannot choose attempt IDs or timestamps'
);
select is(has_table_privilege('authenticated', 'public.solution_attempts', 'update'), false, 'ordinary users have no attempt UPDATE privilege');
select is(has_table_privilege('authenticated', 'public.solution_attempts', 'delete'), false, 'ordinary users have no attempt DELETE privilege');

select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000012', true);
select is(
  (select count(*)::integer from public.solution_attempts),
  0,
  'another signed-in user cannot read private attempts'
);
select throws_ok(
  $$update public.solution_attempts set notes = 'cross-user edit' where challenge_id = 'longest-window'$$,
  '42501',
  null::text,
  'another signed-in user cannot update attempts'
);
select throws_ok(
  $$delete from public.solution_attempts where challenge_id = 'longest-window'$$,
  '42501',
  null::text,
  'another signed-in user cannot delete attempts'
);
select throws_ok(
  $$insert into public.solution_attempts (
      user_id, challenge_id, challenge_version, source, notes,
      declared_time_complexity, declared_space_complexity, test_summary
    ) values (
      'd0000000-0000-4000-8000-000000000011', 'spoofed-owner', '1.0.0', 'source', '',
      null, null, '{"status":"untested"}'::jsonb
    )$$,
  '42501',
  null::text,
  'a caller cannot provide another attempt owner ID'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000011', true);
select throws_ok(
  $$update public.solution_attempts set notes = 'owner edit' where test_summary ->> 'status' = 'untested'$$,
  '42501',
  null::text,
  'an attempt owner cannot update an immutable snapshot'
);
select throws_ok(
  $$delete from public.solution_attempts where test_summary ->> 'status' = 'untested'$$,
  '42501',
  null::text,
  'an attempt owner cannot delete an immutable snapshot'
);
select throws_ok(
  $$insert into public.solution_attempts (
      challenge_id, challenge_version, source, notes,
      declared_time_complexity, declared_space_complexity, test_summary
    ) values (
      'longest-window', '1.0.0', 'source', '', null, null,
      '{"status":"running","totalCases":1,"passedCases":0}'::jsonb
    )$$,
  '23514',
  null::text,
  'transient running evaluations cannot be persisted'
);
select throws_ok(
  $$insert into public.solution_attempts (
      challenge_id, challenge_version, source, notes,
      declared_time_complexity, declared_space_complexity, test_summary
    ) values (
      'longest-window', '1.0.0', 'source', '', null, null,
      '{"status":"not-run","totalCases":0,"passedCases":0}'::jsonb
    )$$,
  '23514',
  null::text,
  'transient not-run evaluations cannot be persisted'
);
select throws_ok(
  $$insert into public.solution_attempts (
      challenge_id, challenge_version, source, notes,
      declared_time_complexity, declared_space_complexity, test_summary
    ) values (
      'longest-window', '1.0.0', 'source', '', null, null,
      '{"status":"passed","totalCases":0,"passedCases":0}'::jsonb
    )$$,
  '23514',
  null::text,
  'passed requires a nonempty case suite'
);
select throws_ok(
  $$insert into public.solution_attempts (
      challenge_id, challenge_version, source, notes,
      declared_time_complexity, declared_space_complexity, test_summary
    ) values (
      'longest-window', '1.0.0', 'source', '', null, null,
      '{"status":"passed","totalCases":3,"passedCases":2}'::jsonb
    )$$,
  '23514',
  null::text,
  'passed requires every case to pass'
);
select throws_ok(
  $$insert into public.solution_attempts (
      challenge_id, challenge_version, source, notes,
      declared_time_complexity, declared_space_complexity, test_summary
    ) values (
      'longest-window', '1.0.0', 'source', '', null, null,
      '{"status":"failed","totalCases":1.5,"passedCases":1}'::jsonb
    )$$,
  '23514',
  null::text,
  'evaluation case counts must be integers'
);
select throws_ok(
  $$insert into public.solution_attempts (
      challenge_id, challenge_version, source, notes,
      declared_time_complexity, declared_space_complexity, test_summary
    ) values (
      'longest-window', '1.0.0', 'source', '', null, null,
      '{"status":"failed","totalCases":2,"passedCases":3}'::jsonb
    )$$,
  '23514',
  null::text,
  'passed case count cannot exceed total cases'
);

reset role;
select is(has_table_privilege('anon', 'public.solution_attempts', 'select'), false, 'anonymous users cannot select attempts');
select is(has_table_privilege('anon', 'public.solution_attempts', 'insert'), false, 'anonymous users cannot insert attempts');
select is(has_table_privilege('anon', 'public.solution_attempts', 'update'), false, 'anonymous users cannot update attempts');
select is(has_table_privilege('anon', 'public.solution_attempts', 'delete'), false, 'anonymous users cannot delete attempts');

select * from finish();
rollback;
