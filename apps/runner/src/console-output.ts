import { bytes, dense, exactKeys, record } from './protocol';

export const CONSOLE_LIMITS = Object.freeze({ entries: 100, messageBytes: 2048, totalBytes: 16384 });
export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error';
export interface ConsoleEntry { sequence: number; caseId: string; level: ConsoleLevel; text: string }
export interface ConsoleTranscript { entries: ConsoleEntry[]; truncated: boolean }

export function validConsoleOutput(value: unknown, caseIds: readonly string[]): value is ConsoleTranscript {
  if (!record(value) || !exactKeys(value, ['entries', 'truncated']) || typeof value.truncated !== 'boolean'
    || !dense(value.entries, CONSOLE_LIMITS.entries)) return false;
  let total = 0, previousCase = -1;
  for (let i = 0; i < value.entries.length; i++) {
    const e = value.entries[i];
    if (!record(e) || !exactKeys(e, ['sequence', 'caseId', 'level', 'text']) || e.sequence !== i
      || typeof e.caseId !== 'string' || typeof e.level !== 'string'
      || !['log', 'info', 'warn', 'error'].includes(e.level) || typeof e.text !== 'string'
      || bytes(e.text) > CONSOLE_LIMITS.messageBytes) return false;
    const index = caseIds.indexOf(e.caseId);
    if (index < previousCase || index < 0 || (total += bytes(e.text)) > CONSOLE_LIMITS.totalBytes) return false;
    previousCase = index;
  }
  return true;
}

// Evaluated only inside QuickJS. The retained state is never reachable from learner globals.
// Capture pristine intrinsics before evaluating source; never call learner coercion/JSON hooks.
export const CONSOLE_BOOTSTRAP = `((maxEntries, remainingBytes) => {
  const create = Object.create, descriptor = Object.getOwnPropertyDescriptor,
    ownKeys = Reflect.ownKeys, apply = Reflect.apply, freeze = Object.freeze,
    stringify = JSON.stringify, isArray = Array.isArray, SafeString = String,
    slice = String.prototype.slice, codePointAt = String.prototype.codePointAt;
  const state = create(null), entries = create(null);
  state.count = 0; state.truncated = false; state.entries = entries;
  function capture(level, args) {
    if (state.count >= maxEntries || remainingBytes <= 0) { state.truncated = true; return; }
    const cap = remainingBytes < 2048 ? remainingBytes : 2048;
    let text = '', size = 0, stopped = false, nodes = 0;
    const ancestors = create(null);
    function append(s) {
      if (stopped) return;
      for (let i = 0; i < s.length;) {
        const cp = apply(codePointAt, s, [i]), length = cp > 65535 ? 2 : 1;
        // Charge conservatively for JSON escaping as well as visible UTF-8 text.
        const n = cp < 32 || cp >= 55296 && cp <= 57343 ? 6 : cp === 34 || cp === 92 ? 2
          : cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4;
        if (size + n > cap - 11) { stopped = true; state.truncated = true; return; }
        text += apply(slice, s, [i, i + length]); size += n; i += length;
      }
    }
    function quote(s) {
      append('"');
      for (let i = 0; i < s.length && !stopped;) {
        const cp = apply(codePointAt, s, [i]), length = cp > 65535 ? 2 : 1;
        const encoded = stringify(apply(slice, s, [i, i + length]));
        append(apply(slice, encoded, [1, encoded.length - 1])); i += length;
      }
      append('"');
    }
    function format(v, depth, nested) {
      if (stopped) return;
      if (++nodes > 50) { state.truncated = true; append('[Value limit]'); return; }
      if (v === null) { append('null'); return; }
      const type = typeof v;
      if (type === 'string') { if (nested) quote(v); else append(v); return; }
      if (type === 'undefined' || type === 'number' || type === 'boolean' || type === 'bigint') {
        append(SafeString(v)); if (type === 'bigint') append('n'); return;
      }
      if (type === 'function') { append('[Function]'); return; }
      if (type === 'symbol') { append('[Symbol]'); return; }
      for (let i = 0; i < depth; i++) if (ancestors[i] === v) { append('[Circular]'); return; }
      if (depth >= 4) { state.truncated = true; append('[Depth limit]'); return; }
      ancestors[depth] = v;
      try {
        const array = isArray(v), keys = ownKeys(v);
        append(array ? '[' : '{');
        let count = 0;
        for (let i = 0; i < keys.length && !stopped; i++) {
          const key = keys[i];
          if (array && key === 'length') continue;
          if (count >= 50 || nodes >= 50) { state.truncated = true; append(', [Value limit]'); break; }
          if (count++) append(', ');
          if (!array) { if (typeof key === 'string') quote(key); else append('[Symbol]'); append(': '); }
          const d = descriptor(v, key);
          if (!d || !descriptor(d, 'value')) append('[Accessor]');
          else format(d.value, depth + 1, true);
        }
        append(array ? ']' : '}');
      } catch { append('[Uninspectable]'); }
    }
    for (let i = 0; i < args.length && !stopped; i++) {
      if (i >= 50 || nodes >= 50) { state.truncated = true; append(' [Value limit]'); break; }
      if (i) append(' ');
      format(args[i], 0, false);
    }
    if (stopped && cap >= 11) { text += '[Truncated]'; size += 11; }
    // JSON encoding preserves embedded NUL and lone surrogates across the WASM string API.
    const entry = create(null); entry.level = level; entry.text = stringify(text);
    entries[state.count++] = entry; remainingBytes -= size;
  }
  const console = create(null);
  console.log = (...args) => capture('log', args);
  console.info = (...args) => capture('info', args);
  console.warn = (...args) => capture('warn', args);
  console.error = (...args) => capture('error', args);
  return { console: freeze(console), state };
})`;
