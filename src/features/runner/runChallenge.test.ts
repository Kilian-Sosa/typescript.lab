import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { longestWindowCases } from '../../../challenges/longest-window/cases';
import { createIframeRunner, localRunnerOrigin } from './runChallenge';

const context = { runId: 'test-run', sourceRevision: 3, challengeVersion: '1.0.0' };
const origin = 'http://runner.test:4567';
const passed = () => ({ contractVersion: '1.0.0', ...context, challengeId: 'longest-window', status: 'passed',
  cases: longestWindowCases.map(c => ({ caseId: c.id, status: 'passed', expected: c.expected, actual: c.expected })), diagnostics: [] });

function fixture(signal?: AbortSignal) {
  const run = createIframeRunner(origin);
  const promise = run('exact editor buffer\n', 'longest-window', context, signal);
  const frame = document.querySelector('iframe')!;
  const port = frame.contentWindow!;
  const send = vi.spyOn(port, 'postMessage').mockImplementation(() => {});
  const receive = (data: unknown, eventOrigin = origin, source: Window = port) => window.dispatchEvent(
    new MessageEvent('message', { origin: eventOrigin, source, data }));
  receive({ protocol: 1, kind: 'ready' });
  const nonce = (send.mock.calls[0]![0] as { nonce: string }).nonce;
  receive({ protocol: 1, kind: 'handshake-ack', nonce });
  return { promise, frame, port, send, nonce, receive,
    reply: (result: unknown) => receive({ protocol: 1, kind: 'run-result', nonce, result }) };
}

// happy-dom cannot load cross-site pages. Exercise the real message listener with a local frame;
// the browser regression covers actual navigation, headers and Worker execution.
beforeEach(() => { vi.spyOn(HTMLIFrameElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLIFrameElement) {
  this.srcdoc = '<!doctype html><title>Message fixture</title>';
}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('local activation gate', () => {
  it('allows only explicit development opt-in with distinct local test sites', () => {
    expect(localRunnerOrigin(true, '1', origin, 'http://app.test:1234')).toBe(origin);
    for (const args of [
      [false, '1', origin, 'http://app.test:1234'], [true, '', origin, 'http://app.test:1234'],
      [true, '1', 'http://app.test:4567', 'http://app.test:1234'],
      [true, '1', 'https://runner.vercel.app', 'https://app.vercel.app'],
      [true, '1', origin + '/path', 'http://app.test:1234'],
    ] as const) expect(localRunnerOrigin(args[0], args[1], args[2], args[3])).toBeNull();
  });
});

describe('iframe adapter', () => {
  it('sends the exact buffer and context only after the bound handshake, then disposes', async () => {
    const f = fixture();
    expect(f.frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(f.send.mock.calls[1]).toEqual([{ protocol: 1, kind: 'run', nonce: f.nonce,
      ...context, challengeId: 'longest-window', source: 'exact editor buffer\n' }, origin]);
    f.reply(passed());
    expect((await f.promise).status).toBe('passed');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('ignores foreign windows, origins, nonces and stale contexts', async () => {
    const f = fixture();
    const envelope = { protocol: 1, kind: 'run-result', nonce: f.nonce, result: passed() };
    f.receive(envelope, 'http://evil.test'); f.receive(envelope, origin, window);
    f.receive({ ...envelope, nonce: 'wrong' });
    for (const patch of [{ runId: 'old' }, { sourceRevision: 2 }, { challengeId: 'other' }, { challengeVersion: '0.1.0' }]) {
      f.reply({ ...passed(), ...patch });
    }
    expect(document.querySelector('iframe')).toBe(f.frame);
    f.reply(passed()); expect((await f.promise).status).toBe('passed');
  });

  it.each([
    ['empty suite', () => ({ ...passed(), cases: [] })],
    ['forged actual', () => { const r = passed(); r.cases[0]!.actual = { start: 999, endExclusive: 999 }; return r; }],
    ['missing cases', () => ({ ...passed(), cases: passed().cases.slice(1) })],
    ['duplicate case', () => ({ ...passed(), cases: passed().cases.map(() => passed().cases[0]) })],
    ['incorrect expected', () => ({ ...passed(), cases: passed().cases.map(c => ({ ...c, expected: null })) })],
    ['sparse cases', () => ({ ...passed(), cases: new Array(14) })],
    ['unsupported contract', () => ({ ...passed(), contractVersion: '2' })],
    ['transient status', () => ({ ...passed(), status: 'running' })],
    ['bad reason', () => ({ ...passed(), reason: 'cancelled' })],
    ['oversized diagnostic', () => ({ ...passed(), diagnostics: ['x'.repeat(70000)] })],
    ['nonfinite actual', () => ({ ...passed(), cases: passed().cases.map(c => ({ ...c, actual: NaN })) })],
    ['unknown field', () => ({ ...passed(), source: 'must not be returned' })],
  ])('rejects %s without fabricating a pass', async (_, result) => {
    const f = fixture(); f.reply(result());
    expect((await f.promise).status).toBe('infrastructure-error');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it.each(['compile-error', 'timeout', 'execution-error', 'infrastructure-error'] as const)('preserves %s', async status => {
    const f = fixture(); f.reply({ ...passed(), status, diagnostics: ['Helpful message'],
      ...(status === 'execution-error' ? { reason: 'runtime-error' } : {}),
      cases: longestWindowCases.map(c => ({ caseId: c.id, status: 'not-run' })) });
    expect((await f.promise).status).toBe(status);
  });

  it('accepts honest failed cases', async () => {
    const f = fixture(); const result = passed();
    f.reply({ ...result, status: 'failed', cases: result.cases.map((c, i) => i === 0
      ? { ...c, status: 'failed', actual: null } : c) });
    expect((await f.promise).status).toBe('failed');
  });

  it('cancels promptly and ignores delayed results', async () => {
    const controller = new AbortController(); const f = fixture(controller.signal);
    controller.abort(); f.reply(passed());
    expect(await f.promise).toMatchObject({ status: 'execution-error', reason: 'cancelled' });
    expect(f.send.mock.calls.at(-1)![0]).toMatchObject({ kind: 'cancel', runId: context.runId });
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('bounds handshake and lost-result waits and permits retry', async () => {
    vi.useFakeTimers(); const f = fixture();
    await vi.advanceTimersByTimeAsync(6000);
    expect((await f.promise).status).toBe('infrastructure-error');
    const retry = fixture(); retry.reply(passed()); expect((await retry.promise).status).toBe('passed');
    const noReady = createIframeRunner(origin)('source', 'longest-window', context);
    await vi.advanceTimersByTimeAsync(15000);
    expect((await noReady).status).toBe('infrastructure-error');
  });
});
