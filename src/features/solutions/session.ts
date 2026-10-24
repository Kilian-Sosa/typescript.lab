import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { App, InjectionKey } from 'vue';
import { authControllerKey, createAuthController, type AuthController } from '../auth/auth';
import { createDraftRepository, type DraftRepository } from './draftRepository';
import { createAttemptRepository, type AttemptRepository, type ScopedRequestClientFactory } from './attemptRepository';

export interface PublicSupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export interface NotebookSessionProvider {
  readonly client: SupabaseClient;
  readonly repository: AttemptRepository;
  readonly drafts: DraftRepository;
  readonly auth: AuthController;
  signInWithGitHub(returnTo?: string): Promise<void>;
}

export class SupabaseConfigurationError extends Error {
  constructor() {
    super('Set both the Supabase URL and publishable key to enable private notebook access.');
    this.name = 'SupabaseConfigurationError';
  }
}

export function buildSameOriginRedirectUrl(returnTo: string, origin: string): string {
  const redirect = new URL(returnTo, origin);
  if (redirect.origin !== origin) {
    throw new Error('The sign-in return path must resolve to this same site.');
  }
  return redirect.toString();
}

export function createScopedDataClient(
  config: PublicSupabaseConfig,
  accessToken: string,
  fetcher?: typeof fetch,
): SupabaseClient {
  return createClient(config.url, config.publishableKey, {
    accessToken: async () => accessToken,
    ...(fetcher ? { global: { fetch: fetcher } } : {}),
  });
}

export const attemptRepositoryKey: InjectionKey<AttemptRepository | null> = Symbol('attemptRepository');
export const notebookSessionKey: InjectionKey<NotebookSessionProvider | null> = Symbol('notebookSessionProvider');
export const draftRepositoryKey: InjectionKey<DraftRepository | null> = Symbol('draftRepository');

export function createNotebookSessionProvider(config: PublicSupabaseConfig): NotebookSessionProvider | null {
  const hasUrl = config.url.trim().length > 0;
  const hasKey = config.publishableKey.trim().length > 0;

  if (!hasUrl && !hasKey) {
    return null;
  }
  if (!hasUrl || !hasKey) {
    throw new SupabaseConfigurationError();
  }

  const client = createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  const createScopedRequestClient: ScopedRequestClientFactory = (accessToken) =>
    createScopedDataClient(config, accessToken);
  const repository = createAttemptRepository(client, createScopedRequestClient);
  const drafts = createDraftRepository(client, createScopedRequestClient);
  const auth = createAuthController(client, { storage: window.sessionStorage, origin: window.location.origin });

  return {
    client,
    repository,
    drafts,
    auth,
    async signInWithGitHub(returnTo = '/notebook') {
      await auth.signIn(returnTo);
    },
  };
}

function readPublicSupabaseConfig(): PublicSupabaseConfig {
  return {
    url: import.meta.env.VITE_SUPABASE_URL ?? '',
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  };
}

export function initializeNotebookSession(
  app: Pick<App, 'provide'>,
  config: PublicSupabaseConfig = readPublicSupabaseConfig(),
): NotebookSessionProvider | null {
  let session: NotebookSessionProvider | null;
  try {
    session = createNotebookSessionProvider(config);
  } catch {
    session = null;
  }
  app.provide(attemptRepositoryKey, session?.repository ?? null);
  app.provide(notebookSessionKey, session);
  app.provide(draftRepositoryKey, session?.drafts ?? null);
  app.provide(authControllerKey, session?.auth ?? null);
  if (session) void session.auth.start();
  return session;
}
