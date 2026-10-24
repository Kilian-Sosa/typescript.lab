# Bounded learner console Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. No delegated review is requested.

**Goal:** Implement issue #14 with bounded VM console output tied to the current run.
**Architecture:** VM-only capture, terminal transcript through the existing iframe envelope, transient extended adapter result, accessible Vue Console.
**Tech Stack:** Vue 3, TypeScript, Vitest, QuickJS-WASM, Edge.
**Spec:** docs/superpowers/specs/2026-10-24-learner-console-design.md

## Global Constraints
- Preserve frozen shared/contracts/v1.ts, existing 64 KiB envelope, VM memory/stack/deadlines and all origin/session gates.
- No dependencies, runtime configuration, persistence or hosted changes.
- 100 messages, 2048 UTF-8 bytes/message, 16384 text bytes/run; depth 4, 50 values/properties/call.
- Only log/info/warn/error; plain text; clear on edit, cancel, reset and subsequent runs.

## Review Focus
- Poisoned intrinsics, getters, proxies and circular values cannot escape VM budgets.
- Multi-byte text and JSON escaping cannot overflow transport.
- Module logs repeat in each case context and remain ordered.
- Older runner builds report capture unavailable.
- Aborted or stale responses never restore output.

### Task 1: VM capture and protocol
**Files:** apps/runner/src/{console,protocol,evaluator,supervisor,worker}.ts; supported-lib.txt; tests/console.test.ts.
**Interfaces:** ConsoleTranscript { entries: { sequence, caseId, level, text }[], truncated }; optional consoleOutput on Worker reply/envelope for old-build compatibility.
- [x] Write real VM and supervisor tests for levels, order, safe formatting, bounds, errors, timeout and forged transcripts; run RED.
- [x] Implement VM-only formatter with pristine intrinsics and bounded retained strings; extract only serialized strings after execution. Add matching compiler declarations.
- [x] Validate transcripts at supervisor boundary; preserve envelope size limits and old-build absence. Run runner tests GREEN.

### Task 2: Adapter and accessible Console
**Files:** src/features/runner/{runChallenge.ts,RunnerControls.vue,ConsoleOutput.vue} and associated tests.
**Interfaces:** RunFeedback extends RunResult with optional consoleOutput; frozen RunResult remains unchanged.
- [x] Write adapter/UI tests for validation, identity, plain text, empty/running/final/unavailable, edit/reset and late cancelled success; run RED.
- [x] Validate full envelope and transcript in adapter. Add Console region and clear cancellation immediately with generation invalidation.
- [x] Run root tests and strict typechecks/builds GREEN.

### Task 3: Browser and handoff
**Files:** scripts/check-runner-local.mjs; runner README; design README; this execution record.
- [x] Extend existing actual iframe/Worker/QuickJS Edge check for logs, error preservation, cancellation, stale clearing and responsive plain text.
- [x] Run root/runner suites and builds, local Edge regression, diff whitespace and direct spec-to-code review.
- [x] Record results and limitations; leave scoped diff for review without deploying/pushing.

## Execution record
Base: 76c1cff (owner-selected runner activation branch, including merged compiler globals).
Spec impact: add focused spec; preserve v1 contracts and persistence.
Pre-flight: Task 1 produces consoleOutput consumed by Task 2; both use runner-owned types and exact validators. Task 3 exercises that same interface.
Review: inline self-review under owner cost policy; no independent reviewer was requested or launched.

### Verification, 2026-10-24

- Baseline: app 193/193; runner 145/145. Console RED: six missing-API failures, protocol missing-forwarding failure, four adapter/UI failures.
- Final app: 25 files, 205 tests passed. Final runner: five files, 167 tests passed. Both strict typechecks and Vite builds passed.
- Existing local Edge suite passed at 1280px and 390px through actual cross-site iframe/Worker/QuickJS. Console checks cover all levels, case ordering, HTML-as-text, truncation, exception output, edit/cancel clearing and keyboard scrolling. Existing CSP/storage/resource/retry/forged-result checks also passed.
- Discovered and fixed a lossless extraction edge: QuickJS getString truncates embedded NUL. VM JSON encoding plus host decoding preserves NUL/lone surrogates; conservative escaping charges prevent wire-budget overflow. Regression observed RED then GREEN.
- App and runner suites ran sequentially after one shared dependency-cache collision (ENOTEMPTY); the sequential rerun passed. No cache reset or global configuration change.
- Direct self-review: requirement-to-code and code-to-spec checks complete; frozen shared/contracts/v1.ts unchanged. No dependencies, environment variables, persistence, flags, hosted configuration, deployments or pushes changed.
- Output is terminal, not streaming. Forced Worker termination or infrastructure failure reports capture unavailable; normal exceptions and VM interrupt timeouts preserve logs. This limitation is explicit in the approved spec and UI.
