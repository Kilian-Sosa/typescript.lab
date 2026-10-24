import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler';
import { evaluate } from '../src/evaluator';
import { longestWindowCases } from '../../../challenges/longest-window/cases';

// Literal expectations check that the declared APIs really exist inside the pinned VM.
const numericExamples: [string, number | boolean][] = [
  ['Math.E', 2.718281828459045],
  ['Math.LN10', 2.302585092994046],
  ['Math.LN2', 0.6931471805599453],
  ['Math.LOG10E', 0.4342944819032518],
  ['Math.LOG2E', 1.4426950408889634],
  ['Math.PI', 3.141592653589793],
  ['Math.SQRT1_2', 0.7071067811865476],
  ['Math.SQRT2', 1.4142135623730951],
  ['Math.abs(-3)', 3],
  ['Math.acos(1)', 0],
  ['Math.acosh(1)', 0],
  ['Math.asin(0)', 0],
  ['Math.asinh(0)', 0],
  ['Math.atan(0)', 0],
  ['Math.atanh(0)', 0],
  ['Math.atan2(0, 1)', 0],
  ['Math.cbrt(27)', 3],
  ['Math.ceil(-1.7)', -1],
  ['Math.clz32(1)', 31],
  ['Math.cos(0)', 1],
  ['Math.cosh(0)', 1],
  ['Math.exp(0)', 1],
  ['Math.expm1(0)', 0],
  ['Math.floor(2.9)', 2],
  ['Math.floor(-1.2)', -2],
  ['Math.fround(1.337)', 1.3370000123977661],
  ['Math.hypot(3, 4)', 5],
  ['Math.imul(0xffffffff, 5)', -5],
  ['Math.log(1)', 0],
  ['Math.log1p(0)', 0],
  ['Math.log10(100)', 2],
  ['Math.log2(8)', 3],
  ['Math.max(-3, 2, 7)', 7],
  ['Math.min(-3, 2, 7)', -3],
  ['Math.pow(2, 10)', 1024],
  ['Math.round(-1.5)', -1],
  ['Math.sign(-5)', -1],
  ['Math.sin(0)', 0],
  ['Math.sinh(0)', 0],
  ['Math.sqrt(81)', 9],
  ['Math.tan(0)', 0],
  ['Math.tanh(0)', 0],
  ['Math.trunc(-1.7)', -1],
  ['Number()', 0],
  ['Number("42")', 42],
  ['Number(true)', 1],
  ['Number.EPSILON', 2.220446049250313e-16],
  ['Number.MAX_SAFE_INTEGER', 9007199254740991],
  ['Number.MIN_SAFE_INTEGER', -9007199254740991],
  ['Number.MAX_VALUE', 1.7976931348623157e308],
  ['Number.MIN_VALUE', 5e-324],
  ['Number.isFinite(Number.POSITIVE_INFINITY)', false],
  ['Number.isFinite(Number.NEGATIVE_INFINITY)', false],
  ['Number.isFinite(1.5)', true],
  ['Number.isFinite("1")', false],
  ['Number.isInteger(2)', true],
  ['Number.isInteger(2.5)', false],
  ['Number.isNaN(Number.NaN)', true],
  ['Number.isNaN("invalid")', false],
  ['Number.isSafeInteger(9007199254740992)', false],
  ['Number.isSafeInteger(42)', true],
  ['Number.parseInt("ff", 16)', 255],
  ['Number.parseFloat("2.5px")', 2.5],
  ['parseInt("11", 2)', 3],
  ['parseFloat("-1.25px")', -1.25],
  ['isFinite(Infinity)', false],
  ['isFinite(-Infinity)', false],
  ['isFinite(1)', true],
  ['isNaN(NaN)', true],
  ['isNaN(2)', false],
];

function request(source: string) {
  return { runId: 'numeric-globals', sourceRevision: 1, source,
    cases: [{ id: 'numeric', input: { events: [], k: 1 } }] };
}

describe('supported numeric globals', () => {
  it.each(numericExamples)('typechecks and executes %s in QuickJS', async (expression, expected) => {
    const source = `export function longestWindow() { return ${expression}; }`;
    expect(compile(source)).toMatchObject({ status: 'ok' });
    const result = await evaluate(request(source));
    expect(result.status).toBe('ok');
    expect(result.cases).toEqual([{ caseId: 'numeric', actual: expected }]);
  });

  it('runs all 14 canonical cases with Math.floor and Math.max', async () => {
    const canonical = readFileSync(new URL('../../../challenges/longest-window/solution.ts', import.meta.url), 'utf8');
    const source = canonical.replace('if (k <= 0)', 'k = Math.max(0, Math.floor(k));\n  if (k <= 0)');
    const result = await evaluate({ ...request(source), cases: longestWindowCases.map(({ id, input }) => ({ id, input })) });
    expect(result.status).toBe('ok');
    expect(result.cases).toEqual(longestWindowCases.map(c => ({ caseId: c.id, actual: c.expected })));
  });

  it.each(['Infinity', '-Infinity', 'Number.NaN', 'Math.max()', 'Math.sqrt(-1)'])('rejects nonfinite output from %s', async expression => {
    const result = await evaluate(request(`export function longestWindow() { return ${expression}; }`));
    expect(result.status).toBe('policy-rejected');
    expect(result.cases).toEqual([]);
  });

  it.each([
    'Math.floor("2")', 'Math.max(1, "2")', 'Math.pow(2)', 'Math.PI = 0',
    'Math.random()', 'Number.parseInt(1)', 'parseFloat(1)', 'Number.MAX_VALUE = 0',
    'fetch("https://example.com")', 'window.document', 'process.env',
    'new WebSocket("wss://example.com")', 'new XMLHttpRequest()',
    'setTimeout(() => {}, 0)', 'Buffer.from("secret")', 'Deno.env.get("secret")',
    'console.debug("message")', 'console.table([])', 'console.clear()',
  ])('preserves strict compile errors for %s', expression => {
    expect(compile(`export function longestWindow() { return ${expression}; }`).status).toBe('compile-error');
  });

  it.each([
    'import x from "remote";', 'import("https://example.com")', 'require("node:fs")',
    'type T = import("node:fs");', '/// <reference lib="dom" />\nfetch("https://example.com");',
    '/// <reference types="node" />\nprocess.exit();',
  ])('does not gain ambient libraries or dependencies through %s', source => {
    expect(compile(source).status).not.toBe('ok');
  });

  it('keeps host APIs absent while exposing only the VM console when types are bypassed', async () => {
    const result = await evaluate(request(`export function longestWindow() {
      const root: any = ([] as any).constructor.constructor('return globalThis')();
      return [typeof root.console, typeof root.fetch, typeof root.process, typeof root.Buffer,
        typeof root.setTimeout, typeof root.WebSocket, typeof root.XMLHttpRequest,
        typeof root.document, typeof root.Worker, typeof root.require, typeof root.Deno];
    }`));
    expect(result.status).toBe('ok');
    expect(result.cases[0]!.actual).toEqual(['object', ...Array(10).fill('undefined')]);
  });
});
