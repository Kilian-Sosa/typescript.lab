import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, provide } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { SolutionAttempt } from '../../../shared/contracts/v1';
import { AuthenticationRequiredError, type AttemptRepository } from './attemptRepository';
import AttemptSubmissionPanel from './AttemptSubmissionPanel.vue';
import { attemptRepositoryKey, notebookSessionKey, type NotebookSessionProvider } from './session';

const savedAttempt: SolutionAttempt = {
  id: 'attempt-1',
  userId: 'owner-a',
  challengeId: 'longest-window',
  challengeVersion: '1.0.0',
  source: 'const answer = 42;\n',
  notes: 'Keep the earliest range.',
  timeComplexity: 'O(n)',
  spaceComplexity: 'O(k)',
  testSummary: { status: 'untested' },
  createdAt: '2026-10-17T10:30:00.000Z',
};

function makeRepository(createAttempt = vi.fn().mockResolvedValue(savedAttempt)) {
  return {
    repository: {
      createAttempt,
      listAttempts: vi.fn().mockResolvedValue([]),
      subscribeToSessionChanges: vi.fn(() => vi.fn()),
    } as unknown as AttemptRepository,
    createAttempt,
  };
}

function mountPanel(
  props: { challengeId: string; challengeVersion: string; source: string },
  repository: AttemptRepository,
  session?: NotebookSessionProvider,
) {
  const host = defineComponent({
    props: {
      challengeId: { type: String, required: true },
      challengeVersion: { type: String, required: true },
      source: { type: String, required: true },
    },
    setup(hostProps) {
      provide(attemptRepositoryKey, repository);
      if (session) {
        provide(notebookSessionKey, session);
      }
      return () => h(AttemptSubmissionPanel, {
        challengeId: hostProps.challengeId,
        challengeVersion: hostProps.challengeVersion,
        source: hostProps.source,
      });
    },
  });
  return mount(host, { props });
}

describe('AttemptSubmissionPanel', () => {
  it('saves the latest parent editor source and notes as an untested immutable attempt', async () => {
    const { repository, createAttempt } = makeRepository();
    const wrapper = mountPanel({
      challengeId: 'longest-window',
      challengeVersion: '1.0.0',
      source: 'const firstDraft = true;\n',
    }, repository);

    await wrapper.get('textarea[aria-label="Learning notes"]').setValue('I retained the earlier tie.');
    await wrapper.get('input[aria-label="Declared time complexity"]').setValue('  O(n)  ');
    await wrapper.setProps({ source: 'const currentEditorSource = "exact";\n' });
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(createAttempt).toHaveBeenCalledWith({
      challengeId: 'longest-window',
      challengeVersion: '1.0.0',
      source: 'const currentEditorSource = "exact";\n',
      notes: 'I retained the earlier tie.',
      timeComplexity: 'O(n)',
      spaceComplexity: null,
      testSummary: { status: 'untested' },
    });
    expect(wrapper.get('[role="status"]').text()).toMatch(/attempt saved.*untested/i);
    expect(wrapper.find('textarea[aria-label="TypeScript source"]').exists()).toBe(false);
  });

  it('offers sign-in when the verified repository reports no authenticated account', async () => {
    const { repository, createAttempt } = makeRepository(
      vi.fn().mockRejectedValue(new AuthenticationRequiredError()),
    );
    const signInWithGitHub = vi.fn().mockResolvedValue(undefined);
    const session = { signInWithGitHub } as unknown as NotebookSessionProvider;
    const wrapper = mountPanel({
      challengeId: 'longest-window',
      challengeVersion: '1.0.0',
      source: 'const current = true;',
    }, repository, session);

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    await wrapper.get('button[aria-label="Sign in with GitHub"]').trigger('click');

    expect(createAttempt).toHaveBeenCalledOnce();
    expect(signInWithGitHub).toHaveBeenCalledWith('/notebook');
  });
});
