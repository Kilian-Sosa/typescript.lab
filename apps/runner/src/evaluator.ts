import { newQuickJSWASMModule, RELEASE_SYNC, type QuickJSContext, type QuickJSHandle } from 'quickjs-emscripten';
import { compile } from './compiler';
import { bytes, json, LIMITS, validWorkerRequest, type WorkerReply, type WorkerRequest } from './protocol';

// Snapshot data descriptors once, using pristine intrinsics and inert output containers.
const SERIALIZER = `(() => {
  const stringify = JSON.stringify, ownKeys = Reflect.ownKeys, isArray = Array.isArray,
    finite = Number.isFinite, hasOwn = Object.hasOwn, create = Object.create,
    descriptor = Object.getOwnPropertyDescriptor, prototype = Object.getPrototypeOf,
    define = Object.defineProperty, setPrototype = Object.setPrototypeOf,
    objectPrototype = Object.prototype, arrayPrototype = Array.prototype, SafeError = Error;
  function reject() { throw new SafeError('Output must be finite plain JSON data without accessors or serialization hooks.'); }
  function data(object, key) {
    const d = descriptor(object, key);
    if (!d || !hasOwn(d, 'value')) reject();
    return d;
  }
  function put(object, key, value) {
    const d = create(null);
    d.value = value; d.enumerable = true;
    define(object, key, d);
  }
  return value => {
    let nodes = 0;
    const ancestors = create(null);
    function snapshot(v, depth) {
      if (++nodes > 100000 || depth > 32) reject();
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
      if (typeof v === 'number' && finite(v)) return v;
      if (typeof v !== 'object') reject();
      for (let i = 0; i < depth; i++) if (ancestors[i] === v) reject();
      ancestors[depth] = v;
      const proto = prototype(v), keys = ownKeys(v);
      if (prototype(objectPrototype) !== null || descriptor(objectPrototype, 'toJSON')) reject();
      if (isArray(v)) {
        if (proto !== null && proto !== arrayPrototype || prototype(arrayPrototype) !== objectPrototype
          || descriptor(arrayPrototype, 'toJSON')) reject();
        const length = data(v, 'length').value;
        if (typeof length !== 'number' || length < 0 || length > 100000 || length % 1 !== 0
          || keys.length !== length + 1) reject();
        const result = [];
        setPrototype(result, null);
        for (let i = 0; i < length; i++) {
          const d = data(v, i);
          if (!d.enumerable) reject();
          put(result, i, snapshot(d.value, depth + 1));
        }
        return result;
      }
      if (proto !== null && proto !== objectPrototype) reject();
      const result = create(null);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (typeof key !== 'string') reject();
        const d = data(v, key);
        if (!d.enumerable) reject();
        put(result, key, snapshot(d.value, depth + 1));
      }
      return result;
    }
    return stringify(snapshot(value, 0));
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
