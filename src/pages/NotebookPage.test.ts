import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../app/App.vue';
import { router } from '../router';

describe('NotebookPage', () => {
  it('shows a clear guest gate without illustrative personal history', async () => {
    await router.push('/notebook');
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.get('main h1').text()).toBe('My Notebook.');
    expect(wrapper.get('h2').text()).toBe('Sign in to open your notebook');
    expect(wrapper.text()).toMatch(/saved attempts and notes remain private/i);
    expect(wrapper.text()).not.toMatch(/Attempt #\d|\d+ attempts|Passed/i);
  });
});
