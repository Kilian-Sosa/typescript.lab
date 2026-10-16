import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../app/App.vue';
import { router } from '../router';

describe('ChallengePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the canonical challenge statement, examples and starter in Interview Mode', async () => {
    await router.push('/challenges/longest-window');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.get('main h1').text()).toBe('Longest Window with Limited Event Types');
    expect(wrapper.findAll('main h1').map((heading) => heading.text())).toEqual([
      'Longest Window with Limited Event Types',
    ]);
    expect(wrapper.find('.markdown-content h1').exists()).toBe(false);
    expect(wrapper.text()).toContain('Given an array of event identifiers');
    expect(wrapper.text()).toContain('Constraints and edge cases');
    expect(wrapper.get('[data-testid="example-output"]').text()).toBe('{ start: 0, endExclusive: 3 }');
    expect(wrapper.text()).toContain('TODO: Return the earliest longest window');
    expect(wrapper.text()).toMatch(/code editing, running tests, and saving are not available/i);
    expect(wrapper.text()).toContain('Interview Mode');
    expect(wrapper.text()).not.toContain('sliding-window');
    expect(wrapper.text()).not.toContain('Maintain a contiguous range');
    expect(wrapper.text()).not.toContain('const frequencies = new Map');
    expect(wrapper.find('button[aria-label="Show hint 1"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Reveal reference explanation"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Reveal reference solution"]').exists()).toBe(false);
  });

  it('requires confirmation before entering Learning Mode or revealing reference material', async () => {
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirm);
    await router.push('/challenges/longest-window');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.get('button[aria-label="Learning mode"]').trigger('click');
    expect(confirm).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('Interview Mode');
    expect(wrapper.find('button[aria-label="Show hint 1"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Reveal reference explanation"]').exists()).toBe(false);

    confirm.mockReturnValue(true);
    await wrapper.get('button[aria-label="Learning mode"]').trigger('click');
    expect(wrapper.text()).toContain('Learning Mode');
    expect(wrapper.find('button[aria-label="Show hint 1"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('arrays · strings · sliding-window · hash-map');

    await wrapper.get('button[aria-label="Show hint 1"]').trigger('click');
    expect(wrapper.text()).toContain('Grow a candidate range from left to right');
    await wrapper.get('button[aria-label="Show hint 2"]').trigger('click');
    expect(wrapper.text()).toContain('move its left edge forward');
    await wrapper.get('button[aria-label="Show hint 3"]').trigger('click');
    expect(wrapper.text()).toContain('Keep the current best on equal lengths');

    confirm.mockReturnValue(false);
    await wrapper.get('button[aria-label="Reveal reference explanation"]').trigger('click');
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(wrapper.text()).not.toContain('Maintain a contiguous range with a left edge');

    confirm.mockReturnValue(true);
    await wrapper.get('button[aria-label="Reveal reference explanation"]').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(wrapper.text()).toContain('Maintain a contiguous range with a left edge');

    confirm.mockReturnValue(false);
    await wrapper.get('button[aria-label="Reveal reference solution"]').trigger('click');
    expect(confirm).toHaveBeenCalledTimes(5);
    expect(wrapper.text()).not.toContain('const frequencies = new Map');

    confirm.mockReturnValue(true);
    await wrapper.get('button[aria-label="Reveal reference solution"]').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(confirm).toHaveBeenCalledTimes(6);
    expect(wrapper.text()).toContain('const frequencies = new Map');
  });

  it('hides revealed spoilers when returning to Interview Mode without losing example input', async () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    await router.push('/challenges/longest-window');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.get('#example-events-json').setValue('["kept"]');
    await wrapper.get('button[aria-label="Learning mode"]').trigger('click');
    await wrapper.get('button[aria-label="Reveal reference solution"]').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(wrapper.text()).toContain('const frequencies = new Map');

    await wrapper.get('button[aria-label="Reveal reference explanation"]').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(wrapper.text()).toContain('Maintain a contiguous range with a left edge');

    await wrapper.get('button[aria-label="Interview mode"]').trigger('click');
    expect(wrapper.text()).toContain('Interview Mode');
    expect(wrapper.text()).not.toContain('const frequencies = new Map');
    expect(wrapper.text()).not.toContain('Maintain a contiguous range');
    expect((wrapper.get('#example-events-json').element as HTMLTextAreaElement).value).toBe('["kept"]');
  });

  it('shows an accessible not-found state for a slug outside the catalog', async () => {
    await router.push('/challenges/not-in-the-catalog');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.get('main h1').text()).toBe('Challenge not found');
    expect(wrapper.get('[role="alert"]').text()).toMatch(/not available in this catalog/i);
    expect(wrapper.get('main a[href="/explore"]').text()).toBe('Explore challenges');
  });
});
