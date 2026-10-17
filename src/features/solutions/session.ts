import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { App, InjectionKey } from 'vue';
import {
  createAttemptRepository,
  type AttemptRepository,
  type ScopedRequestClientFactory,
} from './attemptRepository';

export interface PublicSupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export interface NotebookSessionProvider {
  readonly client: SupabaseClient;
  readonly repository: AttemptRepository;
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

export const attemptRepositoryKey: InjectionKey<AttemptRepository | null> =
  Symbol('attemptRepository');
export const notebookSessionKey: InjectionKey<NotebookSessionProvider | null> =
  Symbol('notebookSessionProvider');

export function createNotebookSessionProvider(
  config: PublicSupabaseConfig,
): NotebookSessionProvider | null {
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
      detectSessionInUrl: true,
    },
  });
  const createScopedRequestClient: ScopedRequestClientFactory = (accessToken) =>
    createScopedDataClient(config, accessToken);
  const repository = createAttemptRepository(client, createScopedRequestClient);

  return {
    client,
    repository,
    async signInWithGitHub(returnTo = '/notebook') {
      const redirectTo = buildSameOriginRedirectUrl(returnTo, window.location.origin);
      const { error } = await client.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
          scopes: 'read:user user:email',
        },
      });

      if (error) {
        throw new Error('Could not start GitHub sign-in.', { cause: error });
      }
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
  return session;
}
