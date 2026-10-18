import { newQuickJSWASMModule, RELEASE_SYNC, type QuickJSContext, type QuickJSHandle } from 'quickjs-emscripten';
import { compile } from './compiler';
import { bytes, json, LIMITS, validWorkerRequest, type WorkerReply, type WorkerRequest } from './protocol';

// Capture serialization functions before learner code can mutate its own VM globals.
const SERIALIZER = `(() => {
  const stringify = JSON.stringify, keys = Object.keys, isArray = Array.isArray,
    finite = Number.isFinite, hasOwn = Object.hasOwn;
  return value => {
    let nodes = 0;
    const seen = [];
    function check(v, depth) {
      if (++nodes > 100000 || depth > 32) throw Error('Output structure exceeds limits.');
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
      if (typeof v === 'number' && finite(v)) return;
      if (typeof v !== 'object' || seen.indexOf(v) >= 0) throw Error('Output must be finite JSON data.');
      seen[seen.length] = v;
      if (isArray(v)) {
        if (v.length > 100000) throw Error('Output structure exceeds limits.');
        for (let i = 0; i < v.length; i++) { if (!hasOwn(v, i)) throw Error('Sparse output.'); check(v[i], depth + 1); }
      } else {
        for (const k of keys(v)) check(v[k], depth + 1);
      }
      seen.length--;
    }
    check(value, 0);
    return stringify(value);
  };
})()`;

function errorMessage(context: QuickJSContext, handle: QuickJSHandle) {
  try {
    const value: unknown = context.dump(handle);
    if (typeof value === 'string') return value.slice(0, 450);
    if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') return value.message.slice(0, 450);
    return 'Learner runtime error.';
  } finally { handle.dispose(); }
}

export async function evaluate(payload: WorkerRequest): Promise<WorkerReply> {
  const base = { runId: payload.runId, sourceRevision: payload.sourceRevision };
  const fail = (status: WorkerReply['status'], message: string): WorkerReply =>
    ({ ...base, status, diagnostics: [message], cases: [] });
  if (!validWorkerRequest(payload)) return fail('policy-rejected', 'Invalid or oversized Worker request.');
  const checked = compile(payload.source);
  if (checked.status !== 'ok') return { ...base, ...checked, cases: [] };
  const QuickJS = await newQuickJSWASMModule(RELEASE_SYNC);
  const runtime = QuickJS.newRuntime();
  const deadline = performance.now() + LIMITS.executionMs;
  let interrupted = false;
  runtime.setMemoryLimit(LIMITS.memory);
  runtime.setMaxStackSize(LIMITS.stack);
  runtime.setInterruptHandler(() => { interrupted = performance.now() >= deadline; return interrupted; });
  const cases: WorkerReply['cases'] = [];
  let outputBytes = 0;
  try {
    for (const c of payload.cases) {
      const context = runtime.newContext();
      const handles: QuickJSHandle[] = [];
      const keep = (h: QuickJSHandle) => { handles.push(h); return h; };
      try {
        const serializeResult = context.evalCode(SERIALIZER);
        if (serializeResult.error) throw new Error(errorMessage(context, serializeResult.error));
        const serialize = keep(serializeResult.value);
        const exports = keep(context.newObject()); context.setProp(context.global, 'exports', exports);
        const parsed = context.evalCode(`(${JSON.stringify(c.input)})`);
        if (parsed.error) throw new Error(errorMessage(context, parsed.error));
        const input = keep(parsed.value);
        const events = keep(context.getProp(input, 'events')), k = keep(context.getProp(input, 'k'));
        const evaluated = context.evalCode(checked.javascript, 'learner.js');
        if (evaluated.error) throw new Error(errorMessage(context, evaluated.error));
        keep(evaluated.value);
        const moduleExports = keep(context.getProp(context.global, 'exports'));
        const fn = keep(context.getProp(moduleExports, 'longestWindow'));
        const called = context.callFunction(fn, context.undefined, events, k);
        if (called.error) throw new Error(errorMessage(context, called.error));
        const actual = keep(called.value);
        const encoded = context.callFunction(serialize, context.undefined, actual);
        if (encoded.error) {
          const message = errorMessage(context, encoded.error);
          return fail(interrupted ? 'timeout' : 'policy-rejected', message);
        }
        const serialized: unknown = context.dump(keep(encoded.value));
        if (typeof serialized !== 'string' || (outputBytes += bytes(serialized)) > LIMITS.output) {
          return fail('policy-rejected', 'Output exceeds the JSON budget.');
        }
        const value: unknown = JSON.parse(serialized);
        if (!json(value)) return fail('policy-rejected', 'Output must be bounded JSON data.');
        cases.push({ caseId: c.id, actual: value });
      } catch (error) {
        return fail(interrupted ? 'timeout' : 'execution-error', error instanceof Error ? error.message.slice(0, 450) : 'VM execution failed.');
      } finally {
        for (let i = handles.length - 1; i >= 0; i--) handles[i]!.dispose();
        context.dispose();
      }
    }
    const reply: WorkerReply = { ...base, status: 'ok', diagnostics: [], cases };
    return bytes(JSON.stringify(reply)) <= LIMITS.output ? reply : fail('policy-rejected', 'Output exceeds the JSON budget.');
  } finally { runtime.dispose(); }
}
