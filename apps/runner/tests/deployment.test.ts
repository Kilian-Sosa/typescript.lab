import { expect, it } from 'vitest';
import { deploymentPolicy } from '../deployment';

it('fails closed on missing, wildcard, same-site, path and HTTP deployment origins', () => {
  for (const [parent, runner] of [[undefined, undefined], ['https://*.vercel.app', 'https://runner.vercel.app'],
    ['https://app.vercel.app/path', 'https://runner.vercel.app'], ['https://app.vercel.app', 'https://app.vercel.app'],
    ['http://app.vercel.app', 'https://runner.vercel.app'], ['https://app.example.com', 'https://runner.example.com']]) {
    expect(() => deploymentPolicy(parent, runner)).toThrow();
  }
});
it('separates page and Worker permissions and pins one embedding origin', () => {
  const policy = deploymentPolicy('https://lab-app.vercel.app', 'https://lab-runner.vercel.app');
  expect(policy.page).toContain('frame-ancestors https://lab-app.vercel.app');
  expect(policy.page).toContain("connect-src 'none'");
  expect(policy.page).not.toContain('wasm-unsafe-eval');
  expect(policy.worker).toContain("worker-src 'none'");
  expect(policy.worker).toContain("'wasm-unsafe-eval'");
});
