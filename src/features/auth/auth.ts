import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { reactive, readonly, type InjectionKey } from 'vue';

export type AuthCallback = { kind: 'code'; code: string } | { kind: 'denied' | 'expired' | 'invalid' };
export interface AuthState {
  status: 'checking' | 'signed-in' | 'signed-out' | 'error';
  userId: string | null;
  generation: number;
  message: string;
  signingOut: boolean;
  signOutFailed: boolean;
  returnTo: string;
}
export type AuthController = ReturnType<typeof createAuthController>;
export const authControllerKey: InjectionKey<AuthController | null> = Symbol('authController');
export const authCallbackKey: InjectionKey<AuthCallback | null> = Symbol('authCallback');
const pendingKey = 'typescript-lab-oauth-return-v1';

export function captureAuthCallback(href: string, replace: (path: string) => void): AuthCallback | null {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (url.pathname !== '/auth/callback') {
    if (['access_token', 'refresh_token', 'error', 'error_code'].some((key) => fragment.has(key))) {
      replace(url.pathname + url.search);
    }
    return null;
  }
  const error = url.searchParams.get('error') ?? fragment.get('error');
  const code = url.searchParams.get('error_code') ?? fragment.get('error_code');
  const authCode = url.searchParams.get('code');
  replace('/auth/callback');
  if (code === 'bad_oauth_state' || code === 'flow_state_expired' || code === 'otp_expired') return { kind: 'expired' };
  if (error === 'access_denied') return { kind: 'denied' };
  if (error || code || !authCode || authCode.length > 4096) return { kind: 'invalid' };
  return { kind: 'code', code: authCode };
}

export function safeReturnPath(path: string, origin: string): string {
  const url = new URL(path, origin);
  if (
    !path.startsWith('/') ||
    url.origin !== origin ||
    url.hash ||
    !(
      /^\/challenges\/[a-z0-9-]+$/.test(url.pathname) ||
      /^\/notebook(?:\/[a-z0-9-]+)?$/.test(url.pathname) ||
      url.pathname === '/explore'
    ) ||
    [...url.searchParams.keys()].some((key) => key !== 'fresh')
  ) {
    throw new Error('The sign-in return path must be a safe route on this site.');
  }
  return url.pathname + url.search;
}

export function createAuthController(
  client: SupabaseClient,
  environment: {
    storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
    origin: string;
  },
) {
  const state = reactive<AuthState>({
    status: 'checking',
    userId: null,
    generation: 0,
    message: '',
    signingOut: false,
    signOutFailed: false,
    returnTo: '/notebook',
  });
  let epoch = 0;
  let disposed = false;
  let suspended = false;
  let callbackAttempt = 0;
  let exchanging = false;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  const deferred = new Set<ReturnType<typeof setTimeout>>();

  function identity(id: string | null, status: AuthState['status'], message = '') {
    if (state.userId !== id) state.generation += 1;
    state.userId = id;
    state.status = status;
    state.message = message;
  }

  async function verify(session: Session | null, revision: number): Promise<boolean> {
    if (disposed || suspended || revision !== epoch) return false;
    clearTimeout(expiryTimer);
    if (!session || !session.expires_at || session.expires_at * 1000 <= Date.now()) {
      identity(null, 'signed-out', session ? 'Your session expired. Sign in again to recover your private work.' : '');
      return false;
    }
    try {
      const { data, error } = await client.auth.getUser(session.access_token);
      if (disposed || suspended || revision !== epoch) return false;
      if (error || !data.user || data.user.id !== session.user.id) throw new Error('Unverified account');
      identity(data.user.id, 'signed-in');
      expiryTimer = setTimeout(
        () => {
          epoch += 1;
          identity(null, 'signed-out', 'Your session expired. Sign in again to recover your private work.');
        },
        Math.min(session.expires_at * 1000 - Date.now(), 2_147_483_647),
      );
      return true;
    } catch {
      if (revision === epoch && !disposed)
        identity(
          null,
          'error',
          'Could not verify your account. Check your connection and retry. Your local work is retained.',
        );
      return false;
    }
  }

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event, session) => {
    if (disposed || suspended || event === 'INITIAL_SESSION') return;
    if (exchanging && event !== 'SIGNED_OUT') return;
    const revision = ++epoch;
    if (!session) {
      callbackAttempt += 1;
      clearTimeout(expiryTimer);
      identity(null, 'signed-out', 'Signed out. Private work is retained for the same account on this browser.');
      return;
    }
    if (session.user.id !== state.userId) identity(null, 'checking');
    // Supabase holds its auth lock while notifying listeners. Verify after it returns.
    const timer = setTimeout(() => {
      deferred.delete(timer);
      void verify(session, revision);
    }, 0);
    deferred.add(timer);
  });

  async function start(): Promise<void> {
    if (suspended || disposed) return;
    const revision = ++epoch;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await verify(data.session, revision);
    } catch {
      if (revision === epoch && !disposed)
        identity(null, 'error', 'Could not restore your session. Check your connection and retry.');
    }
  }

  async function signIn(returnTo = state.returnTo): Promise<void> {
    const path = safeReturnPath(returnTo, environment.origin);
    if (suspended) throw new Error('Finish signing out before switching accounts.');
    if (exchanging) throw new Error('Wait for this sign-in to finish before restarting.');
    state.returnTo = path;
    // Fail before navigation if the tab cannot retain callback state.
    environment.storage.setItem(pendingKey, JSON.stringify({ path, startedAt: Date.now() }));
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${environment.origin}/auth/callback`,
          scopes: 'read:user user:email',
        },
      });
      if (error) throw error;
    } catch {
      environment.storage.removeItem(pendingKey);
      state.message = 'GitHub sign-in could not start. Your local work is retained; please retry.';
      throw new Error('Could not start GitHub sign-in.');
    }
  }

  async function completeCallback(callback: AuthCallback | null): Promise<string | null> {
    let pending: { path: string; startedAt: number } | null = null;
    try {
      pending = JSON.parse(environment.storage.getItem(pendingKey) ?? 'null');
      environment.storage.removeItem(pendingKey);
    } catch {
      /* A missing or unavailable tab store invalidates this callback. */
    }
    if (pending) {
      try {
        state.returnTo = safeReturnPath(pending.path, environment.origin);
      } catch {
        pending = null;
      }
    }
    if (callback?.kind === 'denied') {
      state.message = 'GitHub sign-in was cancelled or denied. Your local work is retained. You can retry.';
      return null;
    }
    if (
      callback?.kind !== 'code' ||
      !pending ||
      !Number.isFinite(pending.startedAt) ||
      Date.now() - pending.startedAt < 0 ||
      Date.now() - pending.startedAt > 10 * 60_000
    ) {
      state.message = 'This sign-in link is missing, expired or already used. Restart GitHub sign-in.';
      return null;
    }
    const attempt = ++callbackAttempt;
    exchanging = true;
    try {
      const path = safeReturnPath(pending.path, environment.origin);
      const { data, error } = await client.auth.exchangeCodeForSession(callback.code);
      if (attempt !== callbackAttempt || suspended || disposed) {
        // A cancelled exchange may have installed a session after the first sign-out.
        await signOut();
        return null;
      }
      if (error || !data.session) throw new Error('Exchange failed');
      const revision = ++epoch;
      if (!(await verify(data.session, revision))) return null;
      return path;
    } catch {
      state.message = 'This sign-in link expired or could not be verified. Restart GitHub sign-in.';
      return null;
    } finally {
      exchanging = false;
    }
  }

  async function signOut(): Promise<void> {
    suspended = true;
    callbackAttempt += 1;
    epoch += 1;
    clearTimeout(expiryTimer);
    state.signingOut = true;
    identity(null, 'signed-out', 'Signing out. Private work is retained for the same account.');
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      suspended = false;
      state.signOutFailed = false;
      state.message = 'Signed out. Private work is retained for the same account on this browser.';
    } catch {
      state.signOutFailed = true;
      state.status = 'error';
      state.message = 'Sign-out could not finish. Check your connection and retry sign-out before switching accounts.';
    } finally {
      state.signingOut = false;
    }
  }

  return {
    state: readonly(state),
    start,
    signIn,
    signOut,
    completeCallback,
    dispose() {
      disposed = true;
      epoch += 1;
      clearTimeout(expiryTimer);
      for (const timer of deferred) clearTimeout(timer);
      subscription.unsubscribe();
    },
  };
}
