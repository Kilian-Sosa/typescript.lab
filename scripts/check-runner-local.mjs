import { indexFixtureFiles } from './static-fixture-files.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';
import test from 'node:test';
import { chromium } from '../node_modules/@playwright/test/index.mjs';
import { build, createServer as createViteServer } from '../node_modules/vite/dist/node/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const solution = await readFile(join(root, 'challenges/longest-window/solution.ts'), 'utf8');

test(
  'Vue editor runs its current source through the cross-site iframe and renders honest accessible results',
  { timeout: 120000 },
  async () => {
    let browser, app, config;
    let staticFiles = new Map();
    const errors = [];
    const runner = createServer(async (req, res) => {
      const path = req.url === '/' ? '/index.html' : req.url;
      const headers = Object.assign(
        {},
        ...config.routes.filter((r) => r.src && new RegExp(`^${r.src}$`).test(path)).map((r) => r.headers),
      );
      try {
        const file = staticFiles.get(path);
        if (!file) throw new Error('Unknown public fixture');
        const body = await readFile(file);
        res.writeHead(200, {
          ...headers,
          'Content-Type':
            { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' }[extname(path)] ??
            'application/octet-stream',
        });
        res.end(body);
      } catch {
        res.writeHead(404, headers);
        res.end();
      }
    });
    const previous = Object.fromEntries(
      ['VITE_RUNNER_PARENT_ORIGIN', 'VITE_RUNNER_ORIGIN', 'LAB_RUNNER_LOCAL_TEST'].map((k) => [k, process.env[k]]),
    );
    try {
      const runnerOrigin = `http://runner.test:${await listen(runner)}`;
      app = await createViteServer({
        configFile: join(root, 'vite.config.ts'),
        server: {
          host: '127.0.0.1',
          port: 0,
          allowedHosts: ['app.test'],
          watch: { ignored: ['**/apps/runner/.vercel/**', '**/output/**'] },
        },
        define: {
          'import.meta.env.VITE_ENABLE_LOCAL_RUNNER': '"1"',
          'import.meta.env.VITE_RUNNER_ORIGIN': JSON.stringify(runnerOrigin),
          'import.meta.env.VITE_SUPABASE_URL': 'undefined',
          'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': 'undefined',
        },
        plugins: [
          {
            name: 'local-runner-frame-policy',
            configureServer(server) {
              server.middlewares.use((_req, res, next) => {
                res.setHeader(
                  'Content-Security-Policy',
                  `frame-src ${runnerOrigin}; object-src 'none'; base-uri 'self'`,
                );
                next();
              });
            },
          },
        ],
      });
      await app.listen();
      const appOrigin = `http://app.test:${app.httpServer.address().port}`;
      process.env.VITE_RUNNER_PARENT_ORIGIN = appOrigin;
      process.env.VITE_RUNNER_ORIGIN = runnerOrigin;
      process.env.LAB_RUNNER_LOCAL_TEST = '1';
      await build({ configFile: join(root, 'apps/runner/vite.config.ts'), logLevel: 'error' });
      config = JSON.parse(await readFile(join(root, 'apps/runner/.vercel/output/config.json'), 'utf8'));
      staticFiles = await indexFixtureFiles(join(root, 'apps/runner/.vercel/output/static'));
      browser = await chromium.launch({
        channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? 'msedge',
        headless: true,
        args: [
          '--no-proxy-server',
          '--host-resolver-rules=MAP app.test 127.0.0.1, MAP runner.test 127.0.0.1',
          `--unsafely-treat-insecure-origin-as-secure=${appOrigin},${runnerOrigin}`,
        ],
      });
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 390, height: 844 },
      ]) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${appOrigin}/challenges/longest-window`);
        const source = page.getByRole('textbox', { name: 'TypeScript source', exact: true });
        await source.waitFor();
        const run = page.getByRole('button', { name: 'Run tests', exact: true });
        const status = page.locator('#execution-status');
        assert.match(await status.textContent(), /Tests have not run/);
        if (viewport.width === 1280) {
          // Verify isolated browser-site storage using the real cross-origin runner document.
          const appStorage = await page.evaluate(async () => {
            document.cookie = 'm3-app-canary=private; Path=/; SameSite=Lax';
            localStorage.setItem('m3-app-canary', 'private');
            await new Promise((resolve, reject) => {
              const open = indexedDB.open('m3-app-only-canary', 1);
              open.onupgradeneeded = () => open.result.createObjectStore('canary');
              open.onsuccess = () => {
                open.result.close();
                resolve();
              };
              open.onerror = () => reject(open.error);
            });
            return {
              cookie: document.cookie.includes('m3-app-canary=private'),
              local: localStorage.getItem('m3-app-canary') === 'private',
              indexedDb: (await indexedDB.databases()).some((db) => db.name === 'm3-app-only-canary'),
            };
          });
          assert.deepEqual(appStorage, { cookie: true, local: true, indexedDb: true });
          await page.evaluate((origin) => {
            const frame = document.createElement('iframe');
            frame.id = 'storage-isolation-probe';
            frame.title = 'Storage isolation probe';
            frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            frame.src = origin;
            document.body.append(frame);
          }, runnerOrigin);
          const frame = page.frameLocator('#storage-isolation-probe');
          // The iframe starts at inherited about:blank; wait for the cross-origin navigation boundary.
          await page.waitForFunction(() => {
            const child = document.querySelector('#storage-isolation-probe');
            try {
              void child.contentWindow.document;
              return false;
            } catch (error) {
              return error instanceof DOMException && error.name === 'SecurityError';
            }
          });
          await frame.locator('body').waitFor({ state: 'attached' });
          const storage = await frame.locator('body').evaluate(async () => ({
            origin: location.origin,
            appCookie: document.cookie.includes('m3-app-canary'),
            appStorage: localStorage.getItem('m3-app-canary'),
            appIndexedDb: (await indexedDB.databases()).some((db) => db.name === 'm3-app-only-canary'),
          }));
          assert.deepEqual(storage, { origin: runnerOrigin, appCookie: false, appStorage: null, appIndexedDb: false });
          const parentDomBlocked = await page.evaluate(() => {
            const child = document.querySelector('#storage-isolation-probe');
            try {
              void child.contentWindow.document.body;
              return false;
            } catch (error) {
              return error instanceof DOMException && error.name === 'SecurityError';
            }
          });
          assert.equal(parentDomBlocked, true);
          await page.locator('#storage-isolation-probe').evaluate((node) => node.remove());
          console.log('PASS separate-site cookie, localStorage, IndexedDB and parent DOM isolation');
        }
        const evaluate = async (text, expected) => {
          await source.fill(text);
          await run.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(
            (expected) => document.querySelector('#execution-status')?.textContent?.includes(expected),
            expected,
          );
          assert.equal(await source.inputValue(), text);
          assert.equal(await status.getAttribute('aria-live'), 'polite');
          assert.equal(await run.evaluate((el) => document.activeElement === el), true);
          assert.equal(await page.locator('iframe').count(), 0);
        };
        const resourceLimit = async (text, label, expected) => {
          await source.fill(text);
          await run.click();
          await page.waitForFunction(
            () => {
              const title = document.querySelector('#execution-status')?.textContent;
              return [
                'Code is unsupported',
                'Execution failed',
                'Run timed out',
                'Compilation failed',
                'Runner unavailable',
              ].includes(title);
            },
            null,
            { timeout: 20000 },
          );
          const observed = (await status.textContent()).trim();
          assert.equal(observed, expected, `Unexpected ${label} failure classification`);
          assert.equal(await page.locator('iframe').count(), 0);
          console.log(`PASS bounded resource probe ${label}: ${observed}`);
        };
        await evaluate(solution, 'All 14 tests passed');
        const consolePanel = page.getByRole('region', { name: 'Console output', exact: true });
        assert.match(await consolePanel.textContent(), /No console messages/);
        const loggedSource = `console.info('module'); console.log('<img src=x onerror=alert(1)> 😀'); console.warn('careful'); console.error('example');\n${solution}`;
        await evaluate(loggedSource, 'All 14 tests passed');
        assert.equal(await consolePanel.locator('li').count(), 56);
        assert.match(await consolePanel.locator('li').nth(0).textContent(), /info.*module/s);
        assert.match(await consolePanel.locator('li').nth(1).textContent(), /log.*<img src=x onerror=alert\(1\)> 😀/s);
        assert.equal(await consolePanel.locator('img').count(), 0);
        assert.match(await consolePanel.textContent(), /Revision \d+.*passed/s);
        await consolePanel.getByRole('region', { name: 'Console messages' }).focus();
        assert.equal(
          await consolePanel
            .getByRole('region', { name: 'Console messages' })
            .evaluate((el) => document.activeElement === el),
          true,
        );
        await evaluate(
          'export function longestWindow() { console.log("before error"); throw new Error("learner exception"); }',
          'Execution failed',
        );
        assert.match(await consolePanel.textContent(), /before error/);
        await evaluate(
          'export function longestWindow() { for (let i=0;i<1000;i++) console.log("😀".repeat(1000)); return null; }',
          'Tests failed',
        );
        assert.match(await consolePanel.textContent(), /truncated/);
        assert.ok((await consolePanel.locator('li').count()) <= 100);
        const consoleDimensions = await page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        assert.ok(consoleDimensions.content <= consoleDimensions.viewport, JSON.stringify(consoleDimensions));
        await source.fill('updated source');
        assert.match(await consolePanel.textContent(), /Console cleared/);
        assert.equal(await consolePanel.locator('li').count(), 0);
        console.log(
          `PASS ${viewport.width}px Console: real VM levels/order, plain text, bounds, runtime error, stale clearing and keyboard scrolling`,
        );
        await evaluate(solution, 'All 14 tests passed');
        // Exercise limits against the actual worker rather than relying only on policy unit tests.
        if (viewport.width === 1280) {
          await resourceLimit(
            'export function longestWindow(){return "x".repeat(70000)}',
            'output',
            'Code is unsupported',
          );
          await resourceLimit(
            'export function longestWindow(){return new Array(10000000).fill(0)}',
            'memory',
            'Execution failed',
          );
          await resourceLimit(
            'export function longestWindow(){function f(): never {return f()} return f()}',
            'stack',
            'Execution failed',
          );
          const oversize = 'export function longestWindow(){return {start:0,endExclusive:0}}' + ' '.repeat(32769);
          await resourceLimit(oversize, 'source', 'Code is unsupported');
          assert.match(await page.getByRole('list', { name: 'Run diagnostics' }).textContent(), /32 KiB/);
          await evaluate(solution, 'All 14 tests passed');
        }
        assert.equal(await page.getByRole('list', { name: 'Test case results' }).getByRole('listitem').count(), 14);
        await evaluate('export function longestWindow() { return { start: 0, endExclusive: 0 }; }', 'Tests failed');
        assert.match(await page.getByRole('list', { name: 'Test case results' }).textContent(), /Expected.*Actual/s);
        await evaluate('export const wrong: number = "wrong";', 'Compilation failed');
        await evaluate('import("https://evil.example/module.js")', 'Code is unsupported');
        await evaluate('export function longestWindow() { throw new Error("learner exception"); }', 'Execution failed');
        await evaluate('export function longestWindow() { while (true) {} }', 'Run timed out');

        await source.fill('export function longestWindow() { while (true) {} }');
        await run.click();
        const cancel = page.getByRole('button', { name: 'Cancel test run' });
        await cancel.click();
        await page.waitForFunction(() =>
          document.querySelector('#execution-status')?.textContent?.includes('Run cancelled'),
        );
        assert.match(await consolePanel.textContent(), /Console cleared/);
        assert.equal(await consolePanel.locator('li').count(), 0);
        assert.equal(await page.locator('iframe').count(), 0);
        assert.equal(await run.evaluate((el) => document.activeElement === el), true);

        // Editing while the Worker runs removes its frame and invalidates this revision immediately.
        await source.fill('export function longestWindow() { while (true) {} }');
        await run.click();
        await source.fill('newer exact buffer');
        await page.waitForFunction(() =>
          document.querySelector('#execution-status')?.textContent?.includes('Source changed'),
        );
        assert.equal(await page.locator('iframe').count(), 0);
        await evaluate(solution, 'All 14 tests passed');
        if (viewport.width === 1280) {
          // True network isolation: a completely offline child cannot load; retries do not reuse prior success.
          await context.setOffline(true);
          await source.fill(solution + ' ');
          await run.click();
          await page.waitForFunction(
            () => document.querySelector('#execution-status')?.textContent?.includes('Runner unavailable'),
            null,
            { timeout: 20000 },
          );
          assert.equal(await page.locator('iframe').count(), 0);
          await context.setOffline(false);
          await evaluate(solution, 'All 14 tests passed');
          // Fresh and warm navigation must preserve exact-origin activation and honest result reporting.
          await page.reload();
          await page.getByRole('textbox', { name: 'TypeScript source', exact: true }).waitFor();
          await evaluate(solution, 'All 14 tests passed');
          // The live status is announced and reachable with the keyboard.
          assert.equal(await status.getAttribute('role'), 'status');
          await run.focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() =>
            document.querySelector('#execution-status')?.textContent?.includes('All 14 tests passed'),
          );
          assert.equal(await run.evaluate((el) => el === document.activeElement), true);
          assert.equal(await page.locator('iframe').count(), 0);
        }
        await source.fill('buffer preserved across modes');
        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Learning mode', exact: true }).click();
        await page.getByRole('button', { name: 'Interview mode', exact: true }).click();
        assert.equal(await source.inputValue(), 'buffer preserved across modes');

        // A failed navigation must be recoverable without losing source or displaying a prior pass.
        await page.route(`${runnerOrigin}/`, (route) => route.abort(), { times: 1 });
        await source.fill(solution);
        await run.click();
        await page.waitForFunction(
          () => document.querySelector('#execution-status')?.textContent?.includes('Runner unavailable'),
          null,
          { timeout: 20000 },
        );
        assert.equal(await source.inputValue(), solution);
        await evaluate(solution, 'All 14 tests passed');
        // A compromised frame can speak the protocol; an empty forged pass must still be rejected.
        await page.route(
          `${runnerOrigin}/`,
          (route) =>
            route.fulfill({
              contentType: 'text/html',
              headers: {
                'Content-Security-Policy': `default-src 'none'; script-src 'nonce-fixture'; frame-ancestors ${appOrigin}`,
              },
              body: `<script nonce="fixture">addEventListener('message', ({data:m}) => {
          if(m.kind==='handshake') parent.postMessage({protocol:1,kind:'handshake-ack',nonce:m.nonce}, ${JSON.stringify(appOrigin)});
          if(m.kind==='run') parent.postMessage({protocol:1,kind:'run-result',nonce:m.nonce,result:{
            contractVersion:'1.0.0',runId:m.runId,sourceRevision:m.sourceRevision,challengeId:m.challengeId,
            challengeVersion:m.challengeVersion,status:'passed',cases:[],diagnostics:[]}}, ${JSON.stringify(appOrigin)});
        }); parent.postMessage({protocol:1,kind:'ready'}, ${JSON.stringify(appOrigin)});</script>`,
            }),
          { times: 1 },
        );
        await evaluate(solution, 'Runner unavailable');
        await evaluate(solution, 'All 14 tests passed');
        const dimensions = await page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        assert.ok(dimensions.content <= dimensions.viewport, JSON.stringify(dimensions));
        // Reduced CSS viewport exercises responsive reflow at zoom without bypassing media queries.
        if (viewport.width === 1280) {
          for (const width of [640, 320]) {
            await page.setViewportSize({ width, height: viewport.height });
            const zoom = await page.evaluate(() => {
              const doc = document.documentElement;
              return { content: doc.scrollWidth, viewport: doc.clientWidth };
            });
            assert.ok(
              zoom.content <= zoom.viewport,
              'Horizontal reflow overflow at CSS width ' + width + ': ' + JSON.stringify(zoom),
            );
          }
          await page.setViewportSize(viewport);
        }
        await source.focus();
        await page.keyboard.press('Tab');
        assert.equal(await source.evaluate((el) => document.activeElement !== el), true);
        await mkdir(join(root, 'output/playwright'), { recursive: true });
        await page.screenshot({ path: join(root, `output/playwright/m3-task2-${viewport.width}.png`), fullPage: true });
        await context.close();
      }
      // Force real third-party-cookie restrictions in Edge without weakening the iframe security policy.
      const blockedContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const blockedPage = await blockedContext.newPage();
      const cdp = await blockedContext.newCDPSession(blockedPage);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCookieControls', {
        enableThirdPartyCookieRestriction: true,
        disableThirdPartyCookieMetadata: true,
        disableThirdPartyCookieHeuristics: true,
      });
      await blockedContext.addCookies([
        {
          name: 'm3-runner-cookie-control',
          value: 'first-party',
          domain: 'runner.test',
          path: '/',
          sameSite: 'None',
          secure: true,
        },
      ]);
      const firstParty = await blockedContext.newPage();
      await firstParty.goto(runnerOrigin);
      assert.match(
        await firstParty.evaluate(() => document.cookie),
        /m3-runner-cookie-control=first-party/,
        'Runner cookie first-party positive control failed',
      );
      await firstParty.close();
      await blockedPage.goto(`${appOrigin}/challenges/longest-window`);
      await blockedPage.evaluate((origin) => {
        const frame = document.createElement('iframe');
        frame.id = 'cookie-blocked-probe';
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        frame.title = 'Third-party cookie isolation';
        frame.src = origin;
        document.body.append(frame);
      }, runnerOrigin);
      await blockedPage.waitForFunction(() => {
        const iframe = document.querySelector('#cookie-blocked-probe');
        try {
          void iframe.contentWindow.document;
          return false;
        } catch (error) {
          return error instanceof DOMException && error.name === 'SecurityError';
        }
      });
      const blockedRunnerCookie = await blockedPage
        .frameLocator('#cookie-blocked-probe')
        .locator('body')
        .evaluate(() => document.cookie);
      assert.doesNotMatch(
        blockedRunnerCookie,
        /m3-runner-cookie-control/,
        'Runner cookie was accessible as an unpartitioned third-party cookie',
      );
      await blockedPage.locator('#cookie-blocked-probe').evaluate((node) => node.remove());
      const blockedSource = blockedPage.getByRole('textbox', { name: 'TypeScript source', exact: true });
      await blockedSource.fill(solution);
      await blockedPage.getByRole('button', { name: 'Run tests', exact: true }).click();
      await blockedPage.getByText('All 14 tests passed', { exact: true }).waitFor();
      assert.equal(await blockedPage.locator('iframe').count(), 0);
      await blockedContext.close();
      console.log(
        'PASS Edge restricted third-party cookies: first-party control, third-party isolation and 14/14 real tests',
      );
      assert.deepEqual(errors, []);
      console.log(
        'Desktop/mobile: actual pass/fail, semantic errors, policy, runtime, timeout, cancel, stale edits, forged pass, retry, keyboard and overflow checks passed.',
      );
    } finally {
      await browser?.close();
      await app?.close();
      await new Promise((resolve) => {
        runner.close(resolve);
        runner.closeAllConnections();
      });
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  },
);
