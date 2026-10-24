/// <reference lib="webworker" />
import { evaluate } from './evaluator';
import { validWorkerRequest } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let used = false;
scope.addEventListener('message', async (event: MessageEvent<unknown>) => {
  if (used) return;
  used = true;
  if (!validWorkerRequest(event.data)) {
    scope.close();
    return;
  }
  const payload = event.data;
  try {
    scope.postMessage(await evaluate(payload));
  } catch {
    scope.postMessage({
      runId: payload.runId,
      sourceRevision: payload.sourceRevision,
      status: 'infrastructure-error',
      cases: [],
      diagnostics: ['VM initialization or execution infrastructure failed.'],
    });
  } finally {
    scope.close();
  }
});
