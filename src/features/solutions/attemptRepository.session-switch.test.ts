import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createAttemptRepository, AttemptSessionChangedError } from './attemptRepository';
import { createScopedDataClient } from './session';

const url = 'https://notebook-test.supabase.co';
const key = 'publishable-test-key';
const config = { url, publishableKey: key };

function tokenFor(userId: string): string {
  const payload = btoa(JSON.stringify({ sub: userId, exp: 2524608000 }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${payload}.c2lnbmF0dXJl`;
}

function userResponse(userId: string): Response {
  return new Response(JSON.stringify({
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: `${userId}@example.test`,
    app_metadata: { provider: 'github', providers: ['github'] },
    user_metadata: {},
    created_at: '2026-10-17T10:00:00.000Z',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function makeTransport(options: {
  holdAttemptWrite?: boolean;
} = {}) {
  let releaseUserA: (() => void) | undefined;
  let userARequestStarted: (() => void) | undefined;
  let releaseWrite: (() => void) | undefined;
  let writeStarted: (() => void) | undefined;
  const userAStarted = new Promise<void>((resolve) => { userARequestStarted = resolve; });
  const attemptWriteStarted = new Promise<void>((resolve) => { writeStarted = resolve; });
  let shouldHoldUserA = false;
  const writeAuthorizations: string[] = [];

  const fetcher: typeof fetch = async (input, init) => {
    const requestUrl = new URL(String(input));
    const authorization = new Headers(init?.headers).get('Authorization') ?? '';

    if (requestUrl.pathname === '/auth/v1/user') {
      if (authorization === `Bearer ${tokenFor('owner-a')}` && shouldHoldUserA) {
        shouldHoldUserA = false;
        userARequestStarted?.();
        await new Promise<void>((resolve) => { releaseUserA = resolve; });
      }
      const userId = authorization === `Bearer ${tokenFor('owner-a')}` ? 'owner-a' : 'owner-b';
      return userResponse(userId);
    }

    if (requestUrl.pathname === '/rest/v1/solution_attempts' && init?.method === 'POST') {
      writeAuthorizations.push(authorization);
      writeStarted?.();
      if (options.holdAttemptWrite) {
        await new Promise<void>((resolve) => { releaseWrite = resolve; });
      }

      const userId = authorization === `Bearer ${tokenFor('owner-a')}` ? 'owner-a' : 'owner-b';
      return new Response(JSON.stringify({
        id: 'attempt-1',
        user_id: userId,
        challenge_id: 'longest-window',
        challenge_version: '1.0.0',
        source: 'function answer() {}',
        notes: '',
        declared_time_complexity: null,
        declared_space_complexity: null,
        test_summary: { status: 'untested' },
        created_at: '2026-10-17T10:30:00.000Z',
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  };

  return {
    fetcher,
    userAStarted,
    attemptWriteStarted,
    writeAuthorizations,
    holdNextUserARequest: () => { shouldHoldUserA = true; },
    releaseUserA: () => releaseUserA?.(),
    releaseWrite: () => releaseWrite?.(),
  };
}

let testClientNumber = 0;

function createAuthClient(fetcher: typeof fetch) {
  testClientNumber += 1;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `notebook-test-auth-${testClientNumber}`,
    },
    global: { fetch: fetcher },
  });
}

async function signInAs(client: ReturnType<typeof createAuthClient>, userId: string): Promise<void> {
  const { error } = await client.auth.setSession({
    access_token: tokenFor(userId),
    refresh_token: `refresh-${userId}`,
  });
  if (error) {
    throw error;
  }
}

const input = {
  challengeId: 'longest-window',
  challengeVersion: '1.0.0',
  source: 'function answer() {}',
  notes: '',
  timeComplexity: null,
  spaceComplexity: null,
  testSummary: { status: 'untested' as const },
};

describe('attempt repository account-switch transport safety', () => {
  it('aborts before saving when the session changes during verified-user lookup', async () => {
    const transport = makeTransport();
    const authClient = createAuthClient(transport.fetcher);
    await signInAs(authClient, 'owner-a');
    transport.holdNextUserARequest();
    const repository = createAttemptRepository(
      authClient,
      (accessToken) => createScopedDataClient(config, accessToken, transport.fetcher),
    );

    const save = repository.createAttempt(input, 'owner-a');
    await transport.userAStarted;
    await signInAs(authClient, 'owner-b');
    transport.releaseUserA();

    await expect(save).rejects.toBeInstanceOf(AttemptSessionChangedError);
    expect(transport.writeAuthorizations).toEqual([]);
  });

  it('pins an in-flight write to its verified account token during an account switch', async () => {
    const transport = makeTransport({ holdAttemptWrite: true });
    const authClient = createAuthClient(transport.fetcher);
    await signInAs(authClient, 'owner-a');
    const repository = createAttemptRepository(
      authClient,
      (accessToken) => createScopedDataClient(config, accessToken, transport.fetcher),
    );

    const save = repository.createAttempt(input, 'owner-a');
    await transport.attemptWriteStarted;
    await signInAs(authClient, 'owner-b');
    transport.releaseWrite();

    await expect(save).rejects.toBeInstanceOf(AttemptSessionChangedError);
    expect(transport.writeAuthorizations).toEqual([`Bearer ${tokenFor('owner-a')}`]);
  });
});
