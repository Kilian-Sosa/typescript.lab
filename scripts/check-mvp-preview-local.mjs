import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from '../node_modules/@playwright/test/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const appOrigin = 'https://typescript-lab-m3-app-qa.vercel.app';
const runnerOrigin = 'https://typescript-lab-m3-runner-qa.vercel.app';
const wrongOrigin = 'https://unapproved-mvp-origin.vercel.app';
const appRoot = join(root, 'output/mvp-preview/app/.vercel/output/static');
const runnerRoot = join(root, 'apps/runner/.vercel/output/static');

const build = spawnSync(process.execPath, ['scripts/build-mvp-preview.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    VERCEL_ENV: 'preview',
    VERCEL_TARGET_ENV: 'preview',
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_fixture',
  },
});
assert.equal(build.status, 0, build.stderr || build.stdout);
const [appConfig, runnerConfig, solution] = await Promise.all([
  readFile(join(root, 'output/mvp-preview/app/.vercel/output/config.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'apps/runner/.vercel/output/config.json'), 'utf8').then(JSON.parse),
  readFile(join(root, 'challenges/longest-window/solution.ts'), 'utf8'),
]);
for (const file of await readdir(join(runnerRoot, 'assets'))) {
  if (!file.endsWith('.js')) continue;
  const code = await readFile(join(runnerRoot, 'assets', file), 'utf8');
  assert.doesNotMatch(
    code,
    /sb_publishable_browser_fixture|https:\/\/example\.supabase\.co/,
    'Supabase public client configuration must not be bundled into the isolated runner',
  );
}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
};
const userId = '00000000-0000-4000-8000-00000000000a';
const user = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'runner-qa@example.test',
  app_metadata: { provider: 'github' },
  user_metadata: {},
  created_at: '2026-10-20T00:00:00Z',
};
const jwt =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.' +
  Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url') +
  '.c2lnbmF0dXJl';

test(
  'compiled authenticated MVP Preview executes in strict isolated sites without auth leaks',
  { timeout: 60000 },
  async () => {
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? 'msedge',
      headless: true,
    });
    const errors = [];
    const runnerRequests = [];
    const authRequests = [];
    let workerRequests = 0;
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addCookies([
        { name: 'app-private-cookie', value: 'not-for-runner', url: appOrigin, sameSite: 'Lax', secure: true },
      ]);
      await context.route('**/*', async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (url.origin === 'https://example.supabase.co') {
          authRequests.push(request.method() + ' ' + url.pathname);
          const cors = {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
            'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          };
          const respond = (body, status = 200) =>
            route.fulfill({
              status,
              contentType: 'application/json',
              headers: cors,
              body: JSON.stringify(body),
            });
          if (request.method() === 'OPTIONS') await route.fulfill({ status: 204, headers: cors });
          else if (url.pathname === '/auth/v1/authorize') {
            const callback = url.searchParams.get('redirect_to');
            assert.equal(callback, appOrigin + '/auth/callback', 'Unexpected OAuth return destination');
            // Navigate from the mock provider document so the next request re-enters local route interception.
            await route.fulfill({
              status: 200,
              contentType: 'text/html',
              body: '<script>location.replace(' + JSON.stringify(callback + '?code=synthetic-mvp-code') + ')</script>',
            });
          } else if (url.pathname === '/auth/v1/token') {
            await respond({
              access_token: jwt,
              refresh_token: 'synthetic-refresh',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user,
            });
          } else if (url.pathname === '/auth/v1/user') await respond(user);
          else if (url.pathname === '/rest/v1/solution_drafts' && request.method() === 'GET') await respond([]);
          else await respond({ message: 'Unexpected fixture request' }, 400);
          return;
        }
        if (url.origin !== appOrigin && url.origin !== runnerOrigin && url.origin !== wrongOrigin) {
          errors.push('Unexpected external request: ' + url.origin);
          await route.abort();
          return;
        }
        const runner = url.origin === runnerOrigin;
        if (runner) {
          const h = request.headers();
          assert.equal(h.authorization, undefined, 'Runner request contained an auth header');
          assert.doesNotMatch(h.cookie ?? '', /app-private-cookie/, 'Runner received parent cookies');
          assert.equal(h.referer, undefined, 'Runner received an app referrer');
          runnerRequests.push(url.pathname);
          if (/\/assets\/worker-[^/]+\.js$/.test(url.pathname)) workerRequests += 1;
        }
        const directory = runner ? runnerRoot : appRoot;
        const file = url.pathname === '/' || (!extname(url.pathname) && !runner) ? '/index.html' : url.pathname;
        const absolute = resolve(directory, '.' + file);
        if (!absolute.startsWith(directory + sep)) {
          await route.abort();
          return;
        }
        let body;
        try {
          body = await readFile(absolute);
        } catch {
          await route.fulfill({ status: 404, body: 'Not found' });
          return;
        }
        const config = runner ? runnerConfig : appConfig;
        const policy = Object.assign(
          {},
          ...config.routes
            .filter((entry) => entry.src && new RegExp('^' + entry.src + '$').test(url.pathname))
            .map((entry) => entry.headers),
        );
        await route.fulfill({
          status: 200,
          headers: policy,
          contentType: mime[extname(absolute)] ?? 'application/octet-stream',
          body,
        });
      });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(appOrigin + '/challenges/longest-window');
      const run = page.getByRole('button', { name: 'Run tests', exact: true });
      const source = page.getByRole('textbox', { name: 'TypeScript source', exact: true });
      await source.waitFor();
      assert.equal(
        await run.isEnabled(),
        true,
        'Compiled MVP Preview must enable isolated execution at the exact app origin',
      );
      assert.equal(
        (await page.getByRole('button', { name: 'Sign in with GitHub' }).count()) > 0,
        true,
        'Authenticated build must preserve the GitHub sign-in flow',
      );
      await page.evaluate(() => localStorage.setItem('app-private-storage', 'not-for-runner'));
      await source.fill(solution);
      await run.click();
      await page.getByText('All 14 tests passed', { exact: true }).waitFor({ timeout: 25000 });
      assert.equal(await page.locator('iframe').count(), 0, 'Runner iframe was not disposed');
      await source.fill(
        'export function longestWindow(_events: string[], _k: number): { start: number; endExclusive: number } { return { start: 0, endExclusive: 0 }; }',
      );
      await run.click();
      await page.getByText('Tests failed', { exact: true }).waitFor({ timeout: 25000 });
      await page.locator('header').getByRole('button', { name: 'Sign in with GitHub' }).click();
      try {
        await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor({ timeout: 10000 });
      } catch (error) {
        throw new Error(
          'Synthetic login incomplete: ' +
            JSON.stringify({
              path: new URL(page.url()).pathname,
              alerts: await page.locator('[role=alert]').allTextContents(),
              authRequests,
              errors: errors.slice(0, 8),
            }),
          { cause: error },
        );
      }
      assert.ok(
        authRequests.some((path) => path.includes('/auth/v1/token')),
        'The test did not exercise the synthetic PKCE token exchange',
      );
      assert.equal(new URL(page.url()).pathname, '/challenges/longest-window');
      assert.equal(new URL(page.url()).search, '', 'OAuth callback query remained visible');
      await source.fill(solution);
      await run.click();
      await page.getByText('All 14 tests passed', { exact: true }).waitFor({ timeout: 25000 });
      assert.ok(
        runnerRequests.some((path) => path === '/'),
        'Runner document was not requested',
      );
      assert.ok(workerRequests >= 2, 'Each run must create a disposable Worker');
      assert.ok(
        runnerRequests.some((path) => path.endsWith('.wasm')),
        'QuickJS WASM was not requested',
      );
      const wrongPage = await context.newPage();
      await wrongPage.goto(wrongOrigin + '/challenges/longest-window');
      const rejectedRun = wrongPage.getByRole('button', { name: 'Run tests', exact: true });
      await rejectedRun.waitFor();
      assert.equal(
        await rejectedRun.isDisabled(),
        true,
        'The copied compiled app must fail closed on an unapproved origin',
      );
      assert.match(await wrongPage.locator('.runner-gate').innerText(), /unavailable on this deployment/);
      await wrongPage.close();
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await browser.close();
    }
  },
);
