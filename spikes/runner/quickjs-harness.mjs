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
if (!playwrightModule)
  throw new Error('Set LAB_RUNNER_PLAYWRIGHT_MODULE to the preinstalled @playwright/test package path.');
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
  const config = { configFile: resolve(SPIKE, 'vite.config.mjs'), root: SPIKE };
  if (process.env.LAB_RUNNER_QUICKJS_MODULE) {
    config.resolve = { alias: { 'quickjs-emscripten': process.env.LAB_RUNNER_QUICKJS_MODULE } };
  }
  const result = await viteBuild(config);
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output ?? []);
  return outputs.map((output) => output.fileName).slice(0, 20);
}

function mime(path) {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.wasm':
      return 'application/wasm';
    case '.css':
      return 'text/css; charset=utf-8';
    default:
      return 'application/octet-stream';
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
window.__runFailures=[];
window.__rejectedHandshakes=[];
window.__activeFrame=null;
window.__runnerHandshake=null;
window.__handshakeTimer=null;
const __RUNNER_PROTOCOL_VERSION=1;
const __CONTRACT_VERSION='1.0.0';
const __MAX_RESULT_BYTES=64*1024;
const __MAX_RESULT_CASES=100;
const __MAX_DIAGNOSTICS=20;
const __MAX_DIAGNOSTIC_BYTES=2000;
const __RESULT_STATUSES=new Set(['passed','failed','compile-error','timeout','execution-error','infrastructure-error']);
const __CASE_STATUSES=new Set(['not-run','passed','failed','timeout','execution-error']);
const __RESULT_REASONS=new Set(['unsupported-code','policy-rejected','runtime-error','cancelled']);
function __isPlainObject(value){
 return !!value&&typeof value==='object'&&!Array.isArray(value)
  &&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}
function __isDenseArray(value,maxLength){
 if(!Array.isArray(value)||value.length>maxLength)return false;
 for(let index=0;index<value.length;index++){
  if(!Object.hasOwn(value,index))return false;
 }
 return true;
}
function __isJsonValue(value,seen=new Set(),depth=0){
 if(depth>32)return false;
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value!=='object'||seen.has(value))return false;
 seen.add(value);
 let valid;
 if(Array.isArray(value)){
   valid=__isDenseArray(value,1000);
  for(let index=0;valid&&index<value.length;index++){
   valid=Object.hasOwn(value,index)&&__isJsonValue(value[index],seen,depth+1);
  }
 }else{
  const keys=Object.keys(value);
  valid=__isPlainObject(value)&&keys.length<=256;
  for(const key of keys){
   if(!valid)break;
   valid=__isJsonValue(value[key],seen,depth+1);
  }
 }
 seen.delete(value);
 return valid;
}
function __equalJson(left,right){
 if(left===right)return true;
 if(left===null||right===null||typeof left!=='object'||typeof right!=='object')return false;
 if(Array.isArray(left)!==Array.isArray(right))return false;
 if(Array.isArray(left)){
  if(left.length!==right.length||!__isDenseArray(left,1000)||!__isDenseArray(right,1000))return false;
  for(let index=0;index<left.length;index++){
   if(!__equalJson(left[index],right[index]))return false;
  }
  return true;
 }
 const leftKeys=Object.keys(left).sort();
 const rightKeys=Object.keys(right).sort();
 return leftKeys.length===rightKeys.length
  &&leftKeys.every((key,index)=>key===rightKeys[index]&&__equalJson(left[key],right[key]));
}
function __validCaseResult(item,expected){
 if(!__isPlainObject(item)||Object.keys(item).some((key)=>!['caseId','status','expected','actual','message'].includes(key))
  ||item.caseId!==expected.caseId||!__CASE_STATUSES.has(item.status))return false;
 if(Object.hasOwn(item,'message')&&(typeof item.message!=='string'||item.message.length>__MAX_DIAGNOSTIC_BYTES))return false;
 if(item.status==='passed'||item.status==='failed'){
  if(!Object.hasOwn(item,'expected')||!Object.hasOwn(item,'actual')
   ||!__isJsonValue(item.expected)||!__isJsonValue(item.actual)
   ||!__equalJson(item.expected,expected.expected))return false;
  const actualMatches=__equalJson(item.actual,expected.expected);
  return item.status==='passed'?actualMatches:!actualMatches;
 }
 return !Object.hasOwn(item,'expected')&&!Object.hasOwn(item,'actual');
}
function __validateRunResult(entry,event,pending){
 const envelope=event.data;
 if(!entry.sourceMatches||event.origin!==window.__runnerOrigin)return 'Runner source or origin is invalid.';
 if(!window.__runnerHandshake?.complete||window.__runnerHandshake.failed)return 'Runner handshake is incomplete.';
 if(!__isPlainObject(envelope)||Object.keys(envelope).some((key)=>!['protocol','kind','nonce','result','testEvidence'].includes(key))
  ||envelope.protocol!==__RUNNER_PROTOCOL_VERSION||envelope.kind!=='run-result'
  ||envelope.nonce!==pending.nonce)return 'Invalid result envelope.';
 let serialized;
 try{serialized=JSON.stringify(envelope);}catch{return 'Result cannot be serialized.';}
 if(typeof serialized!=='string'||new TextEncoder().encode(serialized).byteLength>__MAX_RESULT_BYTES)return 'Result exceeds 64 KiB.';
 const result=envelope.result;
 const resultKeys=['contractVersion','runId','challengeId','challengeVersion','sourceRevision','status','cases','diagnostics','reason'];
 if(!__isPlainObject(result)||Object.keys(result).some((key)=>!resultKeys.includes(key))
  ||result.contractVersion!==pending.contractVersion||result.runId!==pending.runId
  ||result.challengeId!==pending.challengeId||result.challengeVersion!==pending.challengeVersion
  ||result.sourceRevision!==pending.sourceRevision||!Number.isInteger(result.sourceRevision)
   ||!__RESULT_STATUSES.has(result.status)||!__isDenseArray(result.cases,__MAX_RESULT_CASES)
   ||!__isDenseArray(pending.cases,__MAX_RESULT_CASES)||pending.cases.length===0
  ||result.cases.length!==pending.cases.length||result.cases.length>__MAX_RESULT_CASES
   ||!__isDenseArray(result.diagnostics,__MAX_DIAGNOSTICS)
  ||!result.diagnostics.every((message)=>typeof message==='string'&&message.length<=__MAX_DIAGNOSTIC_BYTES)
  ||(Object.hasOwn(result,'reason')&&!__RESULT_REASONS.has(result.reason)))return 'Invalid result metadata or schema.';
 if(result.cases.some((item,index)=>!__validCaseResult(item,pending.cases[index])))return 'Invalid or incomplete case suite.';
 if(result.status==='passed'&&(!result.cases.length||!result.cases.every((item)=>item.status==='passed')))return 'Pass requires every registered case.';
 if(result.status==='failed'&&!result.cases.some((item)=>item.status==='failed'))return 'Failed result has no failed case.';
 if(result.status==='compile-error'&&!result.cases.every((item)=>item.status==='not-run'))return 'Compile errors cannot include evaluated cases.';
 if(result.status==='timeout'&&!result.cases.some((item)=>item.status==='timeout')
  &&!result.cases.every((item)=>item.status==='not-run'))return 'Timeout result has inconsistent cases.';
 if(result.status==='infrastructure-error'&&!result.cases.every((item)=>item.status==='not-run'))return 'Infrastructure errors cannot include evaluated cases.';
 if(result.status==='execution-error'&&!Object.hasOwn(result,'reason'))return 'Execution errors require a reason.';
 if(result.status==='execution-error'&&result.reason==='runtime-error'
  &&!result.cases.some((item)=>item.status==='execution-error'))return 'Runtime errors require a failed case.';
 if(result.status==='execution-error'&&result.reason!=='runtime-error'
  &&!result.cases.every((item)=>item.status==='not-run'))return 'Non-runtime errors cannot include evaluated cases.';
 if(Object.hasOwn(result,'reason')&&result.status!=='execution-error')return 'Only execution errors may include a reason.';
 return null;
}
window.__registerPendingRun=(request)=>{
 if(!window.__runnerHandshake?.complete||window.__runnerHandshake.failed||!request||request.protocol!==__RUNNER_PROTOCOL_VERSION||request.kind!=='run'
  ||typeof request.nonce!=='string'||request.nonce.length<16||request.nonce.length>128
  ||typeof request.runId!=='string'||request.runId.length<1||request.runId.length>128
  ||request.challengeId!=='longest-window'||request.challengeVersion!=='1.0.0'
  ||!Number.isInteger(request.sourceRevision)||request.sourceRevision<0||!Array.isArray(request.cases)
  ||request.cases.length===0||request.cases.length>__MAX_RESULT_CASES||Object.hasOwn(window.__pendingRuns,request.nonce))return false;
 const caseIds=new Set();
 const cases=[];
 for(const item of request.cases){
  if(!__isPlainObject(item)||typeof item.id!=='string'||!item.id||caseIds.has(item.id)
   ||!Object.hasOwn(item,'expected')||!__isJsonValue(item.expected))return false;
  caseIds.add(item.id);
  cases.push({caseId:item.id,expected:item.expected});
 }
 window.__pendingRuns[request.nonce]={
  nonce:request.nonce,
  protocol:request.protocol,
  contractVersion:__CONTRACT_VERSION,
  runId:request.runId,
  challengeId:request.challengeId,
  challengeVersion:request.challengeVersion,
  sourceRevision:request.sourceRevision,
  cases,
 };
 return true;
};
window.__cancelPendingRun=(nonce)=>{
 const pending=window.__pendingRuns[nonce];
 if(!pending)return false;
 delete window.__pendingRuns[nonce];
 if(window.__activeFrame?.contentWindow){
  window.__activeFrame.contentWindow.postMessage({
   protocol:__RUNNER_PROTOCOL_VERSION,kind:'cancel',nonce:pending.nonce,
   runId:pending.runId,sourceRevision:pending.sourceRevision,
  },window.__runnerOrigin);
 }
 return true;
};
window.__openPeer=()=>window.open(location.origin+'/?peer=1','quickjs-peer');
window.__openAttacker=()=>window.open(${JSON.stringify(`${state.attackerOrigin}/attacker`)},'quickjs-attacker');
document.querySelector('#open-peer').addEventListener('click',window.__openPeer);
document.querySelector('#open-attacker').addEventListener('click',window.__openAttacker);
window.addEventListener('message',event=>{
 const frame=window.__activeFrame;
 const entry={origin:event.origin,sourceMatches:!!frame&&event.source===frame.contentWindow,data:event.data};
 window.__messages.push(entry);
 const fromRunner=entry.sourceMatches&&event.origin===window.__runnerOrigin;
 if(!fromRunner){
  if(event.data?.kind==='run-result')window.__rejectedResults.push(entry);
  return;
 }
 if(event.data?.kind==='ready'){
  const handshake=window.__runnerHandshake;
  if(!__isPlainObject(event.data)||Object.keys(event.data).length!==2
   ||!handshake||handshake.failed||handshake.ready||handshake.complete
   ||event.data.protocol!==__RUNNER_PROTOCOL_VERSION){
   window.__rejectedHandshakes.push({kind:'ready',protocol:event.data.protocol??null});
   return;
  }
  handshake.ready=true;
  frame.contentWindow.postMessage({
   protocol:__RUNNER_PROTOCOL_VERSION,kind:'handshake',nonce:handshake.nonce,
  },window.__runnerOrigin);
  return;
 }
 if(event.data?.kind==='handshake-ack'){
  const handshake=window.__runnerHandshake;
  if(!__isPlainObject(event.data)||Object.keys(event.data).length!==3
   ||!handshake||handshake.failed||!handshake.ready||handshake.complete
   ||event.data.protocol!==__RUNNER_PROTOCOL_VERSION||event.data.nonce!==handshake.nonce){
   window.__rejectedHandshakes.push({kind:'handshake-ack',protocol:event.data.protocol??null});
   return;
  }
  handshake.complete=true;
  clearTimeout(window.__handshakeTimer);
  window.__handshakeTimer=null;
  return;
 }
 if(event.data?.kind==='run-result'){
  const pending=window.__pendingRuns[event.data.nonce];
  if(!pending){
   window.__rejectedResults.push(entry);
   return;
  }
  const invalidReason=__validateRunResult(entry,event,pending);
  if(invalidReason){
   window.__rejectedResults.push(entry);
   window.__runFailures.push({
    nonce:pending.nonce,status:'infrastructure-error',message:'Runner returned an invalid result.',
   });
   delete window.__pendingRuns[pending.nonce];
   return;
  }
  window.__acceptedResults.push(entry);
  delete window.__pendingRuns[pending.nonce];
 }
});
window.__makeFrame=(sandbox)=>{
 clearTimeout(window.__handshakeTimer);
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
 const nonce=Array.from(bytes,(value)=>value.toString(16).padStart(2,'0')).join('');
  const handshake={protocol:__RUNNER_PROTOCOL_VERSION,nonce,ready:false,complete:false,failed:false};
 window.__runnerHandshake=handshake;
 window.__handshakeTimer=setTimeout(()=>{
  if(window.__runnerHandshake===handshake&&!handshake.complete){
    handshake.failed=true;
   window.__rejectedHandshakes.push({kind:'timeout',protocol:__RUNNER_PROTOCOL_VERSION});
  }
 },2000);
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
      respond(
        response,
        200,
        `window.__RUNNER_APP_ORIGIN__=${JSON.stringify(state.appOrigin)};`,
        'text/javascript; charset=utf-8',
        {
          'Access-Control-Allow-Origin': '*',
          'Content-Security-Policy': state.runnerPageCsp,
        },
      );
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
  await page.waitForFunction(
    ({ expectedKind, expectedNonce, beforeIndex }) =>
      window.__messages
        .slice(beforeIndex)
        .some(
          (entry) =>
            entry.data?.kind === expectedKind && (expectedNonce === null || entry.data?.nonce === expectedNonce),
        ),
    { expectedKind: kind, expectedNonce: nonce, beforeIndex: afterIndex },
    { timeout },
  );
  return page.evaluate(
    ({ expectedKind, expectedNonce, beforeIndex }) =>
      window.__messages
        .slice(beforeIndex)
        .find(
          (entry) =>
            entry.data?.kind === expectedKind && (expectedNonce === null || entry.data?.nonce === expectedNonce),
        ),
    { expectedKind: kind, expectedNonce: nonce, beforeIndex: afterIndex },
  );
}

async function inspectFrame(page, nonce, timeout = 2500) {
  return page.evaluate(
    ({ inspectionNonce, timeoutMs }) =>
      new Promise((resolveInspection) => {
        const timer = setTimeout(() => resolveInspection(null), timeoutMs);
        const listener = (event) => {
          if (
            event.source !== window.__activeFrame.contentWindow ||
            event.data?.kind !== 'fixture-inspection' ||
            event.data?.nonce !== inspectionNonce
          )
            return;
          clearTimeout(timer);
          window.removeEventListener('message', listener);
          resolveInspection({
            origin: event.origin,
            sourceMatches: event.source === window.__activeFrame.contentWindow,
            evidence: event.data.evidence,
          });
        };
        window.addEventListener('message', listener);
        window.__activeFrame.contentWindow.postMessage(
          { kind: 'fixture-inspect', nonce: inspectionNonce },
          window.__runnerOrigin,
        );
      }),
    { inspectionNonce: nonce, timeoutMs: timeout },
  );
}

async function requestRun(page, request, timeout = 8000) {
  const before = await page.evaluate(() => window.__messages.length);
  await page.evaluate((message) => {
    if (typeof window.__registerPendingRun === 'function') {
      window.__registerPendingRun(message);
      return;
    }
    window.__pendingRuns[message.nonce] = {
      nonce: message.nonce,
      protocol: message.protocol,
      contractVersion: '1.0.0',
      runId: message.runId,
      challengeId: message.challengeId,
      challengeVersion: message.challengeVersion,
      sourceRevision: message.sourceRevision,
      cases: message.cases.map(({ id, expected }) => ({ caseId: id, expected })),
    };
  }, request);
  await page.evaluate(
    (message) => window.__activeFrame.contentWindow.postMessage(message, window.__runnerOrigin),
    request,
  );
  await page.waitForFunction(
    ({ beforeIndex, nonce }) =>
      window.__messages
        .slice(beforeIndex)
        .some((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
    { beforeIndex: before, nonce: request.nonce },
    { timeout },
  );
  const response = await page.evaluate(
    ({ beforeIndex, nonce }) =>
      window.__messages
        .slice(beforeIndex)
        .find((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
    { beforeIndex: before, nonce: request.nonce },
  );
  return response;
}

async function requestHardDeadlineProbe(page, request, timeout = 7000) {
  const before = await page.evaluate(() => window.__messages.length);
  await page.evaluate((message) => {
    if (typeof window.__registerPendingRun === 'function') {
      window.__registerPendingRun(message);
      window.__activeFrame.contentWindow.postMessage(
        { kind: 'test-hard-deadline', request: message },
        window.__runnerOrigin,
      );
      return;
    }
    window.__pendingRuns[message.nonce] = {
      nonce: message.nonce,
      protocol: message.protocol,
      contractVersion: '1.0.0',
      runId: message.runId,
      challengeId: message.challengeId,
      challengeVersion: message.challengeVersion,
      sourceRevision: message.sourceRevision,
      cases: message.cases.map(({ id, expected }) => ({ caseId: id, expected })),
    };
    window.__activeFrame.contentWindow.postMessage(
      { kind: 'test-hard-deadline', request: message },
      window.__runnerOrigin,
    );
  }, request);
  await page.waitForFunction(
    ({ beforeIndex, nonce }) =>
      window.__messages
        .slice(beforeIndex)
        .some((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
    { beforeIndex: before, nonce: request.nonce },
    { timeout },
  );
  const response = await page.evaluate(
    ({ beforeIndex, nonce }) =>
      window.__messages
        .slice(beforeIndex)
        .find((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
    { beforeIndex: before, nonce: request.nonce },
  );
  return response;
}

const ACTIVE_RESULT_CASES = [
  { caseId: 'case-one', expected: { start: 0, endExclusive: 1 } },
  { caseId: 'case-two', expected: { start: 1, endExclusive: 3 } },
];

function activePending(nonce) {
  return {
    nonce,
    protocol: 1,
    contractVersion: '1.0.0',
    runId: 'm3-run-' + nonce,
    challengeId: 'longest-window',
    challengeVersion: '1.0.0',
    sourceRevision: 901,
    cases: ACTIVE_RESULT_CASES.map((item) => ({ caseId: item.caseId, expected: { ...item.expected } })),
  };
}

function activeResultEnvelope(nonce) {
  const pending = activePending(nonce);
  return {
    protocol: 1,
    kind: 'run-result',
    nonce,
    result: {
      contractVersion: pending.contractVersion,
      runId: pending.runId,
      challengeId: pending.challengeId,
      challengeVersion: pending.challengeVersion,
      sourceRevision: pending.sourceRevision,
      status: 'passed',
      cases: ACTIVE_RESULT_CASES.map((item) => ({
        caseId: item.caseId,
        status: 'passed',
        expected: { ...item.expected },
        actual: { ...item.expected },
      })),
      diagnostics: [],
    },
  };
}

async function injectActiveResult(page, envelope, { register = true, pending = null, sparseArray = null } = {}) {
  const beforeIndex = await page.evaluate(() => window.__messages.length);
  await page.evaluate(
    ({ message, shouldRegister, pendingRun, sparseArray: sparseArrayKind }) => {
      if (shouldRegister) window.__pendingRuns[message.nonce] = pendingRun;
      if (sparseArrayKind === 'cases') {
        const cases = new Array(message.result.cases.length);
        cases[0] = message.result.cases[0];
        message.result.cases = cases;
      } else if (sparseArrayKind === 'diagnostics') {
        message.result.diagnostics = new Array(1);
      } else if (sparseArrayKind === 'nested-actual') {
        const actual = new Array(3);
        actual[0] = 1;
        actual[2] = 3;
        message.result.cases[0].actual = actual;
      }
      window.__activeFrame.contentWindow.postMessage(
        {
          kind: 'test-parent-message',
          message,
        },
        window.__runnerOrigin,
      );
    },
    { message: envelope, shouldRegister: register, pendingRun: pending ?? activePending(envelope.nonce), sparseArray },
  );
  await page.waitForFunction(
    ({ index, nonce }) =>
      window.__messages.slice(index).some((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
    { index: beforeIndex, nonce: envelope.nonce },
    { timeout: 2000 },
  );
  return page.evaluate(
    ({ index, nonce, sparseArray: sparseArrayKind }) => {
      const entry = window.__messages
        .slice(index)
        .find((item) => item.data?.kind === 'run-result' && item.data?.nonce === nonce);
      const result = entry?.data?.result;
      const sparseValue =
        sparseArrayKind === 'cases'
          ? result?.cases
          : sparseArrayKind === 'diagnostics'
            ? result?.diagnostics
            : sparseArrayKind === 'nested-actual'
              ? result?.cases?.[0]?.actual
              : null;
      const sparseHoleIndex = sparseArrayKind === 'diagnostics' ? 0 : sparseArrayKind ? 1 : -1;
      return {
        accepted: !!entry && window.__acceptedResults.includes(entry),
        infrastructureError:
          window.__runFailures?.some((item) => item.nonce === nonce && item.status === 'infrastructure-error') ?? false,
        pendingRetired: !Object.hasOwn(window.__pendingRuns, nonce),
        received: !!entry,
        sparseHolePreserved:
          sparseHoleIndex >= 0 && Array.isArray(sparseValue) && !Object.hasOwn(sparseValue, sparseHoleIndex),
      };
    },
    { index: beforeIndex, nonce: envelope.nonce, sparseArray },
  );
}

async function sendRunnerMessage(page, message) {
  const beforeIndex = await page.evaluate(() => window.__messages.length);
  await page.evaluate(
    (data) =>
      window.__activeFrame.contentWindow.postMessage(
        {
          kind: 'test-parent-message',
          message: data,
        },
        window.__runnerOrigin,
      ),
    message,
  );
  await page.waitForFunction((index) => window.__messages.length > index, beforeIndex, { timeout: 2000 });
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
    throw new Error(
      `${error.message}; frame bootstrap diagnostics: ${JSON.stringify({
        sandbox,
        frames,
        consoleErrors: status.consoleErrors,
        pageErrors: status.pageErrors,
        failedRequests: status.failedRequests,
        runnerResponses: status.runnerResponses,
      })}`,
      { cause: error },
    );
  }
  status.readyMessage = ready;
  status.readyOrigin = ready.origin;
  status.readySourceMatches = ready.sourceMatches;
  if (sandbox.includes('allow-same-origin')) {
    try {
      status.handshakeAckMessage = await waitForMessage(page, { kind: 'handshake-ack', afterIndex: beforeIndex }, 1000);
    } catch {
      status.handshakeAckMessage = null;
    }
    status.handshakeCompleted = await page.evaluate(() => window.__runnerHandshake?.complete === true);
    status.handshakeState = await page.evaluate(() => window.__runnerHandshake ?? null);
  }
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
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) =>
      failedRequests.push({
        url: request.url(),
        resourceType: request.resourceType(),
        error: request.failure()?.errorText ?? 'unknown',
      }),
    );
    page.on('response', (response) => {
      if (response.url().startsWith(state.runnerOrigin ?? 'http://runner.test')) {
        runnerResponses.push({
          url: response.url(),
          status: response.status(),
          type: response.request().resourceType(),
        });
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
    await page.waitForFunction(
      (beforeIndex) =>
        window.__messages.slice(beforeIndex).some((entry) => entry.data?.kind === 'opaque-worker-probe-result'),
      opaqueWorkerProbeBefore,
      { timeout: 6500 },
    );
    const opaqueWorkerProbe = await page.evaluate(
      (beforeIndex) =>
        window.__messages.slice(beforeIndex).find((entry) => entry.data?.kind === 'opaque-worker-probe-result'),
      opaqueWorkerProbeBefore,
    );
    const opaqueTargetProbe = await page.evaluate(
      () =>
        new Promise((resolveProbe) => {
          const nonce = 'opaque-target-origin-probe';
          const timer = setTimeout(() => resolveProbe(false), 300);
          const listener = (event) => {
            if (
              event.source !== window.__activeFrame.contentWindow ||
              event.data?.kind !== 'fixture-target-probe-result' ||
              event.data?.nonce !== nonce
            )
              return;
            clearTimeout(timer);
            window.removeEventListener('message', listener);
            resolveProbe(true);
          };
          window.addEventListener('message', listener);
          window.__activeFrame.contentWindow.postMessage(
            { kind: 'fixture-opaque-target-probe', nonce },
            window.__runnerOrigin,
          );
        }),
    );
    await page.evaluate(() => window.__activeFrame.remove());

    const q5 = {
      deployedProofBlocked: true,
      deployedProofReason:
        'No deployed runner site, TLS endpoint, production cookie configuration, or response headers were provisioned for this local-only spike.',
      opaqueFrameOriginNull: opaqueReady?.origin === 'null',
      opaqueReadySourceMatches: opaqueReady?.sourceMatches === true,
      opaqueExactTargetMessageDelivered: opaqueTargetProbe,
      opaqueStorageParentAndCookieChecks:
        'not-measured: the approved exact-target parent protocol cannot inspect an opaque origin',
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
    const canonicalPassed =
      response.origin === state.runnerOrigin &&
      response.sourceMatches &&
      response.data.result.status === 'passed' &&
      caseResults.length === challenge.cases.length &&
      caseResults.every((item, index) => item.status === 'passed' && item.caseId === challenge.cases[index].id);

    const wrongSourceNonce = 'wrong-source-valid-origin';
    const peerPromise = context.waitForEvent('page');
    await page.click('#open-peer');
    const peerPage = await peerPromise;
    await peerPage.waitForLoadState('load');
    const wrongSourceBefore = await page.evaluate(() => window.__messages.length);
    await peerPage.evaluate(
      ({ nonce, source, cases }) =>
        window.opener.__activeFrame.contentWindow.postMessage(
          {
            protocol: 1,
            kind: 'run',
            nonce,
            runId: nonce,
            challengeId: 'longest-window',
            challengeVersion: '1.0.0',
            sourceRevision: 1,
            source,
            cases,
          },
          window.opener.__runnerOrigin,
        ),
      { nonce: wrongSourceNonce, source: challenge.source, cases: challengeInputs.slice(0, 1) },
    );
    await delay(200);
    const wrongSourceRejected = await page.evaluate(
      ({ nonce, beforeIndex }) =>
        !window.__messages
          .slice(beforeIndex)
          .some((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
      { nonce: wrongSourceNonce, beforeIndex: wrongSourceBefore },
    );
    await peerPage.close();

    const foreignPagePromise = context.waitForEvent('page');
    await page.click('#open-attacker');
    const foreignPage = await foreignPagePromise;
    await foreignPage.waitForLoadState('load');
    const foreignBefore = await page.evaluate(() => window.__messages.length);
    await foreignPage.evaluate(() => window.__sendForeignResult());
    await page.waitForFunction(
      ({ beforeIndex }) => window.__messages.length > beforeIndex,
      { beforeIndex: foreignBefore },
      { timeout: 2000 },
    );
    const foreignMessage = await page.evaluate(
      (beforeIndex) =>
        window.__messages.slice(beforeIndex).find((entry) => entry.data?.nonce === 'foreign-forged-pass'),
      foreignBefore,
    );
    const foreignOriginRejected =
      foreignMessage?.origin === state.attackerOrigin &&
      foreignMessage.sourceMatches === false &&
      !(await page.evaluate(() =>
        window.__acceptedResults.some((entry) => entry.data?.nonce === 'foreign-forged-pass'),
      ));
    await foreignPage.close();

    const typeMismatchResponse = await requestRun(
      page,
      runMessage(
        'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { const bad: number = "nope"; return { start: bad, endExclusive: bad }; }',
        challengeInputs.slice(0, 1),
        'type-mismatch',
        8,
      ),
    );
    const syntaxErrorResponse = await requestRun(
      page,
      runMessage('export function longestWindow( {', challengeInputs.slice(0, 1), 'syntax-error', 9),
    );
    const importResponse = await requestRun(
      page,
      runMessage(
        'import { something } from "https://attacker.test/payload.js"; export function longestWindow(events: string[], k: number) { return { start: 0, endExclusive: 0 }; }',
        challengeInputs.slice(0, 1),
        'import',
        10,
      ),
    );
    const malformedRequest = runMessage(challenge.source, challengeInputs.slice(0, 1), 'malformed', 11);
    malformedRequest.nonce = 'short';
    const malformedResponse = await requestRun(page, malformedRequest);
    const runtimeErrorResponse = await requestRun(
      page,
      runMessage(
        'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { throw new Error("fixture runtime error"); }',
        challengeInputs.slice(0, 1),
        'runtime-error',
        11,
      ),
    );
    const hostApiResponse = await requestRun(
      page,
      runMessage(
        'export function longestWindow(events: string[], k: number) { return { start: 0, endExclusive: typeof fetch === "undefined" && typeof window === "undefined" && typeof document === "undefined" && typeof localStorage === "undefined" && typeof indexedDB === "undefined" && typeof parent === "undefined" && typeof location === "undefined" && typeof WebSocket === "undefined" && typeof XMLHttpRequest === "undefined" && typeof Worker === "undefined" && typeof process === "undefined" && typeof require === "undefined" && typeof postMessage === "undefined" && typeof self === "undefined" ? 0 : 1 }; }',
        challengeInputs.slice(0, 1),
        'host-api',
        12,
      ),
    );
    const stateSource =
      'let counter = 0; export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { counter += 1; return { start: counter, endExclusive: counter }; }';
    const stateResponse = await requestRun(
      page,
      runMessage(
        stateSource,
        [
          { id: 'state-one', input: { events: [], k: 1 }, expected: { start: 1, endExclusive: 1 } },
          { id: 'state-two', input: { events: [], k: 1 }, expected: { start: 1, endExclusive: 1 } },
        ],
        'state-reset',
        13,
      ),
    );

    const sourceLimitResponse = await requestRun(
      page,
      runMessage('x'.repeat(33 * 1024), challengeInputs.slice(0, 1), 'source-limit', 14),
    );
    const inputLimitResponse = await requestRun(
      page,
      runMessage(
        challenge.source,
        [
          {
            id: 'large-input',
            input: { events: ['x'.repeat(1024 * 1024 + 32)], k: 1 },
            expected: { start: 0, endExclusive: 0 },
          },
        ],
        'input-limit',
        15,
      ),
    );
    const caseLimitResponse = await requestRun(
      page,
      runMessage(
        challenge.source,
        Array.from({ length: 101 }, (_, index) => ({
          id: `case-${index}`,
          input: { events: [], k: 1 },
          expected: { start: 0, endExclusive: 0 },
        })),
        'case-limit',
        16,
      ),
    );

    await page.evaluate(() => {
      window.__responsiveTicks = 0;
      window.__loopStartedAt = performance.now();
      window.__responsivenessTimer = setInterval(() => {
        window.__responsiveTicks += 1;
      }, 25);
    });
    const loopResponse = await requestRun(
      page,
      runMessage(
        'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { while (true) {} return { start: 0, endExclusive: 0 }; }',
        challengeInputs.slice(0, 1),
        'loop',
        16,
      ),
      7000,
    );
    const loopTiming = await page.evaluate(() => {
      clearInterval(window.__responsivenessTimer);
      return {
        responsiveTicks: window.__responsiveTicks,
        durationMs: Math.round(performance.now() - window.__loopStartedAt),
      };
    });
    const memoryResponse = await requestRun(
      page,
      runMessage(
        'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { const large = new Array(100000000).fill(1); return { start: large.length, endExclusive: large.length }; }',
        challengeInputs.slice(0, 1),
        'memory',
        17,
      ),
      7000,
    );
    const stackResponse = await requestRun(
      page,
      runMessage(
        'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { function recurse(): number { return 1 + recurse(); } const value = recurse(); return { start: value, endExclusive: value }; }',
        challengeInputs.slice(0, 1),
        'stack',
        18,
      ),
      7000,
    );
    const outputResponse = await requestRun(
      page,
      runMessage(
        'export function longestWindow(events: string[], k: number) { const huge = "x".repeat(100000); return { start: huge, endExclusive: huge }; }',
        challengeInputs.slice(0, 1),
        'output',
        19,
      ),
      7000,
    );
    const expensiveSource =
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { const text = "a".repeat(50000) + "!"; const matched = /(a+)+$/.test(text); return { start: matched ? 1 : 0, endExclusive: 0 }; }';
    const expensiveResponse = await requestRun(
      page,
      runMessage(expensiveSource, challengeInputs.slice(0, 1), 'expensive-regexp-interrupt', 20),
      7000,
    );
    const expensiveHardKillResponse = await requestHardDeadlineProbe(
      page,
      runMessage(expensiveSource, challengeInputs.slice(0, 1), 'expensive-regexp-hard-kill', 26),
      7000,
    );

    const crashRequest = runMessage(
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { while (true) {} return { start: 0, endExclusive: 0 }; }',
      challengeInputs.slice(0, 1),
      'worker-error',
      21,
    );
    const crashBefore = await page.evaluate(() => window.__messages.length);
    await page.evaluate(
      (message) => window.__activeFrame.contentWindow.postMessage(message, window.__runnerOrigin),
      crashRequest,
    );
    await delay(80);
    await page.evaluate(
      (message) =>
        window.__activeFrame.contentWindow.postMessage(
          {
            kind: 'test-worker-error',
            nonce: message.nonce,
            runId: message.runId,
          },
          window.__runnerOrigin,
        ),
      crashRequest,
    );
    await page.waitForFunction(
      ({ beforeIndex, nonce }) =>
        window.__messages
          .slice(beforeIndex)
          .some((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
      { beforeIndex: crashBefore, nonce: crashRequest.nonce },
      { timeout: 3000 },
    );
    const crashResponse = await page.evaluate(
      ({ beforeIndex, nonce }) =>
        window.__messages
          .slice(beforeIndex)
          .find((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
      { beforeIndex: crashBefore, nonce: crashRequest.nonce },
    );

    const cancellationNonce = `quickjs-fixture-nonce-cancel-${Date.now()}`;
    const cancellationRequest = runMessage(
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { while (true) {} return { start: 0, endExclusive: 0 }; }',
      challengeInputs.slice(0, 1),
      'cancel',
      22,
    );
    cancellationRequest.nonce = cancellationNonce;
    const cancelBefore = await page.evaluate(() => window.__messages.length);
    await page.evaluate((message) => {
      window.__pendingRuns[message.nonce] = {
        nonce: message.nonce,
        protocol: message.protocol,
        contractVersion: '1.0.0',
        runId: message.runId,
        challengeId: message.challengeId,
        challengeVersion: message.challengeVersion,
        sourceRevision: message.sourceRevision,
        cases: message.cases.map(({ id, expected }) => ({ caseId: id, expected })),
      };
      window.__activeFrame.contentWindow.postMessage(message, window.__runnerOrigin);
    }, cancellationRequest);
    await delay(80);
    const cancellationInitiated = await page.evaluate((message) => {
      if (typeof window.__cancelPendingRun === 'function') return window.__cancelPendingRun(message.nonce);
      window.__activeFrame.contentWindow.postMessage(
        {
          protocol: 1,
          kind: 'cancel',
          nonce: message.nonce,
          runId: message.runId,
          sourceRevision: message.sourceRevision,
        },
        window.__runnerOrigin,
      );
      return false;
    }, cancellationRequest);
    await page.waitForFunction(
      ({ beforeIndex, nonce }) =>
        window.__messages
          .slice(beforeIndex)
          .some((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
      { beforeIndex: cancelBefore, nonce: cancellationNonce },
      { timeout: 3000 },
    );
    const cancelResponse = await page.evaluate(
      ({ beforeIndex, nonce }) =>
        window.__messages
          .slice(beforeIndex)
          .find((entry) => entry.data?.kind === 'run-result' && entry.data?.nonce === nonce),
      { beforeIndex: cancelBefore, nonce: cancellationNonce },
    );
    const cancellationReplyAccepted = await page.evaluate(
      (nonce) => window.__acceptedResults.some((entry) => entry.data?.nonce === nonce),
      cancellationNonce,
    );
    const firstWorkerId = workerEvidence?.workerId;
    const repeatResponse = await requestRun(
      page,
      runMessage(challenge.source, challengeInputs.slice(0, 1), 'repeat', 23),
    );
    const beforeBurstInspection = await inspectFrame(page, 'runner-before-burst');
    const beforeBurstWorkerCount = beforeBurstInspection?.evidence?.runnerMetrics?.workersCreated ?? 0;
    const burstSource =
      'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { while (true) {} return { start: 0, endExclusive: 0 }; }';
    const concurrentResponses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        requestHardDeadlineProbe(
          page,
          runMessage(burstSource, challengeInputs.slice(0, 1), 'concurrent-' + index, 24 + index),
        ),
      ),
    );
    const afterBurstInspection = await inspectFrame(page, 'runner-after-burst');
    const burstMetrics = afterBurstInspection?.evidence?.runnerMetrics ?? {};
    const burstWorkersCreated = burstMetrics.workersCreated - beforeBurstWorkerCount;
    const burstBusyRejections = concurrentResponses.filter(
      (entry) => entry.data.result.reason === 'policy-rejected',
    ).length;
    const burstWorkersDisposed =
      burstMetrics.activeWorkers === 0 && burstMetrics.workersCreated === burstMetrics.workersTerminated;
    const burstRecoveryResponse = await requestRun(
      page,
      runMessage(challenge.source, challengeInputs.slice(0, 1), 'burst-recovery', 32),
    );
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
      runtimeErrorDistinguished:
        runtimeErrorResponse.data.result.status === 'execution-error' &&
        runtimeErrorResponse.data.result.reason === 'runtime-error',
      runtimeErrorStatus: runtimeErrorResponse.data.result.status,
      runtimeErrorDiagnostics: runtimeErrorResponse.data.result.diagnostics,
    };
    const q2 = {
      workerOnlyQuickJs:
        canonicalPassed && workerEvidence?.quickjsVersion === packageJson.dependencies['quickjs-emscripten'],
      hostBrowserApisUnavailable: hostApiResponse.data.result.cases[0]?.actual?.endExclusive === 0,
      expectedValuesExcludedFromVm:
        workerEvidence?.hasExpectedValues === false && workerEvidence?.workerPayloadKeys?.includes('cases') === true,
      workerPayloadKeys: workerEvidence?.workerPayloadKeys ?? [],
      hasExpectedValues: workerEvidence?.hasExpectedValues,
      crossCaseStateReset:
        stateResponse.data.result.cases.length === 2 &&
        stateResponse.data.result.cases.every((item) => item.status === 'passed'),
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
      outputCapped:
        outputResponse.data.result.status === 'execution-error' &&
        outputResponse.data.result.reason === 'policy-rejected',
      outputResult: outputResponse.data.result.status,
      outputDiagnostics: outputResponse.data.result.diagnostics,
      sourceCapped: sourceLimitResponse.data.result.reason === 'policy-rejected',
      inputCapped: inputLimitResponse.data.result.reason === 'policy-rejected',
      caseCountCapped: caseLimitResponse.data.result.reason === 'policy-rejected',
      expensiveBuiltinVmInterruptResult: expensiveResponse.data.result.status,
      expensiveBuiltinVmInterruptDiagnostics: expensiveResponse.data.result.diagnostics,
      expensiveBuiltinHardTerminated:
        expensiveHardKillResponse.data.testEvidence.termination === 'supervisor-deadline' &&
        expensiveHardKillResponse.data.result.status === 'timeout',
      expensiveBuiltinHardTerminationResult: expensiveHardKillResponse.data.result.status,
      expensiveBuiltinHardTerminationEvidence: expensiveHardKillResponse.data.testEvidence,
      workerFailureDisposed: crashResponse.data.result.status === 'infrastructure-error',
      cancelledWorkerDisposed:
        cancelResponse.data.result.reason === 'cancelled' &&
        metrics.activeWorkers === 0 &&
        metrics.workersTerminated === metrics.workersCreated,
      cancellationInitiated,
      cancellationReplyAccepted,
      repeatedRunsUseFreshWorkers:
        repeatResponse.data.testEvidence.workerId !== firstWorkerId &&
        metrics.workersCreated === metrics.workersTerminated,
      singleActiveWorkerBurstBounded:
        metrics.maxActiveWorkers === 1 &&
        burstMetrics.maxActiveWorkers === 1 &&
        concurrentResponses.length === 8 &&
        burstBusyRejections > 0,
      burstWorkersCreated,
      burstBusyRejections,
      burstResponseStatuses: concurrentResponses.map((entry) => ({
        status: entry.data.result.status,
        reason: entry.data.result.reason ?? null,
        termination: entry.data.testEvidence?.termination ?? null,
      })),
      workersDisposedAfterBurst: burstWorkersDisposed,
      boundedRecoveryAfterBurst:
        burstRecoveryResponse.data.result.status === 'passed' &&
        metrics.activeWorkers === 0 &&
        metrics.workersCreated === metrics.workersTerminated,
      limits: { ...BASE_LIMITS },
      workerMetrics: metrics,
    };

    const readyMessage = ready;
    const inspectRunner = isolation?.evidence ?? {};
    const forgedNonce = 'forged-pass-nonce';
    const forgedBefore = await page.evaluate(() => window.__messages.length);
    await page.evaluate(
      ({ nonce, revision }) => {
        const frame = window.__activeFrame;
        frame.contentWindow.postMessage(
          {
            kind: 'test-parent-message',
            message: {
              protocol: 1,
              kind: 'run-result',
              nonce,
              sourceRevision: revision,
              result: {
                contractVersion: '1.0.0',
                runId: 'fake',
                challengeId: 'longest-window',
                challengeVersion: '1.0.0',
                sourceRevision: revision,
                status: 'passed',
                cases: [],
                diagnostics: [],
              },
            },
          },
          window.__runnerOrigin,
        );
      },
      { nonce: forgedNonce, revision: 20 },
    );
    await page.waitForFunction((beforeIndex) => window.__messages.length > beforeIndex, forgedBefore, {
      timeout: 2000,
    });
    const forged = await page.evaluate(
      (beforeIndex) => window.__messages.slice(beforeIndex).find((entry) => entry.data?.kind === 'run-result'),
      forgedBefore,
    );
    const staleRevision = 'quickjs-fixture-nonce-stale-revision';
    await page.evaluate((nonce) => {
      window.__pendingRuns[nonce] = { runId: 'quickjs-fixture-stale-revision', sourceRevision: 8 };
    }, staleRevision);
    const staleBefore = await page.evaluate(() => window.__messages.length);
    await page.evaluate(
      ({ nonce }) =>
        window.__activeFrame.contentWindow.postMessage(
          {
            kind: 'test-parent-message',
            message: {
              protocol: 1,
              kind: 'run-result',
              nonce,
              sourceRevision: 7,
              result: {
                contractVersion: '1.0.0',
                runId: 'quickjs-fixture-stale-revision',
                challengeId: 'longest-window',
                challengeVersion: '1.0.0',
                sourceRevision: 7,
                status: 'passed',
                cases: [],
                diagnostics: [],
              },
            },
          },
          window.__runnerOrigin,
        ),
      { nonce: staleRevision },
    );
    await page.waitForFunction((beforeIndex) => window.__messages.length > beforeIndex, staleBefore, { timeout: 2000 });
    const staleOutcome = await page.evaluate(
      ({ beforeIndex, nonce }) => ({
        entry: window.__messages
          .slice(beforeIndex)
          .find((item) => item.data?.kind === 'run-result' && item.data?.nonce === nonce),
        accepted: window.__acceptedResults.some((item) => item.data?.nonce === nonce),
        trustedScore: window.__trustedScore,
      }),
      { beforeIndex: staleBefore, nonce: staleRevision },
    );

    const activeResultChecks = {};
    const malformedResultCases = [
      [
        'malformed',
        (envelope) => {
          envelope.result.cases = [null];
        },
      ],
      [
        'empty',
        (envelope) => {
          envelope.result.cases = [];
        },
      ],
      [
        'partial',
        (envelope) => {
          envelope.result.cases = envelope.result.cases.slice(0, 1);
        },
      ],
      [
        'duplicate',
        (envelope) => {
          envelope.result.cases[1] = { ...envelope.result.cases[0] };
        },
      ],
      [
        'oversized-suite',
        (envelope) => {
          envelope.result.cases = Array.from({ length: 101 }, (_, index) => ({
            caseId: 'oversized-' + index,
            status: 'passed',
            expected: { start: 0, endExclusive: 0 },
            actual: { start: 0, endExclusive: 0 },
          }));
        },
      ],
      [
        'oversized-payload',
        (envelope) => {
          envelope.result.diagnostics = ['x'.repeat(70 * 1024)];
        },
      ],
      [
        'wrong-protocol',
        (envelope) => {
          envelope.protocol = 2;
        },
      ],
      [
        'wrong-contract',
        (envelope) => {
          envelope.result.contractVersion = '9.9.9';
        },
      ],
      [
        'wrong-challenge',
        (envelope) => {
          envelope.result.challengeId = 'another-challenge';
        },
      ],
      [
        'wrong-challenge-version',
        (envelope) => {
          envelope.result.challengeVersion = '9.9.9';
        },
      ],
      [
        'wrong-expected',
        (envelope) => {
          envelope.result.cases[0].expected = { start: 90, endExclusive: 91 };
        },
      ],
      [
        'wrong-actual',
        (envelope) => {
          envelope.result.cases[0].actual = { start: 90, endExclusive: 91 };
        },
      ],
      [
        'non-json',
        (envelope) => {
          envelope.result.cases[0].actual.start = Number.POSITIVE_INFINITY;
        },
      ],
    ];
    for (const [name, mutate] of malformedResultCases) {
      const nonce = 'm3-active-' + name;
      const envelope = activeResultEnvelope(nonce);
      mutate(envelope);
      activeResultChecks[name] = await injectActiveResult(page, envelope);
    }

    for (const sparseArray of ['cases', 'diagnostics']) {
      const nonce = 'm3-active-sparse-' + sparseArray;
      activeResultChecks['sparse-' + sparseArray] = await injectActiveResult(page, activeResultEnvelope(nonce), {
        sparseArray,
      });
    }

    const sparseNestedNonce = 'm3-active-sparse-nested-json';
    const sparseNestedPending = activePending(sparseNestedNonce);
    sparseNestedPending.cases[0].expected = [1, 2, 3];
    const sparseNestedEnvelope = activeResultEnvelope(sparseNestedNonce);
    sparseNestedEnvelope.result.cases[0].expected = [1, 2, 3];
    sparseNestedEnvelope.result.cases[0].actual = [1, 2, 3];
    activeResultChecks['sparse-nested-json'] = await injectActiveResult(page, sparseNestedEnvelope, {
      pending: sparseNestedPending,
      sparseArray: 'nested-actual',
    });

    const replayNonce = 'm3-active-replay';
    const replayEnvelope = activeResultEnvelope(replayNonce);
    const replayFirst = await injectActiveResult(page, replayEnvelope);
    const replayAgain = await injectActiveResult(page, replayEnvelope, { register: false });

    const originalHandshake = await page.evaluate(() => window.__runnerHandshake ?? null);
    await page.evaluate(() => {
      window.__runnerHandshake = null;
    });
    const missingHandshake = await injectActiveResult(page, activeResultEnvelope('m3-missing-handshake'));

    await page.evaluate(() => {
      window.__runnerHandshake = {
        protocol: 1,
        nonce: 'm3-expected-handshake',
        ready: true,
        complete: false,
      };
    });
    await sendRunnerMessage(page, {
      protocol: 999,
      kind: 'handshake-ack',
      nonce: 'm3-expected-handshake',
    });
    const invalidHandshake = await injectActiveResult(page, activeResultEnvelope('m3-invalid-handshake'));
    const invalidHandshakeCompleted = await page.evaluate(() => window.__runnerHandshake?.complete === true);
    await page.evaluate((handshake) => {
      window.__runnerHandshake = handshake;
    }, originalHandshake);

    const cancellationPendingRetired = await page.evaluate(
      (nonce) => !Object.hasOwn(window.__pendingRuns, nonce),
      cancellationNonce,
    );

    const q4 = {
      foreignOriginRejected,
      wrongSourceRejected,
      forgedPassRejected:
        forged?.sourceMatches === true &&
        !(await page.evaluate(
          (nonce) => window.__acceptedResults.some((entry) => entry.data?.nonce === nonce),
          forgedNonce,
        )) &&
        staleOutcome.trustedScore === null,
      staleRevisionRejected: staleOutcome.entry?.data?.result?.sourceRevision === 7 && !staleOutcome.accepted,
      validHandshakeEstablished:
        runnerEnv.handshakeCompleted === true &&
        runnerEnv.handshakeAckMessage?.origin === state.runnerOrigin &&
        runnerEnv.handshakeAckMessage?.sourceMatches === true &&
        runnerEnv.handshakeAckMessage?.data?.protocol === 1 &&
        runnerEnv.handshakeAckMessage?.data?.nonce === runnerEnv.handshakeState?.nonce,
      activeMalformedCaseRejected:
        !activeResultChecks.malformed.accepted &&
        activeResultChecks.malformed.infrastructureError &&
        activeResultChecks.malformed.pendingRetired,
      activeEmptySuiteRejected:
        !activeResultChecks.empty.accepted &&
        activeResultChecks.empty.infrastructureError &&
        activeResultChecks.empty.pendingRetired,
      activePartialSuiteRejected:
        !activeResultChecks.partial.accepted &&
        activeResultChecks.partial.infrastructureError &&
        activeResultChecks.partial.pendingRetired,
      activeDuplicateSuiteRejected:
        !activeResultChecks.duplicate.accepted &&
        activeResultChecks.duplicate.infrastructureError &&
        activeResultChecks.duplicate.pendingRetired,
      activeSparseCasesRejected:
        !activeResultChecks['sparse-cases'].accepted &&
        activeResultChecks['sparse-cases'].infrastructureError &&
        activeResultChecks['sparse-cases'].pendingRetired &&
        activeResultChecks['sparse-cases'].sparseHolePreserved,
      activeSparseDiagnosticsRejected:
        !activeResultChecks['sparse-diagnostics'].accepted &&
        activeResultChecks['sparse-diagnostics'].infrastructureError &&
        activeResultChecks['sparse-diagnostics'].pendingRetired &&
        activeResultChecks['sparse-diagnostics'].sparseHolePreserved,
      activeSparseNestedJsonRejected:
        !activeResultChecks['sparse-nested-json'].accepted &&
        activeResultChecks['sparse-nested-json'].infrastructureError &&
        activeResultChecks['sparse-nested-json'].pendingRetired &&
        activeResultChecks['sparse-nested-json'].sparseHolePreserved,
      activeSparseArrayStructuredCloneEvidence: {
        casesHolePreserved: activeResultChecks['sparse-cases'].sparseHolePreserved,
        casesAccepted: activeResultChecks['sparse-cases'].accepted,
        diagnosticsHolePreserved: activeResultChecks['sparse-diagnostics'].sparseHolePreserved,
        diagnosticsAccepted: activeResultChecks['sparse-diagnostics'].accepted,
        nestedActualHolePreserved: activeResultChecks['sparse-nested-json'].sparseHolePreserved,
        nestedActualAccepted: activeResultChecks['sparse-nested-json'].accepted,
      },
      activeOversizedSuiteRejected:
        !activeResultChecks['oversized-suite'].accepted && activeResultChecks['oversized-suite'].infrastructureError,
      activeOversizedResultRejected:
        !activeResultChecks['oversized-payload'].accepted &&
        activeResultChecks['oversized-payload'].infrastructureError,
      activeWrongProtocolRejected:
        !activeResultChecks['wrong-protocol'].accepted && activeResultChecks['wrong-protocol'].infrastructureError,
      activeWrongContractVersionRejected:
        !activeResultChecks['wrong-contract'].accepted && activeResultChecks['wrong-contract'].infrastructureError,
      activeWrongChallengeRejected:
        !activeResultChecks['wrong-challenge'].accepted && activeResultChecks['wrong-challenge'].infrastructureError,
      activeWrongChallengeVersionRejected:
        !activeResultChecks['wrong-challenge-version'].accepted &&
        activeResultChecks['wrong-challenge-version'].infrastructureError,
      activeWrongExpectedRejected:
        !activeResultChecks['wrong-expected'].accepted && activeResultChecks['wrong-expected'].infrastructureError,
      activeWrongActualRejected:
        !activeResultChecks['wrong-actual'].accepted && activeResultChecks['wrong-actual'].infrastructureError,
      activeNonJsonResultRejected:
        !activeResultChecks['non-json'].accepted && activeResultChecks['non-json'].infrastructureError,
      activeReplayRejected: replayFirst.accepted && replayFirst.pendingRetired && !replayAgain.accepted,
      activeReplayEvidence: {
        firstAccepted: replayFirst.accepted,
        firstRetired: replayFirst.pendingRetired,
        replayAccepted: replayAgain.accepted,
        replayRetired: replayAgain.pendingRetired,
        replayInfrastructureError: replayAgain.infrastructureError,
      },
      replyAfterCancellationRejected: cancellationInitiated && cancellationPendingRetired && !cancellationReplyAccepted,
      missingHandshakeRejected: !missingHandshake.accepted && missingHandshake.infrastructureError,
      invalidHandshakeRejected:
        !invalidHandshake.accepted && invalidHandshake.infrastructureError && !invalidHandshakeCompleted,
      malformedFrameRejected: malformedResponse.data.result.reason === 'policy-rejected',
      runMetadataPreserved:
        response.data.result.runId === 'quickjs-fixture-canonical' &&
        response.data.result.sourceRevision === 7 &&
        response.data.result.challengeId === 'longest-window' &&
        response.data.result.challengeVersion === '1.0.0',
      runnerOrigin: state.runnerOrigin,
      messageEvidence: {
        readyOrigin: readyMessage.origin,
        readySourceMatches: readyMessage.sourceMatches,
        forgedPassSourceMatches: forged?.sourceMatches,
      },
      trustedScore: staleOutcome.trustedScore,
    };
    const q5Final = {
      ...q5,
      pageAndWorkerCspEnforced:
        !state.appProbeRequests &&
        state.workerScriptHeaders.length > 0 &&
        state.workerScriptHeaders.every(
          (value) => value.includes("connect-src 'self'") && !value.includes(state.appOrigin),
        ) &&
        state.appPageCsp.includes(`frame-src ${state.runnerOrigin}`) &&
        state.runnerPageCsp.includes(`frame-ancestors ${state.appOrigin}`),
      staticWasmLoadedUnderCsp: state.wasmRequests > 0,
      crossSiteCookieStorageIsolated:
        inspectRunner.appCookieVisible === false &&
        inspectRunner.appStorageCanary === null &&
        inspectRunner.parentDomDenied === true &&
        inspectRunner.runnerStorageAvailable === true,
      arbitraryNetworkBlocked:
        inspectRunner.pageNetworkBlocked === true &&
        workerEvidence?.workerNetworkBlocked === true &&
        state.appProbeRequests === 0,
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
      quickjs: {
        version: packageJson.dependencies['quickjs-emscripten'],
        license: 'MIT',
        package: 'quickjs-emscripten',
      },
      typescript: { version: TypeScript.version },
      browser: { name: 'Microsoft Edge', version: browser.version(), consoleErrors: consoleErrors.slice(0, 20) },
      fixture: { buildOutput, appOrigin: state.appOrigin, runnerOrigin: state.runnerOrigin },
      q1,
      q2,
      q3,
      q4,
      q5: q5Final,
      q6: {
        browser: {
          responsiveDuringTimeout:
            page.isClosed() === false &&
            loopResponse.data.result.status === 'timeout' &&
            loopTiming.responsiveTicks > 0,
        },
        cleanup,
      },
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
