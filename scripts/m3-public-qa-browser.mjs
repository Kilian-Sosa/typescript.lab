import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { QA } from './m3-public-qa-probe.mjs';

// Static public-runner delivery probe only; actual editor-iframe tests need a
// separately authenticated app browser and must not use deployment bypass secrets.
const mode = process.argv[2];
if (!['plan', 'public'].includes(mode)) throw new Error('Explicit plan or public mode required.');

const MAX_REQUESTS = 400;
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_MS = 20 * 60 * 1000;
const start = Date.now();
let requests = 0, responseBytes = 0;
let blocked = false;
const matrix = [
  ['Edge desktop', chromium, { channel: 'msedge', viewport: { width: 1280, height: 900 } }],
  ['Edge mobile-sized', chromium, { channel: 'msedge', viewport: { width: 390, height: 844 }, isMobile: true }],
];
if (mode === 'plan') {
  for (const [label, engine, options] of matrix) {
    const ready = 'External Edge channel; verify by launch';
    console.log(JSON.stringify({ label, readiness: ready, viewport: options.viewport }));
  }
  console.log(JSON.stringify({ requestsLimit: MAX_REQUESTS, responseBodyBytesLimit: MAX_BYTES,
    testingMsLimit: MAX_MS, hostedWrites: false, authenticationBypass: false,
    firefox: 'EXPLICITLY OUT OF SCOPE', webkit: 'EXPLICITLY OUT OF SCOPE',
    physicalMobile: 'NOT TESTED' }));
  process.exit(0);
}

for (const [label, engine, { channel, viewport, isMobile }] of matrix) {
  let browser;
  try {
    assert.ok(Date.now() - start < MAX_MS, '20-minute test cutoff');
    browser = await engine.launch({ headless: true, ...(channel ? { channel } : {}) });
    const context = await browser.newContext({
      viewport, isMobile: isMobile ?? false, serviceWorkers: 'block',
      // Keep default HTTPS/TLS and cookie policies; no host mapping or CSP bypass.
    });
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('request', () => {
      requests++;
      if (requests > MAX_REQUESTS) blocked = true;
    });
    page.on('requestfinished', async request => {
      try {
        const sizes = await request.sizes();
        responseBytes += Math.max(0, sizes.responseBodySize);
        if (responseBytes > MAX_BYTES) blocked = true;
      } catch { blocked = true; }
    });
    const response = await page.goto(QA.runner, { waitUntil: 'load', timeout: 20000 });
    assert.ok(response && response.status() === 200, 'Runner must load directly without SSO');
    const headers = response.headers();
    assert.match(headers['content-security-policy'] ?? '', /frame-ancestors https:\/\/typescript-lab-m3-app-qa\.vercel\.app/);
    assert.match(headers['x-content-type-options'] ?? '', /nosniff/);
    assert.match(await page.title(), /TypeScript Lab isolated runner/);
    assert.equal(failures.length, 0, JSON.stringify(failures));
    assert.equal(blocked, false, 'Request/transfer budget exhausted');
    console.log(JSON.stringify({ status: 'PASS', label, version: browser.version(), requests, responseBytes }));
    await context.close();
  } catch (error) {
    blocked = true;
    console.error(JSON.stringify({ status: 'BLOCKED', label, reason: error.message.slice(0, 400) }));
    break;
  } finally {
    await browser?.close();
  }
}
console.log(JSON.stringify({ requests, responseBytes, maxRequests: MAX_REQUESTS, maxBytes: MAX_BYTES,
  elapsedMs: Date.now() - start, physicalMobile: 'NOT TESTED', normalAppIframe: 'SEPARATE AUTHENTICATED BROWSER GATE' }));
if (blocked) process.exitCode = 1;
