# Isolated static runner — M3 Task 1

This package evaluates the current learner source in QuickJS/WASM inside a disposable Worker. The frame supervisor compares actual JSON outputs with the versioned canonical fixtures outside the VM. It imports cases, never the canonical solution. Shared Contracts v1 remains unchanged. Results are educational feedback, not trusted grading.

Task 1 is local implementation only. [Task 2 Vue integration](../../docs/security/2026-10-18-m3-task2-editor.md) connects the actual draft editor with validated, revision-bound results and accessible feedback. Hosted isolation, TLS/cookie/header verification and owner authorization remain Task 3 gates. Production execution remains disabled in the main app.

Run `node --test scripts/check-runner-local.mjs` from the repository root to exercise the real Vue app and built iframe at desktop/mobile sizes. It starts and closes its own two local test sites and requires installed Edge (or `PLAYWRIGHT_BROWSER_CHANNEL=chromium` in CI). Local integration requires development mode, `VITE_ENABLE_LOCAL_RUNNER=1`, an exact `VITE_RUNNER_ORIGIN=http://runner.test:<port>` and an `http://app.test:<port>` app origin. The fixture supplies these process-local settings, browser-only hostname mapping and a test-only frame policy. Production builds cannot activate execution through these variables. No hosted URLs are approved by this local fixture.

## Local verification

From the repository root in PowerShell, with Node 24 and pinned pnpm 11.25.0:

```powershell
pnpm --dir apps/runner install --ignore-workspace --frozen-lockfile
pnpm --dir apps/runner test
$env:VITE_RUNNER_PARENT_ORIGIN = 'https://lab-app.vercel.app'
$env:VITE_RUNNER_ORIGIN = 'https://lab-runner.vercel.app'
pnpm --dir apps/runner build
$env:PLAYWRIGHT_BROWSER_CHANNEL = 'msedge'
pnpm --dir apps/runner test:browser
```

The example hostnames are build-validation placeholders, not provisioned resources or approved destinations. The browser test builds a separate synthetic `app.test`/`runner.test` fixture, serves the generated response policies, and closes its browser and servers. Its test-only local-origin switch is confined to build configuration; the message protocol cannot disable VM limits. On Linux CI use the installed Playwright `chromium` channel. Windows sandboxed Edge may need a narrowly approved rerun outside the sandbox.

The build emits static assets and response routes in `.vercel/output/` using the [Vercel Build Output API](https://vercel.com/docs/build-output-api/configuration). Page responses prohibit connections, child frames and objects; the entry Worker response permits same-origin static WASM bootstrap, prohibits nested Workers, and allows `wasm-unsafe-eval` only there. Serve the **complete generated output with its routing configuration**, not the static directory alone. A future deployment must verify the actual response headers. Do not run a deployment command as part of local verification.

Builds fail without two exact HTTPS origins on distinct single-label `*.vercel.app` sites. Custom domains need the separately specified cookie/site review before this restriction is broadened. The frame also checks its actual origin against the configured runner origin and remains inert outside that origin. The main app must pin this origin, use `sandbox="allow-scripts allow-same-origin"` only cross-site, and validate source/origin/nonce/active metadata/result schema; Task 1 does not implement that parent adapter.

## Protocol and lifecycle

The frame sends `{ protocol: 1, kind: 'ready' }` to the exact configured parent. The parent sends `{ protocol: 1, kind: 'handshake', nonce }`; the frame acknowledges with `handshake-ack`. The nonce is 16–128 ASCII word/hyphen characters, generated freshly by the parent. One handshake binds one frame session; replayed handshakes are ignored.

Run input is exactly `{ protocol: 1, kind: 'run', nonce, runId, sourceRevision, challengeId: 'longest-window', challengeVersion: '1.0.0', source }`. Requests cannot replace canonical cases, expected values, entry point, resource caps or compiler settings. Unknown fields, invalid schemas, wrong origin/window/nonce and stale/replayed requests are ignored before Worker allocation. Each run ID is 1–128 word/hyphen characters; revisions are nonnegative safe integers. The parent owns the startup timeout and discards replies after an editor revision changes (Task 2).

Cancellation is `{ protocol: 1, kind: 'cancel', nonce, runId, sourceRevision }`, matching the active run. Terminal replies are `{ protocol: 1, kind: 'run-result', nonce, result: RunResult }`. A cancelled run returns `execution-error` with `reason: 'cancelled'`; policy rejection uses `reason: 'policy-rejected'`; learner exceptions use `reason: 'runtime-error'`. Invalid Worker output and startup/crash/clone failures are `infrastructure-error`, never fabricated passes. Failed or interrupted suites provide diagnostics and mark cases `not-run` rather than claiming completed case results; complete successful VM evaluations expose expected/actual and honest assertion results.

The supervisor allows one active Worker, rejects concurrent requests before allocation, retires accepted IDs, and rejects older revisions. It retains at most 128 run IDs per frame session; reload/re-handshake after session exhaustion. A fresh Worker, WASM module and runtime are created per accepted run, with a fresh context for each case. Completion, cancellation, crash, timeout and pagehide terminate the Worker. Tests capture a delayed cancelled reply to verify it cannot overwrite a terminal result.

## Supported source and bounds

TypeScript 5.9.3 performs strict syntactic and semantic checking with the explicit synthetic declarations in `src/supported-lib.txt`, followed by CommonJS emission targeting ES2022. This is a restricted library, **not full TypeScript standard-library or DOM support**. It covers the canonical algorithm’s arrays, strings and Map operations; unsupported declarations produce compile diagnostics. Static/dynamic imports, re-exports from modules, import types/import.meta, require calls, async/await and generators are rejected. Only synchronous pure functions are supported. QuickJS has no browser/Node APIs, module loader, timers, console bridge or host callbacks. The selected interpreter is the pinned MIT-licensed QuickJS 0.32.0 release synchronous variant; the upstream package also emits unused variant assets, while the browser loads the selected synchronous WASM.

The numeric library also supports deterministic ES2022 `Math` methods/constants (including `floor` and `max`), primitive `Number(value?)` conversion, Number constants and static predicates/parsers, and global `Infinity`, `NaN`, `isFinite`, `isNaN`, `parseFloat` and `parseInt`. See the [exact supported surface](../../docs/superpowers/specs/2026-10-17-dedicated-runner-design.md#supported-numeric-source-library-issue-11-2026-10-24) and `tests/standard-globals.test.ts` for compiler + actual QuickJS coverage of every added API. `Math.random` and boxed Number construction are outside the declared subset. Nonfinite intermediate values are valid, but nonfinite output is rejected by the JSON boundary. These declarations do not add any native host capability or replace the VM isolation boundary.

`console.log`/`info`/`warn`/`error` remain compile errors until [issue #14](https://github.com/Kilian-Sosa/typescript.lab/issues/14) supplies bounded isolated output capture and display. This fix does not install a fake console that silently discards messages.

| Resource | Limit |
| --- | --- |
| Source | 32 KiB UTF-8 |
| Worker inputs | 1 MiB serialized JSON, at most 100 cases; currently 14 canonical cases |
| JSON shape | Dense arrays, finite numbers, no cycles, depth ≤32, ≤100,000 nodes |
| Output | 64 KiB aggregate and final serialized envelope |
| Diagnostics | 20 strings, at most 2,000 UTF-8 bytes each; generated diagnostics further truncated |
| QuickJS heap / stack | 32 MiB / 128 KiB |
| VM interrupt deadline | 2 seconds across the suite |
| Independent Worker deadline | 3 seconds, including compiler and WASM startup |
| Concurrency / retained IDs | One Worker / 128 accepted runs per frame session |

The VM output boundary snapshots own enumerable data descriptors once, then serializes null-prototype containers using captured intrinsics. It rejects accessors without calling them, class/custom prototypes, serialization hooks, sparse arrays, nonfinite values, cycles, symbols, extra array properties and non-enumerable record fields. VM mutations of iterators, prototype methods or global serialization functions cannot alter the snapshot. Plain and null-prototype records, dense arrays and ordinary string keys (including `__proto__` and a non-callable `toJSON` value) remain supported.

These are application budgets, not browser-process quotas. Slow startup may honestly time out. Oversized or non-JSON output is rejected; no expected values or reference implementations enter the VM. Real mobile, cold remote cache, offline recovery and cross-browser compatibility remain incomplete. See the [Task 1 evidence](../../docs/security/2026-10-18-m3-task1-runner.md) and [JSON-boundary correction](../../docs/security/2026-10-18-m3-json-boundary-correction.md).
