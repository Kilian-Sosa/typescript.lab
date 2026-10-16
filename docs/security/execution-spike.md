# TypeScript execution security spike

**Status:** Task 0 investigation complete; awaiting the owner's security architecture decision. No production runner is approved by this report.

**Spec impact:** No spec change. This is the disposable investigation required by Task 0 of the runner plan; no product behavior or shared contract changed. Governing requirements are REQ-03, REQ-04, REQ-12 and ADR-0002.

## Decision requested

Do not proceed with a same-origin worker, an opaque iframe with permissive network policy, or a runner that differs from the app only by port. A conditional browser-side candidate is a dedicated untrusted **site** with a restrictive iframe and a per-run worker, no shared app/session cookies, no sensitive persistent runner state, strict response CSP, and parent-controlled termination. The owner must explicitly approve or reject that architecture before Task 1. If a dedicated site and its deployment controls cannot be assured, use the plan's external-playground fallback after its privacy and security review. Do not use a browser message as trusted scoring.

This is a feasibility spike in one browser, not a production security approval. The tested runner used a different port on the **same host**. Its storage separation worked, but its app cookie isolation did not. The next architecture decision must include the deployment hostname and cookie configuration, not just a distinct origin tuple.

## Threat model

The adversary is a learner who can submit arbitrary TypeScript that becomes JavaScript, including deliberate access attempts, loops, network requests, imports, and forged messages. Treat every byte of submitted source and every result from the browser execution boundary as untrusted. The probe runs only fixed adversarial fixtures in disposable local pages; no arbitrary production-user source or privileged server code was executed.

Assets and forbidden capabilities:

- App session material, cookies, local storage, IndexedDB, private drafts and submissions, and authenticated app endpoints must remain inaccessible to learner code.
- Learner code must not read or mutate the app document or its JavaScript state.
- It must not load unapproved code or send data to arbitrary network destinations.
- An endless synchronous loop must not freeze the app UI; a parent outside the worker must be able to terminate that run.
- Learner code must not create a trusted pass by posting a fabricated result. Browser execution can provide educational feedback only; any authoritative achievement or submission decision needs an independent server-side verification policy.
- Repeated runs/users must not gain access to data persisted by earlier untrusted runs on a shared runner origin.

## Probe setup and results

The reproducible harness is retained in [`spikes/runner/`](../../spikes/runner/). It starts two disposable loopback HTTP servers on random ports, launches a fresh headless Edge context, and closes the context, browser and server connections in `finally`. Its fixtures seed only synthetic canaries. The exact machine-local JSON and full test log are intentionally ignored under `docs/prompts/`.

Browser run: Microsoft Edge 155.0.4283.45, `http://127.0.0.1:<random-port>` app and runner origins. The tuple origins differed by port but shared host and cookie scope. The isolated frame had `sandbox="allow-scripts allow-same-origin"`; the app frame allowed the runner origin. Runner page CSP denied connections and nested frames, allowed its static script and one same-origin worker. The worker response carried `default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'` so the worker could evaluate transpiled output while blocking tested imports, connections and nested workers.

| Probe | Observed result | Security implication |
| --- | --- | --- |
| Same-origin worker | No DOM, but it read the app IndexedDB canary, made a same-origin request carrying the synthetic app-cookie canary, and ran an infinite loop until the host terminated it. The host remained responsive. | A worker removes direct DOM access; it does not isolate origin storage or network credentials. It is not a security boundary by itself. |
| Sandboxed opaque-origin iframe (`allow-scripts`) | `event.origin` was `"null"`; localStorage and IndexedDB access threw `SecurityError`; parent DOM read failed; with `connect-src 'none'`, the app server saw no request. The iframe's fake `passed` message was received. | Opaque origin plus CSP blocks the probed capabilities, but the parent still receives attacker-controlled messages. `event.origin` is not an identity for this frame and a message is never proof of a grade. |
| Opaque iframe control | A control frame with `connect-src` allowing the app origin sent a no-CORS POST; the app server observed it with `Origin: null`. | Opaque origin alone does not prevent network side effects. Enforce CSP and treat CORS response-read restrictions as distinct from preventing a request. |
| Different-port iframe plus dedicated worker | Parent DOM and app localStorage/IndexedDB canary were unavailable; runner storage and IndexedDB existed. Page and worker fetch attempts were blocked before reaching the app server. `importScripts`, dynamic `import()`, and nested Worker were blocked before their fixture scripts loaded. A tight worker loop was terminated while the host stayed responsive. A fake pass message was received. | CSP and parent-controlled termination constrained these tested paths. This is still only an origin-by-port probe, not evidence of isolation from cookie scope, persistent runner-origin data, other browsers or browser vulnerabilities. |
| Cookie boundary | The different-port runner frame could read the app's synthetic non-HttpOnly cookie (`document.cookie`); the same-host/different-port control confirmed it. The app worker's same-origin request also carried that cookie. The runner's CSP-blocked request did not reach the app. | A port change is not a cookie boundary. A dedicated runner host/site and host-only app cookies are required; do not share a parent-domain auth cookie with the runner. |
| TypeScript feasibility | TypeScript 5.9.3 `transpileModule` emitted JavaScript that ran and returned `42`. A source with `const answer: number = "not-a-number"` also emitted output with zero semantic error diagnostics. | Single-file transpilation is feasible for runtime output, but it does not type-check. Compile diagnostics must come from a separate real checker and remain distinct from runtime/test results. Imports were blocked at runtime in the worker fixture; import syntax/emit behavior was not separately evaluated. |
| Cleanup | Browser context, browser process and both local servers closed successfully. | The disposable harness cleans up its resources on the successful run; cleanup under browser startup failure is in the `finally` path but was not separately fault-injected. |

Run completed: **6/6 Node tests passed**, exit code 0, 1.89 s. The detailed evidence file records origin values, request logs, worker/network outcomes and cleanup flags at `docs/prompts/track-c-evidence.json` (ignored). The test log is `docs/prompts/track-c-probe.log` (ignored).

Reproduce from the repository root on Windows PowerShell in a checkout where these package directories are already present under local `node_modules`. The command points the harness at them; it does not install packages or edit manifests. The exact package paths used for the recorded run are kept in the ignored local report.

```powershell
$env:LAB_RUNNER_PLAYWRIGHT_MODULE=(Resolve-Path '.\node_modules\@playwright\test').Path
$env:LAB_RUNNER_TYPESCRIPT_MODULE=(Resolve-Path '.\node_modules\typescript').Path
node --test spikes\runner\probe.test.mjs
```

Static checks also passed: `node --check spikes\runner\probe.mjs`, `node --check spikes\runner\probe.test.mjs`, and `git diff --check`.

## Interpretation and constraints

The origin standard separates web storage by scheme/host/port, but cookies follow host/domain and path rules rather than the origin tuple. The probe demonstrates the practical consequence: same-host ports isolate localStorage and IndexedDB while exposing a non-HttpOnly cookie. A runner on a subdomain also must not receive an app cookie set for a parent domain. Prefer app auth cookies that are host-only (and, where applicable, `Secure`, `HttpOnly`, and `__Host-` prefixed); do not treat `SameSite` or CORS as a replacement for the runner boundary.

Workers have no direct DOM, but the browser API surface includes IndexedDB and network APIs, and workers can create other workers absent policy. Put the worker on the untrusted runner site, serve a dedicated CSP on the worker script response, disallow arbitrary imports, and use an independently responsive supervisor that can terminate that worker. The test's `unsafe-eval` exists only on its disposable worker response to evaluate output; shipping that permission requires an owner-approved policy and tightly controlled static worker bootstrap. CSP is defense-in-depth: test the exact deployment headers and browser matrix, not only this loopback fixture.

The probe did **not** establish a hard CPU or memory budget. It tested one tight synchronous loop that the iframe supervisor terminated after 150 ms. It did not test memory exhaustion, worker floods, browser process failure, tab suspension/background timer throttling, cross-browser differences, CSP bypasses, browser exploits, WebSocket/beacon/other side channels, cross-user persistence, session-cookie configurations used by production, or deployed TLS/DNS/header configuration. Runner-page localStorage and worker IndexedDB APIs were available on the runner origin; the worker can use IndexedDB, so a shared persistent runner origin could become a cross-run data channel if user/run data is put there. Cross-user persistence was not directly tested. A production design must isolate or avoid such state (for example, short-lived per-run/per-user origins) and add explicit source-size, execution-time, output-size and concurrency limits. A browser limit is still not trusted grading.

## Architecture comparison

- **Opaque-origin sandboxed iframe:** useful as a browser defense layer; tested access to app storage and parent DOM was denied. It needs CSP to stop network requests, and its `null` message origin plus attacker-controlled `postMessage` results prevent trusting its reports. Worker compatibility under the opaque origin was not probed.
- **Dedicated untrusted site + sandboxed iframe + worker:** the strongest browser-side candidate from this spike. It can keep code out of app origin, use response CSP to restrict connection/import/worker paths, and terminate an individual worker. It must be a real dedicated site, not merely a different port; app cookies must not be shared; runner persistent storage must not cross users/runs. Prove those deployment properties and supported-browser behavior before implementation.
- **Worker on app origin:** rejected as isolation. It can reach app IndexedDB and same-origin authenticated network despite having no DOM. A worker alone also cannot stop itself from a loop; an external watchdog is required.
- **Hardened server sandbox:** deferred. It can be considered if the product later needs trusted execution or stronger resource guarantees, but requires a separate design for ephemeral isolation, no credentials/network by default, memory/CPU/process quotas, cleanup, abuse control and operational cost. This spike did not build or validate it.
- **External playground:** the plan-sanctioned fallback if a separately hosted browser runner is not acceptable. No provider was tested. Before adoption, review source retention and privacy, allowed imports/network, embedding controls, availability, vendor terms and whether results can be forged; do not send private submissions without that review.

## Owner gate

**Recommended decision: no-go for production runner implementation from the current evidence alone.** Reject worker-only and same-host/different-port architectures. The owner may authorize Task 1 only after selecting a separate-site browser architecture with explicit cookie and runner-storage isolation requirements, or may select the external playground path after provider review. A subsequent implementation plan must verify actual deployment origin/cookie headers, iframe and worker CSP response headers, message-source validation, per-run worker termination and resource caps, cross-browser behavior, and the policy that browser passes are educational only. If those controls cannot be demonstrated, stop rather than implement Task 1 or Task 2.

## Source references

- [WHATWG HTML Standard: iframe sandbox flags](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox) — opaque origins, sandbox flags, and the same-origin `allow-scripts`/`allow-same-origin` warning; hostile content should use a dedicated domain.
- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) — origin tuple, Web Storage/IndexedDB separation by origin, and the distinct cookie domain model.
- [RFC 6265: HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265) and [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) — cookie host/domain and path scope; cookies do not use the origin port tuple.
- [MDN: Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) — no direct DOM, but IndexedDB, fetch and nested workers are available.
- [MDN: CSP `connect-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src), [CSP `worker-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src), and [CSP in workers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy#csp_in_workers) — connection/worker restrictions and the need to deliver a policy on the worker response itself.
- [MDN: `importScripts()`](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts) — classic worker imports can load cross-origin unless blocked by CSP or another policy.
- [TypeScript 5.5 release notes: `transpileModule`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html#the-transpiledeclaration-api) — single-file transpilation does not have the full program context; the runtime probe additionally demonstrates that a semantic type mismatch still emits output without semantic diagnostics.
