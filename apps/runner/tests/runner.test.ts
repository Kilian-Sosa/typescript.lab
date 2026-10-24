/* eslint-disable @typescript-eslint/no-explicit-any -- Hostile protocol fixtures deliberately bypass static types to test runtime validation. */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createSupervisor, type WorkerPort } from '../src/supervisor';
import { evaluate } from '../src/evaluator';
import { json, validWorkerRequest } from '../src/protocol';
import { longestWindowCases } from '../../../challenges/longest-window/cases';

const nonce = '0123456789abcdef0123456789abcdef';
const source = readFileSync(new URL('../../../challenges/longest-window/solution.ts', import.meta.url), 'utf8');
const request = (extra = {}) => ({
  protocol: 1,
  kind: 'run',
  nonce,
  runId: 'run-1',
  sourceRevision: 1,
  challengeId: 'longest-window',
  challengeVersion: '1.0.0',
  source,
  ...extra,
});
const workerRequest = (text = source) => ({
  runId: 'run-1',
  sourceRevision: 1,
  source: text,
  cases: longestWindowCases.map(({ id, input }) => ({ id, input })),
});

function fixture() {
  const sent: any[] = [];
  const workers: (WorkerPort & { payload: any; terminated: boolean })[] = [];
  const parent = {};
  const supervisor = createSupervisor({
    parent,
    parentOrigin: 'https://app.example',
    send: (m) => sent.push(m),
    createWorker() {
      const worker: WorkerPort & { payload: any; terminated: boolean } = {
        payload: null,
        terminated: false,
        onmessage: null,
        onerror: null,
        onmessageerror: null,
        postMessage(p: unknown) {
          this.payload = p;
        },
        terminate() {
          this.terminated = true;
        },
      };
      workers.push(worker);
      return worker;
    },
  });
  const deliver = (data: unknown, origin = 'https://app.example', sourceWindow = parent) =>
    supervisor.receive({ data, origin, source: sourceWindow });
  const handshake = () => deliver({ protocol: 1, kind: 'handshake', nonce });
  return { sent, workers, deliver, handshake, supervisor };
}
afterEach(() => vi.useRealTimers());

describe('isolated supervisor', () => {
  it('bounds Worker JSON inputs, case count, depth, cycles and sparse arrays', () => {
    expect(validWorkerRequest(workerRequest())).toBe(true);
    expect(validWorkerRequest({ ...workerRequest(), cases: new Array(14) })).toBe(false);
    expect(
      validWorkerRequest({
        ...workerRequest(),
        cases: Array.from({ length: 101 }, (_, i) => ({ id: `${i}`, input: { events: [], k: 1 } })),
      }),
    ).toBe(false);
    expect(
      validWorkerRequest({
        ...workerRequest(),
        cases: [{ id: 'huge', input: { events: ['x'.repeat(1048577)], k: 1 } }],
      }),
    ).toBe(false);
    expect(
      validWorkerRequest({ ...workerRequest(), cases: [{ id: 'sparse', input: { events: new Array(2), k: 1 } }] }),
    ).toBe(false);
    expect(validWorkerRequest({ ...workerRequest(), testDisableVmInterrupt: true })).toBe(false);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(json(cyclic)).toBe(false);
    let deep: unknown = null;
    for (let i = 0; i < 40; i++) deep = { child: deep };
    expect(json(deep)).toBe(false);
  });
  it('rejects wrong origin, window, nonce, pre-handshake and extra fields before creating Workers', () => {
    const f = fixture();
    f.deliver(request());
    f.handshake();
    f.deliver(request(), 'https://evil.example');
    f.deliver(request(), undefined, {});
    f.deliver(request({ nonce: 'different-nonce-0123456789' }));
    f.deliver(request({ testDisableVmInterrupt: true }));
    expect(f.workers).toHaveLength(0);
  });
  it('bounds source and rejects sparse, oversized and unknown case payloads', () => {
    const f = fixture();
    f.handshake();
    for (const extra of [
      { source: 'é'.repeat(16385) },
      { cases: new Array(14) },
      { sourceRevision: -1 },
      { sourceRevision: Number.MAX_SAFE_INTEGER + 1 },
      { challengeVersion: '2' },
    ]) {
      f.deliver(request(extra));
    }
    expect(f.workers).toHaveLength(0);
  });
  it('uses canonical inputs only and bounds burst concurrency before allocation', () => {
    const f = fixture();
    f.handshake();
    f.deliver(request());
    for (let n = 2; n < 40; n++) f.deliver(request({ runId: `run-${n}`, sourceRevision: n }));
    expect(f.workers).toHaveLength(1);
    expect(JSON.stringify(f.workers[0]!.payload)).not.toContain('expected');
    expect(JSON.stringify(f.workers[0]!.payload)).not.toContain('solution');
    f.supervisor.dispose();
    expect(f.workers[0]!.terminated).toBe(true);
  });
  it('rejects forged passed and incomplete, sparse, duplicate, non-JSON or oversized replies', () => {
    for (const mutate of [
      (r: any) => ({ ...r, status: 'passed' }),
      (r: any) => ({ ...r, status: new String('compile-error'), cases: [], diagnostics: ['invalid status'] }),
      (r: any) => ({ ...r, cases: [] }),
      (r: any) => ({ ...r, cases: new Array(14) }),
      (r: any) => ({ ...r, diagnostics: new Array(1) }),
      (r: any) => ({ ...r, runId: 'other' }),
      (r: any) => ({ ...r, cases: r.cases.map((c: any) => ({ ...c, caseId: 'duplicate' })) }),
      (r: any) => ({ ...r, cases: r.cases.map((c: any) => ({ ...c, actual: { hole: new Array(1) } })) }),
      (r: any) => ({ ...r, diagnostics: ['x'.repeat(65537)] }),
    ]) {
      const f = fixture();
      f.handshake();
      f.deliver(request());
      f.workers[0]!.onmessage!({
        data: mutate({
          runId: 'run-1',
          sourceRevision: 1,
          status: 'ok',
          diagnostics: [],
          cases: longestWindowCases.map((c) => ({ caseId: c.id, actual: c.expected })),
        }),
      });
      expect(f.sent.at(-1).result.status).toBe('infrastructure-error');
      expect(f.workers[0]!.terminated).toBe(true);
    }
  });
  it('compares actual values outside VM, disposes, rejects replays and stale revisions', async () => {
    const f = fixture();
    f.handshake();
    f.deliver(request());
    const reply = await evaluate(f.workers[0]!.payload);
    f.workers[0]!.onmessage!({ data: reply });
    expect(f.sent.at(-1).result.status).toBe('passed');
    expect(f.sent.at(-1).result.cases).toHaveLength(14);
    expect(f.workers[0]!.terminated).toBe(true);
    f.deliver(request());
    f.deliver(request({ runId: 'old', sourceRevision: 0 }));
    expect(f.workers).toHaveLength(1);
  });
  it('terminates on cancellation, discards delayed reply, recovers with a fresh Worker', () => {
    const f = fixture();
    f.handshake();
    f.deliver(request());
    const delayed = f.workers[0]!.onmessage!;
    f.deliver({ protocol: 1, kind: 'cancel', nonce, runId: 'run-1', sourceRevision: 1 });
    expect(f.sent.at(-1).result.reason).toBe('cancelled');
    const count = f.sent.length;
    delayed({ data: { status: 'passed' } });
    expect(f.sent).toHaveLength(count);
    f.deliver(request({ runId: 'run-2', sourceRevision: 2 }));
    expect(f.workers).toHaveLength(2);
    f.supervisor.dispose();
  });
  it('has an independent hard deadline and handles Worker startup/crash/clone errors', () => {
    vi.useFakeTimers();
    for (const mode of ['timeout', 'error', 'messageerror']) {
      const f = fixture();
      f.handshake();
      f.deliver(request());
      if (mode === 'timeout') vi.advanceTimersByTime(3000);
      else if (mode === 'error') f.workers[0]!.onerror!();
      else f.workers[0]!.onmessageerror!();
      expect(f.sent.at(-1).result.status).toBe(mode === 'timeout' ? 'timeout' : 'infrastructure-error');
      expect(f.workers[0]!.terminated).toBe(true);
    }
  });
  it('returns infrastructure failure when Worker construction or posting throws', () => {
    for (const mode of ['create', 'post']) {
      const f = fixture();
      const parent = {};
      const s = createSupervisor({
        parent,
        parentOrigin: 'https://app.example',
        send: (m) => f.sent.push(m),
        createWorker() {
          if (mode === 'create') throw Error('Cannot create Worker');
          return {
            onmessage: null,
            onerror: null,
            onmessageerror: null,
            postMessage() {
              throw Error('Cannot clone');
            },
            terminate() {},
          };
        },
      });
      const deliver = (data: unknown) => s.receive({ origin: 'https://app.example', source: parent, data });
      deliver({ protocol: 1, kind: 'handshake', nonce });
      deliver(request());
      expect(f.sent.at(-1).result.status).toBe('infrastructure-error');
    }
  });
});

describe('real TypeScript + QuickJS evaluator', () => {
  it.each([
    [
      'inherited toJSON returning a nonfinite number',
      'class R { toJSON() { return NaN; } } export function longestWindow() { return new R(); }',
    ],
    [
      'inherited toJSON returning a sparse array',
      'class R { toJSON() { return new Array(2); } } export function longestWindow() { return new R(); }',
    ],
    [
      'changing getter',
      'export function longestWindow() { let i = 0; return { get start() { return ++i === 1 ? 0 : NaN; }, endExclusive: 0 }; }',
    ],
    [
      'plain class instance',
      'class R { start = 0; endExclusive = 0; } export function longestWindow() { return new R(); }',
    ],
    [
      'poisoned array iterator',
      `export function longestWindow() {
      const root: any = ([] as any).constructor.constructor('return globalThis')();
      root.Array.prototype[root.Symbol.iterator] = function () { return { next: () => ({ done: true }) }; };
      return { invalid: NaN };
    }`,
    ],
    [
      'poisoned ancestor tracking',
      `export function longestWindow() {
      const root: any = ([] as any).constructor.constructor('return globalThis')();
      root.Array.prototype.indexOf = () => -1;
      root.Array.prototype[root.Symbol.iterator] = function () { return { next: () => ({ done: true }) }; };
      return { invalid: new Array(2) };
    }`,
    ],
    [
      'inherited Object serialization hook',
      `export function longestWindow() {
      const root: any = ([] as any).constructor.constructor('return globalThis')();
      root.Object.prototype.toJSON = () => NaN;
      return { start: 0, endExclusive: 0 };
    }`,
    ],
    [
      'inherited Array serialization hook',
      `export function longestWindow() {
      const root: any = ([] as any).constructor.constructor('return globalThis')();
      root.Array.prototype.toJSON = () => new Array(2);
      return [1, 2];
    }`,
    ],
  ])('rejects %s at the VM JSON boundary', async (_label, text) => {
    const result = await evaluate(workerRequest(text));
    expect(result.status).toBe('policy-rejected');
    expect(result.cases).toEqual([]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
  it('does not invoke accessors while snapshotting output', async () => {
    const result = await evaluate(
      workerRequest(
        'export function longestWindow() { return { get start(): number { while (true) {} }, endExclusive: 0 }; }',
      ),
    );
    expect(result.status).toBe('policy-rejected');
  });
  it('preserves inert nested data despite poisoned VM intrinsics and prototype fields', async () => {
    const result = await evaluate(
      workerRequest(`export function longestWindow() {
      const root: any = ([] as any).constructor.constructor('return globalThis')();
      const object = root.Object.create(null);
      object['__proto__'] = { preserved: true };
      object.toJSON = 'ordinary data';
      object.values = [null, true, '雪', 1.5, { nested: [0, false] }];
      root.Object.prototype.get = () => 99;
      root.Object.prototype.set = () => 99;
      root.Array.prototype.indexOf = () => -1;
      root.Array.prototype[root.Symbol.iterator] = () => ({ next: () => ({ done: true }) });
      root.Object.getOwnPropertyDescriptor = root.Object.getPrototypeOf = root.Object.create = () => null;
      root.Object.defineProperty = root.Object.setPrototypeOf = () => null;
      root.Reflect.ownKeys = () => [];
      root.Number.isFinite = () => true;
      root.JSON.stringify = () => 'null';
      return object;
    }`),
    );
    expect(result.status).toBe('ok');
    expect(result.cases[0]!.actual).toEqual(
      JSON.parse(
        '{"__proto__":{"preserved":true},"toJSON":"ordinary data","values":[null,true,"雪",1.5,{"nested":[0,false]}]}',
      ),
    );
  });
  it.each([
    ['nested accessor', 'return { nested: { get value() { return 1; } } };'],
    ['sparse array', 'return new Array(2);'],
    ['nonfinite nested value', 'return { value: [NaN] };'],
    ['cycle', 'const v: any = {}; v.self = v; return v;'],
    ['depth budget', 'let v: any = 0; for (let i = 0; i < 40; i++) v = { v }; return v;'],
    [
      'symbol key',
      "const root: any = ([] as any).constructor.constructor('return globalThis')(); const v: any = {}; v[root.Symbol('hidden')] = 1; return v;",
    ],
    ['array extra property', 'const v: any = [1]; v.extra = 2; return v;'],
  ])('rejects %s instead of silently dropping unsupported output', async (_label, body) => {
    expect((await evaluate(workerRequest(`export function longestWindow() { ${body} }`))).status).toBe(
      'policy-rejected',
    );
  });
  it('runs all canonical cases from current source and changes results for incorrect source', async () => {
    const result = await evaluate(workerRequest());
    expect(result.status).toBe('ok');
    expect(result.cases.map((c) => c.actual)).toEqual(longestWindowCases.map((c) => c.expected));
    const wrong = await evaluate(
      workerRequest(
        'export function longestWindow(events: string[], k: number) { return { start: 0, endExclusive: 0 }; }',
      ),
    );
    expect(wrong.cases[0]!.actual).not.toEqual(longestWindowCases[0]!.expected);
  });
  it.each([
    ['export const value: number = "wrong";', 'compile-error'],
    ['export function longestWindow( {', 'compile-error'],
    ['import x from "remote";', 'policy-rejected'],
    ['export * from "remote";', 'policy-rejected'],
    ['import("https://evil.example")', 'policy-rejected'],
    ['require("x")', 'policy-rejected'],
    ['export async function longestWindow() {}', 'policy-rejected'],
    ['export function longestWindow() { throw new Error("learner failure"); }', 'execution-error'],
    ['export function longestWindow() { return undefined; }', 'policy-rejected'],
    ['export function longestWindow() { return NaN; }', 'policy-rejected'],
    ['export function longestWindow() { return "x".repeat(70000); }', 'policy-rejected'],
    ['export function longestWindow() { while(true) {} }', 'timeout'],
  ])('distinguishes %s as %s', async (text, status) => {
    expect((await evaluate(workerRequest(text))).status).toBe(status);
  });
  it('isolates host APIs and case state; exposes neither expected outcomes nor host callbacks', async () => {
    const result = await evaluate(
      workerRequest(`export function longestWindow() {
      return [typeof window, typeof document, typeof fetch, typeof postMessage, typeof process,
        typeof localStorage, typeof Worker, typeof require, typeof expected];
    }`),
    );
    expect(result.status).toBe('ok');
    expect(result.cases[0]!.actual).toEqual(Array(9).fill('undefined'));
    const isolated = await evaluate(
      workerRequest('let count = 0; export function longestWindow() { return ++count; }'),
    );
    expect(isolated.cases.every((c) => c.actual === 1)).toBe(true);
  });
});
