import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, expect, it } from 'vitest';
import DraftSaveStatus from './DraftSaveStatus.vue';
import { createDraftRecovery } from './draftRecovery';
import { createDraftSync } from './draftSync';

beforeEach(() => localStorage.clear());
it('counts distinct recoveries and labels the open buffer until its content changes', async () => {
  const recovery = createDraftRecovery(localStorage, 'other');
  recovery.write({
    ownerId: null,
    challengeId: 'challenge',
    challengeVersion: '1',
    source: 'other work',
    expectedRevision: null,
    dirty: true,
    notes: '',
    timeComplexity: '',
    spaceComplexity: '',
  });
  const sync = createDraftSync({
    repository: null,
    recovery: createDraftRecovery(localStorage, 'current'),
    challenge: { id: 'challenge', version: '1', starter: 'starter' },
    isOnline: () => true,
  });
  await sync.connect(null);
  sync.edit('my work');
  const wrapper = mount(DraftSaveStatus, { props: { sync, challengeId: 'challenge', challengeVersion: '1' } });
  await wrapper.get('summary').trigger('click');
  const review = wrapper.findAll('button').find((button) => button.text().startsWith('Review buffer'))!;
  await review.trigger('click');
  await flushPromises();
  expect(wrapper.get('summary').text()).toContain('(2)');
  expect(wrapper.findAll('button').filter((button) => button.text().includes('Currently open'))).toHaveLength(1);
  expect(
    wrapper
      .findAll('button')
      .find((button) => button.text().includes('Currently open'))!
      .attributes('disabled'),
  ).toBeDefined();
  sync.editNotes({ notes: 'new reasoning', timeComplexity: '', spaceComplexity: '' });
  await flushPromises();
  expect(wrapper.text()).not.toContain('Currently open');
  sync.dispose();
  wrapper.unmount();
});
