import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/evaluator';
import { longestWindowCases } from '../../../challenges/longest-window/cases';

const request = (source: string) => ({ runId: 'console-run', sourceRevision: 7, source,
  cases: longestWindowCases.slice(0, 2).map(({ id, input }) => ({ id, input })) });
const run = (body: string) => evaluate(request('export function longestWindow() { ' + body + ' return null; }'));
const output = (r: any) => r.consoleOutput;

describe('VM-only console', () => {
  it('captures four levels, module initialization and ordered case identity', async () => {
    const r = await evaluate(request(`console.info('module');
      export function longestWindow() { console.log('hello', 42); console.warn('careful'); console.error('problem'); return null; }`));
    expect(r.status).toBe('ok');
    expect(output(r).entries.map((e: any) => [e.sequence, e.caseId, e.level, e.text])).toEqual([
      [0, longestWindowCases[0]!.id, 'info', 'module'], [1, longestWindowCases[0]!.id, 'log', 'hello 42'],
      [2, longestWindowCases[0]!.id, 'warn', 'careful'], [3, longestWindowCases[0]!.id, 'error', 'problem'],
      [4, longestWindowCases[1]!.id, 'info', 'module'], [5, longestWindowCases[1]!.id, 'log', 'hello 42'],
      [6, longestWindowCases[1]!.id, 'warn', 'careful'], [7, longestWindowCases[1]!.id, 'error', 'problem'],
    ]);
    expect(output(r).truncated).toBe(false);
  });
  it('formats cycles, accessors, unsupported values and depth without invoking hooks', async () => {
    const r = await run(`const v: any = { a: 1, get bad() { throw new Error('getter invoked'); }, toJSON() { throw new Error('hook invoked'); } };
      v.self = v; console.log(v, undefined, NaN, 1n, () => 1, {a:{b:{c:{d:{e:1}}}}});`);
    expect(r.status).toBe('ok');
    for (const marker of ['[Circular]', '[Accessor]', '[Function]', '[Depth limit]']) expect(output(r).entries[0].text).toContain(marker);
    expect(output(r).truncated).toBe(true);
  });
  it('bounds multibyte strings without broken Unicode and preserves logs on thrown errors', async () => {
    const r = await run(`console.log('😀'.repeat(5000)); throw new Error('learner failure');`);
    expect(r.status).toBe('execution-error');
    expect(r.diagnostics[0]).toContain('learner failure');
    expect(output(r).entries).toHaveLength(1);
    const text = output(r).entries[0].text;
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(2048);
    expect(text).not.toContain('�'); expect(text).toContain('[Truncated]');
    expect(output(r).truncated).toBe(true);
  });
  it('caps count and total text across contexts and stops retaining floods', async () => {
    const flood = await run(`for (let i = 0; i < 10000; i++) console.log('x');`);
    expect(flood.status).toBe('ok'); expect(output(flood).entries).toHaveLength(100); expect(output(flood).truncated).toBe(true);
    const huge = await run(`for (let i = 0; i < 1000; i++) console.log('é'.repeat(2000));`);
    expect(huge.status).toBe('ok');
    expect(output(huge).entries.reduce((n: number, e: any) => n + new TextEncoder().encode(e.text).length, 0)).toBeLessThanOrEqual(16384);
    expect(output(huge).truncated).toBe(true);
  });
  it('retains safe logs on VM interrupt and exposes no browser APIs', async () => {
    const r = await run(`console.log(typeof window, typeof fetch, typeof postMessage); while (true) {}`);
    expect(r.status).toBe('timeout'); expect(output(r).entries[0].text).toBe('undefined undefined undefined');
  }, 6000);
  it('uses pristine formatting after prototype poisoning', async () => {
    const r = await run(`const root: any = ([] as any).constructor.constructor('return globalThis')();
      root.JSON.stringify = () => 'forged'; root.Object.getOwnPropertyDescriptor = () => { throw 1; };
      root.Array.prototype.push = () => { throw 2; }; root.String.prototype.slice = () => 'forged';
      console.log({ value: 5 });`);
    expect(r.status).toBe('ok'); expect(output(r).entries[0].text).toBe('{"value": 5}');
  });
  it('reserves transport space for escaped control characters without failing the learner run', async () => {
    const r = await run(`for (let i = 0; i < 20; i++) console.log('\u0000'.repeat(2048));`);
    expect(r.status).toBe('ok'); expect(output(r).truncated).toBe(true);
    expect(output(r).entries[0].text).toContain('\u0000');
    expect(new TextEncoder().encode(JSON.stringify(r)).length).toBeLessThanOrEqual(65536);
  });
  it('bounds property inspection and preserves lone surrogates and newlines losslessly', async () => {
    const r = await run(`const v: any = {}; for (let i=0;i<1000;i++) v[i] = i;
      console.log(v); console.log('\\ud800\\n😀');`);
    expect(r.status).toBe('ok'); expect(output(r).truncated).toBe(true);
    expect(output(r).entries[0].text).toContain('[Value limit]');
    expect(output(r).entries[0].text).not.toContain('"100"');
    expect(output(r).entries[1].text).toBe('\ud800\n😀');
  });
  it('does not expose collector state, native functions or unsupported console methods', async () => {
    const r = await run(`const c: any = console;
      console.log(typeof c.state, typeof c.debug, typeof c.clear, typeof c.log.constructor('return typeof fetch')());`);
    expect(r.status).toBe('ok'); expect(output(r).entries[0].text).toBe('undefined undefined undefined string');
  });
  it('keeps hostile Proxy inspection inside the VM deadline', async () => {
    const r = await run(`const root: any = ([] as any).constructor.constructor('return globalThis')();
      console.log('before proxy'); console.log(new root.Proxy({}, { ownKeys() { while(true) {} } }));`);
    expect(r.status).toBe('timeout'); expect(output(r).entries[0].text).toBe('before proxy');
  }, 6000);
});
