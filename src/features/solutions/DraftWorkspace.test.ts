import type { SupabaseClient } from '@supabase/supabase-js';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authControllerKey, type AuthController } from '../auth/auth';
import { draftRepositoryKey } from './session';
import type { DraftRepository } from './draftRepository';
import DraftWorkspace from './DraftWorkspace.vue';
import { createDraftRecovery } from './draftRecovery';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
async function fixture() {
  const state = reactive({
    status: 'signed-in',
    userId: 'a' as string | null,
    generation: 0,
    message: '',
    signingOut: false,
  });
  const auth = { state, signIn: vi.fn(), client: {} as SupabaseClient } as unknown as AuthController;
  const repository: DraftRepository = {
    loadDraft: vi.fn().mockResolvedValue(null),
    saveDraft: vi.fn().mockRejectedValue(new Error('offline')),
  };
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
      provide: { [authControllerKey as symbol]: auth, [draftRepositoryKey as symbol]: repository },
    },
  });
  await flushPromises();
  return { wrapper, state, repository };
}

describe('editor recovery presentation', () => {
  it('refreshes recovery entries when another tab changes matching content', async () => {
    const { wrapper, state } = await fixture();
    state.userId = null;
    await flushPromises();
    await wrapper.get('textarea[aria-label="TypeScript source"]').setValue('matching work');
    const other = createDraftRecovery(localStorage, 'other');
    const buffer = {
      ownerId: null,
      challengeId: 'longest-window',
      challengeVersion: '1.0.0',
      source: 'matching work',
      expectedRevision: null,
      dirty: true,
      notes: '',
      timeComplexity: '',
      spaceComplexity: '',
    };
    other.write(buffer);
    window.dispatchEvent(new StorageEvent('storage'));
    await flushPromises();
    expect(wrapper.findAll('button').filter((button) => button.text().includes('Currently open'))).toHaveLength(1);
    other.write({ ...buffer, source: 'other tab newer edits' });
    window.dispatchEvent(new StorageEvent('storage'));
    await flushPromises();
    expect(wrapper.text()).not.toContain('Currently open');
    const review = wrapper.findAll('button').find((button) => button.text().startsWith('Review buffer'))!;
    await review.trigger('click');
    await flushPromises();
    expect((wrapper.get('textarea[aria-label="TypeScript source"]').element as HTMLTextAreaElement).value).toBe(
      'other tab newer edits',
    );
    wrapper.unmount();
  });

  it('retains source and notes over a reload, and synchronously clears them across accounts', async () => {
    const { wrapper, state } = await fixture();
    await wrapper.get('textarea[aria-label="TypeScript source"]').setValue('private A source');
    await wrapper.get('textarea[aria-label="Learning notes"]').setValue('private A notes');
    state.userId = null;
    state.generation += 1;
    await flushPromises();
    expect((wrapper.get('textarea[aria-label="TypeScript source"]').element as HTMLTextAreaElement).value).toBe(
      'starter',
    );
    expect((wrapper.get('textarea[aria-label="Learning notes"]').element as HTMLTextAreaElement).value).toBe('');
    state.userId = 'b';
    state.generation += 1;
    await flushPromises();
    expect(wrapper.text()).not.toContain('private A');
    state.userId = 'a';
    state.generation += 1;
    await flushPromises();
    expect((wrapper.get('textarea[aria-label="TypeScript source"]').element as HTMLTextAreaElement).value).toBe(
      'private A source',
    );
    expect((wrapper.get('textarea[aria-label="Learning notes"]').element as HTMLTextAreaElement).value).toBe(
      'private A notes',
    );
  });

  it('labels guest storage honestly and offers a portable download', async () => {
    const { wrapper, state } = await fixture();
    state.userId = null;
    await flushPromises();
    await wrapper.get('textarea[aria-label="TypeScript source"]').setValue('guest work');
    expect(wrapper.get('#source-persistence').text()).toMatch(/guest.*browser|browser.*guest/i);
    expect(wrapper.find('button[aria-label="Download current draft"]').exists()).toBe(true);
  });
});
