import { longestWindowCases } from '../../../challenges/longest-window/cases';
import { CONTRACT_VERSION, type CaseResult, type RunResult } from '../../../shared/contracts/v1';
import { bytes, dense, equalJson, exactKeys, json, LIMITS, record, validRun,
  type RunRequest, type WorkerReply } from './protocol';

export interface WorkerPort {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onmessageerror: (() => void) | null;
  postMessage(payload: unknown): void;
  terminate(): void;
}
interface Options {
  parent: unknown; parentOrigin: string; send(message: unknown): void; createWorker(): WorkerPort;
}
interface Active { request: RunRequest; worker: WorkerPort | null; timer?: ReturnType<typeof setTimeout>; finished: boolean; }

function validReply(value: unknown, request: RunRequest): value is WorkerReply {
  if (!record(value) || !exactKeys(value, ['runId', 'sourceRevision', 'status', 'diagnostics', 'cases'])
    || value.runId !== request.runId || value.sourceRevision !== request.sourceRevision
    || typeof value.status !== 'string'
    || !['ok', 'compile-error', 'policy-rejected', 'execution-error', 'timeout', 'infrastructure-error'].includes(value.status)
    || !dense(value.diagnostics, 20) || !value.diagnostics.every(d => typeof d === 'string' && bytes(d) <= 2000)
    || !dense(value.cases, LIMITS.cases)) return false;
  if (value.status === 'ok' ? value.cases.length !== longestWindowCases.length
    : value.cases.length !== 0 || value.diagnostics.length === 0) return false;
  for (let i = 0; i < value.cases.length; i++) {
    const c = value.cases[i];
    if (!record(c) || !exactKeys(c, ['caseId', 'actual']) || c.caseId !== longestWindowCases[i]?.id || !json(c.actual)) return false;
  }
  return bytes(JSON.stringify(value)) <= LIMITS.output;
}

export function createSupervisor(options: Options) {
  let nonce: string | null = null;
  let disposed = false;
  let active: Active | null = null;
  let highestRevision = -1;
  const retired = new Set<string>();
  const unrun = (): CaseResult[] => longestWindowCases.map(c => ({ caseId: c.id, status: 'not-run' }));
  function sendResult(request: RunRequest, status: RunResult['status'], diagnostics: readonly string[],
    reason?: RunResult['reason'], cases = unrun()) {
    const result: RunResult = { contractVersion: CONTRACT_VERSION, runId: request.runId,
      challengeId: request.challengeId, challengeVersion: request.challengeVersion,
      sourceRevision: request.sourceRevision, status, cases, diagnostics, ...(reason ? { reason } : {}) };
    const message = { protocol: 1, kind: 'run-result', nonce, result };
    if (bytes(JSON.stringify(message)) > LIMITS.output) {
      options.send({ ...message, result: { ...result, status: 'execution-error', reason: 'policy-rejected',
        cases: unrun(), diagnostics: ['Result exceeds the output budget.'] } });
    } else options.send(message);
  }
  function finish(state: Active, status: RunResult['status'], diagnostics: readonly string[],
    reason?: RunResult['reason'], cases?: CaseResult[]) {
    if (state.finished) return;
    state.finished = true;
    clearTimeout(state.timer);
    if (state.worker) {
      state.worker.onmessage = state.worker.onerror = state.worker.onmessageerror = null;
      state.worker.terminate(); state.worker = null;
    }
    if (active === state) active = null;
    sendResult(state.request, status, diagnostics, reason, cases);
  }
  return {
    receive(event: { origin: string; source: unknown; data: unknown }) {
      if (disposed || event.origin !== options.parentOrigin || event.source !== options.parent || !record(event.data)) return;
      const m = event.data;
      if (m.kind === 'handshake') {
        if (nonce || !exactKeys(m, ['protocol', 'kind', 'nonce']) || m.protocol !== 1
          || typeof m.nonce !== 'string' || !/^[\w-]{16,128}$/.test(m.nonce)) return;
        nonce = m.nonce; options.send({ protocol: 1, kind: 'handshake-ack', nonce }); return;
      }
      if (!nonce || m.nonce !== nonce || m.protocol !== 1) return;
      if (m.kind === 'cancel') {
        if (!exactKeys(m, ['protocol', 'kind', 'nonce', 'runId', 'sourceRevision']) || !active
          || m.runId !== active.request.runId || m.sourceRevision !== active.request.sourceRevision) return;
        finish(active, 'execution-error', ['Run cancelled.'], 'cancelled'); return;
      }
      if (!validRun(m)) return;
      const request: RunRequest = m;
      if (retired.has(m.runId) || m.sourceRevision < highestRevision) return;
      if (active || retired.size >= LIMITS.sessionRuns) {
        sendResult(request, 'execution-error', ['Runner busy or session exhausted; retry or reload the frame.'], 'policy-rejected'); return;
      }
      retired.add(request.runId); highestRevision = request.sourceRevision;
      const state: Active = { request, worker: null, finished: false };
      active = state;
      state.timer = setTimeout(() => finish(state, 'timeout', ['Independent Worker deadline exceeded.']), LIMITS.hardMs);
      try {
        const worker = options.createWorker(); state.worker = worker;
        worker.onerror = worker.onmessageerror = () => finish(state, 'infrastructure-error', ['Worker failed to load or crashed.']);
        worker.onmessage = ({ data }) => {
          if (state.finished) return;
          if (!validReply(data, request)) { finish(state, 'infrastructure-error', ['Invalid Worker result.']); return; }
          if (data.status === 'ok') {
            const cases: CaseResult[] = longestWindowCases.map((c, i) => ({ caseId: c.id,
              expected: c.expected, actual: data.cases[i]!.actual,
              status: equalJson(c.expected, data.cases[i]!.actual) ? 'passed' : 'failed' }));
            finish(state, cases.every(c => c.status === 'passed') ? 'passed' : 'failed', [], undefined, cases);
          } else {
            const status = data.status === 'policy-rejected' ? 'execution-error' : data.status;
            finish(state, status, data.diagnostics, data.status === 'policy-rejected' ? 'policy-rejected'
              : data.status === 'execution-error' ? 'runtime-error' : undefined);
          }
        };
        worker.postMessage({ runId: request.runId, sourceRevision: request.sourceRevision, source: request.source,
          cases: longestWindowCases.map(({ id, input }) => ({ id, input })) });
      } catch { finish(state, 'infrastructure-error', ['Worker could not start.']); }
    },
    dispose() {
      disposed = true;
      if (active) finish(active, 'execution-error', ['Runner closed.'], 'cancelled');
    },
  };
}
