import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import { authCallbackKey, authControllerKey, type AuthController } from './auth';
import AuthCallbackPage from './AuthCallbackPage.vue';

describe('authentication callback page', () => {
  it('presents denial with retry and guest navigation, without provider strings', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/callback', component: AuthCallbackPage },
        { path: '/explore', component: { template: '<p>Explore</p>' } },
      ],
    });
    await router.push('/auth/callback');
    const auth = {
      state: { message: 'GitHub sign-in was cancelled or denied. Your local work is retained.' },
      completeCallback: vi.fn().mockResolvedValue(null),
      signIn: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthController;
    const wrapper = mount(AuthCallbackPage, {
      global: {
        plugins: [router],
        provide: {
          [authControllerKey as symbol]: auth,
          [authCallbackKey as symbol]: { kind: 'denied' },
        },
      },
    });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toMatch(/denied/);
    await wrapper.get('button').trigger('click');
    expect(auth.signIn).toHaveBeenCalled();
    expect(wrapper.get('a').attributes('href')).toBe('/explore');
  });
});
