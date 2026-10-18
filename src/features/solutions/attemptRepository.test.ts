import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  AttemptAuthorizationError,
  AuthenticationRequiredError,
  createAttemptRepository,
} from './attemptRepository';

const input = {
  challengeId: 'longest-window',
  challengeVersion: '1.0.0',
  source: '\nconst answer = "π";\n',
  notes: 'Remember why the left edge moves.',
  timeComplexity: 'O(n)',
  spaceComplexity: null,
  testSummary: { status: 'untested' as const },
};

function row(userId = 'owner-a') {
  return {
    id: 'attempt-1',
    user_id: userId,
    challenge_id: 'longest-window',
    challenge_version: '1.0.0',
    source: input.source,
    notes: input.notes,
    declared_time_complexity: 'O(n)',
    declared_space_complexity: null,
    test_summary: { status: 'untested' },
    created_at: '2026-10-17T10:30:00.000Z',
  };
}

function makeClient(options: {
  userId?: string | null;
  listData?: unknown;
  insertAfterFirstPage?: unknown;
  insertData?: unknown;
  listError?: unknown;
  insertError?: unknown;
  authError?: unknown;
} = {}) {
  const filters: Array<[string, string]> = [];
  const orderCalls: Array<[string, { ascending: boolean }]> = [];
  const rangeCalls: Array<[number, number]> = [];
  const cursorFilters: string[] = [];
  const requestTokens: string[] = [];
  const inserted: unknown[] = [];
  let currentListData = Array.isArray(options.listData) ? [...options.listData] : options.listData;
  let cursor: { createdAt: string; id: string } | undefined;
  let fetchedPages = 0;
  let authChange: ((event: string, session: { user: { id: string } } | null) => void) | undefined;

  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: options.userId === null
            ? null
            : {
              access_token: `${options.userId ?? 'owner-a'}-token`,
              user: { id: options.userId ?? 'owner-a' },
            },
        },
        error: null,
      })),
      getUser: vi.fn(async () => ({
        data: { user: options.userId === null ? null : { id: options.userId ?? 'owner-a' } },
        error: options.authError ?? null,
      })),
      onAuthStateChange: vi.fn((callback: NonNullable<typeof authChange>) => {
        authChange = callback;
        callback('INITIAL_SESSION', options.userId === null
          ? null
          : { user: { id: options.userId ?? 'owner-a' } });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    from: vi.fn((table: string) => {
      expect(table).toBe('solution_attempts');
      let rangeStart = 0;
      let rangeEnd = Number.MAX_SAFE_INTEGER;
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: string) => {
          filters.push([column, value]);
          return query;
        }),
        order: vi.fn((column: string, options: { ascending: boolean }) => {
          orderCalls.push([column, options]);
          return query;
        }),
        range: vi.fn((start: number, end: number) => {
          rangeStart = start;
          rangeEnd = end;
          rangeCalls.push([start, end]);
          return query;
        }),
        or: vi.fn((filters: string) => {
          cursorFilters.push(filters);
          const match = filters.match(/^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([^)]+)\)$/);
          if (match) {
            cursor = { createdAt: match[1]!, id: match[3]! };
          }
          return query;
        }),
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve({
            data: Array.isArray(currentListData)
              ? currentListData
                .filter((record) => {
                  if (!cursor || typeof record !== 'object' || record === null) {
                    return true;
                  }
                  const rowRecord = record as Record<string, unknown>;
                  const createdAt = String(rowRecord.created_at);
                  const id = String(rowRecord.id);
                  return createdAt < cursor.createdAt
                    || (createdAt === cursor.createdAt && id < cursor.id);
                })
                .slice(rangeStart, rangeEnd + 1)
              : currentListData ?? [],
            error: options.listError ?? null,
          })
            .then((result) => {
              fetchedPages += 1;
              if (fetchedPages === 1 && options.insertAfterFirstPage !== undefined && Array.isArray(currentListData)) {
                currentListData = [options.insertAfterFirstPage, ...currentListData];
              }
              return result;
            })
            .then(resolve, reject),
      };

      return {
        select: query.select,
        eq: query.eq,
        order: query.order,
        range: query.range,
        or: query.or,
        then: query.then,
        insert: (value: unknown) => {
          inserted.push(value);
          return {
            select: () => ({
              single: async () => ({ data: options.insertData ?? row(), error: options.insertError ?? null }),
            }),
          };
        },
      };
    }),
  };

  return {
    client: client as unknown as SupabaseClient,
    filters,
    orderCalls,
    rangeCalls,
    cursorFilters,
    requestTokens,
    inserted,
    changeSession: (userId: string | null) => {
      authChange?.('SIGNED_IN', userId ? { user: { id: userId } } : null);
    },
  };
}

function repositoryFor(fake: ReturnType<typeof makeClient>) {
  return createAttemptRepository(fake.client, (token) => {
    fake.requestTokens.push(token);
    return fake.client;
  });
}

describe('createAttemptRepository', () => {
  it('rejects a verified SDK account that differs from the submitting application account before inserting', async () => {
    const fake = makeClient({ insertData: row() });
    const repository = repositoryFor(fake);
    await expect(repository.createAttempt(input, 'owner-b')).rejects.toBeInstanceOf(AttemptAuthorizationError);
    expect(fake.inserted).toEqual([]);
  });

  it('stores exact source and notes without accepting identity or timestamp fields from the caller', async () => {
    const fake = makeClient({ insertData: row() });
    const repository = repositoryFor(fake);

    const saved = await repository.createAttempt(input, 'owner-a');

    expect(saved).toEqual({
      id: 'attempt-1',
      userId: 'owner-a',
      challengeId: 'longest-window',
      challengeVersion: '1.0.0',
      source: '\nconst answer = "π";\n',
      notes: 'Remember why the left edge moves.',
      timeComplexity: 'O(n)',
      spaceComplexity: null,
      testSummary: { status: 'untested' },
      createdAt: '2026-10-17T10:30:00.000Z',
    });
    expect(fake.inserted).toEqual([{
      challenge_id: 'longest-window',
      challenge_version: '1.0.0',
      source: input.source,
      notes: input.notes,
      declared_time_complexity: 'O(n)',
      declared_space_complexity: null,
      test_summary: { status: 'untested' },
    }]);
  });

  it('refuses to read or write when Supabase has no authenticated user', async () => {
    const fake = makeClient({ userId: null });
    const repository = repositoryFor(fake);

    await expect(repository.listAttempts()).rejects.toBeInstanceOf(AuthenticationRequiredError);
    await expect(repository.createAttempt(input, 'owner-a')).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it('maps Supabase AuthSessionMissingError to a sign-in-required state', async () => {
    const fake = makeClient({
      authError: { name: 'AuthSessionMissingError', message: 'Auth session missing!' },
    });
    const repository = repositoryFor(fake);

    await expect(repository.listAttempts()).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it('lists only the verified owner’s challenge attempts newest first', async () => {
    const fake = makeClient({ listData: [row()] });
    const repository = repositoryFor(fake);

    const attempts = await repository.listAttempts('longest-window');

    expect(fake.filters).toEqual([
      ['user_id', 'owner-a'],
      ['challenge_id', 'longest-window'],
    ]);
    expect(fake.orderCalls).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(attempts[0]?.source).toBe(input.source);
    expect(attempts[0]?.userId).toBe('owner-a');
  });

  it('loads every attempt past the Supabase API row cap using stable pages', async () => {
    const records = Array.from({ length: 1001 }, (_, index) => ({
      ...row(),
      id: `attempt-${index}`,
      created_at: new Date(Date.parse('2026-10-17T10:00:00.000Z') - index * 1000).toISOString(),
    }));
    const fake = makeClient({
      listData: records,
      insertAfterFirstPage: {
        ...row(),
        id: 'concurrent-newest-attempt',
        created_at: '2026-10-18T10:00:00.000Z',
      },
    });
    const repository = repositoryFor(fake);

    const attempts = await repository.listAttempts();

    expect(attempts).toHaveLength(1001);
    expect(attempts[0]?.id).toBe('attempt-0');
    expect(attempts[1000]?.id).toBe('attempt-1000');
    expect(new Set(attempts.map((attempt) => attempt.id)).size).toBe(1001);
    expect(attempts.some((attempt) => attempt.id === 'concurrent-newest-attempt')).toBe(false);
    expect(fake.rangeCalls).toEqual([[0, 999], [0, 999]]);
    expect(fake.cursorFilters).toEqual([
      'created_at.lt.2026-10-17T09:43:21.000Z,and(created_at.eq.2026-10-17T09:43:21.000Z,id.lt.attempt-999)',
    ]);
  });

  it('rejects a database response that contains another account’s attempt', async () => {
    const fake = makeClient({ listData: [row('owner-b')] });
    const repository = repositoryFor(fake);

    await expect(repository.listAttempts()).rejects.toBeInstanceOf(AttemptAuthorizationError);
  });

  it('notifies subscribers when the authenticated account changes', () => {
    const fake = makeClient();
    const repository = repositoryFor(fake);
    const changed = vi.fn();
    const unsubscribe = repository.subscribeToSessionChanges(changed);

    fake.changeSession('owner-b');

    expect(changed).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
