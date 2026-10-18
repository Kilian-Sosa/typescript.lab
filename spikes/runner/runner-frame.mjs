const APP_ORIGIN = window.__RUNNER_APP_ORIGIN__;
const PROTOCOL_VERSION = 1;
const HARD_WORKER_TIMEOUT_MS = 3000;
const MAX_SOURCE_BYTES = 32 * 1024;
const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_CASES = 100;
const activeWorkers = new Map();
const metrics = {
  workersCreated: 0,
  workersTerminated: 0,
  activeWorkers: 0,
  maxActiveWorkers: 0,
  lastPayloadKeys: [],
  lastWorkerId: null,
};
let handshakeComplete = false;
let handshakeNonce = null;
window.__runnerMetrics = metrics;

function bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function isPlainJson(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isPlainJson(item, seen))
    : Object.getPrototypeOf(value) === Object.prototype
      && Object.values(value).every((item) => isPlainJson(item, seen));
  seen.delete(value);
  return valid;
}

function equalJson(left, right) {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) {
    return left.length === right.length && left.every((value, index) => equalJson(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && equalJson(left[key], right[key]));
}

function validRequest(message) {
  if (!message || message.protocol !== PROTOCOL_VERSION || message.kind !== 'run'
    || typeof message.nonce !== 'string' || message.nonce.length < 16 || message.nonce.length > 128
    || typeof message.runId !== 'string' || message.runId.length < 1 || message.runId.length > 128
    || message.challengeId !== 'longest-window' || message.challengeVersion !== '1.0.0'
    || !Number.isInteger(message.sourceRevision) || message.sourceRevision < 0
    || typeof message.source !== 'string' || !Array.isArray(message.cases)
    || message.cases.length === 0 || message.cases.length > MAX_CASES) return 'Invalid run envelope.';
  if (bytes(message.source) > MAX_SOURCE_BYTES) return 'Source exceeds 32 KiB.';
  if (!message.cases.every((item) => item && typeof item.id === 'string'
    && item.input && Array.isArray(item.input.events)
    && item.input.events.every((event) => typeof event === 'string')
    && typeof item.input.k === 'number' && Number.isFinite(item.input.k)
    && Object.hasOwn(item, 'expected') && isPlainJson(item.input) && isPlainJson(item.expected))) {
    return 'Challenge cases must contain valid JSON inputs and expected values.';
  }
  const inputs = JSON.stringify(message.cases.map(({ id, input }) => ({ id, input })));
  if (bytes(inputs) > MAX_INPUT_BYTES) return 'Serialized inputs exceed 1 MiB.';
  return null;
}

function noRunCases(cases) {
  return cases.map((item) => ({ caseId: item?.id ?? 'unknown', status: 'not-run' }));
}

function mapWorkerCases(cases, workerResult, diagnostics) {
  const workerCases = Array.isArray(workerResult?.cases) ? workerResult.cases : [];
  return cases.map((testCase, index) => {
    const actual = workerCases[index];
    if (!actual || actual.caseId !== testCase.id) return { caseId: testCase.id, status: 'not-run' };
    if (actual.status === 'actual') {
      return equalJson(actual.actual, testCase.expected)
        ? { caseId: testCase.id, status: 'passed', expected: testCase.expected, actual: actual.actual }
        : { caseId: testCase.id, status: 'failed', expected: testCase.expected, actual: actual.actual };
    }
    if (actual.status === 'timeout') return { caseId: testCase.id, status: 'timeout', message: diagnostics[0] };
    if (actual.status === 'execution-error') return { caseId: testCase.id, status: 'execution-error', message: diagnostics[0] };
    return { caseId: testCase.id, status: 'not-run' };
  });
}

function resultEnvelope(request, workerResult, fallbackStatus = null) {
  const cases = request.cases ?? [];
  let status = fallbackStatus ?? workerResult?.status ?? 'infrastructure-error';
  let reason;
  let caseResults = noRunCases(cases);
  const diagnostics = Array.isArray(workerResult?.diagnostics)
    ? workerResult.diagnostics.slice(0, 20).map((message) => String(message).slice(0, 2000))
    : [];

  if (status === 'policy-rejected') {
    status = 'execution-error';
    reason = 'policy-rejected';
  } else if (status === 'execution-error') {
    reason = 'runtime-error';
  } else if (status === 'cancelled') {
    status = 'execution-error';
    reason = 'cancelled';
  } else if (!['ok', 'compile-error', 'timeout', 'infrastructure-error'].includes(status)) {
    status = 'infrastructure-error';
    diagnostics.push('Runner returned an unsupported status.');
  }

  if (['ok', 'execution-error', 'timeout'].includes(workerResult?.status)) {
    caseResults = mapWorkerCases(cases, workerResult, diagnostics);
  }
  if (status === 'ok') {
    status = caseResults.every((item) => item.status === 'passed') ? 'passed'
      : caseResults.some((item) => item.status === 'execution-error') ? 'execution-error'
        : caseResults.some((item) => item.status === 'timeout') ? 'timeout' : 'failed';
    if (status === 'execution-error') reason = 'runtime-error';
  }
  const runResult = {
    contractVersion: '1.0.0',
    runId: request.runId,
    challengeId: request.challengeId,
    challengeVersion: request.challengeVersion,
    sourceRevision: request.sourceRevision,
    status,
    cases: caseResults,
    diagnostics,
  };
  if (reason) runResult.reason = reason;
  const output = {
    protocol: PROTOCOL_VERSION,
    kind: 'run-result',
    nonce: request.nonce,
    result: runResult,
    testEvidence: {
      workerNetworkBlocked: workerResult?.workerNetworkBlocked,
      workerId: workerResult?.workerId,
      workerPayloadKeys: workerResult?.workerPayloadKeys ?? [],
      hasExpectedValues: workerResult?.hasExpectedValues,
      runtimeMs: workerResult?.runtimeMs,
      quickjsVersion: workerResult?.quickjsVersion,
      termination: workerResult?.termination,
    },
  };
  if (bytes(JSON.stringify(output)) > MAX_OUTPUT_BYTES) {
    output.result = {
      contractVersion: '1.0.0',
      runId: request.runId,
      challengeId: request.challengeId,
      challengeVersion: request.challengeVersion,
      sourceRevision: request.sourceRevision,
      status: 'execution-error',
      reason: 'policy-rejected',
      cases: noRunCases(cases),
      diagnostics: ['Serialized output exceeds 64 KiB.'],
    };
    output.testEvidence = {};
  }
  return output;
}

function sendToParent(message) {
  parent.postMessage(message, APP_ORIGIN);
}

function finishWorker(state, workerResult, fallbackStatus = null, termination = 'worker-response') {
  if (state.finished) return;
  state.finished = true;
  clearTimeout(state.hardTimer);
  if (state.worker) {
    state.worker.terminate();
    state.worker = null;
    metrics.workersTerminated += 1;
    activeWorkers.delete(state.key);
    metrics.activeWorkers = activeWorkers.size;
  }
  const response = resultEnvelope(state.request, { ...workerResult, termination }, fallbackStatus);
  sendToParent(response);
}

function beginRun(request, { testDisableVmInterrupt = false } = {}) {
  const error = validRequest(request);
  if (error) {
    sendToParent(resultEnvelope({
      protocol: request?.protocol ?? PROTOCOL_VERSION,
      kind: 'run',
      nonce: request?.nonce ?? '',
      runId: request?.runId ?? 'invalid',
      challengeId: request?.challengeId ?? 'longest-window',
      challengeVersion: request?.challengeVersion ?? '1.0.0',
      sourceRevision: Number.isInteger(request?.sourceRevision) ? request.sourceRevision : 0,
      source: '',
      cases: Array.isArray(request?.cases) ? request.cases.slice(0, MAX_CASES) : [],
    }, { status: 'policy-rejected', diagnostics: [error] }));
    return;
  }
  if (!handshakeComplete) {
    sendToParent(resultEnvelope(request, {
      status: 'infrastructure-error',
      diagnostics: ['Runner handshake is required before execution.'],
    }, 'infrastructure-error'));
    return;
  }
  const key = `${request.runId}:${request.nonce}`;
  if (activeWorkers.has(key)) return;
  if (activeWorkers.size > 0) {
    sendToParent(resultEnvelope(request, {
      status: 'policy-rejected',
      diagnostics: ['Runner is busy; retry after the active run completes.'],
    }, 'policy-rejected'));
    return;
  }

  let worker;
  try {
    worker = new Worker(new URL('./quickjs.worker.mjs', import.meta.url), { type: 'module', name: `quickjs-${request.runId}` });
  } catch (error) {
    sendToParent(resultEnvelope(request, { status: 'infrastructure-error', diagnostics: [String(error?.message ?? error)] }));
    return;
  }

  const state = { key, request, worker, workerId: null, finished: false, hardTimer: null };
  activeWorkers.set(key, state);
  metrics.workersCreated += 1;
  metrics.activeWorkers = activeWorkers.size;
  metrics.maxActiveWorkers = Math.max(metrics.maxActiveWorkers, metrics.activeWorkers);
  metrics.lastWorkerId = `${request.runId}-${metrics.workersCreated}`;
  state.workerId = metrics.lastWorkerId;
  state.hardTimer = setTimeout(() => {
    finishWorker(state, { status: 'timeout', diagnostics: ['Independent Worker deadline exceeded.'] }, 'timeout', 'supervisor-deadline');
  }, HARD_WORKER_TIMEOUT_MS);
  worker.onmessage = (event) => {
    const message = event.data;
    if (!message || message.kind !== 'result' || message.runId !== request.runId
      || message.sourceRevision !== request.sourceRevision || message.workerId !== state.workerId
      || message.hasExpectedValues !== false) {
      finishWorker(state, { status: 'infrastructure-error', diagnostics: ['Worker protocol validation failed.'] }, 'infrastructure-error');
      return;
    }
    metrics.lastPayloadKeys = message.workerPayloadKeys ?? [];
    finishWorker(state, message, null, 'worker-response');
  };
  worker.onerror = (event) => {
    event.preventDefault();
    const details = [event.message, event.filename, event.lineno && `line ${event.lineno}`, event.colno && `column ${event.colno}`]
      .filter(Boolean).join(' ').slice(0, 1000);
    finishWorker(state, {
      status: 'infrastructure-error',
      diagnostics: [details ? `Worker execution failed to load or crashed: ${details}` : 'Worker execution failed to load or crashed.'],
    }, 'infrastructure-error');
  };
  worker.onmessageerror = () => {
    finishWorker(state, { status: 'infrastructure-error', diagnostics: ['Worker returned an unserializable message.'] }, 'infrastructure-error');
  };

  const workerPayload = {
    kind: 'run',
    workerId: state.workerId,
    runId: request.runId,
    sourceRevision: request.sourceRevision,
    source: request.source,
    cases: request.cases.map(({ id, input }) => ({ id, input })),
    probeUrl: `${APP_ORIGIN}/probe-target`,
    ...(testDisableVmInterrupt ? { testDisableVmInterrupt: true } : {}),
  };
  try {
    worker.postMessage(workerPayload);
  } catch (error) {
    finishWorker(state, { status: 'infrastructure-error', diagnostics: [String(error?.message ?? error)] }, 'infrastructure-error');
  }
}

function cancelRun(message) {
  if (!handshakeComplete || message.protocol !== PROTOCOL_VERSION || message.kind !== 'cancel'
    || typeof message.nonce !== 'string' || typeof message.runId !== 'string'
    || !Number.isInteger(message.sourceRevision)) return;
  const key = `${message.runId}:${message.nonce}`;
  const state = activeWorkers.get(key);
  if (!state || message.sourceRevision !== state.request.sourceRevision) return;
  finishWorker(state, { status: 'cancelled', diagnostics: ['Run cancelled by the parent.'] }, 'cancelled', 'cancelled');
}

window.addEventListener('message', (event) => {
  if (event.source !== parent || event.origin !== APP_ORIGIN) return;
  const message = event.data;
  if (!message || typeof message !== 'object' || Array.isArray(message)) return;
  if (message.kind === 'handshake') {
    if (message.protocol !== PROTOCOL_VERSION || typeof message.nonce !== 'string'
      || message.nonce.length < 16 || message.nonce.length > 128 || handshakeComplete) return;
    handshakeNonce = message.nonce;
    handshakeComplete = true;
    sendToParent({ protocol: PROTOCOL_VERSION, kind: 'handshake-ack', nonce: handshakeNonce });
    return;
  }
  if (message.kind === 'test-parent-message' && message.message && typeof message.message === 'object') {
    sendToParent(message.message);
    return;
  }
  if (message.kind === 'test-worker-error') {
    const state = activeWorkers.get(`${message.runId}:${message.nonce}`);
    if (state?.worker?.onerror) state.worker.onerror({ preventDefault() {} });
    return;
  }
  if (message.kind === 'test-hard-deadline' && message.request && typeof message.request === 'object') {
    beginRun(message.request, { testDisableVmInterrupt: true });
    return;
  }
  if (message.kind === 'run') beginRun(message);
  if (message.kind === 'cancel') cancelRun(message);
});

sendToParent({ protocol: PROTOCOL_VERSION, kind: 'ready' });

window.__testSendRunnerMessage = (message) => sendToParent(message);
window.__testSendMalformedToRunner = (message) => window.postMessage(message, location.origin);

if (new URLSearchParams(location.search).has('testOpaqueWorker')) {
  let probeWorker;
  try {
    probeWorker = new Worker(new URL('./quickjs.worker.mjs', import.meta.url), {
      type: 'module',
      name: 'quickjs-opaque-bootstrap-probe',
    });
  } catch (error) {
    sendToParent({ kind: 'opaque-worker-probe-result', outcome: 'worker-error', message: String(error?.message ?? error).slice(0, 1000) });
  }
  if (probeWorker) {
  let probeFinished = false;
  const probeTimer = setTimeout(() => {
    if (probeFinished) return;
    probeFinished = true;
    probeWorker.terminate();
    sendToParent({ kind: 'opaque-worker-probe-result', outcome: 'timeout' });
  }, 5000);
  probeWorker.onmessage = (event) => {
    if (probeFinished) return;
    probeFinished = true;
    clearTimeout(probeTimer);
    probeWorker.terminate();
    sendToParent({
      kind: 'opaque-worker-probe-result',
      outcome: event.data?.status === 'ok' ? 'passed' : 'worker-result',
      status: event.data?.status ?? null,
      quickjsVersion: event.data?.quickjsVersion ?? null,
      cases: event.data?.cases ?? [],
    });
  };
  probeWorker.onerror = (event) => {
    if (probeFinished) return;
    probeFinished = true;
    clearTimeout(probeTimer);
    event.preventDefault();
    probeWorker.terminate();
    sendToParent({ kind: 'opaque-worker-probe-result', outcome: 'worker-error', message: String(event.message ?? '').slice(0, 1000) });
  };
  probeWorker.postMessage({
    kind: 'run',
    workerId: 'opaque-bootstrap-probe',
    runId: 'opaque-bootstrap-probe',
    sourceRevision: 1,
    source: 'export function longestWindow(events: string[], k: number): { start: number; endExclusive: number } { return { start: 0, endExclusive: 0 }; }',
    cases: [{ id: 'opaque-bootstrap', input: { events: [], k: 0 } }],
  });
  }
}
