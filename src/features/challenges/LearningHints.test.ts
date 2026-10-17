import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LearningHints from './LearningHints.vue';

const hints = [
  'First progressive hint.',
  'Second progressive hint.',
  'Third progressive hint.',
] as const;

describe('LearningHints', () => {
  it('keeps hints out of the page until Learning Mode is active', async () => {
    const wrapper = mount(LearningHints, {
      props: { active: false, challengeVersion: '1.0.0', hints },
    });

    expect(wrapper.find('section').exists()).toBe(false);
    expect(wrapper.text()).not.toContain(hints[0]);

    await wrapper.setProps({ active: true });
    expect(wrapper.get('section').text()).toContain('Progressive hints');
    expect(wrapper.text()).not.toContain(hints[0]);
  });

  it('reveals the versioned challenge hints one at a time with an announced status', async () => {
    const wrapper = mount(LearningHints, {
      props: { active: true, challengeVersion: '1.0.0', hints },
    });

    await wrapper.get('button[aria-label="Show hint 1"]').trigger('click');
    expect(wrapper.get('ol').text()).toContain(hints[0]);
    expect(wrapper.text()).not.toContain(hints[1]);
    expect(wrapper.get('[role="status"]').text()).toContain('Hint 1 of 3 revealed');

    await wrapper.get('button[aria-label="Show hint 2"]').trigger('click');
    expect(wrapper.get('ol').text()).toContain(hints[1]);
    expect(wrapper.text()).not.toContain(hints[2]);
  });

  it('requires another reveal after hiding Learning Mode or changing challenge version', async () => {
    const wrapper = mount(LearningHints, {
      props: { active: true, challengeVersion: '1.0.0', hints },
    });

    await wrapper.get('button[aria-label="Show hint 1"]').trigger('click');
    await wrapper.setProps({ active: false });
    expect(wrapper.find('section').exists()).toBe(false);

    await wrapper.setProps({ active: true });
    expect(wrapper.text()).not.toContain(hints[0]);

    await wrapper.get('button[aria-label="Show hint 1"]').trigger('click');
    await wrapper.setProps({ challengeVersion: '1.1.0' });
    expect(wrapper.text()).not.toContain(hints[0]);
  });
});
