import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAuthCallback, createAuthController } from './auth';

function session(id: string, expiresIn = 3600): Session {
  return {
    user: { id },
    access_token: `token-${id}`,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  } as Session;
}

function fixture() {
  let current: Session | null = session('a');
  let listener: (event: string, session: Session | null) => void = () => {};
  const auth = {
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: current?.user ?? null }, error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const controller = createAuthController({ auth } as unknown as SupabaseClient, {
    storage: sessionStorage,
    origin: 'https://app.example',
  });
  return {
    auth,
    controller,
    change(id: string | null) {
      current = id ? session(id) : null;
      listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', current);
    },
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('explicit authentication recovery', () => {
  it('retains the editor return route when denied sign-in is restarted', async () => {
    const { controller } = fixture();
    await controller.signIn('/challenges/longest-window');
    await controller.completeCallback({ kind: 'denied' });
    await controller.signIn();
    expect(await controller.completeCallback({ kind: 'code', code: 'retry' })).toBe('/challenges/longest-window');
    controller.dispose();
  });

  it('cannot restore an account when sign-out interrupts a callback exchange', async () => {
    const { controller, auth } = fixture();
    await controller.signIn('/challenges/longest-window');
    let release!: (value: unknown) => void;
    auth.exchangeCodeForSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }) as never,
    );
    const exchange = controller.completeCallback({ kind: 'code', code: 'delayed' });
    await controller.signOut();
    release({ data: { session: session('a') }, error: null });
    expect(await exchange).toBeNull();
    expect(controller.state.userId).toBeNull();
    controller.dispose();
  });
  it('scrubs callback values before routing and never reflects provider error descriptions', () => {
    const replace = vi.fn();
    const callback = captureAuthCallback(
      'https://app.example/auth/callback?error=access_denied&error_description=private-value#access_token=secret',
      replace,
    );
    expect(replace).toHaveBeenCalledWith('/auth/callback');
    expect(callback).toEqual({ kind: 'denied' });
    expect(JSON.stringify(callback)).not.toMatch(/private-value|secret/);
  });

  it('classifies expired OAuth state and strips legacy fragments on other routes', () => {
    expect(captureAuthCallback('https://app.example/auth/callback#error_code=bad_oauth_state', vi.fn())).toEqual({
      kind: 'expired',
    });
    const replace = vi.fn();
    expect(captureAuthCallback('https://app.example/explore#access_token=legacy', replace)).toBeNull();
    expect(replace).toHaveBeenCalledWith('/explore');
  });

  it('uses one exact callback and keeps the safe return route in tab storage', async () => {
    const { auth, controller } = fixture();
    await controller.signIn('/challenges/longest-window?fresh=retry');
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        redirectTo: 'https://app.example/auth/callback',
        scopes: 'read:user user:email',
      },
    });
    const route = await controller.completeCallback({ kind: 'code', code: 'one-use-code' });
    expect(route).toBe('/challenges/longest-window?fresh=retry');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('one-use-code');
    expect(await controller.completeCallback({ kind: 'code', code: 'one-use-code' })).toBeNull();
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/notebook#access_token=x', '/auth/callback'])(
    'rejects an unsafe return path %s',
    async (path) => {
      const { controller, auth } = fixture();
      await expect(controller.signIn(path)).rejects.toThrow(/return/i);
      expect(auth.signInWithOAuth).not.toHaveBeenCalled();
      controller.dispose();
    },
  );

  it('requires a recent same-tab attempt even when an old account is still signed in', async () => {
    const { controller, auth } = fixture();
    await controller.start();
    expect(await controller.completeCallback({ kind: 'code', code: 'unsolicited' })).toBeNull();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(controller.state.message).toMatch(/expired|restart/i);
    await controller.signIn('/notebook');
    await vi.advanceTimersByTimeAsync(11 * 60_000);
    expect(await controller.completeCallback({ kind: 'code', code: 'expired' })).toBeNull();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('clears identity synchronously on account changes and ignores late identity checks', async () => {
    const { controller, auth, change } = fixture();
    await controller.start();
    expect(controller.state.userId).toBe('a');
    let release!: (value: unknown) => void;
    auth.getUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }) as never,
    );
    change('b');
    expect(controller.state.userId).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    change(null);
    release({ data: { user: { id: 'b' } }, error: null });
    await Promise.resolve();
    expect(controller.state.userId).toBeNull();
    controller.dispose();
  });

  it('hides private content immediately even if local-scope sign-out fails', async () => {
    const { controller, auth } = fixture();
    await controller.start();
    auth.signOut.mockResolvedValueOnce({ error: new Error('offline') } as never);
    await controller.signOut();
    expect(controller.state.userId).toBeNull();
    expect(controller.state.message).toMatch(/sign.out.*retry/i);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    controller.dispose();
  });

  it('expires UI identity when refresh does not arrive', async () => {
    const { controller } = fixture();
    await controller.start();
    await vi.advanceTimersByTimeAsync(3601_000);
    expect(controller.state.userId).toBeNull();
    expect(controller.state.message).toMatch(/expired/i);
    controller.dispose();
  });
});
