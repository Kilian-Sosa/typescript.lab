# Bounded learner console — issue #14

**Status:** Approved by owner, 2026-10-24. Implements [issue #14](https://github.com/Kilian-Sosa/typescript.lab/issues/14).

**Spec impact: add focused spec.** Extends REQ-04 and REQ-12 of the approved product design; preserves the dedicated runner architecture, budgets, security gates and frozen `shared/contracts/v1.ts`. This authorizes no deployment or infrastructure change.

## Experience and lifecycle

Show a dedicated, labelled Console region below test results in Solve, using the existing visual tokens. Render messages as plain text, with visible level and case identity in execution order. Show empty, running, completed and cleared/stale states; include run ID, source revision and final status. Diagnostics remain in TestResults. Announce a compact summary politely rather than reading every line automatically. The bounded transcript can scroll with keyboard focus and wraps long text on small screens.

Capture `console.log`, `console.info`, `console.warn` and `console.error` inside QuickJS. Capture module initialization and function calls for each fresh case context. Number messages from zero across the run; associate each with its canonical case ID. Preserve captured messages on normal runtime exceptions and VM-interrupt timeouts. A hard Worker termination or infrastructure failure has no recoverable transcript and must say so. Clear messages immediately on cancellation, source/challenge/version changes, account generation reset, unmount and subsequent runs; late replies cannot restore them.

## Approach

Recommended: return one bounded transcript with the terminal Worker reply and iframe envelope. No per-line host callbacks or streaming messages. This preserves the current single-result lifecycle and prevents cross-frame message flooding. Tradeoff: output is visible only after completion, and is lost if the Worker is forcibly terminated.

Alternative: stream bounded batches. This could retain pre-timeout output, but adds acknowledgement/backpressure and extra cancellation/order states. Defer it; issue #14 does not require live output.

## Bounds and safe formatting

- Maximum 100 entries per run; maximum 2,048 UTF-8 bytes per entry and 16,384 UTF-8 text bytes per run. The existing 65,536-byte total reply/envelope budget still applies.
- At most depth 4, 50 inspected values and 50 properties/array positions per console call. Limit arguments before traversing them. Stop formatting entirely after the transcript is full and expose a boolean truncation indicator. No growing dropped-message counter.
- Format inside the VM with captured pristine intrinsics. Bound string construction before it reaches the host. Preserve Unicode code points at truncation boundaries; quote control characters in structured values. Circular objects, accessors, unsupported values, excess depth/properties and truncation have explicit text markers. Never invoke getters, `toJSON`, custom coercion or learner iterators deliberately. Proxy traps remain subject to VM interrupts, memory/stack and the independent Worker deadline.
- No browser/global host console forwarding, object handles, native callbacks, network, storage, cookies, credentials, private drafts or account metadata cross the boundary. Console is a VM-only object with matching compiler declarations.

## Protocol and compatibility

Keep `RunResult` v1 unchanged. Define one runner-owned console transcript shape in a small shared runner module: `{ entries: { sequence, caseId, level, text }[], truncated }`. Add it to the ephemeral Worker reply and iframe run-result envelope, not to persisted attempt summaries. Expose it to the UI through the runner adapter's extended completed-result type. Treat absent console data from older runner builds as unavailable, never as successfully captured empty output.

Both supervisor and parent validate exact keys, levels, contiguous sequence, canonical case identity/order, UTF-8 limits, total size and truncation type before forwarding/displaying a transcript. Existing nonce/origin/window/run/revision/challenge checks remain mandatory. Invalid data produces infrastructure failure. Cancellation clears output even if a mocked or delayed runner returns success later.

## Acceptance evidence

Real QuickJS tests cover all four levels, module/function output, ordering across cases, circular/deep/accessor/hostile values, Unicode, large strings, count/total truncation, repeated floods, thrown exceptions and interrupt timeout. Protocol tests cover malformed/forged/oversized transcripts and stale/cancelled replies. Vue tests cover named regions, plain text rendering, empty/running/final/unavailable states, run identity, edit/reset/sign-out/cancel/retry invalidation. Run the root and runner suites, typechecks/builds, and a local Edge browser regression through the actual iframe/Worker/QuickJS path when the environment permits.

No environment-variable, dependency, persistence or deployment changes are expected. The separate compiler-globals issue retains ownership of Math and other globals; this change declares only the four console methods actually implemented here.
