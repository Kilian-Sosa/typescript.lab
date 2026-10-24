import type { SupabaseClient } from '@supabase/supabase-js';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { defineComponent, h, reactive } from 'vue';
import { longestWindowCases } from '../../../challenges/longest-window/cases';
import type { CreateAttemptInput, SolutionAttempt } from '../../../shared/contracts/v1';
import type { RunChallenge, RunContext, RunFeedback } from '../runner/runChallenge';
import { runChallengeKey } from '../runner/session';
import { attemptRepositoryKey } from './session';
import type { AttemptRepository } from './attemptRepository';
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
  const createAttempt = vi.fn(async (input: CreateAttemptInput, userId: string): Promise<SolutionAttempt> => ({
    ...input,
    id: 'saved',
    userId,
    createdAt: '2026-10-24T10:00:00Z',
  }));
  const attempts: AttemptRepository = {
    createAttempt,
    listAttempts: vi.fn(),
    subscribeToSessionChanges: () => () => {},
  };
  let finish!: (result: RunFeedback) => void;
  let active!: RunContext;
  const run = vi.fn<RunChallenge>((_source, _id, context) => {
    active = context;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const reply = (status: RunFeedback['status'] = 'passed', reason?: RunFeedback['reason']) =>
    finish({
      contractVersion: '1.0.0',
      ...active,
      challengeId: 'longest-window',
      status,
      ...(reason ? { reason } : {}),
      diagnostics: status === 'passed' || status === 'failed' ? [] : ['Run diagnostic'],
      cases: longestWindowCases.map((c, i) => ({
        caseId: c.id,
        status:
          status === 'passed' || status === 'failed'
            ? status === 'failed' && i === 0
              ? 'failed'
              : 'passed'
            : 'not-run',
        ...(status === 'passed' || status === 'failed'
          ? { expected: c.expected, actual: status === 'failed' && i === 0 ? null : c.expected }
          : {}),
      })),
    });
  const workspaceProps = reactive({ challengeId: 'longest-window', challengeVersion: '1.0.0', starter: 'starter' });
  const host = defineComponent({ setup: () => () => h(DraftWorkspace, workspaceProps) });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/challenges/:slug', component: host }],
  });
  await router.push('/challenges/longest-window');
  const wrapper = mount(RouterView, {
    global: {
      plugins: [router],
      provide: {
        [authControllerKey as symbol]: auth,
        [draftRepositoryKey as symbol]: repository,
        [attemptRepositoryKey as symbol]: attempts,
        [runChallengeKey as symbol]: run,
      },
    },
  });
  await flushPromises();
  return { wrapper, state, repository, run, reply, createAttempt, workspaceProps };
}

describe('Run to immutable Save', () => {
  it.each([
    ['failed', 13],
    ['compile-error', 0],
    ['timeout', 0],
    ['execution-error', 0],
    ['infrastructure-error', 0],
  ] as const)('persists a truthful %s evaluation', async (status, passedCases) => {
    const f = await fixture();
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    f.reply(status, status === 'execution-error' ? 'policy-rejected' : undefined);
    await flushPromises();
    await f.wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(f.createAttempt.mock.calls.at(-1)?.[0].testSummary).toEqual({ status, passedCases, totalCases: 14 });
    expect(f.wrapper.text()).toContain('Attempt saved. Test status: ' + status);
    f.wrapper.unmount();
  });

  it('saves a validated 14/14 evaluation with exact current source and notes', async () => {
    const f = await fixture();
    await f.wrapper.get('textarea[aria-label="TypeScript source"]').setValue('exact source');
    await f.wrapper.get('textarea[aria-label="Learning notes"]').setValue('private notes');
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    f.reply();
    await flushPromises();
    await f.wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(f.createAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: 'exact source',
        notes: 'private notes',
        challengeVersion: '1.0.0',
        testSummary: { status: 'passed', passedCases: 14, totalCases: 14 },
      }),
      'a',
    );
    expect(f.wrapper.text()).toContain('Evaluation: passed · 14/14');
    f.wrapper.unmount();
  });

  it.each(['edit-revert', 'new-run', 'cancel', 'session', 'signing-out', 'version'] as const)(
    'cannot reuse a passing evaluation after %s',
    async (change) => {
      const f = await fixture();
      await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
      f.reply();
      await flushPromises();
      if (change === 'edit-revert') {
        const editor = f.wrapper.get('textarea[aria-label="TypeScript source"]');
        (editor.element as HTMLTextAreaElement).value = 'edit';
        void editor.trigger('input');
        (editor.element as HTMLTextAreaElement).value = 'starter';
        void editor.trigger('input');
        await flushPromises();
      } else if (change === 'session') {
        f.state.generation++;
        await flushPromises();
      } else if (change === 'signing-out') {
        f.state.signingOut = true;
        await flushPromises();
        f.state.signingOut = false;
        await flushPromises();
      } else if (change === 'version') {
        f.workspaceProps.challengeVersion = '2.0.0';
        await flushPromises();
      } else {
        await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
        if (change === 'cancel') {
          await f.wrapper.get('button[aria-label="Cancel test run"]').trigger('click');
          f.reply();
          await flushPromises();
        }
      }
      await f.wrapper.get('form').trigger('submit');
      await flushPromises();
      expect(f.createAttempt.mock.calls.at(-1)?.[0].testSummary).toEqual({ status: 'untested' });
      f.wrapper.unmount();
    },
  );
});

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
