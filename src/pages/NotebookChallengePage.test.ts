import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, provide, reactive } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import type { SolutionAttempt } from '../../shared/contracts/v1';
import NotebookChallengePage from './NotebookChallengePage.vue';
import { AuthenticationRequiredError, type AttemptRepository } from '../features/solutions/attemptRepository';
import { attemptRepositoryKey } from '../features/solutions/session';
import { authControllerKey, type AuthController } from '../features/auth/auth';

const olderAttempt: SolutionAttempt = {
  id: 'attempt-older',
  userId: 'owner-a',
  challengeId: 'longest-window',
  challengeVersion: '0.9.0',
  source: 'function longestWindow() {\n  return { start: 0, endExclusive: 1 };\n}',
  notes: 'The first draft only kept one event.',
  timeComplexity: 'O(n)',
  spaceComplexity: 'O(n)',
  testSummary: { status: 'untested' },
  createdAt: '2026-10-15T10:00:00.000Z',
};
const newerAttempt: SolutionAttempt = {
  ...olderAttempt,
  id: 'attempt-newer',
  challengeVersion: '1.0.0',
  source: 'function longestWindow() {\n  return { start: 0, endExclusive: 3 };\n}',
  notes: 'Now I keep the earliest longest range.',
  createdAt: '2026-10-17T10:00:00.000Z',
};

function makeRepository(listAttempts = vi.fn().mockResolvedValue([newerAttempt, olderAttempt])) {
  const repository = {
    listAttempts,
    createAttempt: vi.fn().mockResolvedValue(newerAttempt),
    subscribeToSessionChanges: vi.fn(() => vi.fn()),
  } as unknown as AttemptRepository;
  return { repository, listAttempts };
}

async function mountDetail(repository: AttemptRepository, auth?: AuthController) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/notebook', name: 'notebook', component: { template: '<main>Notebook</main>' } },
      { path: '/notebook/:slug', name: 'notebook-detail', component: NotebookChallengePage },
      { path: '/challenges/:slug', name: 'challenge', component: { template: '<main>Challenge</main>' } },
    ],
  });
  await router.push('/notebook/longest-window');
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

describe('Notebook challenge detail', () => {
  it('hides source, notes and export immediately when the UI identity is cleared', async () => {
    const state = reactive({ userId: 'owner-a' as string | null });
    const { repository } = makeRepository();
    const { wrapper } = await mountDetail(repository, { state } as unknown as AuthController);
    expect(wrapper.text()).toContain(newerAttempt.notes);
    state.userId = null;
    await flushPromises();
    expect(wrapper.text()).not.toContain(newerAttempt.notes);
    expect(wrapper.find('[aria-label="Saved TypeScript source"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Download TypeScript source"]').exists()).toBe(false);
  });
  it('reopens exact saved source and notes with the original challenge revision', async () => {
    const { repository, listAttempts } = makeRepository();
    const { wrapper } = await mountDetail(repository);

    expect(listAttempts).toHaveBeenCalledWith('longest-window');
    expect(wrapper.get('[aria-label="Saved TypeScript source"]').text()).toBe(newerAttempt.source);
    expect(wrapper.text()).toContain(newerAttempt.notes);
    expect(wrapper.text()).toContain('Challenge version 1.0.0');
    expect(wrapper.text()).toMatch(/older challenge version 0\.9\.0/i);
    expect(wrapper.text()).toContain('Untested');
    expect(wrapper.find('textarea[aria-label="TypeScript source"]').exists()).toBe(false);

    await wrapper.get('button[aria-label^="Open attempt 1,"]').trigger('click');
    expect(wrapper.get('[aria-label="Saved TypeScript source"]').text()).toBe(olderAttempt.source);
    expect(wrapper.text()).toContain(
      'The original challenge statement for that revision is unavailable in this build.',
    );
  });

  it('compares selected versions with explicit Added and Removed labels', async () => {
    const { repository } = makeRepository();
    const { wrapper } = await mountDetail(repository);

    await wrapper.get('button[aria-label="Compare versions"]').trigger('click');

    expect(wrapper.get('[aria-label="Earlier attempt source"]').text()).toContain('Removed');
    expect(wrapper.get('[aria-label="Later attempt source"]').text()).toContain('Added');
    expect(wrapper.text()).toContain('return { start: 0, endExclusive: 1 }');
    expect(wrapper.text()).toContain('return { start: 0, endExclusive: 3 }');
  });

  it('retries with a fresh unique query token and does not carry prior source', async () => {
    const { repository } = makeRepository();
    const { wrapper, router } = await mountDetail(repository);

    await wrapper.get('button[aria-label="Retry from scratch"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('challenge');
    expect(router.currentRoute.value.params.slug).toBe('longest-window');
    expect(router.currentRoute.value.query.fresh).toEqual(expect.any(String));
    expect(Object.keys(router.currentRoute.value.query)).toEqual(['fresh']);
    expect(JSON.stringify(router.currentRoute.value.query)).not.toContain(olderAttempt.source);
  });

  it('shows an explicit error when a private attempt export cannot be created', async () => {
    const { repository } = makeRepository();
    const { wrapper } = await mountDetail(repository);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('download is unavailable');
    });

    try {
      await wrapper.get('button[aria-label="Download TypeScript source"]').trigger('click');
      expect(wrapper.get('[role="alert"]').text()).toMatch(/could not be exported/i);
    } finally {
      createObjectUrl.mockRestore();
    }
  });

  it('does not expose source or export actions after authentication fails', async () => {
    const { repository } = makeRepository(vi.fn().mockRejectedValue(new AuthenticationRequiredError()));
    const { wrapper } = await mountDetail(repository);

    expect(wrapper.text()).toMatch(/sign in to view/i);
    expect(wrapper.find('[aria-label="Saved TypeScript source"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Download TypeScript source"]').exists()).toBe(false);
  });
});
