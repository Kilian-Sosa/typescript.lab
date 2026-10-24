import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, provide, reactive } from 'vue';
import { authControllerKey, type AuthController } from '../auth/auth';
import { describe, expect, it, vi } from 'vitest';
import type { AttemptEvaluation, CreateAttemptInput, SolutionAttempt } from '../../../shared/contracts/v1';
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
  props: { challengeId: string; challengeVersion: string; source: string; evaluation?: AttemptEvaluation },
  repository: AttemptRepository,
  session?: NotebookSessionProvider,
  authState: Partial<AuthController['state']> | null = { status: 'signed-in', userId: 'owner-a' },
) {
  const host = defineComponent({
    props: {
      challengeId: { type: String, required: true },
      challengeVersion: { type: String, required: true },
      source: { type: String, required: true },
      evaluation: { type: Object, required: false },
    },
    setup(hostProps) {
      provide(attemptRepositoryKey, repository);
      if (authState) provide(authControllerKey, { state: authState } as AuthController);
      if (session) {
        provide(notebookSessionKey, session);
      }
      return () =>
        h(AttemptSubmissionPanel, {
          challengeId: hostProps.challengeId,
          challengeVersion: hostProps.challengeVersion,
          source: hostProps.source,
          evaluation: hostProps.evaluation as AttemptEvaluation | undefined,
        });
    },
  });
  return mount(host, { props });
}

describe('AttemptSubmissionPanel', () => {
  it('captures a detached evaluation/source/notes snapshot and reports the actual saved summary', async () => {
    let finish!: (attempt: SolutionAttempt) => void;
    const create = vi.fn(
      (_input: CreateAttemptInput) =>
        new Promise<SolutionAttempt>((resolve) => {
          finish = resolve;
        }),
    );
    const { repository } = makeRepository(create);
    const evaluation = reactive({ status: 'passed' as const, passedCases: 14, totalCases: 14 });
    const wrapper = mountPanel(
      { challengeId: 'longest-window', challengeVersion: '1.0.0', source: 'snapshot', evaluation },
      repository,
    );
    await wrapper.get('textarea').setValue('snapshot notes');
    await wrapper.get('form').trigger('submit');
    await wrapper.get('form').trigger('submit');
    expect(create).toHaveBeenCalledOnce();
    evaluation.passedCases = 0;
    expect(create.mock.calls[0]![0]).toMatchObject({
      source: 'snapshot',
      notes: 'snapshot notes',
      testSummary: { status: 'passed', passedCases: 14, totalCases: 14 },
    });
    finish({ ...savedAttempt, testSummary: { status: 'failed', passedCases: 13, totalCases: 14 } });
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain('failed · 13/14');
    wrapper.unmount();
  });

  it.each(['source', 'version', 'auth', 'unmount'] as const)(
    'suppresses obsolete save completion after %s changes',
    async (change) => {
      let finish!: (attempt: SolutionAttempt) => void;
      const { repository } = makeRepository(
        vi.fn(
          () =>
            new Promise<SolutionAttempt>((resolve) => {
              finish = resolve;
            }),
        ),
      );
      const state = reactive({ status: 'signed-in' as const, userId: 'owner-a', generation: 0 });
      const wrapper = mountPanel(
        { challengeId: 'longest-window', challengeVersion: '1.0.0', source: 'snapshot' },
        repository,
        undefined,
        state,
      );
      const panel = wrapper.getComponent(AttemptSubmissionPanel);
      await wrapper.get('form').trigger('submit');
      if (change === 'source') await wrapper.setProps({ source: 'later revision' });
      if (change === 'version') await wrapper.setProps({ challengeVersion: '2.0.0' });
      if (change === 'auth') state.generation++;
      if (change === 'unmount') wrapper.unmount();
      finish(savedAttempt);
      await flushPromises();
      expect(panel.emitted('saved')).toBeUndefined();
      if (change !== 'unmount') {
        expect(wrapper.find('[role="status"]').exists()).toBe(false);
        wrapper.unmount();
      }
    },
  );
  it.each([
    null,
    { status: 'checking' as const, userId: 'owner-a' },
    { status: 'error' as const, userId: 'owner-a' },
    { status: 'signed-out' as const, userId: null },
    { status: 'signed-in' as const, userId: 'owner-a', signingOut: true },
    { status: 'signed-in' as const, userId: 'owner-a', signOutFailed: true },
  ])('requires verified application authentication before calling the repository (%j)', async (state) => {
    const { repository, createAttempt } = makeRepository();
    const wrapper = mountPanel(
      { challengeId: 'longest-window', challengeVersion: '1.0.0', source: 'guest source' },
      repository,
      undefined,
      state,
    );
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(createAttempt).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toMatch(/sign in/i);
  });

  it('saves the latest parent editor source and notes as an untested immutable attempt', async () => {
    const { repository, createAttempt } = makeRepository();
    const wrapper = mountPanel(
      {
        challengeId: 'longest-window',
        challengeVersion: '1.0.0',
        source: 'const firstDraft = true;\n',
      },
      repository,
    );

    await wrapper.get('textarea[aria-label="Learning notes"]').setValue('I retained the earlier tie.');
    await wrapper.get('input[aria-label="Declared time complexity"]').setValue('  O(n)  ');
    await wrapper.setProps({ source: 'const currentEditorSource = "exact";\n' });
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(createAttempt).toHaveBeenCalledWith(
      {
        challengeId: 'longest-window',
        challengeVersion: '1.0.0',
        source: 'const currentEditorSource = "exact";\n',
        notes: 'I retained the earlier tie.',
        timeComplexity: 'O(n)',
        spaceComplexity: null,
        testSummary: { status: 'untested' },
      },
      'owner-a',
    );
    expect(wrapper.get('[role="status"]').text()).toMatch(/attempt saved.*untested/i);
    expect(wrapper.find('textarea[aria-label="TypeScript source"]').exists()).toBe(false);
  });

  it('offers sign-in when the verified repository reports no authenticated account', async () => {
    const { repository, createAttempt } = makeRepository(vi.fn().mockRejectedValue(new AuthenticationRequiredError()));
    const signInWithGitHub = vi.fn().mockResolvedValue(undefined);
    const session = { signInWithGitHub } as unknown as NotebookSessionProvider;
    const wrapper = mountPanel(
      {
        challengeId: 'longest-window',
        challengeVersion: '1.0.0',
        source: 'const current = true;',
      },
      repository,
      session,
    );

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    await wrapper.get('button[aria-label="Sign in with GitHub"]').trigger('click');

    expect(createAttempt).toHaveBeenCalledOnce();
    expect(signInWithGitHub).toHaveBeenCalledWith('/notebook');
  });
});
