import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from '../node_modules/@playwright/test/index.mjs';

import { PRODUCTION_ORIGINS } from '../shared/deployment/production.ts';
import { QA } from './m3-public-qa-probe.mjs';
export async function runMvpBrowserAcceptance({ mode }) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  if (!['mvp-preview', 'mvp-production'].includes(mode)) throw new Error('Unsupported acceptance mode.');
  const production = mode === 'mvp-production';
  const appOrigin = production ? PRODUCTION_ORIGINS.app : QA.app;
  const runnerOrigin = production ? PRODUCTION_ORIGINS.runner : QA.runner;
  const wrongOrigin = 'https://unapproved-mvp-origin.vercel.app';
  const appOutput = join(root, 'output', mode, 'app/.vercel/output');
  const runnerOutput = production
    ? join(root, 'output/mvp-production/runner/.vercel/output')
    : join(root, 'apps/runner/.vercel/output');
  const appRoot = join(appOutput, 'static');
  const runnerRoot = join(runnerOutput, 'static');

  const build = spawnSync(
    process.execPath,
    [production ? 'scripts/build-mvp-production.mjs' : 'scripts/build-mvp-preview.mjs'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        VERCEL_ENV: production ? 'production' : 'preview',
        VERCEL_TARGET_ENV: production ? 'production' : 'preview',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_fixture',
      },
    },
  );
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const [appConfig, runnerConfig, solution] = await Promise.all([
    readFile(join(appOutput, 'config.json'), 'utf8').then(JSON.parse),
    readFile(join(runnerOutput, 'config.json'), 'utf8').then(JSON.parse),
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
    `compiled authenticated ${mode} executes in strict isolated sites without auth leaks`,
    { timeout: 60000 },
    async () => {
      const browser = await chromium.launch({
        channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? 'msedge',
        headless: true,
      });
      const errors = [];
      const runnerRequests = [];
      const authRequests = [];
      const attempts = [];
      const browserConsole = [];
      let failSave = false;
      let failRunner = false;
      let draft = null;
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
                body:
                  '<script>location.replace(' + JSON.stringify(callback + '?code=synthetic-mvp-code') + ')</script>',
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
            else if (url.pathname === '/rest/v1/solution_attempts') {
              assert.equal(
                request.headers().authorization,
                `Bearer ${jwt}`,
                'Attempt request lost its captured session',
              );
              if (request.method() === 'POST') {
                if (failSave) {
                  await respond({ message: 'Synthetic temporary failure' }, 503);
                  return;
                }
                const input = request.postDataJSON();
                assert.equal(input.user_id, undefined, 'Client must not assign attempt ownership');
                assert.deepEqual(
                  Object.keys(input.test_summary).sort(),
                  input.test_summary.status === 'untested' ? ['status'] : ['passedCases', 'status', 'totalCases'],
                );
                const attempt = {
                  ...input,
                  user_id: userId,
                  id: `attempt-${attempts.length + 1}`,
                  created_at: new Date(Date.UTC(2026, 9, 24, 10, 0, attempts.length)).toISOString(),
                };
                attempts.unshift(attempt);
                await respond(attempt, 201);
              } else {
                assert.equal(request.method(), 'GET');
                assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
                await respond(attempts);
              }
            } else if (url.pathname === '/rest/v1/solution_drafts') {
              assert.equal(request.headers().authorization, `Bearer ${jwt}`);
              if (request.method() === 'GET') await respond(draft ? [draft] : []);
              else {
                const input = request.postDataJSON();
                draft = {
                  ...input,
                  user_id: userId,
                  revision: draft ? draft.revision + 1 : 0,
                  updated_at: new Date().toISOString(),
                };
                await respond(request.method() === 'POST' ? draft : [draft]);
              }
            } else await respond({ message: 'Unexpected fixture request' }, 400);
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
            if (failRunner && url.pathname === '/') {
              await route.fulfill({ status: 503, contentType: 'text/html', body: 'Synthetic unavailable runner' });
              return;
            }
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
        page.on('console', (message) => browserConsole.push(message.text()));
        await page.goto(appOrigin + '/challenges/longest-window');
        const run = page.getByRole('button', { name: 'Run tests', exact: true });
        const source = page.getByRole('textbox', { name: 'TypeScript source', exact: true });
        await source.waitFor();
        assert.equal(
          await run.isEnabled(),
          true,
          'Compiled MVP artifact must enable isolated execution at the exact app origin',
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
        const complete = async (code, title) => {
          await source.fill(code);
          await run.click();
          await page.getByText(title, { exact: true }).waitFor({ timeout: 25000 });
          assert.equal(await source.inputValue(), code, 'Execution must preserve the exact source');
          assert.equal(await page.locator('iframe').count(), 0, 'Every terminal run must dispose its iframe');
        };
        const consoleText = '<img src=x onerror="globalThis.consoleEscaped=true"> production-console';
        await complete(
          `console.log(${JSON.stringify(consoleText)}); console.info('info'); console.warn('warn'); console.error('error');\n${solution}`,
          'All 14 tests passed',
        );
        const consoleOutput = page.getByRole('region', { name: 'Console output', exact: true });
        assert.ok((await consoleOutput.innerText()).includes(consoleText));
        assert.equal(await consoleOutput.locator('img, script').count(), 0, 'Console text must not become HTML');
        assert.equal(await page.evaluate(() => globalThis.consoleEscaped), undefined);
        assert.ok(
          !browserConsole.some((line) => line.includes('production-console')),
          'Learner console must not reach host console',
        );
        for (const level of ['log', 'info', 'warn', 'error'])
          assert.ok((await consoleOutput.locator('.console-level').allTextContents()).includes(level));
        await complete(`for (let i = 0; i < 110; i++) console.log('bounded');\n${solution}`, 'All 14 tests passed');
        await page.getByText('Console output was truncated to stay within display limits.', { exact: true }).waitFor();
        assert.ok((await consoleOutput.locator('li').count()) <= 100);
        await complete('export function longestWindow() { return missingValue; }', 'Compilation failed');
        await complete(
          'export function longestWindow() { throw new Error("learner runtime failure"); }',
          'Execution failed',
        );
        const loop = 'export function longestWindow() { while (true) {} }';
        await complete(loop, 'Run timed out');
        await source.fill(loop);
        await run.click();
        const cancel = page.getByRole('button', { name: 'Cancel test run', exact: true });
        await cancel.waitFor();
        await cancel.focus();
        await page.keyboard.press('Enter');
        await page.getByText('Run cancelled', { exact: true }).waitFor();
        assert.equal(await page.locator('iframe').count(), 0);
        assert.equal(
          await run.evaluate((button) => button === document.activeElement),
          true,
          'Cancel must restore keyboard focus',
        );
        await complete(solution, 'All 14 tests passed');
        failRunner = true;
        await complete(solution + '\n// network retry', 'Runner unavailable');
        failRunner = false;
        await complete(solution, 'All 14 tests passed');
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
        await page.waitForURL(appOrigin + '/challenges/longest-window');
        assert.equal(new URL(page.url()).pathname, '/challenges/longest-window');
        assert.equal(new URL(page.url()).search, '', 'OAuth callback query remained visible');
        await source.fill(solution);
        await run.click();
        await page.getByText('All 14 tests passed', { exact: true }).waitFor({ timeout: 25000 });
        const notes = 'A verified run saved with the exact source and revision.';
        await page.getByRole('textbox', { name: 'Learning notes', exact: true }).fill(notes);
        failSave = true;
        await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
        await page
          .getByText('This attempt could not be saved. Your source and notes are still here; try again.', {
            exact: true,
          })
          .waitFor();
        assert.equal(attempts.length, 0);
        assert.equal(await source.inputValue(), solution);
        assert.equal(await page.getByRole('textbox', { name: 'Learning notes', exact: true }).inputValue(), notes);
        failSave = false;
        await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
        await page.getByText('Attempt saved. Test status: passed · 14/14 cases.', { exact: true }).waitFor();
        assert.equal(attempts.length, 1);
        assert.equal(attempts[0].source, solution);
        assert.equal(attempts[0].notes, notes);
        assert.equal(attempts[0].challenge_version, '1.0.0');
        assert.deepEqual(attempts[0].test_summary, { status: 'passed', totalCases: 14, passedCases: 14 });
        const passedSnapshot = structuredClone(attempts[0]);
        await page.goto(appOrigin + '/notebook/longest-window');
        await page.locator('.attempt-status-label').getByText('passed · 14/14 cases', { exact: true }).waitFor();
        await page.locator('.attempt-timeline').getByText('passed · 14/14 cases', { exact: true }).waitFor();
        await page.getByText(notes, { exact: true }).waitFor();
        const downloading = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
        const stream = await (await downloading).createReadStream();
        const chunks = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        const exported = JSON.parse(Buffer.concat(chunks).toString('utf8')).attempt;
        assert.equal(exported.source, solution);
        assert.equal(exported.notes, notes);
        assert.equal(exported.challengeVersion, '1.0.0');
        assert.deepEqual(exported.testSummary, passedSnapshot.test_summary);
        assert.deepEqual(Object.keys(exported.testSummary).sort(), ['passedCases', 'status', 'totalCases']);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
          true,
        );
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(appOrigin + '/challenges/longest-window');
        await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
        await source.fill(solution + '\n// edited after passing');
        await source.fill(solution);
        await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
        await page.getByText('Attempt saved. Test status: Untested.', { exact: true }).waitFor();
        assert.deepEqual(attempts[0].test_summary, { status: 'untested' });
        assert.deepEqual(attempts[1], passedSnapshot, 'Later saves must not alter immutable passed history');
        await source.fill(
          'export function longestWindow(_events: string[], _k: number) { return { start: 0, endExclusive: 0 }; }',
        );
        await run.click();
        await page.getByText('Tests failed', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Save attempt', exact: true }).click();
        await page.getByText(/Attempt saved\. Test status: failed/).waitFor();
        assert.equal(attempts[0].test_summary.status, 'failed');
        assert.equal(attempts[0].test_summary.totalCases, 14);
        assert.ok(attempts[0].test_summary.passedCases < 14);
        for (const snapshot of structuredClone(attempts)) {
          await page.goto(appOrigin + '/notebook/longest-window');
          const text = snapshot.test_summary.status === 'untested' ? 'Untested' : snapshot.test_summary.status;
          const entry = page
            .locator('.attempt-timeline')
            .getByRole('button', { name: new RegExp(`^Open attempt ${snapshot.id.split('-').at(-1)},`) });
          await entry.waitFor();
          assert.ok((await entry.innerText()).includes(text));
          await entry.click();
          await page.locator('.attempt-status-label').getByText(new RegExp(text)).waitFor();
          assert.equal(await page.locator('pre[aria-label="Saved TypeScript source"]').innerText(), snapshot.source);
          const download = page.waitForEvent('download');
          await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
          const stream = await (await download).createReadStream();
          const chunks = [];
          for await (const chunk of stream) chunks.push(Buffer.from(chunk));
          const exported = JSON.parse(Buffer.concat(chunks).toString('utf8')).attempt;
          assert.equal(exported.source, snapshot.source);
          assert.equal(exported.notes, snapshot.notes);
          assert.equal(exported.challengeVersion, snapshot.challenge_version);
          assert.deepEqual(exported.testSummary, snapshot.test_summary);
        }
        assert.deepEqual(
          attempts.find((attempt) => attempt.id === passedSnapshot.id),
          passedSnapshot,
        );
        for (const width of [1280, 768, 640, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(appOrigin + '/challenges/longest-window');
          await source.waitFor();
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
            true,
            `Overflow at ${width}px`,
          );
          await page.getByRole('link', { name: 'Skip to content', exact: true }).focus();
          await page.keyboard.press('Enter');
          assert.equal(
            await page.locator('#main-content').evaluate((element) => element === document.activeElement),
            true,
          );
          const theme = page.getByRole('button', { name: /Switch to .* theme/ });
          const previousTheme = await page.locator('html').getAttribute('data-theme');
          await theme.focus();
          await page.keyboard.press('Enter');
          assert.notEqual(await page.locator('html').getAttribute('data-theme'), previousTheme);
        }
        assert.equal(await page.getByRole('button', { name: 'Show reference visualization' }).count(), 0);
        assert.equal(await page.getByRole('heading', { name: 'Progressive hints' }).count(), 0);
        console.log(
          'PASS actual QuickJS 14/14 → synthetic authenticated snapshot → Notebook/timeline → JSON; edit/revert untested and failed saves',
        );
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
}
