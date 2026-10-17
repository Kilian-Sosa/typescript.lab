import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SPIKE = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);
const fixtureCasesPath = resolve(ROOT, 'challenges/longest-window/cases.ts');
const solutionPath = resolve(ROOT, 'challenges/longest-window/solution.ts');
const packageJson = JSON.parse(await readFile(resolve(SPIKE, 'package.json'), 'utf8'));
const playwrightModule = process.env.LAB_RUNNER_PLAYWRIGHT_MODULE;
if (!playwrightModule) throw new Error('Set LAB_RUNNER_PLAYWRIGHT_MODULE to the preinstalled @playwright/test package path.');
const { chromium } = require(playwrightModule);
const TypeScript = require(process.env.LAB_RUNNER_TYPESCRIPT_MODULE ?? 'typescript');

const BASE_LIMITS = {
  sourceBytes: 32 * 1024,
  inputBytes: 1024 * 1024,
  maxCases: 100,
  outputBytes: 64 * 1024,
  quickJsMemoryBytes: 32 * 1024 * 1024,
  quickJsStackBytes: 128 * 1024,
  executionMs: 2000,
  supervisorMs: 3000,
};

function respond(response, status, body, contentType, headers = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(body);
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolveListen(server.address().port));
  });
}

async function close(server) {
  if (!server?.listening) return;
  await new Promise((resolveClose) => {
    server.close(() => resolveClose());
    server.closeAllConnections?.();
  });
}

async function loadChallenge() {
  const source = await readFile(solutionPath, 'utf8');
  const casesText = await readFile(fixtureCasesPath, 'utf8');
  const emitted = TypeScript.transpileModule(casesText, {
    compilerOptions: { target: TypeScript.ScriptTarget.ES2022, module: TypeScript.ModuleKind.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(emitted).toString('base64')}`;
  const challenge = await import(moduleUrl);
  return { source, cases: challenge.longestWindowCases };
}

async function buildFixture() {
  const result = await viteBuild({ configFile: resolve(SPIKE, 'vite.config.mjs'), root: SPIKE });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output ?? []);
  return outputs.map((output) => output.fileName).slice(0, 20);
}

function mime(path) {
  switch (extname(path)) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': case '.mjs': return 'text/javascript; charset=utf-8';
    case '.wasm': return 'application/wasm';
    case '.css': return 'text/css; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function makeServers(state) {
  const appServer = createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/probe-target') {
      state.appProbeRequests += 1;
      respond(response, 204, '', 'text/plain; charset=utf-8');
      return;
    }
    if (url.pathname === '/attacker') {
      const nonce = state.nonce;
      const html = `<!doctype html><meta charset="utf-8"><title>Foreign-origin message fixture</title><script nonce="${nonce}">
window.__sendForeignResult=()=>window.opener.postMessage({protocol:1,kind:'run-result',nonce:'foreign-forged-pass',result:{runId:'foreign',sourceRevision:1,status:'passed'}},${JSON.stringify(state.appOrigin)});
</script>`;
      const cspValue = `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; frame-src ${state.runnerOrigin}; object-src 'none'; base-uri 'none'; form-action 'none'`;
      respond(response, 200, html, 'text/html; charset=utf-8', { 'Content-Security-Policy': cspValue });
      return;
    }
    if (url.pathname === '/') {
      const nonce = state.nonce;
      const cspValue = `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; frame-src ${state.runnerOrigin}; object-src 'none'; base-uri 'none'; form-action 'none'`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>App host harness</title></head><body><main><h1 id="app-marker">App-only marker</h1><button id="open-peer" type="button">Open same-origin peer</button><button id="open-attacker" type="button">Open foreign-origin page</button><div id="frame-host"></div></main><script nonce="${nonce}">
window.__runnerOrigin=${JSON.stringify(state.runnerOrigin)};
window.__appOrigin=location.origin;
window.__messages=[];
window.__trustedScore=null;
window.__pendingRuns=Object.create(null);
window.__acceptedResults=[];
window.__rejectedResults=[];
window.__activeFrame=null;
window.__openPeer=()=>window.open(location.origin+'/?peer=1','quickjs-peer');
window.__openAttacker=()=>window.open(${JSON.stringify(`${state.attackerOrigin}/attacker`)},'quickjs-attacker');
document.querySelector('#open-peer').addEventListener('click',window.__openPeer);
document.querySelector('#open-attacker').addEventListener('click',window.__openAttacker);
window.addEventListener('message',event=>{
 const frame=window.__activeFrame;
 const entry={origin:event.origin,sourceMatches:!!frame&&event.source===frame.contentWindow,data:event.data};
 window.__messages.push(entry);
 if(event.data?.kind==='run-result'){
  const pending=window.__pendingRuns[event.data.nonce];
  const result=event.data.result;
  const valid=entry.sourceMatches&&event.origin===window.__runnerOrigin&&pending
   &&result?.runId===pending.runId&&result?.sourceRevision===pending.sourceRevision;
  (valid?window.__acceptedResults:window.__rejectedResults).push(entry);
 }
});
window.__makeFrame=(sandbox)=>{
 const frame=document.createElement('iframe');frame.title='QuickJS fixture';frame.setAttribute('sandbox',sandbox);frame.src=window.__runnerOrigin+(sandbox==='allow-scripts'?'/?testOpaqueWorker=1':'/');document.querySelector('#frame-host').append(frame);window.__activeFrame=frame;return frame;
};
</script></body></html>`;
      respond(response, 200, html, 'text/html; charset=utf-8', {
        'Content-Security-Policy': cspValue,
        'Referrer-Policy': 'no-referrer',
        'Set-Cookie': 'lab_app_cookie=app-cookie-canary; Path=/; SameSite=Lax',
      });
      return;
    }
    respond(response, 404, 'not found', 'text/plain; charset=utf-8');
  });

  const runnerServer = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/fixture-config.js') {
      respond(response, 200, `window.__RUNNER_APP_ORIGIN__=${JSON.stringify(state.appOrigin)};`, 'text/javascript; charset=utf-8', {
        'Access-Control-Allow-Origin': '*',
        'Content-Security-Policy': state.runnerPageCsp,
      });
      return;
    }
    const relative = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const fullPath = resolve(SPIKE, '.dist', `.${relative}`);
    if (!fullPath.startsWith(resolve(SPIKE, '.dist') + sep)) {
      respond(response, 403, 'forbidden', 'text/plain; charset=utf-8');
      return;
    }
    try {
      const fileInfo = await stat(fullPath);
      if (!fileInfo.isFile()) throw new Error('not a file');
      const body = await readFile(fullPath);
      const isHtml = extname(fullPath) === '.html';
      const isWorkerScript = /quickjs\.worker-[^/]+\.js$/.test(url.pathname) || url.pathname === '/quickjs.worker.mjs';
      const headers = isHtml
        ? { 'Content-Security-Policy': state.runnerPageCsp, 'Referrer-Policy': 'no-referrer' }
        : isWorkerScript
          ? { 'Access-Control-Allow-Origin': '*', 'Content-Security-Policy': state.workerCsp }
          : { 'Access-Control-Allow-Origin': '*' };
      if (extname(fullPath) === '.wasm') state.wasmRequests += 1;
      if (isWorkerScript) {
        state.workerScriptHeaders.push(headers['Content-Security-Policy'] ?? null);
        state.workerScriptUrl = `${state.runnerOrigin}${url.pathname}`;
        state.workerScriptBytes = body.byteLength;
      }
      if (extname(fullPath) === '.wasm') state.wasmBytes = (state.wasmBytes ?? 0) + body.byteLength;
      respond(response, 200, body, mime(fullPath), headers);
    } catch {
      respond(response, 404, 'not found', 'text/plain; charset=utf-8');
    }
  });
  return { appServer, runnerServer };
}

async function waitForMessage(page, { kind, nonce = null, afterIndex = 0 }, timeout = 8000) {
  await page.waitForFunction(({ expectedKind, expectedNonce, beforeIndex }) => window.__messages.slice(beforeIndex).some((entry) =>
    entry.data?.kind === expectedKind && (expectedNonce === null || entry.data?.nonce === expectedNonce)),
  { expectedKind: kind, expectedNonce: nonce, beforeIndex: afterIndex }, { timeout });
  return page.evaluate(({ expectedKind, expectedNonce, beforeIndex }) => window.__messages.slice(beforeIndex).find((entry) =>
    entry.data?.kind === expectedKind && (expectedNonce === null || entry.data?.nonce === expectedNonce)),
  { expectedKind: kind, expectedNonce: nonce, beforeIndex: afterIndex });
}

async function inspectFrame(page, nonce, timeout = 2500) {
  return page.evaluate(({ inspectionNonce, timeoutMs }) => new Promise((resolveInspection) => {
    const timer = setTimeout(() => resolveInspection(null), timeoutMs);
    const listener = (event) => {
      if (event.source !== window.__activeFrame.contentWindow
        || event.data?.kind !== 'fixture-inspection'
        || event.data?.nonce !== inspectionNonce) return;
      clearTimeout(timer);
      window.removeEventListener('message', listener);
      resolveInspection({ origin: event.origin, sourceMatches: event.source === window.__activeFrame.contentWindow, evidence: event.data.evidence });
    };
    window.addEventListener('message', listener);
    window.__activeFrame.contentWindow.postMessage({ kind: 'fixture-inspect', nonce: inspectionNonce }, window.__runnerOrigin);
  }), { inspectionNonce: nonce, timeoutMs: timeout });
}

async function requestRun(page, request, timeout = 8000) {
  const before = await page.evaluate(() => window.__messages.length);
  await page.evaluate((message) => {
    window.__pendingRuns[message.nonce] = { runId: message.runId, sourceRevision: message.sourceRevision };
  }, request);
  await page.evaluate((message) => window.__activeFrame.contentWindow.postMessage(message, window.__runnerOrigin), request);
  await page.waitForFunction(({ beforeIndex, nonce }) => window.__messages.slice(beforeIndex).some((entry) =>
    entry.data?.kind === 'run-result' && entry.data?.nonce === nonce), { beforeIndex: before, nonce: request.nonce }, { timeout });
  const response = await page.evaluate(({ beforeIndex, nonce }) => window.__messages.slice(beforeIndex).find((entry) =>
    entry.data?.kind === 'run-result' && entry.data?.nonce === nonce), { beforeIndex: before, nonce: request.nonce });
  await page.evaluate((nonce) => { delete window.__pendingRuns[nonce]; }, request.nonce);
  return response;
}

async function requestHardDeadlineProbe(page, request, timeout = 7000) {
  const before = await page.evaluate(() => window.__messages.length);
  await page.evaluate((message) => {
    window.__pendingRuns[message.nonce] = { runId: message.runId, sourceRevision: message.sourceRevision };
    window.__activeFrame.contentWindow.postMessage({ kind: 'test-hard-deadline', request: message }, window.__runnerOrigin);
  }, request);
  await page.waitForFunction(({ beforeIndex, nonce }) => window.__messages.slice(beforeIndex).some((entry) =>
    entry.data?.kind === 'run-result' && entry.data?.nonce === nonce), { beforeIndex: before, nonce: request.nonce }, { timeout });
  const response = await page.evaluate(({ beforeIndex, nonce }) => window.__messages.slice(beforeIndex).find((entry) =>
    entry.data?.kind === 'run-result' && entry.data?.nonce === nonce), { beforeIndex: before, nonce: request.nonce });
  await page.evaluate((nonce) => { delete window.__pendingRuns[nonce]; }, request.nonce);
  return response;
}

function runMessage(source, cases, suffix, revision = 1) {
  return {
    protocol: 1,
    kind: 'run',
    nonce: `quickjs-fixture-nonce-${suffix}`,
    runId: `quickjs-fixture-${suffix}`,
    challengeId: 'longest-window',
    challengeVersion: '1.0.0',
    sourceRevision: revision,
    source,
    cases,
  };
}

async function createFrame(page, sandbox, status) {
  const beforeIndex = await page.evaluate(() => window.__messages.length);
  const responseWaiter = waitForMessage(page, { kind: 'ready', afterIndex: beforeIndex });
  await page.evaluate((sandboxValue) => window.__makeFrame(sandboxValue), sandbox);
  let ready;
  try {
    ready = await responseWaiter;
  } catch (error) {
    const frames = page.frames().map((frame) => ({ name: frame.name(), url: frame.url() }));
    throw new Error(`${error.message}; frame bootstrap diagnostics: ${JSON.stringify({
      sandbox,
      frames,
      consoleErrors: status.consoleErrors,
      pageErrors: status.pageErrors,
      failedRequests: status.failedRequests,
      runnerResponses: status.runnerResponses,
    })}`);
  }
  status.readyMessage = ready;
  status.readyOrigin = ready.origin;
  status.readySourceMatches = ready.sourceMatches;
}

export async function runQuickJsFeasibility() {
  const buildOutput = await buildFixture();
  const challenge = await loadChallenge();
  const state = {
    appProbeRequests: 0,
    wasmRequests: 0,
    workerScriptHeaders: [],
    workerScriptUrl: null,
    nonce: `csp-${Math.random().toString(36).slice(2)}`,
  };
  const { appServer, runnerServer } = makeServers(state);
  let browser;
  let context;
  let page;
  let appPort;
  let runnerPort;
  const cleanup = { browserClosed: false, serversClosed: false, workersDisposed: null };

  try {
    appPort = await listen(appServer);
    runnerPort = await listen(runnerServer);
    state.appOrigin = `http://app.test:${appPort}`;
    state.runnerOrigin = `http://runner.test:${runnerPort}`;
    state.attackerOrigin = `http://attacker.test:${appPort}`;
    state.runnerPageCsp = `default-src 'none'; script-src 'self' ${state.runnerOrigin} 'wasm-unsafe-eval'; connect-src 'self' ${state.runnerOrigin}; worker-src 'self' ${state.runnerOrigin}; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${state.appOrigin}`;
    state.workerCsp = `default-src 'none'; script-src 'self' ${state.runnerOrigin} 'wasm-unsafe-eval'; connect-src 'self' ${state.runnerOrigin}; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;

    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--host-resolver-rules=MAP app.test 127.0.0.1, MAP runner.test 127.0.0.1, MAP attacker.test 127.0.0.1'],
    });
    context = await browser.newContext({ serviceWorkers: 'block' });
    page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const runnerResponses = [];
    state.browserDiagnostics = { consoleErrors, pageErrors, failedRequests, runnerResponses };
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => failedRequests.push({
      url: request.url(),
      resourceType: request.resourceType(),
      error: request.failure()?.errorText ?? 'unknown',
    }));
    page.on('response', (response) => {
      if (response.url().startsWith(state.runnerOrigin ?? 'http://runner.test')) {
        runnerResponses.push({ url: response.url(), status: response.status(), type: response.request().resourceType() });
      }
    });
    const appResponse = await page.goto(`${state.appOrigin}/`, { waitUntil: 'load' });
    state.appPageCsp = appResponse.headers()['content-security-policy'] ?? '';
    await page.evaluate(() => localStorage.setItem('lab_app_storage_canary', 'app-storage-canary'));

    const challengeInputs = challenge.cases.map(({ id, input, expected }) => ({ id, input, expected }));
    const opaqueEnv = { ...state.browserDiagnostics, readyOrigin: null, readySourceMatches: false };
    const opaqueWorkerProbeBefore = await page.evaluate(() => window.__messages.length);
    await createFrame(page, 'allow-scripts', opaqueEnv);
    const opaqueReady = opaqueEnv.readyMessage;
    await page.waitForFunction((beforeIndex) => window.__messages.slice(beforeIndex).some((entry) =>
      entry.data?.kind === 'opaque-worker-probe-result'), opaqueWorkerProbeBefore, { timeout: 6500 });
    const opaqueWorkerProbe = await page.evaluate((beforeIndex) => window.__messages.slice(beforeIndex).find((entry) =>
      entry.data?.kind === 'opaque-worker-probe-result'), opaqueWorkerProbeBefore);
    const opaqueTargetProbe = await page.evaluate(() => new Promise((resolveProbe) => {
      const nonce = 'opaque-target-origin-probe';
      const timer = setTimeout(() => resolveProbe(false), 300);
      const listener = (event) => {
        if (event.source !== window.__activeFrame.contentWindow
          || event.data?.kind !== 'fixture-target-probe-result'
          || event.data?.nonce !== nonce) return;
        clearTimeout(timer);
        window.removeEventListener('message', listener);
        resolveProbe(true);
      };
      window.addEventListener('message', listener);
      window.__activeFrame.contentWindow.postMessage({ kind: 'fixture-opaque-target-probe', nonce }, window.__runnerOrigin);
    }));
    await page.evaluate(() => window.__activeFrame.remove());

    const q5 = {
      deployedProofBlocked: true,
      deployedProofReason: 'No deployed runner site, TLS endpoint, production cookie configuration, or response headers were provisioned for this local-only spike.',
      opaqueFrameOriginNull: opaqueReady?.origin === 'null',
      opaqueReadySourceMatches: opaqueReady?.sourceMatches === true,
      opaqueExactTargetMessageDelivered: opaqueTargetProbe,
      opaqueStorageParentAndCookieChecks: 'not-measured: the approved exact-target parent protocol cannot inspect an opaque origin',
      opaqueWorkerBootstrapOutcome: opaqueWorkerProbe?.data?.outcome ?? 'missing-result',
      opaqueWorkerStatus: opaqueWorkerProbe?.data?.status ?? null,
      opaqueWorkerQuickJsVersion: opaqueWorkerProbe?.data?.quickjsVersion ?? null,
      opaqueWorkerCaseResults: opaqueWorkerProbe?.data?.cases ?? [],
    };
    const sandboxMode = 'allow-scripts allow-same-origin';
    const runnerEnv = { ...state.browserDiagnostics, readyOrigin: null, readySourceMatches: false };
    await createFrame(page, sandboxMode, runnerEnv);
    const ready = runnerEnv.readyMessage;
    const isolation = await inspectFrame(page, 'runner-inspect-nonce');

    const response = await requestRun(page, runMessage(challenge.source, challengeInputs, 'canonical', 7));
    const workerEvidence = response.data.testEvidence;
    const caseResults = response.data.result.cases;
    const canonicalPassed = response.origin === state.runnerOrigin
      && response.sourceMatches
      && response.data.result.status === 'passed'
      && caseResults.length === challenge.cases.length
      && caseResults.every((item, index) => item.status === 'passed' && item.caseId === challenge.cases[index].id);

    const wrongSourceNonce = 'wrong-source-valid-origin';
    const peerPromise = context.waitForEvent('page');
    await page.click('#open-peer');
    const peerPage = await peerPromise;
    await peerPage.waitForLoadState('load');
    const wrongSourceBefore = await page.evaluate(() => window.__messages.length);
    await peerPage.evaluate(({ nonce, source, cases }) => window.opener.__activeFrame.contentWindow.postMessage({
      protocol: 1, kind: 'run', nonce, runId: nonce, challengeId: 'longest-window', challengeVersion: '1.0.0', sourceRevision: 1, source, cases,
    }, window.opener.__runnerOrigin), { nonce: wrongSourceNonce, source: challenge.source, cases: challengeInputs.slice(0, 1) });
    await delay(200);
    const wrongSourceRejected = await page.evaluate(({ nonce, beforeIndex }) => !window.__messages.slice(beforeIndex).some((entry) =>
      entry.data?.kind === 'run-result' && entry.data?.nonce === nonce), { nonce: wrongSourceNonce, beforeIndex: wrongSourceBefore });
    await peerPage.close();

    const foreignPagePromise = context.waitForEvent('page');
    await page.click('#open-attacker');
    const foreignPage = await foreignPagePromise;
    await foreignPage.waitForLoadState('load');
    const foreignBefore = await page.evaluate(() => window.__messages.length);
    await foreignPage.evaluate(() => window.__sendForeignResult());
    await page.waitForFunction(({ beforeIndex }) => window.__messages.length > beforeIndex, { beforeIndex: foreignBefore }, { timeout: 2000 });
    const foreignMessage = await page.evaluate((beforeIndex) => window.__messages.slice(beforeIndex).find((entry) =>
      entry.data?.nonce === 'foreign-forged-pass'), foreignBefore);
    const foreignOriginRejected = foreignMessage?.origin === state.attackerOrigin
      && foreignMessage.sourceMatches === false
      && !(await page.evaluate(() => window.__acceptedResults.some((entry) => entry.data?.nonce === 'foreign-forged-pass')));
    await foreignPage.close();

    const typeMismatchResponse = await requestRun(page, runMessage(
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { const bad: number = "nope"; return { start: bad, endExclusive: bad }; }',
      challengeInputs.slice(0, 1), 'type-mismatch', 8));
    const syntaxErrorResponse = await requestRun(page, runMessage('export function longestWindow( {', challengeInputs.slice(0, 1), 'syntax-error', 9));
    const importResponse = await requestRun(page, runMessage('import { something } from "https://attacker.test/payload.js"; export function longestWindow(events: string[], k: number) { return { start: 0, endExclusive: 0 }; }', challengeInputs.slice(0, 1), 'import', 10));
    const malformedRequest = runMessage(challenge.source, challengeInputs.slice(0, 1), 'malformed', 11);
    malformedRequest.nonce = 'short';
    const malformedResponse = await requestRun(page, malformedRequest);
    const runtimeErrorResponse = await requestRun(page, runMessage('export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { throw new Error("fixture runtime error"); }', challengeInputs.slice(0, 1), 'runtime-error', 11));
    const hostApiResponse = await requestRun(page, runMessage(
      'export function longestWindow(events: string[], k: number) { return { start: 0, endExclusive: typeof fetch === "undefined" && typeof window === "undefined" && typeof document === "undefined" && typeof localStorage === "undefined" && typeof indexedDB === "undefined" && typeof parent === "undefined" && typeof location === "undefined" && typeof WebSocket === "undefined" && typeof XMLHttpRequest === "undefined" && typeof Worker === "undefined" && typeof process === "undefined" && typeof require === "undefined" && typeof postMessage === "undefined" && typeof self === "undefined" ? 0 : 1 }; }',
      challengeInputs.slice(0, 1), 'host-api', 12));
    const stateSource = 'let counter = 0; export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { counter += 1; return { start: counter, endExclusive: counter }; }';
    const stateResponse = await requestRun(page, runMessage(stateSource, [
      { id: 'state-one', input: { events: [], k: 1 }, expected: { start: 1, endExclusive: 1 } },
      { id: 'state-two', input: { events: [], k: 1 }, expected: { start: 1, endExclusive: 1 } },
    ], 'state-reset', 13));

    const sourceLimitResponse = await requestRun(page, runMessage('x'.repeat(33 * 1024), challengeInputs.slice(0, 1), 'source-limit', 14));
    const inputLimitResponse = await requestRun(page, runMessage(challenge.source, [
      { id: 'large-input', input: { events: ['x'.repeat(1024 * 1024 + 32)], k: 1 }, expected: { start: 0, endExclusive: 0 } },
    ], 'input-limit', 15));
    const caseLimitResponse = await requestRun(page, runMessage(challenge.source,
      Array.from({ length: 101 }, (_, index) => ({ id: `case-${index}`, input: { events: [], k: 1 }, expected: { start: 0, endExclusive: 0 } })),
      'case-limit', 16));

    await page.evaluate(() => {
      window.__responsiveTicks = 0;
      window.__loopStartedAt = performance.now();
      window.__responsivenessTimer = setInterval(() => { window.__responsiveTicks += 1; }, 25);
    });
    const loopResponse = await requestRun(page, runMessage(
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { while (true) {} return { start: 0, endExclusive: 0 }; }',
      challengeInputs.slice(0, 1), 'loop', 16), 7000);
    const loopTiming = await page.evaluate(() => {
      clearInterval(window.__responsivenessTimer);
      return { responsiveTicks: window.__responsiveTicks, durationMs: Math.round(performance.now() - window.__loopStartedAt) };
    });
    const memoryResponse = await requestRun(page, runMessage(
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { const large = new Array(100000000).fill(1); return { start: large.length, endExclusive: large.length }; }',
      challengeInputs.slice(0, 1), 'memory', 17), 7000);
    const stackResponse = await requestRun(page, runMessage(
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { function recurse(): number { return 1 + recurse(); } const value = recurse(); return { start: value, endExclusive: value }; }',
      challengeInputs.slice(0, 1), 'stack', 18), 7000);
    const outputResponse = await requestRun(page, runMessage(
      'export function longestWindow(events: string[], k: number) { const huge = "x".repeat(100000); return { start: huge, endExclusive: huge }; }',
      challengeInputs.slice(0, 1), 'output', 19), 7000);
    const expensiveSource = 'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { const text = "a".repeat(50000) + "!"; const matched = /(a+)+$/.test(text); return { start: matched ? 1 : 0, endExclusive: 0 }; }';
    const expensiveResponse = await requestRun(page, runMessage(
      expensiveSource, challengeInputs.slice(0, 1), 'expensive-regexp-interrupt', 20), 7000);
    const expensiveHardKillResponse = await requestHardDeadlineProbe(page, runMessage(
      expensiveSource, challengeInputs.slice(0, 1), 'expensive-regexp-hard-kill', 26), 7000);

    const crashRequest = runMessage(
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { while (true) {} return { start: 0, endExclusive: 0 }; }',
      challengeInputs.slice(0, 1), 'worker-error', 21);
    const crashBefore = await page.evaluate(() => window.__messages.length);
    await page.evaluate((message) => window.__activeFrame.contentWindow.postMessage(message, window.__runnerOrigin), crashRequest);
    await delay(80);
    await page.evaluate((message) => window.__activeFrame.contentWindow.postMessage({
      kind: 'test-worker-error', nonce: message.nonce, runId: message.runId,
    }, window.__runnerOrigin), crashRequest);
    await page.waitForFunction(({ beforeIndex, nonce }) => window.__messages.slice(beforeIndex).some((entry) =>
      entry.data?.kind === 'run-result' && entry.data?.nonce === nonce), { beforeIndex: crashBefore, nonce: crashRequest.nonce }, { timeout: 3000 });
    const crashResponse = await page.evaluate(({ beforeIndex, nonce }) => window.__messages.slice(beforeIndex).find((entry) =>
      entry.data?.kind === 'run-result' && entry.data?.nonce === nonce), { beforeIndex: crashBefore, nonce: crashRequest.nonce });

    const cancellationNonce = `quickjs-fixture-nonce-cancel-${Date.now()}`;
    const cancellationRequest = runMessage(
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { while (true) {} return { start: 0, endExclusive: 0 }; }',
      challengeInputs.slice(0, 1), 'cancel', 22);
    cancellationRequest.nonce = cancellationNonce;
    const cancelBefore = await page.evaluate(() => window.__messages.length);
    await page.evaluate((message) => window.__activeFrame.contentWindow.postMessage(message, window.__runnerOrigin), cancellationRequest);
    await delay(80);
    await page.evaluate((message) => window.__activeFrame.contentWindow.postMessage({
      protocol: 1, kind: 'cancel', nonce: message.nonce, runId: message.runId, sourceRevision: message.sourceRevision,
    }, window.__runnerOrigin), cancellationRequest);
    await page.waitForFunction(({ beforeIndex, nonce }) => window.__messages.slice(beforeIndex).some((entry) =>
      entry.data?.kind === 'run-result' && entry.data?.nonce === nonce), { beforeIndex: cancelBefore, nonce: cancellationNonce }, { timeout: 3000 });
    const cancelResponse = await page.evaluate(({ beforeIndex, nonce }) => window.__messages.slice(beforeIndex).find((entry) =>
      entry.data?.kind === 'run-result' && entry.data?.nonce === nonce), { beforeIndex: cancelBefore, nonce: cancellationNonce });
    const firstWorkerId = workerEvidence?.workerId;
    const repeatResponse = await requestRun(page, runMessage(challenge.source, challengeInputs.slice(0, 1), 'repeat', 23));
    const concurrentResponses = await Promise.all([
      requestRun(page, runMessage(challenge.source, challengeInputs.slice(0, 1), 'concurrent-a', 24)),
      requestRun(page, runMessage(challenge.source, challengeInputs.slice(0, 1), 'concurrent-b', 25)),
    ]);
    const finalInspection = await inspectFrame(page, 'runner-final-inspection');
    const metrics = finalInspection?.evidence?.runnerMetrics ?? {};

    const q1 = {
      currentSourcePassedCanonicalCases: canonicalPassed,
      canonicalStatus: response.data.result.status,
      canonicalReason: response.data.result.reason ?? null,
      canonicalDiagnostics: response.data.result.diagnostics,
      canonicalCaseCount: caseResults.length,
      canonicalCaseIds: caseResults.map((item) => item.caseId),
      semanticTypeMismatchRejected: typeMismatchResponse.data.result.status === 'compile-error',
      typeMismatchStatus: typeMismatchResponse.data.result.status,
      typeMismatchDiagnostics: typeMismatchResponse.data.result.diagnostics,
      syntaxErrorRejected: syntaxErrorResponse.data.result.status === 'compile-error',
      importRejected: importResponse.data.result.reason === 'policy-rejected',
      runtimeErrorDistinguished: runtimeErrorResponse.data.result.status === 'execution-error'
        && runtimeErrorResponse.data.result.reason === 'runtime-error',
      runtimeErrorStatus: runtimeErrorResponse.data.result.status,
      runtimeErrorDiagnostics: runtimeErrorResponse.data.result.diagnostics,
    };
    const q2 = {
      workerOnlyQuickJs: canonicalPassed && workerEvidence?.quickjsVersion === packageJson.dependencies['quickjs-emscripten'],
      hostBrowserApisUnavailable: hostApiResponse.data.result.cases[0]?.actual?.endExclusive === 0,
      expectedValuesExcludedFromVm: workerEvidence?.hasExpectedValues === false
        && workerEvidence?.workerPayloadKeys?.includes('cases') === true,
      workerPayloadKeys: workerEvidence?.workerPayloadKeys ?? [],
      hasExpectedValues: workerEvidence?.hasExpectedValues,
      crossCaseStateReset: stateResponse.data.result.cases.length === 2
        && stateResponse.data.result.cases.every((item) => item.status === 'passed'),
    };
    const q3 = {
      loopTimedOut: loopResponse.data.result.status === 'timeout',
      loopResult: loopResponse.data.result.status,
      browserResponsiveTicks: loopTiming.responsiveTicks,
      loopDurationMs: loopTiming.durationMs,
      memoryCapped: memoryResponse.data.result.status === 'execution-error',
      memoryResult: memoryResponse.data.result.status,
      memoryDiagnostics: memoryResponse.data.result.diagnostics,
      stackCapped: stackResponse.data.result.status === 'execution-error',
      stackResult: stackResponse.data.result.status,
      stackDiagnostics: stackResponse.data.result.diagnostics,
      outputCapped: outputResponse.data.result.status === 'execution-error' && outputResponse.data.result.reason === 'policy-rejected',
      outputResult: outputResponse.data.result.status,
      outputDiagnostics: outputResponse.data.result.diagnostics,
      sourceCapped: sourceLimitResponse.data.result.reason === 'policy-rejected',
      inputCapped: inputLimitResponse.data.result.reason === 'policy-rejected',
      caseCountCapped: caseLimitResponse.data.result.reason === 'policy-rejected',
      expensiveBuiltinVmInterruptResult: expensiveResponse.data.result.status,
      expensiveBuiltinVmInterruptDiagnostics: expensiveResponse.data.result.diagnostics,
      expensiveBuiltinHardTerminated: expensiveHardKillResponse.data.testEvidence.termination === 'supervisor-deadline'
        && expensiveHardKillResponse.data.result.status === 'timeout',
      expensiveBuiltinHardTerminationResult: expensiveHardKillResponse.data.result.status,
      expensiveBuiltinHardTerminationEvidence: expensiveHardKillResponse.data.testEvidence,
      workerFailureDisposed: crashResponse.data.result.status === 'infrastructure-error',
      cancelledWorkerDisposed: cancelResponse.data.result.reason === 'cancelled'
        && metrics.activeWorkers === 0 && metrics.workersTerminated === metrics.workersCreated,
      repeatedRunsUseFreshWorkers: repeatResponse.data.testEvidence.workerId !== firstWorkerId
        && metrics.workersCreated === metrics.workersTerminated,
      concurrentRunsUseDistinctWorkers: concurrentResponses.every((entry) => entry.data.result.status === 'passed')
        && concurrentResponses[0].data.testEvidence.workerId !== concurrentResponses[1].data.testEvidence.workerId,
      limits: { ...BASE_LIMITS },
      workerMetrics: metrics,
    };

    const readyMessage = ready;
    const inspectRunner = isolation?.evidence ?? {};
    const forgedNonce = 'forged-pass-nonce';
    const forgedBefore = await page.evaluate(() => window.__messages.length);
    await page.evaluate(({ nonce, revision }) => {
      const frame = window.__activeFrame;
      frame.contentWindow.postMessage({ kind: 'test-parent-message', message: {
        protocol: 1, kind: 'run-result', nonce, sourceRevision: revision,
        result: { contractVersion: '1.0.0', runId: 'fake', challengeId: 'longest-window', challengeVersion: '1.0.0', sourceRevision: revision, status: 'passed', cases: [], diagnostics: [] },
      } }, window.__runnerOrigin);
    }, { nonce: forgedNonce, revision: 20 });
    await page.waitForFunction((beforeIndex) => window.__messages.length > beforeIndex, forgedBefore, { timeout: 2000 });
    const forged = await page.evaluate((beforeIndex) => window.__messages.slice(beforeIndex).find((entry) => entry.data?.kind === 'run-result'), forgedBefore);
    const staleRevision = 'quickjs-fixture-nonce-stale-revision';
    await page.evaluate((nonce) => { window.__pendingRuns[nonce] = { runId: 'quickjs-fixture-stale-revision', sourceRevision: 8 }; }, staleRevision);
    const staleBefore = await page.evaluate(() => window.__messages.length);
    await page.evaluate(({ nonce }) => window.__activeFrame.contentWindow.postMessage({
      kind: 'test-parent-message', message: {
        protocol: 1, kind: 'run-result', nonce, sourceRevision: 7,
        result: { contractVersion: '1.0.0', runId: 'quickjs-fixture-stale-revision', challengeId: 'longest-window', challengeVersion: '1.0.0', sourceRevision: 7, status: 'passed', cases: [], diagnostics: [] },
      },
    }, window.__runnerOrigin), { nonce: staleRevision });
    await page.waitForFunction((beforeIndex) => window.__messages.length > beforeIndex, staleBefore, { timeout: 2000 });
    const staleOutcome = await page.evaluate(({ beforeIndex, nonce }) => ({
      entry: window.__messages.slice(beforeIndex).find((item) => item.data?.kind === 'run-result' && item.data?.nonce === nonce),
      accepted: window.__acceptedResults.some((item) => item.data?.nonce === nonce),
      trustedScore: window.__trustedScore,
    }), { beforeIndex: staleBefore, nonce: staleRevision });

    const q4 = {
      foreignOriginRejected,
      wrongSourceRejected,
      forgedPassRejected: forged?.sourceMatches === true
        && !(await page.evaluate((nonce) => window.__acceptedResults.some((entry) => entry.data?.nonce === nonce), forgedNonce))
        && staleOutcome.trustedScore === null,
      staleRevisionRejected: staleOutcome.entry?.data?.result?.sourceRevision === 7 && !staleOutcome.accepted,
      malformedFrameRejected: malformedResponse.data.result.reason === 'policy-rejected',
      runMetadataPreserved: response.data.result.runId === 'quickjs-fixture-canonical'
        && response.data.result.sourceRevision === 7
        && response.data.result.challengeId === 'longest-window'
        && response.data.result.challengeVersion === '1.0.0',
      runnerOrigin: state.runnerOrigin,
      messageEvidence: { readyOrigin: readyMessage.origin, readySourceMatches: readyMessage.sourceMatches, forgedPassSourceMatches: forged?.sourceMatches },
      trustedScore: staleOutcome.trustedScore,
    };
    const q5Final = {
      ...q5,
      pageAndWorkerCspEnforced: !state.appProbeRequests && state.workerScriptHeaders.length > 0
        && state.workerScriptHeaders.every((value) => value.includes("connect-src 'self'") && !value.includes(state.appOrigin))
        && state.appPageCsp.includes(`frame-src ${state.runnerOrigin}`)
        && state.runnerPageCsp.includes(`frame-ancestors ${state.appOrigin}`),
      staticWasmLoadedUnderCsp: state.wasmRequests > 0,
      crossSiteCookieStorageIsolated: inspectRunner.appCookieVisible === false
        && inspectRunner.appStorageCanary === null
        && inspectRunner.parentDomDenied === true
        && inspectRunner.runnerStorageAvailable === true,
      arbitraryNetworkBlocked: inspectRunner.pageNetworkBlocked === true
        && workerEvidence?.workerNetworkBlocked === true && state.appProbeRequests === 0,
      appProbeRequests: state.appProbeRequests,
      wasmRequests: state.wasmRequests,
      wasmBytes: state.wasmBytes ?? 0,
      workerScriptBytes: state.workerScriptBytes ?? 0,
      workerScriptCsp: state.workerScriptHeaders,
      runnerPageCsp: state.runnerPageCsp,
      workerCsp: state.workerCsp,
      sandboxModeUsed: sandboxMode,
      isolation: inspectRunner,
      opaqueIsolation: 'not-measured: the approved parent protocol cannot inspect an opaque origin',
      opaqueWorkerBootstrapOutcome: opaqueWorkerProbe?.data?.outcome ?? 'missing-result',
    };

    cleanup.workersDisposed = metrics.activeWorkers === 0 && metrics.workersCreated === metrics.workersTerminated;
    cleanup.browserClosed = true;
    return {
      quickjs: { version: packageJson.dependencies['quickjs-emscripten'], license: 'MIT', package: 'quickjs-emscripten' },
      typescript: { version: TypeScript.version },
      browser: { name: 'Microsoft Edge', version: browser.version(), consoleErrors: consoleErrors.slice(0, 20) },
      fixture: { buildOutput, appOrigin: state.appOrigin, runnerOrigin: state.runnerOrigin },
      q1, q2, q3, q4, q5: q5Final,
      q6: { browser: { responsiveDuringTimeout: page.isClosed() === false && loopResponse.data.result.status === 'timeout' && loopTiming.responsiveTicks > 0 }, cleanup },
      cleanup,
    };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await Promise.all([close(appServer), close(runnerServer)]);
    cleanup.browserClosed = !browser?.isConnected?.();
    cleanup.serversClosed = !appServer.listening && !runnerServer.listening;
  }
}
