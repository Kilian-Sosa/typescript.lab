import { longestWindowCases } from '../../../challenges/longest-window/cases';
import { CONTRACT_VERSION, type RunResult } from '../../../shared/contracts/v1';
import {
  bytes,
  dense,
  equalJson,
  exactKeys,
  identifier,
  json,
  LIMITS,
  record,
  revision,
} from '../../../apps/runner/src/protocol';
import { validConsoleOutput, type ConsoleTranscript } from '../../../apps/runner/src/console-output';

export interface RunContext {
  runId: string;
  sourceRevision: number;
  challengeVersion: string;
}
export type RunFeedback = RunResult & { readonly consoleOutput?: ConsoleTranscript };
export type RunChallenge = (
  source: string,
  challengeId: string,
  context: RunContext,
  signal?: AbortSignal,
) => Promise<RunFeedback>;

export function newRunId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Hosted activation requires the dedicated QA mode and its validated Preview build metadata.
export const M3_QA_APP_ORIGIN = 'https://typescript-lab-m3-app-qa.vercel.app';
export const M3_QA_RUNNER_ORIGIN = 'https://typescript-lab-m3-runner-qa.vercel.app';

export function hostedQaRunnerOrigin(
  mode: string,
  enabled: string | undefined,
  raw: string | undefined,
  parent: string,
  dev: boolean,
  deploymentEnvironment: string | undefined,
): string | null {
  return !dev &&
    mode === 'm3-hosted-qa' &&
    enabled === '1' &&
    deploymentEnvironment === 'preview' &&
    parent === M3_QA_APP_ORIGIN &&
    raw === M3_QA_RUNNER_ORIGIN
    ? M3_QA_RUNNER_ORIGIN
    : null;
}

// The authenticated MVP Preview uses the same reviewed isolated site pair but a separate build gate.
export function mvpPreviewRunnerOrigin(
  mode: string,
  enabled: string | undefined,
  raw: string | undefined,
  parent: string,
  dev: boolean,
  deploymentEnvironment: string | undefined,
): string | null {
  return !dev &&
    mode === 'mvp-preview' &&
    enabled === '1' &&
    deploymentEnvironment === 'preview' &&
    parent === M3_QA_APP_ORIGIN &&
    raw === M3_QA_RUNNER_ORIGIN
    ? M3_QA_RUNNER_ORIGIN
    : null;
}

// Ordinary development runs only on the two synthetic local test sites.
export function localRunnerOrigin(
  dev: boolean,
  enabled: string | undefined,
  raw: string | undefined,
  parent: string,
): string | null {
  if (!dev || enabled !== '1' || !raw) return null;
  try {
    const runner = new URL(raw),
      app = new URL(parent);
    return runner.origin === raw &&
      runner.protocol === 'http:' &&
      runner.hostname === 'runner.test' &&
      app.protocol === 'http:' &&
      app.hostname === 'app.test'
      ? raw
      : null;
  } catch {
    return null;
  }
}

export function runOutcome(
  challengeId: string,
  context: RunContext,
  status: RunResult['status'],
  diagnostic: string,
  reason?: RunResult['reason'],
): RunResult {
  return {
    contractVersion: CONTRACT_VERSION,
    ...context,
    challengeId,
    status,
    cases: longestWindowCases.map((c) => ({ caseId: c.id, status: 'not-run' })),
    diagnostics: diagnostic ? [diagnostic] : [],
    ...(reason ? { reason } : {}),
  };
}

export function validResult(value: unknown): value is RunResult {
  if (!json(value) || bytes(JSON.stringify(value)) > LIMITS.output || !record(value)) return false;
  const keys = [
    'contractVersion',
    'runId',
    'sourceRevision',
    'challengeId',
    'challengeVersion',
    'status',
    'cases',
    'diagnostics',
  ];
  if (
    !exactKeys(value, 'reason' in value ? [...keys, 'reason'] : keys) ||
    value.contractVersion !== CONTRACT_VERSION ||
    !identifier(value.runId) ||
    !revision(value.sourceRevision) ||
    value.challengeId !== 'longest-window' ||
    value.challengeVersion !== '1.0.0' ||
    !['passed', 'failed', 'compile-error', 'timeout', 'execution-error', 'infrastructure-error'].includes(
      String(value.status),
    ) ||
    !dense(value.diagnostics, 20) ||
    !value.diagnostics.every((d) => typeof d === 'string' && bytes(d) <= 2000) ||
    !dense(value.cases, LIMITS.cases) ||
    value.cases.length !== longestWindowCases.length
  )
    return false;
  if (
    'reason' in value &&
    (value.status !== 'execution-error' ||
      !['unsupported-code', 'policy-rejected', 'runtime-error', 'cancelled'].includes(String(value.reason)))
  )
    return false;
  const evaluated = value.status === 'passed' || value.status === 'failed';
  if (evaluated ? value.diagnostics.length !== 0 : value.diagnostics.length === 0) return false;
  let allPassed = true;
  for (let i = 0; i < value.cases.length; i++) {
    const c = value.cases[i],
      canonical = longestWindowCases[i]!;
    if (!record(c) || c.caseId !== canonical.id) return false;
    if (!evaluated) {
      if (!exactKeys(c, ['caseId', 'status']) || c.status !== 'not-run') return false;
      continue;
    }
    if (
      !exactKeys(c, ['caseId', 'status', 'expected', 'actual']) ||
      !json(c.expected) ||
      !json(c.actual) ||
      !equalJson(c.expected, canonical.expected)
    )
      return false;
    const passed = equalJson(c.actual, canonical.expected);
    if (c.status !== (passed ? 'passed' : 'failed')) return false;
    allPassed &&= passed;
  }
  return !evaluated || value.status === (allPassed ? 'passed' : 'failed');
}

export function createIframeRunner(runnerOrigin: string): RunChallenge {
  return (source, challengeId, context, signal) =>
    new Promise((resolve) => {
      const outcome = (status: RunResult['status'], message: string, reason?: RunResult['reason']) =>
        runOutcome(challengeId, context, status, message, reason);
      if (signal?.aborted) {
        resolve(outcome('execution-error', 'Run cancelled.', 'cancelled'));
        return;
      }
      if (
        challengeId !== 'longest-window' ||
        context.challengeVersion !== '1.0.0' ||
        !identifier(context.runId) ||
        !revision(context.sourceRevision) ||
        bytes(source) > LIMITS.source
      ) {
        resolve(
          outcome('execution-error', 'Unsupported challenge or source exceeds the 32 KiB limit.', 'policy-rejected'),
        );
        return;
      }
      const frame = document.createElement('iframe');
      frame.title = 'Isolated TypeScript test runner';
      frame.hidden = true;
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      frame.referrerPolicy = 'no-referrer';
      const nonce = newRunId();
      let phase: 'loading' | 'handshake' | 'running' | 'done' = 'loading';
      let timer: ReturnType<typeof setTimeout>;
      const send = (message: object) =>
        frame.contentWindow?.postMessage({ protocol: 1, nonce, ...message }, runnerOrigin);
      function finish(result: RunFeedback) {
        if (phase === 'done') return;
        phase = 'done';
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        window.removeEventListener('messageerror', messageError);
        signal?.removeEventListener('abort', cancel);
        frame.remove();
        resolve(result);
      }
      function failure() {
        finish(outcome('infrastructure-error', 'The isolated runner failed. Your code is preserved; retry Run tests.'));
      }
      function cancel() {
        try {
          if (phase === 'running')
            send({ kind: 'cancel', runId: context.runId, sourceRevision: context.sourceRevision });
        } finally {
          finish(outcome('execution-error', 'Run cancelled.', 'cancelled'));
        }
      }
      function messageError(event: MessageEvent) {
        if (event.source === frame.contentWindow && event.origin === runnerOrigin) failure();
      }
      function receive(event: MessageEvent<unknown>) {
        if (event.origin !== runnerOrigin || event.source !== frame.contentWindow || !record(event.data)) return;
        const m = event.data;
        try {
          if (phase === 'loading' && exactKeys(m, ['protocol', 'kind']) && m.protocol === 1 && m.kind === 'ready') {
            phase = 'handshake';
            send({ kind: 'handshake' });
            return;
          }
          if (m.nonce !== nonce) return;
          if (
            phase === 'handshake' &&
            exactKeys(m, ['protocol', 'kind', 'nonce']) &&
            m.protocol === 1 &&
            m.kind === 'handshake-ack'
          ) {
            phase = 'running';
            clearTimeout(timer);
            timer = setTimeout(failure, 6000);
            send({ kind: 'run', ...context, challengeId, source });
            return;
          }
          if (phase !== 'running') {
            failure();
            return;
          }
          if (
            record(m.result) &&
            (m.result.runId !== context.runId ||
              m.result.sourceRevision !== context.sourceRevision ||
              m.result.challengeId !== challengeId ||
              m.result.challengeVersion !== context.challengeVersion)
          )
            return;
          const keys = ['protocol', 'kind', 'nonce', 'result'];
          if (
            !exactKeys(m, 'consoleOutput' in m ? [...keys, 'consoleOutput'] : keys) ||
            m.protocol !== 1 ||
            m.kind !== 'run-result' ||
            !validResult(m.result)
          ) {
            failure();
            return;
          }
          if (
            'consoleOutput' in m &&
            !validConsoleOutput(
              m.consoleOutput,
              longestWindowCases.map((c) => c.id),
            )
          ) {
            failure();
            return;
          }
          if (bytes(JSON.stringify(m)) > LIMITS.output) {
            failure();
            return;
          }
          finish({
            ...m.result,
            ...('consoleOutput' in m ? { consoleOutput: m.consoleOutput as ConsoleTranscript } : {}),
          });
        } catch {
          failure();
        }
      }
      timer = setTimeout(failure, 15000);
      window.addEventListener('message', receive);
      window.addEventListener('messageerror', messageError);
      signal?.addEventListener('abort', cancel, { once: true });
      frame.onerror = failure;
      frame.src = runnerOrigin;
      try {
        document.body.append(frame);
      } catch {
        failure();
      }
    });
}
