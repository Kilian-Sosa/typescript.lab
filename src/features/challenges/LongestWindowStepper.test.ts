import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LongestWindowStepper from './LongestWindowStepper.vue';

const events = ['A', 'B', 'A', 'C'];

describe('LongestWindowStepper', () => {
  it('keeps the reference trace out of the page until Learning Mode is active', () => {
    const wrapper = mount(LongestWindowStepper, { props: { active: false, events, k: 2 } });

    expect(wrapper.find('section').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('A');

    return wrapper.setProps({ active: true }).then(() => {
      expect(wrapper.get('section').text()).toMatch(/reference approach/i);
      expect(wrapper.text()).toContain('does not read or run your editor code');
    });
  });

  it('shows pointer positions, counts, the best range, and a live explanation', () => {
    const wrapper = mount(LongestWindowStepper, { props: { active: true, events, k: 2 } });

    expect(wrapper.get('[data-testid="visualizer-step-status"]').text()).toMatch(/^Step 1 of/);
    expect(wrapper.get('[data-testid="visualizer-left-pointer"]').text()).toContain('0');
    expect(wrapper.get('[data-testid="visualizer-right-pointer"]').text()).toMatch(/before scanning/i);
    expect(wrapper.get('[data-testid="visualizer-best-range"]').text()).toContain('[0, 0)');
    expect(wrapper.get('[aria-live="polite"][data-testid="visualizer-explanation"]').text()).toMatch(
      /start before the first event/i,
    );
    expect(wrapper.get('[aria-label="Event positions and current window"]').text()).toContain('Index 0');
  });

  it('moves next and previous with native keyboard-operable buttons', async () => {
    const wrapper = mount(LongestWindowStepper, { props: { active: true, events, k: 2 } });

    await wrapper.get('button[aria-label="Next reference step"]').trigger('click');
    expect(wrapper.get('[data-testid="visualizer-step-status"]').text()).toMatch(/^Step 2 of/);
    expect(wrapper.get('[data-testid="visualizer-counts"]').text()).toContain('A: 1');

    await wrapper.get('button[aria-label="Next reference step"]').trigger('click');
    await wrapper.get('button[aria-label="Previous reference step"]').trigger('click');
    expect(wrapper.get('[data-testid="visualizer-step-status"]').text()).toMatch(/^Step 2 of/);
  });

  it('returns to the initial step after the Learning Mode gate closes', async () => {
    const wrapper = mount(LongestWindowStepper, { props: { active: true, events, k: 2 } });

    await wrapper.get('button[aria-label="Next reference step"]').trigger('click');
    await wrapper.setProps({ active: false });
    expect(wrapper.find('section').exists()).toBe(false);

    await wrapper.setProps({ active: true });
    expect(wrapper.get('[data-testid="visualizer-step-status"]').text()).toMatch(/^Step 1 of/);
  });
});
