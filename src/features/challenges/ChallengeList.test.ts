import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { ChallengeSummary } from '../../../shared/contracts/v1';
import { router } from '../../router';
import ChallengeList from './ChallengeList.vue';

const sampleChallenges = [
  {
    id: 'longest-window',
    slug: 'longest-window',
    version: '1.0.0',
    title: 'Longest Window with K Distinct Events',
    objective: 'Find a maximal contiguous valid segment.',
    difficulty: 'medium',
    estimatedMinutes: 25,
    tags: ['arrays', 'strings'],
  },
  {
    id: 'merge-intervals',
    slug: 'merge-intervals',
    version: '1.0.0',
    title: 'Merge Intervals',
    objective: 'Combine overlapping ranges.',
    difficulty: 'hard',
    estimatedMinutes: 35,
    tags: ['sorting'],
  },
] satisfies readonly ChallengeSummary[];

describe('ChallengeList', () => {
  it('filters challenge titles and objectives by a case-insensitive search', async () => {
    const wrapper = mount(ChallengeList, {
      props: { challenges: sampleChallenges },
      global: { plugins: [router] },
    });

    await wrapper.get('input[type="search"]').setValue('MAXIMAL');

    expect(wrapper.text()).toContain('Longest Window with K Distinct Events');
    expect(wrapper.text()).not.toContain('Merge Intervals');
  });

  it('filters the results by difficulty', async () => {
    const wrapper = mount(ChallengeList, {
      props: { challenges: sampleChallenges },
      global: { plugins: [router] },
    });

    await wrapper.get('select[name="difficulty"]').setValue('hard');

    expect(wrapper.text()).toContain('Merge Intervals');
    expect(wrapper.text()).not.toContain('Longest Window with K Distinct Events');
  });

  it('emits the selected slug and links to the challenge route', async () => {
    const wrapper = mount(ChallengeList, {
      props: { challenges: sampleChallenges },
      global: { plugins: [router] },
    });

    const link = wrapper.get('a[href="/challenges/longest-window"]');
    await link.trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();

    expect(wrapper.emitted('select')?.[0]).toEqual(['longest-window']);
    expect(router.currentRoute.value.fullPath).toBe('/challenges/longest-window');
  });

  it('shows an honest first-challenges state when the public catalog is empty', () => {
    const wrapper = mount(ChallengeList, {
      props: { challenges: [] },
      global: { plugins: [router] },
    });

    expect(wrapper.get('[role="status"]').text()).toMatch(/first challenges are coming soon/i);
    expect(wrapper.find('a[href^="/challenges/"]').exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/solved|attempts|progress/i);
  });
});
