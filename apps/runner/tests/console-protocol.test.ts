/* eslint-disable @typescript-eslint/no-explicit-any -- Capture untrusted outgoing messages for runtime protocol assertions. */
import { describe, expect, it } from 'vitest';
import { createSupervisor, type WorkerPort } from '../src/supervisor';
import { longestWindowCases } from '../../../challenges/longest-window/cases';

function fixture() {
  const sent: any[] = [];
  let worker!: WorkerPort;
  const parent = {};
  const supervisor = createSupervisor({
    parent,
    parentOrigin: 'https://app.example',
    send: (m) => sent.push(m),
    createWorker() {
      worker = { onmessage: null, onerror: null, onmessageerror: null, postMessage() {}, terminate() {} };
      return worker;
    },
  });
  const deliver = (data: unknown) => supervisor.receive({ origin: 'https://app.example', source: parent, data });
  deliver({ protocol: 1, kind: 'handshake', nonce: '0123456789abcdef' });
  deliver({
    protocol: 1,
    kind: 'run',
    nonce: '0123456789abcdef',
    runId: 'console-run',
    sourceRevision: 7,
    challengeId: 'longest-window',
    challengeVersion: '1.0.0',
    source: '',
  });
  return { sent, worker, deliver };
}
const transcript = () => ({
  truncated: false,
  entries: [{ sequence: 0, caseId: longestWindowCases[0]!.id, level: 'log', text: 'hello' }],
});
const reply = (consoleOutput: unknown) => ({
  runId: 'console-run',
  sourceRevision: 7,
  status: 'execution-error',
  cases: [],
  diagnostics: ['failure'],
  consoleOutput,
});

describe('console supervisor boundary', () => {
  it('forwards validated output separately from RunResult', () => {
    const f = fixture();
    f.worker.onmessage!({ data: reply(transcript()) });
    expect(f.sent.at(-1).consoleOutput).toEqual(transcript());
    expect(f.sent.at(-1).result.reason).toBe('runtime-error');
    expect(f.sent.at(-1).result.consoleOutput).toBeUndefined();
  });
  it.each([
    { ...transcript(), truncated: 'yes' },
    { ...transcript(), entries: [{ ...transcript().entries[0], sequence: 2 }] },
    { ...transcript(), entries: [{ ...transcript().entries[0], level: 'debug' }] },
    { ...transcript(), entries: [{ ...transcript().entries[0], caseId: 'unknown' }] },
    { ...transcript(), entries: [{ ...transcript().entries[0], text: 'é'.repeat(2048) }] },
    { ...transcript(), secret: 'extra' },
    { truncated: false, entries: new Array(1) },
    {
      truncated: false,
      entries: Array.from({ length: 101 }, (_, sequence) => ({ ...transcript().entries[0], sequence })),
    },
    {
      truncated: false,
      entries: Array.from({ length: 9 }, (_, sequence) => ({
        ...transcript().entries[0],
        sequence,
        text: 'x'.repeat(2048),
      })),
    },
    {
      truncated: false,
      entries: [
        { ...transcript().entries[0], caseId: longestWindowCases[1]!.id },
        { ...transcript().entries[0], sequence: 1 },
      ],
    },
    {
      truncated: false,
      entries: Array.from({ length: 8 }, (_, sequence) => ({
        ...transcript().entries[0],
        sequence,
        text: '\0'.repeat(2048),
      })),
    },
  ])('rejects malformed or oversized output %#', (consoleOutput) => {
    const f = fixture();
    f.worker.onmessage!({ data: reply(consoleOutput) });
    expect(f.sent.at(-1).result.status).toBe('infrastructure-error');
    expect(f.sent.at(-1).consoleOutput).toBeUndefined();
  });
  it('discards output on cancellation and ignores delayed Worker replies', () => {
    const f = fixture();
    const late = f.worker.onmessage!;
    f.deliver({ protocol: 1, kind: 'cancel', nonce: '0123456789abcdef', runId: 'console-run', sourceRevision: 7 });
    late({ data: reply(transcript()) });
    expect(f.sent).toHaveLength(2);
    expect(f.sent.at(-1).result.reason).toBe('cancelled');
    expect(f.sent.at(-1).consoleOutput).toBeUndefined();
  });
});
