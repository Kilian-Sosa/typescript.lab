import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadPackage(environmentKey, name) {
  const modulePath = process.env[environmentKey];
  if (!modulePath) throw new Error(`Set ${environmentKey} to the preinstalled ${name} package path.`);
  return require(modulePath);
}

function respond(response, status, contentType, body, headers = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(body);
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    if (!server.listening) return resolve();
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections?.();
  });
}

function sendHtml(response, csp, html) {
  respond(response, 200, 'text/html; charset=utf-8', html, {
    'Content-Security-Policy': csp,
    'Referrer-Policy': 'no-referrer',
  });
}

function makeHostHtml() {
  return '<!doctype html><meta charset="utf-8"><title>Disposable runner probe</title><main><div id="host-marker">App DOM canary</div><textarea id="compiled"></textarea><button id="run">Run probes</button><pre id="results" data-done="false">waiting</pre><script src="/app.js" defer></script></main>';
}

function makeHostScript(runnerOrigin) {
  return `
const runnerOrigin=${JSON.stringify(runnerOrigin)};
const appOrigin=location.origin;
const resultNode=document.querySelector('#results');
const frames=new Map();
function onMessage(event){
 for(const state of frames.values()){
  if(event.source!==state.frame.contentWindow) continue;
  const item={origin:event.origin,data:event.data};
  state.messages.push(item);
  for(const waiter of [...state.waiters]){
   if(!waiter.test(item)) continue;
   clearTimeout(waiter.timer);state.waiters.delete(waiter);waiter.resolve(item);
  }
 }
}
window.addEventListener('message',onMessage);
function waitFor(state,test,timeout=2500){
 const found=state.messages.find(test);if(found)return Promise.resolve(found);
 return new Promise(resolve=>{
  const waiter={test,resolve,timer:setTimeout(()=>{state.waiters.delete(waiter);resolve(null)},timeout)};
  state.waiters.add(waiter);
 });
}
function frame(id,src,sandbox='allow-scripts'){
 const element=document.createElement('iframe');element.title=id;element.setAttribute('sandbox',sandbox);
 const state={id,frame:element,messages:[],waiters:new Set()};frames.set(id,state);
 element.src=src;document.body.append(element);return state;
}
function openAppDb(){return new Promise((resolve,reject)=>{
 const request=indexedDB.open('lab-runner-spike',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('values');
 request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);
});}
async function seedAppCanaries(){
 localStorage.setItem('lab_probe_canary','app-localstorage-canary');
 document.cookie='lab_probe_cookie=app-cookie-canary; Path=/; SameSite=Strict';
 const db=await openAppDb();await new Promise((resolve,reject)=>{
  const tx=db.transaction('values','readwrite');tx.objectStore('values').put('app-idb-canary','auth-probe');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });db.close();
}
async function probeWorkerOnly(){
 const worker=new Worker('/app-worker.js');
 const capabilities=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('same-origin worker capability timeout')),2500);
  worker.onerror=()=>reject(Error('same-origin worker failed'));
  worker.onmessage=event=>{if(event.data.kind==='capabilities'){clearTimeout(timer);resolve(event.data)}};
  worker.postMessage({kind:'read'});
 });
 const loop=await new Promise(resolve=>{
  const timer=setTimeout(()=>{worker.terminate();resolve({loopStarted:false,loopTerminated:true,hostResponsive:true})},2000);
  worker.onmessage=event=>{if(event.data.kind!=='loop-started')return;const start=performance.now();
   setTimeout(()=>{worker.terminate();clearTimeout(timer);resolve({loopStarted:true,loopTerminated:true,hostResponsive:performance.now()-start<1000})},150);
  };
  worker.postMessage({kind:'loop'});
 });
 return {...capabilities,...loop};
}
async function probeFrames(compiledSource){
 const opaque=frame('opaque','/opaque.html');
 const opaqueControl=frame('opaque-control','/opaque.html?control=1');
 const opaqueDone=waitFor(opaque,item=>item.data?.kind==='complete');
 const controlDone=waitFor(opaqueControl,item=>item.data?.kind==='complete');
 const opaqueResult=await opaqueDone;const controlResult=await controlDone;

 const isolated=frame('isolated-runner',runnerOrigin+'/isolated.html','allow-scripts allow-same-origin');
 const ready=await waitFor(isolated,item=>item.data?.kind==='ready',3500);
 async function runSource(source,probe){
  const result=waitFor(isolated,item=>item.data?.kind==='worker'&&item.data.payload?.probe===probe,2500);
  isolated.frame.contentWindow.postMessage({kind:'run-source',source},runnerOrigin);
  return result;
 }
 const typedSource=await runSource(compiledSource,'typed-source');
 const workerNetwork=await runSource(
  '(async()=>{try{await fetch('+JSON.stringify(appOrigin)+"+'/probe-hit?mode=isolated-worker',{method:'POST',body:'probe-only'});postMessage({probe:'worker-network',outcome:'allowed'})}catch(error){postMessage({probe:'worker-network',outcome:'blocked',name:error.name})}})()",
  'worker-network');
 const workerStorage=await runSource(
  "postMessage({probe:'worker-storage',indexedDbAvailable:typeof indexedDB==='object'})",'worker-storage');
 const imports=await runSource(
  "try{importScripts('/nested-import.js');postMessage({probe:'imports',outcome:'allowed'})}catch(error){postMessage({probe:'imports',outcome:'blocked',name:error.name})}",'imports');
 const dynamicImport=await runSource(
  "import('/dynamic-import.js').then(()=>postMessage({probe:'dynamic-import',outcome:'allowed'})).catch(error=>postMessage({probe:'dynamic-import',outcome:'blocked',name:error.name}))",
  'dynamic-import');
 const nestedWorker=await runSource(
  "try{const child=new Worker('/nested-worker.js');child.onmessage=()=>{child.terminate();postMessage({probe:'nested-worker',outcome:'allowed'})};child.onerror=()=>postMessage({probe:'nested-worker',outcome:'blocked'});setTimeout(()=>{child.terminate();postMessage({probe:'nested-worker',outcome:'timeout'})},350)}catch(error){postMessage({probe:'nested-worker',outcome:'blocked',name:error.name})}",
  'nested-worker');
 const loopPromise=waitFor(isolated,item=>item.data?.kind==='loop-terminated',2500);
 isolated.frame.contentWindow.postMessage({kind:'run-source',source:"postMessage({probe:'loop-started'});while(true){}"},runnerOrigin);
 const loop=await loopPromise;

 const sameHostCookie=await probeCookieAtDifferentPort();
 const sameHostDetails=sameHostCookie?.data?.summary??null;
 for(const state of [opaque,opaqueControl,isolated,sameHostCookie?.state].filter(Boolean))state.frame.remove();
 return {
  opaque:{origin:opaqueResult?.origin??null,summary:opaqueResult?.data?.summary??null,spoofedPass:opaque.messages.some(item=>item.data?.kind==='spoof-grade')},
  opaqueControl:{origin:controlResult?.origin??null,summary:controlResult?.data?.summary??null,requestObserved:true},
  isolated:{
   ready:Boolean(ready),origin:isolated.messages.find(item=>item.data?.kind==='ready')?.origin??null,
   summary:isolated.messages.find(item=>item.data?.kind==='capabilities')?.data?.summary??null,
   spoofedPass:isolated.messages.some(item=>item.data?.kind==='spoof-grade'),
   typed:typedSource?.data?.payload??null,network:workerNetwork?.data?.payload??null,
   workerStorage:workerStorage?.data?.payload??null,imports:imports?.data?.payload??null,
   dynamicImport:dynamicImport?.data?.payload??null,nestedWorker:nestedWorker?.data?.payload??null,
   loopTerminated:Boolean(loop),hostResponsive:loop?.data?.responsive??false,
  },
  sameHostDifferentPortCookie:sameHostDetails,
 };
 async function probeCookieAtDifferentPort(){
  const state=frame('same-host-different-port',runnerOrigin+'/cookie-check.html','allow-scripts allow-same-origin');
  const done=await waitFor(state,item=>item.data?.kind==='cookie-check',2500);
  return done?{...done,state}:null;
 }
}
document.querySelector('#run').addEventListener('click',async()=>{
 const button=document.querySelector('#run');button.disabled=true;
 try{
  await seedAppCanaries();const workerOnly=await probeWorkerOnly();
  const frames=await probeFrames(document.querySelector('#compiled').value);
  const events=await (await fetch('/probe-events')).json();
  resultNode.textContent=JSON.stringify({workerOnly,frames,events});
 }catch(error){resultNode.textContent=JSON.stringify({error:String(error),stack:error.stack});}
 resultNode.dataset.done='true';
});
`;
}

function opaqueDocument(appOrigin, control) {
  const nonce = 'runner-spike-bootstrap';
  const mode = control ? 'opaque-control' : 'opaque-protected';
  const connect = control ? appOrigin : "'none'";
  const csp = `default-src 'none'; script-src 'nonce-${nonce}'; connect-src ${connect}; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${appOrigin}`;
  const source = `(async()=>{
 const summary={};
 try{localStorage.getItem('lab_probe_canary');summary.localStorageDenied=false}catch(error){summary.localStorageDenied=error.name==='SecurityError';summary.localStorageError=error.name}
 try{indexedDB.open('lab-runner-spike');summary.indexedDbDenied=false}catch(error){summary.indexedDbDenied=error.name==='SecurityError';summary.indexedDbError=error.name}
 try{parent.document.querySelector('#host-marker').textContent;summary.parentDomDenied=false}catch(error){summary.parentDomDenied=error.name==='SecurityError';summary.parentDomError=error.name}
 try{await fetch(${JSON.stringify(appOrigin)}+'/probe-hit?mode=${mode}',{method:'POST',mode:'no-cors',body:'probe-only'});summary.networkBlocked=false}catch(error){summary.networkBlocked=true;summary.networkError=error.name}
 parent.postMessage({kind:'capabilities',summary},'*');
 parent.postMessage({kind:'spoof-grade',status:'passed',passedCases:3,totalCases:3},'*');
 parent.postMessage({kind:'complete',summary},'*');
})().catch(error=>parent.postMessage({kind:'error',message:String(error)},'*'));`;
  return {
    csp,
    html: `<!doctype html><meta charset="utf-8"><title>Opaque origin probe</title><script nonce="${nonce}">${source}</script>`,
  };
}

function makeIsolatedPageScript(appOrigin) {
  return `
const appOrigin=${JSON.stringify(appOrigin)};
function send(kind,extra={}){parent.postMessage({kind,...extra},'*')}
function parentDomDenied(){try{parent.document.querySelector('#host-marker').textContent;return false}catch(error){return error.name==='SecurityError'}}
function readRunnerStorage(){return new Promise((resolve)=>{
 let request;try{request=indexedDB.open('lab-runner-spike',1)}catch(error){resolve({available:false,error:error.name});return}
 request.onupgradeneeded=()=>request.result.createObjectStore('runner-values');
 request.onerror=()=>resolve({available:false,error:request.error?.name});
 request.onsuccess=()=>{const db=request.result;const hasAppStore=db.objectStoreNames.contains('values');
  if(!hasAppStore){db.close();resolve({available:true,appCanaryFound:false});return}
  const tx=db.transaction('values');const get=tx.objectStore('values').get('auth-probe');
  get.onsuccess=()=>{db.close();resolve({available:true,appCanaryFound:get.result==='app-idb-canary'})};
  get.onerror=()=>{db.close();resolve({available:true,readError:get.error?.name})};
 };
})}
let worker;try{worker=new Worker('/runner-worker.js')}catch(error){send('error',{message:'worker construction failed: '+error.name})}
if(worker){
 worker.onmessage=event=>{const payload=event.data;if(payload?.probe==='loop-started'){
  const started=performance.now();setTimeout(()=>{worker.terminate();send('loop-terminated',{responsive:performance.now()-started<1000})},150)
 }send('worker',{payload})};
 worker.onerror=event=>send('worker-error',{message:event.message});
 addEventListener('message',event=>{if(event.source!==parent||event.origin!==appOrigin)return;
  if(event.data?.kind==='run-source'&&typeof event.data.source==='string')worker.postMessage({kind:'run',source:event.data.source})
 });
}
(async()=>{
 let appStorageUnavailable=false;try{appStorageUnavailable=localStorage.getItem('lab_probe_canary')===null}catch(error){appStorageUnavailable=error.name==='SecurityError'}
 let pageNetworkBlocked=false;try{await fetch(appOrigin+'/probe-hit?mode=isolated-frame',{method:'POST',body:'probe-only'})}catch{pageNetworkBlocked=true}
 const runnerDb=await readRunnerStorage();const summary={parentDomDenied:parentDomDenied(),appStorageUnavailable,
  runnerLocalStorageAvailable:(()=>{try{localStorage.setItem('runner-canary','local');return localStorage.getItem('runner-canary')==='local'}catch{return false}})(),
  appCookieVisible:document.cookie.includes('lab_probe_cookie=app-cookie-canary'),pageNetworkBlocked,runnerDb};
 send('capabilities',{summary});send('spoof-grade',{status:'passed',passedCases:3,totalCases:3});send('ready');
})().catch(error=>send('error',{message:String(error)}));
`;
}

function cookieCheckHtml() {
  return `<!doctype html><meta charset="utf-8"><script>
parent.postMessage({kind:'cookie-check',summary:{cookieVisible:document.cookie.includes('lab_probe_cookie=app-cookie-canary')}},'*');
</script>`;
}

function makeRunnerWorker() {
  return `self.addEventListener('message',event=>{
 if(event.data?.kind!=='run'||typeof event.data.source!=='string')return;
 try{(0,eval)(event.data.source)}catch(error){self.postMessage({probe:'source-error',name:error.name,message:error.message})}
});`;
}

function makeAppServer(state) {
  return createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/probe-hit') {
      state.events.push({
        mode: url.searchParams.get('mode'),
        origin: request.headers.origin ?? null,
        cookieSent: String(request.headers.cookie ?? '').includes('lab_probe_cookie=app-cookie-canary'),
      });
      respond(response, 200, 'application/json', '{"ok":true}');
      return;
    }
    if (url.pathname === '/probe-events') {
      respond(response, 200, 'application/json', JSON.stringify(state.events));
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const csp = `default-src 'none'; script-src 'self'; connect-src 'self'; worker-src 'self'; frame-src 'self' ${state.runnerOrigin}; object-src 'none'; base-uri 'none'; form-action 'none'`;
      sendHtml(response, csp, makeHostHtml());
      return;
    }
    if (url.pathname === '/app.js') {
      respond(response, 200, 'text/javascript; charset=utf-8', makeHostScript(state.runnerOrigin));
      return;
    }
    if (url.pathname === '/opaque.html') {
      const opaque = opaqueDocument(state.appOrigin, url.searchParams.has('control'));
      sendHtml(response, opaque.csp, opaque.html);
      return;
    }
    if (url.pathname === '/cookie-check.html') {
      sendHtml(
        response,
        `default-src 'none'; script-src 'unsafe-inline'; frame-ancestors ${state.appOrigin}`,
        cookieCheckHtml(),
      );
      return;
    }
    if (url.pathname === '/app-worker.js') {
      respond(
        response,
        200,
        'text/javascript; charset=utf-8',
        `
function readCanary(){return new Promise((resolve,reject)=>{const req=indexedDB.open('lab-runner-spike');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;const get=db.transaction('values').objectStore('values').get('auth-probe');get.onsuccess=()=>{db.close();resolve(get.result)};get.onerror=()=>reject(get.error)}})}
self.onmessage=async event=>{if(event.data?.kind==='read'){
 const indexedDbCanary=await readCanary();const response=await fetch('/probe-hit?mode=worker-only',{method:'POST',credentials:'same-origin',body:'probe-only'});
 self.postMessage({kind:'capabilities',domUnavailable:typeof document==='undefined',indexedDbCanary,sameOriginFetchOk:response.ok})
 }if(event.data?.kind==='loop'){self.postMessage({kind:'loop-started'});while(true){}}};`,
      );
      return;
    }
    respond(response, 404, 'text/plain; charset=utf-8', 'not found');
  });
}

function makeRunnerServer(state) {
  return createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/probe-hit') {
      state.events.push({ mode: url.searchParams.get('mode'), origin: request.headers.origin ?? null });
      respond(response, 200, 'application/json', '{"ok":true}');
      return;
    }
    if (url.pathname === '/isolated.html') {
      const csp = `default-src 'none'; script-src 'self'; connect-src 'none'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${state.appOrigin}`;
      sendHtml(
        response,
        csp,
        '<!doctype html><meta charset="utf-8"><title>Isolated runner</title><script src="/isolated.js" defer></script>',
      );
      return;
    }
    if (url.pathname === '/cookie-check.html') {
      sendHtml(
        response,
        `default-src 'none'; script-src 'unsafe-inline'; frame-ancestors ${state.appOrigin}`,
        cookieCheckHtml(),
      );
      return;
    }
    if (url.pathname === '/isolated.js') {
      respond(response, 200, 'text/javascript; charset=utf-8', makeIsolatedPageScript(state.appOrigin));
      return;
    }
    if (url.pathname === '/runner-worker.js') {
      respond(response, 200, 'text/javascript; charset=utf-8', makeRunnerWorker(), {
        'Content-Security-Policy':
          "default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'",
      });
      return;
    }
    if (
      url.pathname === '/nested-worker.js' ||
      url.pathname === '/nested-import.js' ||
      url.pathname === '/dynamic-import.js'
    ) {
      state.events.push({ mode: url.pathname.slice(1) + '-loaded' });
      respond(response, 200, 'text/javascript; charset=utf-8', 'postMessage({probe:"unexpected-script-execution"});');
      return;
    }
    respond(response, 404, 'text/plain; charset=utf-8', 'not found');
  });
}

export async function runSpike() {
  const { chromium } = loadPackage('LAB_RUNNER_PLAYWRIGHT_MODULE', 'Playwright');
  const typescript = loadPackage('LAB_RUNNER_TYPESCRIPT_MODULE', 'TypeScript');
  if (typescript.version !== '5.9.3') throw new Error(`Expected TypeScript 5.9.3; received ${typescript.version}.`);

  const compiled = typescript.transpileModule(
    "const answer: number = 6 * 7; postMessage({probe:'typed-source',value:answer});",
    {
      reportDiagnostics: true,
      compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.None },
    },
  );
  const invalidType = typescript.transpileModule('const answer: number = "not-a-number";', {
    reportDiagnostics: true,
    compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.None },
  });

  const appState = { appOrigin: null, runnerOrigin: null, events: [] };
  const runnerState = { appOrigin: null, events: [] };
  const appServer = makeAppServer(appState);
  const runnerServer = makeRunnerServer(runnerState);
  let browser;
  let context;
  let browserClosed = false;
  let contextClosed = false;
  let serversClosed;
  let evidence;
  let failure;
  try {
    const appPort = await listen(appServer);
    const runnerPort = await listen(runnerServer);
    appState.appOrigin = `http://127.0.0.1:${appPort}`;
    runnerState.appOrigin = appState.appOrigin;
    appState.runnerOrigin = `http://127.0.0.1:${runnerPort}`;
    runnerState.runnerOrigin = appState.runnerOrigin;

    browser = await chromium.launch({ channel: 'msedge', headless: true });
    context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(`${appState.appOrigin}/`, { waitUntil: 'load' });
    await page.locator('#compiled').fill(compiled.outputText);
    await page.getByRole('button', { name: 'Run probes' }).click();
    await page.locator('#results[data-done="true"]').waitFor({ timeout: 15000 });
    const probe = JSON.parse(await page.locator('#results').textContent());
    const appEvents = await page.evaluate(async () => (await fetch('/probe-events')).json());
    const runnerEvents = runnerState.events;
    const request = (mode) => appEvents.find((event) => event.mode === mode);
    const isolated = probe.frames?.isolated ?? {};
    const isolatedSummary = isolated.summary ?? {};
    const opaqueSummary = probe.frames?.opaque?.summary ?? {};
    evidence = {
      browser: { engine: 'Microsoft Edge', channel: 'msedge', version: browser.version() },
      origins: { app: appState.appOrigin, runner: appState.runnerOrigin },
      workerOnly: {
        domUnavailable: probe.workerOnly?.domUnavailable,
        indexedDbCanary: probe.workerOnly?.indexedDbCanary,
        sameOriginRequestObserved: Boolean(request('worker-only')),
        cookieSent: request('worker-only')?.cookieSent ?? false,
        loopStarted: probe.workerOnly?.loopStarted,
        loopTerminated: probe.workerOnly?.loopTerminated,
        hostResponsive: probe.workerOnly?.hostResponsive,
      },
      opaqueIframe: {
        messageOrigin: probe.frames?.opaque?.origin,
        localStorageDenied: opaqueSummary.localStorageDenied,
        indexedDbDenied: opaqueSummary.indexedDbDenied,
        parentDomDenied: opaqueSummary.parentDomDenied,
        networkBlocked: opaqueSummary.networkBlocked,
        networkRequestObserved: Boolean(request('opaque-protected')),
        spoofedPassReceived: probe.frames?.opaque?.spoofedPass,
      },
      opaqueControl: {
        messageOrigin: probe.frames?.opaqueControl?.origin,
        networkRequestObserved: Boolean(request('opaque-control')),
        requestOrigin: request('opaque-control')?.origin ?? null,
      },
      isolatedRunner: {
        messageOrigin: isolated.origin,
        parentDomDenied: isolatedSummary.parentDomDenied,
        appStorageUnavailable: isolatedSummary.appStorageUnavailable,
        runnerLocalStorageAvailable: isolatedSummary.runnerLocalStorageAvailable,
        appCookieVisible: isolatedSummary.appCookieVisible,
        runnerDb: isolatedSummary.runnerDb,
        pageNetworkBlocked: isolatedSummary.pageNetworkBlocked,
        pageNetworkRequestObserved: Boolean(request('isolated-frame')),
        workerNetworkBlocked: isolated.network?.outcome === 'blocked',
        workerNetworkRequestObserved: Boolean(request('isolated-worker')),
        workerIndexedDbAvailable: isolated.workerStorage?.indexedDbAvailable,
        nestedWorkerOutcome: isolated.nestedWorker?.outcome ?? null,
        nestedWorkerScriptLoaded: runnerEvents.some((event) => event.mode === 'nested-worker.js-loaded'),
        importOutcome: isolated.imports?.outcome ?? null,
        importScriptLoaded: runnerEvents.some((event) => event.mode === 'nested-import.js-loaded'),
        dynamicImportOutcome: isolated.dynamicImport?.outcome ?? null,
        dynamicImportScriptLoaded: runnerEvents.some((event) => event.mode === 'dynamic-import.js-loaded'),
        loopTerminated: isolated.loopTerminated,
        hostResponsive: isolated.hostResponsive,
        spoofedPassReceived: isolated.spoofedPass,
        typedSourceRan: isolated.typed?.probe === 'typed-source',
        typedResult: isolated.typed?.value,
      },
      sameHostDifferentPortCookie: probe.frames?.sameHostDifferentPortCookie,
      typescript: {
        version: typescript.version,
        outputProduced: compiled.outputText.length > 0,
        typedOutputRan: isolated.typed?.probe === 'typed-source',
        typedResult: isolated.typed?.value,
        invalidTypeOutputProduced: invalidType.outputText.length > 0,
        invalidTypeSemanticDiagnostics: (invalidType.diagnostics ?? []).filter(
          (diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error,
        ).length,
      },
      requestLog: appEvents,
      runnerRequestLog: runnerEvents,
    };
    await context.close();
    contextClosed = true;
  } catch (error) {
    failure = error;
  } finally {
    if (context && !contextClosed) {
      await context.close();
      contextClosed = true;
    }
    if (browser) {
      await browser.close();
      browserClosed = true;
    }
    await Promise.all([close(appServer), close(runnerServer)]);
    serversClosed = true;
  }
  if (failure) throw failure;
  return { ...evidence, cleanup: { contextClosed, browserClosed, serversClosed } };
}
