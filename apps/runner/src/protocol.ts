import type { JsonValue } from '../../../shared/contracts/v1';
import type { ConsoleTranscript } from './console-output';

export const LIMITS = Object.freeze({
  source: 32768,
  input: 1048576,
  output: 65536,
  cases: 100,
  memory: 33554432,
  stack: 131072,
  executionMs: 2000,
  hardMs: 3000,
  sessionRuns: 128,
});
export const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
export const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
export const exactKeys = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
export const identifier = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,128}$/.test(v);
export const revision = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
export function dense(v: unknown, max: number): v is unknown[] {
  if (!Array.isArray(v) || v.length > max || Object.keys(v).length !== v.length) return false;
  for (let i = 0; i < v.length; i++) if (!Object.hasOwn(v, i)) return false;
  return true;
}

// Bound depth, nodes and strings before serializing; structured clone preserves holes.
export function json(v: unknown): v is JsonValue {
  let nodes = 0;
  let size = 0;
  const seen = new Set<object>();
  function visit(value: unknown, depth: number): boolean {
    if (++nodes > 100000 || depth > 32) return false;
    if (typeof value === 'string') {
      size += bytes(value);
      return size <= LIMITS.input;
    }
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    if (Array.isArray(value)) {
      if (!dense(value, 100000)) return false;
      for (const item of value) if (!visit(item, depth + 1)) return false;
    } else {
      if (!record(value)) return false;
      for (const [key, item] of Object.entries(value)) {
        size += bytes(key);
        if (size > LIMITS.input || !visit(item, depth + 1)) return false;
      }
    }
    seen.delete(value);
    return true;
  }
  return visit(v, 0);
}

export function equalJson(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equalJson(v, b[i]!));
  const left = a as Record<string, JsonValue>,
    right = b as Record<string, JsonValue>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((k) => Object.hasOwn(right, k) && equalJson(left[k]!, right[k]!))
  );
}

export interface RunRequest {
  protocol: 1;
  kind: 'run';
  nonce: string;
  runId: string;
  sourceRevision: number;
  challengeId: 'longest-window';
  challengeVersion: '1.0.0';
  source: string;
}
export interface WorkerRequest {
  runId: string;
  sourceRevision: number;
  source: string;
  cases: readonly { id: string; input: { readonly events: readonly string[]; readonly k: number } }[];
}
export type WorkerStatus =
  'ok' | 'compile-error' | 'policy-rejected' | 'execution-error' | 'timeout' | 'infrastructure-error';
export interface WorkerReply {
  runId: string;
  sourceRevision: number;
  status: WorkerStatus;
  cases: { caseId: string; actual: JsonValue }[];
  diagnostics: string[];
  consoleOutput?: ConsoleTranscript;
}
export function validRun(v: Record<string, unknown>): v is Record<string, unknown> & RunRequest {
  return (
    exactKeys(v, [
      'protocol',
      'kind',
      'nonce',
      'runId',
      'sourceRevision',
      'challengeId',
      'challengeVersion',
      'source',
    ]) &&
    v.protocol === 1 &&
    v.kind === 'run' &&
    identifier(v.runId) &&
    revision(v.sourceRevision) &&
    v.challengeId === 'longest-window' &&
    v.challengeVersion === '1.0.0' &&
    typeof v.source === 'string' &&
    bytes(v.source) <= LIMITS.source
  );
}
export function validWorkerRequest(v: unknown): v is WorkerRequest {
  if (
    !record(v) ||
    !exactKeys(v, ['runId', 'sourceRevision', 'source', 'cases']) ||
    !identifier(v.runId) ||
    !revision(v.sourceRevision) ||
    typeof v.source !== 'string' ||
    bytes(v.source) > LIMITS.source ||
    !dense(v.cases, LIMITS.cases) ||
    !v.cases.length
  )
    return false;
  const ids = new Set();
  for (const c of v.cases) {
    if (
      !record(c) ||
      !exactKeys(c, ['id', 'input']) ||
      !identifier(c.id) ||
      ids.has(c.id) ||
      !record(c.input) ||
      !exactKeys(c.input, ['events', 'k']) ||
      !dense(c.input.events, 100000) ||
      !c.input.events.every((e) => typeof e === 'string') ||
      typeof c.input.k !== 'number' ||
      !Number.isFinite(c.input.k)
    )
      return false;
    ids.add(c.id);
  }
  return json(v.cases) && bytes(JSON.stringify(v.cases)) <= LIMITS.input;
}
