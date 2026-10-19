# M3 technical implementation closeout — 2026-10-19

**Decision:** M3 **engineering implementation is complete** for the approved, Edge-tested cross-site QuickJS/WASM runner. This is an **implementation closeout**, **not** an unrestricted Q5/Q6 hosted-delivery approval or authorization to activate Production. M3's previously approved hosted Edge matrix remains a separate mandatory release gate where not fully evidenced.

**Authority:** Owner requested M3 closeout after the analogous M4 technical closeout. The accepted runner architecture, ADR-0002, Shared Contracts v1 and the exact hosted QA/release security constraints remain unchanged. Do not infer that the owner waived the mandatory public-runner test matrix or independent hosted reassessment.

## Version and review scope

- Application/runner executable Preview artifacts were built from reviewed `b2a1a6315378fb437a80d270d5170bd9605a19a4`. App Preview ID `dpl_CQqQD8p91MdSoRdhuBT1LQwGhpmP`; runner Preview ID `dpl_DCBqquzSQUtRc3x9p9RFEiCjW4WT`.
- Existing independent read-only security reassessment approved the bounded Preview activation **code** at that source SHA, recorded on PR #9 on 2026-10-18. Task 1 and Task 2 have their own earlier independent code/security evidence. None of these reviews certifies the complete final hosted Q5/Q6 matrix.
- Current PR #9 branch included integration/security test additions at `177db410adde9c70599109928520c5d207b174a0`; this closeout adds **only test and documentation** changes. No revised executable QA runtime or public server is published.
- Owner expressly waived Firefox, WebKit, physical mobile and native Safari for the bounded Edge QA experiment. Do not conflate a 390×844 simulated viewport with a physical device or call untested browsers unsupported.

## Verified code and local Edge Q1–Q4/Q6 evidence

- Real app editor → separately hosted `app.test`/`runner.test` iframe → Worker → QuickJS/WASM pipeline: exact current source runs all **14 canonical test cases**, and wrong answers, semantic diagnostics, unsupported imports, VM runtime errors and timeouts have distinct honest outcomes.
- Adversarial code checks: memory and stack pressure, oversized source/output, infinite loop watchdog, cancellation, stale edit revisions, forged empty-pass, blocked asset/iframe startup, offline/reconnect, cold/warm loading, and live-region/focus/keyboard behavior. No false success observed in the tested cases.
- App-side positive and cross-site runner-side negative checks for cookie, localStorage, IndexedDB and parent DOM access. A separate installed Edge context uses the browser's `Network.setCookieControls` CDP third-party-cookie restriction with metadata/heuristics exceptions disabled, confirms a runner-origin first-party cookie is readable first-party and blocked inside the cross-site iframe, **then executes the actual QuickJS 14/14 run** in that restricted context.
- Browser viewports: Edge desktop 1280×900 and Edge simulated mobile 390×844, with additional document reflow at 640/320 CSS pixels, no horizontal overflow. Fresh real Edge **200% browser zoom** on the exact immutable protected M3 app Preview `dpl_CQqQD8p91MdSoRdhuBT1LQwGhpmP` at a physically resized 1280×900 window yielded `devicePixelRatio=2`, document CSS width `620` and `scrollWidth=620`: no horizontal document overflow. Zoom was reset to 100% and the dedicated tab closed. This validates the exact M3 application artifact's layout, **not** public hosted iframe execution at that zoom; the immutable hostname differs from the required QA alias.
- Fresh checks: `node scripts/check-runner-local.mjs` PASS; `pnpm test` **192/192** PASS, `pnpm typecheck` PASS, `pnpm build` PASS, `node --test scripts/m3-public-qa-probe.test.mjs` **5/5** PASS; `node scripts/m3-public-qa-probe.mjs protected` **5/5** SSO checks PASS; `git diff --check` PASS.
- These local browser checks intentionally use loopback mapping and treat dedicated `.test` origins as secure. They do **not** prove real hosted HTTPS/TLS cookie/browser behavior for the final QA A/R aliases.

## Bounded historical hosted Q5/Q6 evidence

- Previous owner-controlled QA experiments temporarily made only the **exact runner QA alias** public and verified direct HTML/Worker/WASM 200, required CSP/MIME/nosniff, 404 rejection, protected app QA/immutable runner/Production domains, and a real iframe in ordinary Vercel-authenticated desktop Edge with canonical **14/14** and a wrong-answer failure.
- Additional hosted tests on the reviewed artifact covered resource pressure and local/controller-assisted hostile messaging/timeout paths. These experiments are separately recorded in ignored local acceptance reports; the reviewed public-plan document remains in the repository.
- After those experiments, the runner exception was removed via Vercel's two-stage protection restoration, both QA aliases restored to exact inert Preview IDs, and public SSO verified. Fresh 2026-10-19 Vercel project and alias readbacks confirm SSO `all`, Git disconnected, QA A = `dpl_DrbEyamt5bgxaAwwQZwfmcrjbvVW`, QA R = `dpl_4bj2D2yd12FQQFo1U3q7MbPXU9Po`, with only original inert Production deployments for each project. The runner dashboard displayed **no exceptions listed**, and unauthenticated 5/5 protection probe passed.

## Unfulfilled mandatory hosted/release gates — carried forward explicitly

1. Full ordinary authenticated **public-runner** iframe end-to-end test at the simulated-mobile Edge viewport, without browser/controller protection bypass. The existing mobile public probe was static only; other mobile 14/14 passes used local or controlled access.
2. Hosted ordinary browser with explicit **third-party-cookie blocking** plus real hosted iframe, cookies, IndexedDB and navigation isolation. Local CDP-restricted profile now passes, but this is not hosted proof.
3. Full hosted **public runner** iframe execution during genuine **200% browser zoom**, cold-cache/offline/reconnect verification and complete adversarial suite in the public runner profile. Genuine zoom/reflow has been observed on the exact M3 app executable artifact in isolation, but not with a public runner at the paired QA origins.
4. **Fresh independent consolidated hosted** security reassessment. Previous independent code review applies to the unchanged executable runtime, but later reviewer workers did not start; there is no final independent hosted signoff.
5. Separate **Production** exact-origin architecture, publicly served runner strategy, release/abuse review, real authenticated M4/M5 integrated Run→Submit E2E and explicit release authorization. The Preview QA build is deliberately not eligible for Production activation.

The limited public hosted test would require revisiting a narrowly scoped runner Deployment Protection Exception. A previous attempt at its Add Domain control was blocked. **Do not bypass that control** or silently relax SSO; resume only through an authorized, functioning protection workflow and the previously accepted operator/time/rollback limits.

## Closeout disposition

**Accepted as implemented and locally/partially hosted validated; no further M3 feature coding is required.** The remaining items are documented **release-readiness verification and infrastructure controls**, not evidence of new code defects. Do **not** claim the strict hosted Q5/Q6 matrix has passed; under its original pass criteria the full hosted gate remains **NO-GO**. PR #9 stays draft and unmerged pending separate authorization. The app and runner remain protected and Production learner execution disabled.
