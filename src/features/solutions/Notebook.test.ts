import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, provide, reactive } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import type { SolutionAttempt } from '../../../shared/contracts/v1';
import NotebookPage from '../../pages/NotebookPage.vue';
import { AttemptAuthorizationError, type AttemptRepository } from './attemptRepository';
import { attemptRepositoryKey } from './session';
import { authControllerKey, type AuthController } from '../auth/auth';

const attempt: SolutionAttempt = {
  id: 'attempt-a',
  userId: 'owner-a',
  challengeId: 'longest-window',
  challengeVersion: '1.0.0',
  source: 'const privateSolution = "owner-a";',
  notes: 'Keep the earlier range.',
  timeComplexity: 'O(n)',
  spaceComplexity: null,
  testSummary: { status: 'untested' },
  createdAt: '2026-10-17T10:30:00.000Z',
};

function makeRepository(listAttempts = vi.fn().mockResolvedValue([])) {
  let sessionChanged: (() => void) | undefined;
  const repository = {
    listAttempts,
    createAttempt: vi.fn().mockResolvedValue(attempt),
    subscribeToSessionChanges: vi.fn((listener: () => void) => {
      sessionChanged = listener;
      return () => {
        sessionChanged = undefined;
      };
    }),
  } as unknown as AttemptRepository;

  return { repository, listAttempts, changeSession: () => sessionChanged?.() };
}

async function mountNotebook(repository: AttemptRepository, auth?: AuthController) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/explore', component: { template: '<main>Explore</main>' } },
      { path: '/notebook', component: NotebookPage },
      { path: '/notebook/:slug', name: 'notebook-detail', component: NotebookPage },
    ],
  });
  await router.push('/notebook');
  await router.isReady();

  const host = defineComponent({
    setup() {
      provide(attemptRepositoryKey, repository);
      if (auth) provide(authControllerKey, auth);
      return () => h(RouterView);
    },
  });
  const wrapper = mount(host, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

describe('Notebook list', () => {
  it('clears private history when UI sign-out starts even if the SDK cannot complete sign-out', async () => {
    const state = reactive({ userId: 'owner-a' as string | null });
    const { repository } = makeRepository(vi.fn().mockResolvedValue([attempt]));
    const { wrapper } = await mountNotebook(repository, { state } as unknown as AuthController);
    expect(wrapper.text()).toContain(attempt.notes);
    state.userId = null;
    await flushPromises();
    expect(wrapper.text()).not.toContain(attempt.notes);
    expect(wrapper.find('button[aria-label="Export all attempts as JSON"]').exists()).toBe(false);
  });
  it('shows a useful empty state without illustrative history', async () => {
    const { repository } = makeRepository();
    const { wrapper } = await mountNotebook(repository);

    expect(wrapper.get('h1').text()).toBe('My Notebook.');
    expect(wrapper.text()).toMatch(/your notebook is empty/i);
    expect(wrapper.text()).toMatch(/save an attempt/i);
    expect(wrapper.text()).not.toMatch(/Attempt #\d|\d+ attempts|Passed/i);
  });

  it('lists only attempts returned by the authenticated repository', async () => {
    const { repository } = makeRepository(vi.fn().mockResolvedValue([attempt]));
    const { wrapper } = await mountNotebook(repository);

    expect(wrapper.get('a[href="/notebook/longest-window"]').text()).toContain(
      'Longest Window with Limited Event Types',
    );
    expect(wrapper.text()).toContain('1 attempt');
    expect(wrapper.text()).toContain('Untested');
    expect(wrapper.text()).not.toContain('Passed');
  });

  it('shows an error and no export action when the authenticated repository rejects a record', async () => {
    const { repository } = makeRepository(vi.fn().mockRejectedValue(new AttemptAuthorizationError()));
    const { wrapper } = await mountNotebook(repository);

    expect(wrapper.get('[role="alert"]').text()).toMatch(/could not load/i);
    expect(wrapper.find('button[aria-label="Export all attempts as JSON"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain(attempt.source);
  });

  it('clears the old account history immediately when the session changes', async () => {
    const listAttempts = vi.fn().mockResolvedValueOnce([attempt]).mockResolvedValueOnce([]);
    const { repository, changeSession } = makeRepository(listAttempts);
    const { wrapper } = await mountNotebook(repository);

    expect(wrapper.text()).toContain(attempt.notes);
    changeSession();
    await flushPromises();

    expect(wrapper.text()).not.toContain(attempt.notes);
    expect(wrapper.text()).toMatch(/your notebook is empty/i);
    expect(listAttempts).toHaveBeenCalledTimes(2);
  });
});
