import ts from 'typescript';
import { getQuickJS } from 'quickjs-emscripten';

const PACKAGE_VERSION = '0.32.0';
const LIMITS = {
  sourceBytes: 32 * 1024,
  inputBytes: 1024 * 1024,
  maxCases: 100,
  outputBytes: 64 * 1024,
  quickJsMemoryBytes: 32 * 1024 * 1024,
  quickJsStackBytes: 128 * 1024,
  executionMs: 2000,
};
const LIB_FILE = '/runner-lib.d.ts';
const SOURCE_FILE = '/learner.ts';
const LIB_SOURCE = `
interface Object {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments { length: number; callee: Function; [index: number]: any; }
interface String { readonly length: number; repeat(count: number): string; }
interface Number {}
interface Boolean {}
interface RegExp { test(value: string): boolean; }
interface Symbol {}
interface Array<T> {
  readonly length: number;
  [index: number]: T;
  fill(value: T): this;
}
interface ReadonlyArray<T> extends Array<T> {}
interface Map<K, V> {
  readonly size: number;
  get(key: K): V | undefined;
  set(key: K, value: V): this;
  delete(key: K): boolean;
}
interface MapConstructor { new <K, V>(): Map<K, V>; }
declare var Map: MapConstructor;
interface ArrayConstructor { new <T>(length?: number): Array<T>; }
declare var Array: ArrayConstructor;
interface Error { readonly name: string; readonly message: string; }
interface ErrorConstructor { new(message?: string): Error; }
declare var Error: ErrorConstructor;
declare var fetch: unknown;
declare var window: unknown;
declare var document: unknown;
declare var localStorage: unknown;
declare var indexedDB: unknown;
declare var parent: unknown;
declare var location: unknown;
declare var WebSocket: unknown;
declare var XMLHttpRequest: unknown;
declare var self: unknown;
declare var Worker: unknown;
declare var process: unknown;
declare var require: unknown;
declare var postMessage: unknown;
`;

const utf8 = new TextEncoder();

function utf8Bytes(value) {
  return utf8.encode(value).byteLength;
}

function isPlainJson(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isPlainJson(item, seen))
    : Object.getPrototypeOf(value) === Object.prototype &&
      Object.values(value).every((item) => isPlainJson(item, seen));
  seen.delete(value);
  return valid;
}

function flatten(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

function policyViolation(sourceFile) {
  let violation = null;
  function visit(node) {
    if (violation) return;
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      violation = 'Static imports are not supported.';
      return;
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      violation = 'Dynamic imports and require are not supported.';
      return;
    }
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
      violation = 'import.meta is not supported.';
      return;
    }
    if (
      ts.isAwaitExpression(node) ||
      (ts.isFunctionLike(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword))
    ) {
      violation = 'Asynchronous code is not supported.';
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return violation;
}

function checkTypes(source) {
  const sourceFile = ts.createSourceFile(SOURCE_FILE, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const syntaxDiagnostics = sourceFile.parseDiagnostics;
  if (syntaxDiagnostics.length > 0) {
    return { status: 'compile-error', diagnostics: syntaxDiagnostics.map(flatten) };
  }

  const policy = policyViolation(sourceFile);
  if (policy) return { status: 'policy-rejected', diagnostics: [policy] };

  const files = new Map([
    [LIB_FILE, LIB_SOURCE],
    [SOURCE_FILE, source],
  ]);
  const options = {
    noLib: true,
    noEmit: true,
    strict: true,
    exactOptionalPropertyTypes: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    skipLibCheck: true,
  };
  const host = {
    getDefaultLibFileName: () => LIB_FILE,
    getSourceFile: (fileName, languageVersion) => {
      const text = files.get(fileName);
      return text === undefined ? undefined : ts.createSourceFile(fileName, text, languageVersion, true);
    },
    writeFile: () => {},
    getCurrentDirectory: () => '/',
    getDirectories: () => [],
    fileExists: (fileName) => files.has(fileName),
    readFile: (fileName) => files.get(fileName),
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    directoryExists: (directoryName) => directoryName === '/',
    realpath: (fileName) => fileName,
  };

  const program = ts.createProgram([LIB_FILE, SOURCE_FILE], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length > 0) {
    return { status: 'compile-error', diagnostics: diagnostics.map(flatten) };
  }

  const transpiled = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      strict: true,
    },
  });
  const emitErrors = (transpiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (emitErrors.length > 0) {
    return { status: 'compile-error', diagnostics: emitErrors.map(flatten) };
  }
  return { status: 'ok', javascript: transpiled.outputText, diagnostics: [] };
}

function dumpError(context, handle) {
  try {
    const value = context.dump(handle);
    if (typeof value === 'string') return value.slice(0, 2000);
    if (value && typeof value.message === 'string') return value.message.slice(0, 2000);
    return String(value).slice(0, 2000);
  } catch {
    return 'QuickJS runtime error.';
  } finally {
    handle.dispose();
  }
}

function takeValue(result, context) {
  if ('error' in result) throw new Error(dumpError(context, result.error));
  return result.value;
}

async function evaluateRun(payload) {
  const workerStartedAt = performance.now();
  const typeResult = checkTypes(payload.source);
  if (typeResult.status === 'policy-rejected') {
    return { status: 'policy-rejected', diagnostics: typeResult.diagnostics, cases: [] };
  }
  if (typeResult.status === 'compile-error') {
    return { status: 'compile-error', diagnostics: typeResult.diagnostics, cases: [] };
  }

  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  let interrupted = false;
  const deadline = performance.now() + LIMITS.executionMs;
  runtime.setMemoryLimit(LIMITS.quickJsMemoryBytes);
  runtime.setMaxStackSize(LIMITS.quickJsStackBytes);
  if (payload.testDisableVmInterrupt !== true) {
    runtime.setInterruptHandler(() => {
      interrupted = performance.now() >= deadline;
      return interrupted;
    });
  }

  const results = [];
  let status = 'ok';
  let diagnostics = [];
  try {
    for (const testCase of payload.cases) {
      const context = runtime.newContext();
      const handles = [];
      const retain = (handle) => {
        handles.push(handle);
        return handle;
      };
      try {
        const exportsHandle = retain(context.newObject());
        context.setProp(context.global, 'exports', exportsHandle);

        const jsonHandle = retain(context.getProp(context.global, 'JSON'));
        const stringifyHandle = retain(context.getProp(jsonHandle, 'stringify'));
        const parseHandle = retain(context.getProp(jsonHandle, 'parse'));
        const sourceResult = context.evalCode(typeResult.javascript, 'learner.js');
        if ('error' in sourceResult) {
          status = interrupted ? 'timeout' : 'execution-error';
          diagnostics = [dumpError(context, sourceResult.error)];
          results.push({ caseId: testCase.id, status: status === 'timeout' ? 'timeout' : 'execution-error' });
          break;
        }
        retain(sourceResult.value);

        const moduleExports = retain(context.getProp(context.global, 'exports'));
        const functionHandle = retain(context.getProp(moduleExports, 'longestWindow'));
        const encodedInput = JSON.stringify(testCase.input);
        const inputTextHandle = retain(context.newString(encodedInput));
        const inputHandle = retain(takeValue(context.callFunction(parseHandle, jsonHandle, inputTextHandle), context));
        const eventsHandle = retain(context.getProp(inputHandle, 'events'));
        const kHandle = retain(context.getProp(inputHandle, 'k'));
        const callResult = context.callFunction(functionHandle, context.undefined, eventsHandle, kHandle);
        if ('error' in callResult) {
          status = interrupted ? 'timeout' : 'execution-error';
          diagnostics = [dumpError(context, callResult.error)];
          results.push({ caseId: testCase.id, status: status === 'timeout' ? 'timeout' : 'execution-error' });
          break;
        }
        retain(callResult.value);

        const stringifyResult = context.callFunction(stringifyHandle, jsonHandle, callResult.value);
        if ('error' in stringifyResult) {
          status = 'policy-rejected';
          diagnostics = [dumpError(context, stringifyResult.error)];
          results.push({ caseId: testCase.id, status: 'policy-rejected' });
        } else {
          retain(stringifyResult.value);
          const serialized = context.dump(stringifyResult.value);
          if (typeof serialized !== 'string' || utf8Bytes(serialized) > LIMITS.outputBytes) {
            status = 'policy-rejected';
            diagnostics = ['Output must be JSON data no larger than 64 KiB.'];
            results.push({ caseId: testCase.id, status: 'policy-rejected' });
          } else {
            results.push({ caseId: testCase.id, status: 'actual', actual: JSON.parse(serialized) });
          }
        }

        if (status !== 'ok') break;
      } catch (error) {
        status = interrupted ? 'timeout' : 'execution-error';
        diagnostics = [String(error?.message ?? error).slice(0, 2000)];
        results.push({ caseId: testCase.id, status: status === 'timeout' ? 'timeout' : 'execution-error' });
        break;
      } finally {
        for (let index = handles.length - 1; index >= 0; index -= 1) {
          handles[index].dispose();
        }
        context.dispose();
      }
    }
  } finally {
    runtime.dispose();
  }

  return {
    status,
    diagnostics,
    cases: results,
    quickjsVersion: PACKAGE_VERSION,
    runtimeMs: Math.round(performance.now() - workerStartedAt),
    limits: {
      memoryBytes: LIMITS.quickJsMemoryBytes,
      stackBytes: LIMITS.quickJsStackBytes,
      executionMs: LIMITS.executionMs,
      sourceBytes: LIMITS.sourceBytes,
      inputBytes: LIMITS.inputBytes,
      outputBytes: LIMITS.outputBytes,
      maxCases: LIMITS.maxCases,
    },
  };
}

function validate(payload) {
  if (
    !payload ||
    payload.kind !== 'run' ||
    typeof payload.runId !== 'string' ||
    !Number.isInteger(payload.sourceRevision) ||
    typeof payload.source !== 'string' ||
    !Array.isArray(payload.cases) ||
    payload.cases.length === 0 ||
    payload.cases.length > LIMITS.maxCases
  ) {
    return 'Invalid run envelope.';
  }
  if (utf8Bytes(payload.source) > LIMITS.sourceBytes) return 'Source exceeds 32 KiB.';
  if (!payload.cases.every((item) => item && typeof item.id === 'string' && isPlainJson(item.input))) {
    return 'Cases must contain only JSON-compatible inputs.';
  }
  const inputText = JSON.stringify(payload.cases.map(({ id, input }) => ({ id, input })));
  if (utf8Bytes(inputText) > LIMITS.inputBytes) return 'Serialized inputs exceed 1 MiB.';
  return null;
}

self.addEventListener('message', async (event) => {
  const payload = event.data;
  const workerId = typeof payload?.workerId === 'string' ? payload.workerId : 'invalid-worker';
  const error = validate(payload);
  if (error) {
    self.postMessage({
      kind: 'result',
      workerId,
      runId: payload?.runId ?? '',
      sourceRevision: payload?.sourceRevision ?? -1,
      status: 'policy-rejected',
      diagnostics: [error],
      cases: [],
    });
    return;
  }
  const workerPayloadKeys = Object.keys(payload).sort();
  const hasExpectedValues = payload.cases.some((item) => Object.hasOwn(item, 'expected'));
  let workerNetworkBlocked = false;
  if (Number.isInteger(payload.probePort) && payload.probePort > 0 && payload.probePort <= 65535) {
    try {
      await fetch(`http://app.test:${payload.probePort}/probe-target`, { method: 'POST', mode: 'no-cors' });
    } catch {
      workerNetworkBlocked = true;
    }
  }
  try {
    const result = await evaluateRun(payload);
    self.postMessage({
      kind: 'result',
      workerId,
      runId: payload.runId,
      sourceRevision: payload.sourceRevision,
      workerPayloadKeys,
      hasExpectedValues,
      workerNetworkBlocked,
      ...result,
    });
  } catch (error) {
    self.postMessage({
      kind: 'result',
      workerId,
      runId: payload.runId,
      sourceRevision: payload.sourceRevision,
      workerPayloadKeys,
      hasExpectedValues,
      status: 'infrastructure-error',
      diagnostics: [String(error?.message ?? error).slice(0, 2000)],
      cases: [],
    });
  }
});
