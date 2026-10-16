import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../app/App.vue';
import { router } from '../router';

describe('ChallengePage', () => {
  it('shows an accessible not-found state for a slug outside the catalog', async () => {
    await router.push('/challenges/not-in-the-catalog');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.get('main h1').text()).toBe('Challenge not found');
    expect(wrapper.get('[role="alert"]').text()).toMatch(/not available in this catalog/i);
    expect(wrapper.get('main a[href="/explore"]').text()).toBe('Explore challenges');
  });
});
