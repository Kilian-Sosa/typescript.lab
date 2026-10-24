import { createApp, inject } from 'vue';
import { describe, expect, it } from 'vitest';
import {
  attemptRepositoryKey,
  buildSameOriginRedirectUrl,
  createNotebookSessionProvider,
  initializeNotebookSession,
  notebookSessionKey,
} from './session';

describe('notebook session provider', () => {
  it('rejects OAuth redirect paths that resolve outside the current site', () => {
    expect(() => buildSameOriginRedirectUrl('/\\evil.example', 'https://typescript.lab')).toThrow(/same site/i);
    expect(buildSameOriginRedirectUrl('/notebook', 'https://typescript.lab')).toBe('https://typescript.lab/notebook');
  });

  it('fails closed when public Supabase configuration is absent', () => {
    const app = createApp({ render: () => null });

    const session = initializeNotebookSession(app, { url: '', publishableKey: '' });

    expect(session).toBeNull();
    expect(app.runWithContext(() => inject(attemptRepositoryKey, null))).toBeNull();
    expect(app.runWithContext(() => inject(notebookSessionKey, null))).toBeNull();
  });

  it('fails closed without crashing when public Supabase configuration is partial', () => {
    const app = createApp({ render: () => null });

    const session = initializeNotebookSession(app, {
      url: 'http://127.0.0.1:55321',
      publishableKey: '',
    });

    expect(session).toBeNull();
    expect(app.runWithContext(() => inject(attemptRepositoryKey, null))).toBeNull();
    expect(app.runWithContext(() => inject(notebookSessionKey, null))).toBeNull();
  });

  it('rejects partial public configuration instead of creating an unauthenticated client', () => {
    expect(() =>
      createNotebookSessionProvider({
        url: 'http://127.0.0.1:55321',
        publishableKey: '',
      }),
    ).toThrow(/both.*URL.*publishable key/i);
  });

  it('provides one configured authenticated repository without requesting privileged credentials', () => {
    const app = createApp({ render: () => null });
    const session = initializeNotebookSession(app, {
      url: 'http://127.0.0.1:55321',
      publishableKey: 'local-publishable-key',
    });

    expect(session?.repository).toBeDefined();
    expect(app.runWithContext(() => inject(attemptRepositoryKey, null))).toBe(session?.repository);
    expect(app.runWithContext(() => inject(notebookSessionKey, null))).toBe(session);
  });
});
