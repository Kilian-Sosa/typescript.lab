import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';
import test from 'node:test';
import { chromium } from '../node_modules/@playwright/test/index.mjs';
import { build } from '../node_modules/vite/dist/node/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const solution = await readFile(new URL('../../../challenges/longest-window/solution.ts', import.meta.url), 'utf8');
const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = (server) =>
  new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });

test(
  'built cross-site runner enforces CSP, actual evaluation, deadlines, recovery and disposal',
  { timeout: 90000 },
  async () => {
    let browser;
    let config;
    let appOrigin, runnerOrigin;
    let appNetworkHits = 0;
    const hits = [];
    const runner = createServer(async (req, res) => {
      hits.push(req.url);
      const path = req.url === '/' ? '/index.html' : req.url;
      const headers = Object.assign(
        {},
        ...config.routes.filter((r) => r.src && new RegExp(`^${r.src}$`).test(path)).map((r) => r.headers),
      );
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' };
      if (path === '/assets/worker-policy-probe.js') {
        res.writeHead(200, { ...headers, 'Content-Type': 'text/javascript' });
        res.end(`Promise.all([fetch(${JSON.stringify(appOrigin)}+'/blocked').then(()=>false,()=>true),
        new Promise(resolve=>{try{const child=new Worker('/child.js'); child.onerror=e=>{e.preventDefault();child.terminate();resolve(true)}; child.onmessage=()=>{child.terminate();resolve(false)}}catch{resolve(true)}})
      ]).then(result=>postMessage(result));`);
        return;
      }
      try {
        const body = await readFile(join(root, '.vercel/output/static', path));
        res.writeHead(200, { ...headers, 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404, headers);
        res.end();
      }
    });
    const app = createServer((req, res) => {
      if (req.url !== '/') {
        appNetworkHits++;
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': 'app_canary=private; SameSite=Strict; Path=/',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-test'; frame-src ${runnerOrigin}`,
      });
      res.end(`<!doctype html><html lang="en"><title>Runner test host</title><iframe title="runner" sandbox="allow-scripts allow-same-origin" src="${runnerOrigin}"></iframe><script nonce="test">
      window.messages=[]; window.ticks=0; setInterval(()=>window.ticks++, 20);
      const frame=document.querySelector('iframe');
      addEventListener('message', e => { if(e.origin===${JSON.stringify(runnerOrigin)} && e.source===frame.contentWindow) messages.push(e.data); });
      window.send=m=>frame.contentWindow.postMessage(m, ${JSON.stringify(runnerOrigin)});
      localStorage.setItem('canary','private');
    </script></html>`);
    });
    try {
      const appPort = await listen(app),
        runnerPort = await listen(runner);
      appOrigin = `http://app.test:${appPort}`;
      runnerOrigin = `http://runner.test:${runnerPort}`;
      process.env.VITE_RUNNER_PARENT_ORIGIN = appOrigin;
      process.env.VITE_RUNNER_ORIGIN = runnerOrigin;
      process.env.LAB_RUNNER_LOCAL_TEST = '1';
      await build({ configFile: join(root, 'vite.config.ts'), logLevel: 'error' });
      config = JSON.parse(await readFile(join(root, '.vercel/output/config.json'), 'utf8'));
      const files = await readdir(join(root, '.vercel/output/static/assets'));
      assert.ok(files.some((f) => f.endsWith('.wasm')));
      browser = await chromium.launch({
        channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? 'msedge',
        headless: true,
        args: ['--no-proxy-server', '--host-resolver-rules=MAP app.test 127.0.0.1, MAP runner.test 127.0.0.1'],
      });
      const context = await browser.newContext();
      await context.addInitScript(() => {
        const NativeWorker = window.Worker;
        window.workerStats = { created: 0, terminated: 0, active: 0, max: 0 };
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args);
            this.finished = false;
            const s = window.workerStats;
            s.created++;
            s.active++;
            s.max = Math.max(s.max, s.active);
          }
          terminate() {
            if (!this.finished) {
              this.finished = true;
              window.workerStats.terminated++;
              window.workerStats.active--;
            }
            super.terminate();
          }
        };
      });
      const page = await context.newPage();
      const responses = [];
      page.on('response', (r) => responses.push({ url: r.url(), headers: r.headers() }));
      await page.goto(appOrigin);
      await page.waitForFunction(() => window.messages.some((m) => m.kind === 'ready'));
      const frame = page.frames().find((f) => f.url().startsWith(runnerOrigin));
      assert.ok(frame);
      assert.deepEqual(
        await frame.evaluate(() => ({
          cookie: document.cookie,
          storage: localStorage.getItem('canary'),
          dom: (() => {
            try {
              return !!parent.document;
            } catch {
              return false;
            }
          })(),
        })),
        { cookie: '', storage: null, dom: false },
      );
      assert.equal(
        await frame.evaluate(async (origin) => {
          try {
            await fetch(origin);
            return false;
          } catch {
            return true;
          }
        }, appOrigin),
        true,
      );
      assert.deepEqual(
        await frame.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const worker = new Worker('/assets/worker-policy-probe.js');
              worker.onmessage = (e) => {
                worker.terminate();
                resolve(e.data);
              };
              worker.onerror = () => {
                worker.terminate();
                reject(Error('Worker CSP probe failed'));
              };
            }),
        ),
        [true, true],
      );
      assert.equal(appNetworkHits, 0);
      assert.equal(hits.includes('/child.js'), false);
      const nonce = '0123456789abcdef0123456789abcdef';
      const send = (m) => page.evaluate((m) => window.send(m), m);
      await send({ protocol: 1, kind: 'handshake', nonce });
      await page.waitForFunction(() => window.messages.some((m) => m.kind === 'handshake-ack'));
      let revision = 0;
      async function run(source, expectedStatus, reason) {
        const n = ++revision,
          runId = `browser-${n}`;
        await send({
          protocol: 1,
          kind: 'run',
          nonce,
          runId,
          sourceRevision: n,
          challengeId: 'longest-window',
          challengeVersion: '1.0.0',
          source,
        });
        await page.waitForFunction(
          (id) => window.messages.some((m) => m.kind === 'run-result' && m.result.runId === id),
          runId,
        );
        const result = await page.evaluate(
          (id) => window.messages.find((m) => m.kind === 'run-result' && m.result.runId === id).result,
          runId,
        );
        assert.equal(result.status, expectedStatus, JSON.stringify(result));
        if (reason) assert.equal(result.reason, reason);
        return result;
      }
      const passed = await run(solution, 'passed');
      assert.equal(passed.cases.length, 14);
      assert.equal(
        passed.cases.every((c) => c.status === 'passed'),
        true,
      );
      const numericSolution = solution.replace('if (k <= 0)', 'k = Math.max(0, Math.floor(k));\n  if (k <= 0)');
      const numericPassed = await run(numericSolution, 'passed');
      assert.equal(numericPassed.cases.length, 14);
      assert.equal(
        numericPassed.cases.every((c) => c.status === 'passed'),
        true,
      );
      const numericGlobals = await run(
        `export function longestWindow() {
      return [Math.floor(-1.2), Math.max(2, 7), Number.isFinite(Infinity), Number.isNaN(NaN),
        Number.isSafeInteger(42), Number("3"), parseInt("ff", 16), parseFloat("2.5px")];
    }`,
        'failed',
      );
      assert.deepEqual(numericGlobals.cases[0].actual, [-2, 7, false, true, true, 3, 255, 2.5]);
      await run('export function longestWindow() { console.log("bounded capture"); return null; }', 'failed');
      const logged = await page.evaluate(() => window.messages.filter((m) => m.kind === 'run-result').at(-1));
      assert.equal(logged.consoleOutput.entries[0].text, 'bounded capture');
      await run('export function longestWindow() { return { start: 0, endExclusive: 0 }; }', 'failed');
      await run('export const bad: number = "wrong";', 'compile-error');
      await run('export function longestWindow( {', 'compile-error');
      await run('import("https://evil.example")', 'execution-error', 'policy-rejected');
      await run('export function longestWindow() { throw new Error("failure"); }', 'execution-error', 'runtime-error');
      const globals = await run(
        'export function longestWindow() { return [typeof window, typeof fetch, typeof postMessage, typeof process]; }',
        'failed',
      );
      assert.deepEqual(globals.cases[0].actual, ['undefined', 'undefined', 'undefined', 'undefined']);
      const before = await page.evaluate(() => window.ticks);
      await run('export function longestWindow() { while(true) {} }', 'timeout');
      assert.ok(await page.evaluate((before) => window.ticks > before + 10, before));
      await run('export function longestWindow() { return "x".repeat(70000); }', 'execution-error', 'policy-rejected');
      for (const source of [
        'class R { toJSON() { return NaN; } } export function longestWindow() { return new R(); }',
        'class R { toJSON() { return new Array(2); } } export function longestWindow() { return new R(); }',
        'export function longestWindow() { return { get start(): number { while(true) {} }, endExclusive: 0 }; }',
        `export function longestWindow() {
        const root: any = ([] as any).constructor.constructor('return globalThis')();
        root.Array.prototype[root.Symbol.iterator] = () => ({ next: () => ({ done: true }) });
        return { invalid: NaN };
      }`,
      ])
        await run(source, 'execution-error', 'policy-rejected');
      await run(
        'export function longestWindow(): number { return longestWindow() + 1; }',
        'execution-error',
        'runtime-error',
      );
      await run(
        'export function longestWindow() { return new Array(100000000).fill(1); }',
        'execution-error',
        'runtime-error',
      );
      // Cancellation and burst pressure hit the built supervisor, without test commands in its protocol.
      const runId = `browser-${++revision}`;
      await send({
        protocol: 1,
        kind: 'run',
        nonce,
        runId,
        sourceRevision: revision,
        challengeId: 'longest-window',
        challengeVersion: '1.0.0',
        source: 'export function longestWindow() { while(true) {} }',
      });
      await send({ protocol: 1, kind: 'cancel', nonce, runId, sourceRevision: revision });
      await page.waitForFunction(
        (id) => window.messages.some((m) => m.result?.runId === id && m.result.reason === 'cancelled'),
        runId,
      );
      await run(solution, 'passed');
      // Replace one Worker response in the harness with an unresponsive native test fixture.
      // The shipped protocol has no switch for disabling VM interrupts.
      await page.route(
        /\/assets\/worker-(?!policy-probe)[^/]+\.js$/,
        (route) =>
          route.fulfill({
            contentType: 'text/javascript',
            body: 'while(true) {}',
            headers: { 'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'none'" },
          }),
        { times: 1 },
      );
      const watchdogStarted = Date.now();
      const hard = await run(solution, 'timeout');
      assert.ok(hard.diagnostics.some((d) => d.includes('Independent Worker deadline')));
      assert.ok(Date.now() - watchdogStarted >= 2900);
      await run(solution, 'passed');
      const stats = await frame.evaluate(() => window.workerStats);
      assert.equal(stats.active, 0);
      assert.equal(stats.max, 1);
      assert.equal(stats.created, stats.terminated);
      assert.ok(hits.some((p) => p.endsWith('.wasm')));
      const workerResponse = responses.find((r) => /\/assets\/worker-(?!policy-probe)[^/]+\.js$/.test(r.url));
      assert.ok(workerResponse.headers['content-security-policy'].includes("worker-src 'none'"));
      assert.ok(workerResponse.headers['content-security-policy'].includes("'wasm-unsafe-eval'"));
      assert.ok(
        responses
          .find((r) => r.url === `${runnerOrigin}/`)
          .headers['content-security-policy'].includes(`frame-ancestors ${appOrigin}`),
      );
      console.log(
        JSON.stringify({
          cases: passed.cases.length,
          workers: stats,
          wasmRequests: hits.filter((p) => p.endsWith('.wasm')).length,
        }),
      );
    } finally {
      await browser?.close();
      await Promise.all([close(app), close(runner)]);
      delete process.env.VITE_RUNNER_PARENT_ORIGIN;
      delete process.env.VITE_RUNNER_ORIGIN;
      delete process.env.LAB_RUNNER_LOCAL_TEST;
    }
  },
);
