import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const probeModule = await import('./probe.mjs').catch(() => null);
const evidence = typeof probeModule?.runSpike === 'function'
  ? await probeModule.runSpike()
  : {};
const evidencePath = fileURLToPath(new URL('../../docs/prompts/track-c-evidence.json', import.meta.url));
mkdirSync(dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(`Full runner probe evidence: ${evidencePath}`);

test('runner security spike exports the browser probe', () => {
  assert.equal(typeof probeModule?.runSpike, 'function');
});

test('a same-origin worker can reach app-origin storage and authenticated network', () => {
  assert.equal(evidence.workerOnly?.domUnavailable, true);
  assert.equal(evidence.workerOnly?.indexedDbCanary, 'app-idb-canary');
  assert.equal(evidence.workerOnly?.sameOriginRequestObserved, true);
  assert.equal(evidence.workerOnly?.cookieSent, true);
  assert.equal(evidence.workerOnly?.loopTerminated, true);
  assert.equal(evidence.workerOnly?.hostResponsive, true);
});

test('a sandboxed opaque-origin iframe blocks app state and CSP network but can spoof a result', () => {
  assert.equal(evidence.opaqueIframe?.messageOrigin, 'null');
  assert.equal(evidence.opaqueIframe?.localStorageDenied, true);
  assert.equal(evidence.opaqueIframe?.indexedDbDenied, true);
  assert.equal(evidence.opaqueIframe?.parentDomDenied, true);
  assert.equal(evidence.opaqueIframe?.networkBlocked, true);
  assert.equal(evidence.opaqueIframe?.networkRequestObserved, false);
  assert.equal(evidence.opaqueIframe?.spoofedPassReceived, true);
  assert.equal(evidence.opaqueControl?.networkRequestObserved, true);
  assert.equal(evidence.opaqueControl?.requestOrigin, 'null');
});

test('a separate-origin iframe and worker isolate origin storage and constrain execution', () => {
  assert.equal(evidence.isolatedRunner?.parentDomDenied, true);
  assert.equal(evidence.isolatedRunner?.appStorageUnavailable, true);
  assert.equal(evidence.isolatedRunner?.runnerLocalStorageAvailable, true);
  assert.equal(evidence.isolatedRunner?.runnerDb?.available, true);
  assert.equal(evidence.isolatedRunner?.runnerDb?.appCanaryFound, false);
  assert.equal(evidence.isolatedRunner?.pageNetworkBlocked, true);
  assert.equal(evidence.isolatedRunner?.pageNetworkRequestObserved, false);
  assert.equal(evidence.isolatedRunner?.workerNetworkBlocked, true);
  assert.equal(evidence.isolatedRunner?.workerNetworkRequestObserved, false);
  assert.equal(evidence.isolatedRunner?.workerIndexedDbAvailable, true);
  assert.equal(evidence.isolatedRunner?.nestedWorkerOutcome, 'blocked');
  assert.equal(evidence.isolatedRunner?.nestedWorkerScriptLoaded, false);
  assert.equal(evidence.isolatedRunner?.importOutcome, 'blocked');
  assert.equal(evidence.isolatedRunner?.importScriptLoaded, false);
  assert.equal(evidence.isolatedRunner?.dynamicImportOutcome, 'blocked');
  assert.equal(evidence.isolatedRunner?.dynamicImportScriptLoaded, false);
  assert.equal(evidence.isolatedRunner?.loopTerminated, true);
  assert.equal(evidence.isolatedRunner?.hostResponsive, true);
  assert.equal(evidence.isolatedRunner?.spoofedPassReceived, true);
  assert.equal(evidence.isolatedRunner?.appCookieVisible, true);
  assert.equal(evidence.sameHostDifferentPortCookie?.cookieVisible, true);
});

test('TypeScript transpilation runs typed output but does not type-check it', () => {
  assert.equal(evidence.typescript?.version, '5.9.3');
  assert.equal(evidence.typescript?.outputProduced, true);
  assert.equal(evidence.typescript?.typedOutputRan, true);
  assert.equal(evidence.typescript?.typedResult, 42);
  assert.equal(evidence.typescript?.invalidTypeOutputProduced, true);
  assert.equal(evidence.typescript?.invalidTypeSemanticDiagnostics, 0);
});

test('the disposable browser and loopback servers are cleaned up', () => {
  assert.equal(evidence.cleanup?.browserClosed, true);
  assert.equal(evidence.cleanup?.serversClosed, true);
});
