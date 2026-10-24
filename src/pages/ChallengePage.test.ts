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
    expect((wrapper.get('textarea[aria-label="TypeScript source"]').element as HTMLTextAreaElement).value).toContain(
      'TODO: Return the earliest longest window',
    );
    expect(wrapper.text()).toContain('Tests have not run');
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

  it('preserves the current source when learning spoilers are shown and hidden', async () => {
    vi.stubGlobal('confirm', () => true);
    await router.push('/challenges/longest-window');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    const source = 'export function longestWindow() { return { start: 0, endExclusive: 0 }; }';
    await wrapper.get('textarea[aria-label="TypeScript source"]').setValue(source);
    await wrapper.get('button[aria-label="Learning mode"]').trigger('click');
    await wrapper.get('button[aria-label="Interview mode"]').trigger('click');

    expect((wrapper.get('textarea[aria-label="TypeScript source"]').element as HTMLTextAreaElement).value).toBe(source);
    expect(wrapper.text()).toContain('Tests have not run');
    expect(wrapper.text()).not.toContain('Reference algorithm visualization');
  });

  it('opens the reference visualization on request and hides it again in Interview Mode', async () => {
    vi.stubGlobal('confirm', () => true);
    await router.push('/challenges/longest-window');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).not.toContain('Step through the sliding window');
    await wrapper.get('button[aria-label="Learning mode"]').trigger('click');
    expect(wrapper.text()).not.toContain('Step through the sliding window');
    await wrapper.get('button[aria-label="Show reference visualization"]').trigger('click');
    expect(wrapper.text()).toContain('Step through the sliding window');
    expect(wrapper.text()).toContain('does not read or run your editor code');

    await wrapper.get('button[aria-label="Interview mode"]').trigger('click');
    expect(wrapper.text()).not.toContain('Step through the sliding window');
    await wrapper.get('button[aria-label="Learning mode"]').trigger('click');
    expect(wrapper.text()).not.toContain('Step through the sliding window');
  });

  it('retries from the versioned starter and resets learning material on the same route', async () => {
    vi.stubGlobal('confirm', () => true);
    await router.push('/challenges/longest-window');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();
    await wrapper.get('textarea[aria-label="TypeScript source"]').setValue('old learner source');
    await wrapper.get('button[aria-label="Learning mode"]').trigger('click');

    await router.push('/challenges/longest-window?fresh=1');
    await flushPromises();

    expect((wrapper.get('textarea[aria-label="TypeScript source"]').element as HTMLTextAreaElement).value).toContain(
      'TODO: Return the earliest longest window',
    );
    expect(wrapper.get('button[aria-label="Interview mode"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('button[aria-label="Show hint 1"]').exists()).toBe(false);
  });

  it('requires deliberate consent before leaving Interview Mode for historical solutions', async () => {
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirm);
    await router.push('/challenges/longest-window');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();
    await wrapper.get('textarea[aria-label="TypeScript source"]').setValue('keep my current approach');

    await router.push('/notebook/longest-window');
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('previous solutions'));
    expect(router.currentRoute.value.path).toBe('/challenges/longest-window');
    expect((wrapper.get('textarea[aria-label="TypeScript source"]').element as HTMLTextAreaElement).value).toBe(
      'keep my current approach',
    );

    confirm.mockReturnValue(true);
    await router.push('/notebook/longest-window');
    expect(router.currentRoute.value.path).toBe('/notebook/longest-window');
  });
});
