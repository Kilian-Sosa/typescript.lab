import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authControllerKey, createAuthController } from '../auth/auth';
import { createAttemptRepository } from './attemptRepository';
import { attemptRepositoryKey } from './session';
import DraftWorkspace from './DraftWorkspace.vue';

const cleanup: Array<() => void> = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function fixture(holdWrite = false) {
  let sdkSession = {
    access_token: 'account-a-token',
    user: { id: 'a' },
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  } as Session | null;
  const logout = deferred<{ error: Error | null }>();
  const write = deferred<void>();
  const inserts: Array<{ token: string; payload: Record<string, unknown> }> = [];
  const listeners: Array<(event: string, session: Session | null) => void> = [];
  const client = {
    auth: {
      getSession: async () => ({ data: { session: sdkSession }, error: null }),
      getUser: async () => ({ data: { user: sdkSession?.user ?? null }, error: null }),
      onAuthStateChange: (listener: (typeof listeners)[number]) => {
        listeners.push(listener);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: async () => {
        const result = await logout.promise;
        if (!result.error) {
          sdkSession = null;
          for (const listener of listeners) listener('SIGNED_OUT', null);
        }
        return result;
      },
    },
  } as unknown as SupabaseClient;
  const repository = createAttemptRepository(
    client,
    (token) =>
      ({
        from: () => ({
          insert: (payload: Record<string, unknown>) => {
            inserts.push({ token, payload });
            return {
              select: () => ({
                single: async () => {
                  if (holdWrite) await write.promise;
                  return {
                    data: { ...payload, id: 'attempt-a', user_id: 'a', created_at: '2026-10-18T10:00:00Z' },
                    error: null,
                  };
                },
              }),
            };
          },
        }),
      }) as unknown as SupabaseClient,
  );
  const auth = createAuthController(client, { storage: sessionStorage, origin: 'http://localhost' });
  cleanup.push(() => auth.dispose());
  await auth.start();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/challenges/:slug',
        component: DraftWorkspace,
        props: { challengeId: 'longest-window', challengeVersion: '1.0.0', starter: 'starter' },
      },
    ],
  });
  await router.push('/challenges/longest-window');
  const wrapper = mount(RouterView, {
    global: {
      plugins: [router],
      provide: {
        [authControllerKey as symbol]: auth,
        [attemptRepositoryKey as symbol]: repository,
      },
    },
  });
  cleanup.push(() => wrapper.unmount());
  await flushPromises();
  const edit = async (source: string, notes: string) => {
    await wrapper.get('textarea[aria-label="TypeScript source"]').setValue(source);
    await wrapper.get('textarea[aria-label="Learning notes"]').setValue(notes);
  };
  const submit = async () => {
    await wrapper.get('form').trigger('submit');
    await flushPromises();
  };
  return { auth, client, wrapper, logout, write, inserts, edit, submit };
}

describe('submission application identity across sign-out', () => {
  it.each(['pending', 'failed'] as const)(
    'does not insert newly entered guest source or notes during %s logout with a retained SDK session',
    async (phase) => {
      const f = await fixture();
      await f.edit('private A source', 'private A notes');
      const signingOut = f.auth.signOut();
      if (phase === 'failed') {
        f.logout.resolve({ error: new Error('offline') });
        await signingOut;
        expect(f.auth.state.signOutFailed).toBe(true);
      } else {
        expect(f.auth.state.signingOut).toBe(true);
      }
      await flushPromises();
      expect(f.auth.state.userId).toBeNull();
      expect((await f.client.auth.getSession()).data.session?.user.id).toBe('a');
      await f.edit('new guest source', 'new guest notes');
      await f.submit();
      expect(f.inserts).toEqual([]);
      expect(f.wrapper.get('[role="alert"]').text()).toMatch(/sign in/i);
      expect((f.wrapper.get('textarea[aria-label="TypeScript source"]').element as HTMLTextAreaElement).value).toBe(
        'new guest source',
      );
      expect((f.wrapper.get('textarea[aria-label="Learning notes"]').element as HTMLTextAreaElement).value).toBe(
        'new guest notes',
      );
      if (phase === 'pending') {
        f.logout.resolve({ error: null });
        await signingOut;
      }
    },
  );

  it('saves exact signed-in source and notes to the verified application account', async () => {
    const f = await fixture();
    await f.edit('signed-in source', 'signed-in notes');
    await f.submit();
    expect(f.inserts).toEqual([
      {
        token: 'account-a-token',
        payload: expect.objectContaining({ source: 'signed-in source', notes: 'signed-in notes' }),
      },
    ]);
    expect(f.wrapper.text()).toContain('Attempt saved.');
  });

  it('requires sign-in after successful logout', async () => {
    const f = await fixture();
    const signingOut = f.auth.signOut();
    f.logout.resolve({ error: null });
    await signingOut;
    await flushPromises();
    await f.edit('guest source', 'guest notes');
    await f.submit();
    expect(f.inserts).toEqual([]);
    expect(f.wrapper.get('[role="alert"]').text()).toMatch(/sign in/i);
  });

  it('keeps an already-started write pinned to A and does not announce it in the guest workspace', async () => {
    const f = await fixture(true);
    await f.edit('private A source', 'private A notes');
    await f.submit();
    expect(f.inserts).toHaveLength(1);
    const signingOut = f.auth.signOut();
    f.logout.resolve({ error: null });
    await signingOut;
    await flushPromises();
    await f.edit('guest source', 'guest notes');
    f.write.resolve();
    await flushPromises();
    expect(f.inserts).toEqual([
      {
        token: 'account-a-token',
        payload: expect.objectContaining({ source: 'private A source', notes: 'private A notes' }),
      },
    ]);
    expect(f.wrapper.text()).not.toContain('Attempt saved.');
  });
});
