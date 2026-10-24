import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import AuthControls from './AuthControls.vue';
import { authControllerKey, type AuthController, type AuthState } from './auth';

async function fixture(overrides: Partial<AuthState> = {}) {
  const state = reactive<AuthState>({ status: 'signed-in', userId: 'learner', generation: 1,
    message: '', signingOut: false, signOutFailed: false, returnTo: '/notebook', ...overrides });
  const auth = { state, signIn: vi.fn().mockResolvedValue(undefined), signOut: vi.fn(), start: vi.fn() };
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/challenges/:slug', component: { template: '<p>Challenge</p>' } },
  ] });
  await router.push('/challenges/longest-window?fresh=retry');
  const wrapper = mount(AuthControls, { global: { plugins: [router], provide: {
    [authControllerKey as symbol]: auth as unknown as AuthController,
  } } });
  return { wrapper, state, auth };
}

describe('header authentication controls', () => {
  it('offers sign-out without redundant connected-account copy', async () => {
    const { wrapper } = await fixture();
    expect(wrapper.text()).not.toContain('Private account connected');
    expect(wrapper.get('button').text()).toBe('Sign out');
  });

  it('keeps sign-out disabled while identity is being cleared', async () => {
    const { wrapper } = await fixture({ userId: null, status: 'signed-out', signingOut: true });
    expect(wrapper.get('button').text()).toBe('Sign out');
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true');
  });

  it('announces checking and exposes session recovery after failure', async () => {
    const { wrapper, state, auth } = await fixture({ status: 'checking', userId: null });
    expect(wrapper.get('[role="status"]').text()).toContain('Checking account');
    expect(wrapper.find('button').exists()).toBe(false);
    Object.assign(state, { status: 'error', message: 'Could not restore your session.' });
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain('Could not restore');
    await wrapper.findAll('button').find((button) => button.text() === 'Retry session')!.trigger('click');
    expect(auth.start).toHaveBeenCalledOnce();
  });

  it('disables duplicate sign-in and retains a safe return route and retry after failure', async () => {
    const { wrapper, auth } = await fixture({ status: 'signed-out', userId: null });
    let reject!: (reason: Error) => void;
    auth.signIn.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true');
    expect(auth.signIn).toHaveBeenCalledWith('/challenges/longest-window?fresh=retry');
    reject(new Error('transport failure'));
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain('please retry');
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
    await wrapper.get('button').trigger('click');
    expect(auth.signIn).toHaveBeenCalledTimes(2);
  });

  it('retains failed-sign-out retry and its announced message', async () => {
    const { wrapper, auth } = await fixture({ userId: null, status: 'signed-out', signOutFailed: true,
      message: 'Sign-out could not finish. Please retry.' });
    expect(wrapper.get('[role="status"]').text()).toContain('Please retry');
    expect(wrapper.get('button').text()).toBe('Retry sign-out');
    await wrapper.get('button').trigger('click');
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});
