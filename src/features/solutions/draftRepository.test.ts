import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createDraftRepository } from './draftRepository';
import { createScopedDataClient } from './session';

const config = { url: 'https://draft-test.supabase.co', publishableKey: 'publishable-test-key' };
function token(id: string) {
  const payload = btoa(JSON.stringify({ sub: id, exp: 2524608000 }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${payload}.c2lnbmF0dXJl`;
}
let clientNumber = 0;
async function fixture() {
  const rows = new Map<string, Record<string, unknown>>();
  const writes: { authorization: string; body: Record<string, unknown>; revision: string | null }[] = [];
  let hold: (() => Promise<void>) | null = null;
  let responseOwner: string | null = null;
  let identityHold: (() => Promise<void>) | null = null;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const authorization = new Headers(init?.headers).get('Authorization') ?? '';
    const owner = authorization === `Bearer ${token('a')}` ? 'a' : 'b';
    const reply = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/auth/v1/user') {
      if (owner === 'a' && identityHold) {
        const wait = identityHold;
        identityHold = null;
        await wait();
      }
      return reply({
        id: owner,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-10-17T00:00:00Z',
      });
    }
    if (url.pathname !== '/rest/v1/solution_drafts') return reply({}, 404);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    if (init?.method === 'POST' || init?.method === 'PATCH') {
      writes.push({ authorization, body, revision: url.searchParams.get('revision') });
      await hold?.();
      const old = rows.get(owner);
      if (init.method === 'POST' && old) return reply({ code: '23505' }, 409);
      if (init.method === 'PATCH' && (!old || `eq.${old.revision}` !== url.searchParams.get('revision')))
        return reply([]);
      const row = {
        ...old,
        ...body,
        user_id: responseOwner ?? owner,
        revision: old ? Number(old.revision) + 1 : 0,
        updated_at: '2026-10-17T00:00:00Z',
      };
      rows.set(owner, row);
      return reply(init.method === 'POST' ? row : [row], init.method === 'POST' ? 201 : 200);
    }
    const row = rows.get(owner);
    return reply(row ? { ...row, user_id: responseOwner ?? owner } : null);
  };
  const client = createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `draft-test-${++clientNumber}`,
    },
    global: { fetch: fetcher },
  });
  const signIn = async (id: string) => {
    const { error } = await client.auth.setSession({ access_token: token(id), refresh_token: `refresh-${id}` });
    if (error) throw error;
  };
  await signIn('a');
  const repository = createDraftRepository(client, (accessToken) =>
    createScopedDataClient(config, accessToken, fetcher),
  );
  return {
    repository,
    rows,
    writes,
    signIn,
    setHold(value: typeof hold) {
      hold = value;
    },
    holdIdentity(value: typeof identityHold) {
      identityHold = value;
    },
    wrongOwner(id: string) {
      responseOwner = id;
    },
  };
}
const input = {
  challengeId: 'longest-window',
  challengeVersion: '1.0.0',
  source: 'my exact source',
  expectedRevision: null,
};

describe('private draft transport', () => {
  it('aborts before writing when accounts switch during the verified-user lookup', async () => {
    const { repository, writes, signIn, holdIdentity } = await fixture();
    let release!: () => void;
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    holdIdentity(async () => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const save = repository.saveDraft(input);
    await began;
    await signIn('b');
    release();
    await expect(save).rejects.toThrow(/account|session/i);
    expect(writes).toHaveLength(0);
  });
  it('creates without client ownership, then atomically updates revision zero', async () => {
    const { repository, writes } = await fixture();
    expect(await repository.saveDraft(input)).toMatchObject({
      kind: 'saved',
      draft: { userId: 'a', revision: 0, source: input.source },
    });
    expect(await repository.saveDraft({ ...input, source: 'new', expectedRevision: 0 })).toMatchObject({
      kind: 'saved',
      draft: { revision: 1, source: 'new' },
    });
    expect(writes.map(({ body }) => Object.keys(body).sort())).toEqual([
      ['challenge_id', 'challenge_version', 'source'],
      ['challenge_version', 'source'],
    ]);
    expect(writes[1]?.revision).toBe('eq.0');
  });

  it('returns current content on create-only and stale CAS conflicts without overwriting', async () => {
    const { repository } = await fixture();
    await repository.saveDraft(input);
    expect(await repository.saveDraft({ ...input, source: 'overwrite' })).toMatchObject({
      kind: 'conflict',
      current: { source: input.source },
    });
    await repository.saveDraft({ ...input, source: 'tab one', expectedRevision: 0 });
    expect(await repository.saveDraft({ ...input, source: 'tab two', expectedRevision: 0 })).toMatchObject({
      kind: 'conflict',
      current: { source: 'tab one', revision: 1 },
    });
  });

  it('rejects records from another owner', async () => {
    const { repository, wrongOwner } = await fixture();
    await repository.saveDraft(input);
    wrongOwner('b');
    await expect(repository.loadDraft(input.challengeId)).rejects.toThrow(/account|owner/i);
  });

  it('keeps an in-flight write on the original token and rejects its late acknowledgment after an account switch', async () => {
    const { repository, writes, signIn, setHold, rows } = await fixture();
    let release!: () => void;
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    setHold(async () => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const save = repository.saveDraft(input);
    await began;
    await signIn('b');
    release();
    await expect(save).rejects.toThrow(/account|session/i);
    expect(writes[0]?.authorization).toBe(`Bearer ${token('a')}`);
    expect(rows.has('b')).toBe(false);
  });

  it('rejects a response that acknowledges different source or challenge metadata', async () => {
    const { repository, rows } = await fixture();
    await repository.saveDraft(input);
    rows.get('a')!.challenge_id = 'other';
    await expect(repository.loadDraft(input.challengeId)).rejects.toThrow(/contract|draft/i);
  });
});
