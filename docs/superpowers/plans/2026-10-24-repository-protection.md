# Repository protection implementation plan

> **Approved by owner on 2026-10-24.** execute inline using Superpowers executing-plans, test-driven-development and verification-before-completion. No automatic review delegation. Publication, merge and deployment are separate actions.

**Goal:** Deliver issue #24's real PR security checks and independently verified merge enforcement.
**Architecture:** Preserve functional CI; add distinct lint, dependency, CodeQL and Gitleaks checks. Enforce job completion and actual CodeQL findings through a single strict `main` ruleset after hosted validation.
**Tech stack:** Node 24, pinned pnpm, ESLint with TypeScript/Vue support, CodeQL JS/TS, Gitleaks CLI, GitHub Actions/rulesets.
**Spec:** [Proposed repository protection design](../specs/2026-10-24-repository-protection-design.md).
**Spec impact:** Add focused spec; existing product, runner and shared-contract requirements remain unchanged.

## Global constraints

- Base: clean `main` at `cf6ef5a`; branch: `chore/repository-protection`. Recheck status and upstream before implementation.
- Preserve every existing `verify` command; no deployments, provider mutations, real credentials or long-lived tokens.
- Stable job names: `verify`, `lint`, `dependency-audit`, `static-security`, `secret-scan`. No path-filter skips, privileged fork execution or broad permissions.
- No new runtime environment variables or feature flags. Record any implementation-time deviation explicitly.
- Resolve official current releases and immutable SHAs before writing workflow pins; do not copy abbreviated search-result SHAs.

## Review Focus

- An analysis job can succeed while CodeQL findings should block merge; test the findings rule itself.
- Fork PRs must scan successfully without secrets or privileged code execution; distinguish approval waiting from unsupported configuration.
- Generated web assets can contain credentials absent from tracked source; scan freshly built app and runner outputs.
- Historical commits or mixed encodings must not evade the source scan; test a removed-but-present-in-PR-history synthetic credential.
- Missing/skipped/stale required contexts must remain blocking, including for administrators; verify settings and a real PR without merging.

### Task 1: Maintainable CI and dependency gates

**Files:** Modify `.github/workflows/ci.yml`, `package.json`, `pnpm-lock.yaml`; create `eslint.config.mjs`, `.github/dependabot.yml`, `scripts/check-ci-policy.test.mjs`; update `README.md` and `docs/security/repository-protection.md`.
**Interfaces:** `pnpm lint` exits nonzero on lint/whitespace failure; `pnpm audit --audit-level=high` covers the root plus separate runner and spike manifests. `verify` retains its current coverage.

- [ ] Confirm design approval, status, base and branch. Resolve current official action releases/runtime support and complete SHA pins; include pnpm's maintained successor in the audit.
- [ ] Add policy regressions for exact job names, immutable action refs, least privilege, unprivileged PR triggers and preservation of functional commands. Run before editing CI; expect failure for absent gates and mutable pins.
- [ ] Add bounded ESLint rules for JS/TS/Vue, with narrowly justified fixture exclusions. Correct actual baseline lint errors without broad application refactors or cosmetic reformatting.
- [ ] Add pinned Actions updates and separate `lint`/`dependency-audit` jobs. Consume issue #23 auditing for root and runner production/development dependency graphs; retain its documented historical-spike exclusion; handle findings explicitly rather than suppressing the gate.
- [ ] Run policy tests, lint, both active-boundary audits and existing typecheck/unit/build checks. Any unavailable audit or unresolved high/critical advisory is a failure to report and fix, not a passing gate.

### Task 2: Real static-security and credential scans

**Files:** Create `.github/workflows/security.yml`, `.github/codeql/codeql-config.yml`, `.gitleaks.toml` only if defaults need narrow fixture exceptions, `scripts/check-secret-scan.mjs`, `scripts/check-secret-scan.test.mjs`; extend `scripts/check-ci-policy.test.mjs` and `docs/security/repository-protection.md`.
**Interfaces:** `static-security` analyzes JS/TS including Vue SFCs and uploads CodeQL findings; `secret-scan` scans tracked files, PR history and clean CI app/runner builds. Scanner errors and real findings fail. Logs contain locations/rule names with credential values redacted.

- [ ] Write failing real-scanner tests for clean content, generated synthetic credential in source/history/artifacts, and missing executable/build output. Keep temporary resources scoped and clean them afterward. Verify expected red before adding the wrapper.
- [ ] Implement checksum-verified pinned Gitleaks CLI acquisition and invocation. Scan PR commit range with the required fetched history, all tracked current content, and fresh app/runner output. Do not ingest local private files or upload raw reports.
- [ ] Configure pinned CodeQL advanced analysis, security-extended queries, explicit JS/TS language and supported public/fork permissions. Check official Vue coverage and document limits. Never add an unsupported fake success fallback.
- [ ] Run local scanner regressions/policy tests and lint. Validate workflow YAML and action inputs; run every retained CI command where locally supported and record concrete hosted-only checks.

### Task 3: Hosted proof and enforced merge policy

**Files:** Create `.github/main-ruleset.json` as the reviewable desired policy and update `docs/security/repository-protection.md` with exact UI steps/evidence; update this execution record.
**Interfaces:** Active `main-required-checks` targets `refs/heads/main`, requires five exact GitHub Actions contexts, strict/up-to-date results, CodeQL security medium+ / error thresholds, PRs and resolved conversations; empty bypass list; no force pushes/deletions.

- [ ] Obtain explicit branch/PR publication authorization if still absent. Publish the scoped implementation and use a non-deployed validation PR. Do not merge or deploy.
- [ ] Run a clean hosted baseline and safe seeded credential/CodeQL fixtures. Capture real failures and useful redacted findings, remove seeds, then rerun green. Exercise a fork PR without repository secrets or record the unverified acceptance item.
- [ ] Inspect emitted check contexts and CodeQL tool identity before serializing/configuring the ruleset. Preserve existing secret and push protection.
- [ ] Save the ruleset using the signed-in `Kilian-Sosa/typescript.lab` Settings UI when the connector lacks administration. Reopen it independently and read back all effective settings. If unavailable, document exact manual UI steps and leave enforcement explicitly pending.
- [ ] Verify a real PR is blocked when each required status fails/is missing and when qualifying CodeQL findings exist; verify green up-to-date status becomes merge-eligible. Avoid direct pushes or clicking Merge. Keep admins subject to the documented policy.
- [ ] Self-review spec-to-check and behavior-to-spec coverage; run `node scripts/check-design.mjs` and `git diff --check`. Report the local/hosted verification boundary, settings readback, any remaining acceptance gaps and environment-variable impact.

## Execution record

- 2026-10-24: issue/spec/ADR/workflow/manifests inspected; no existing lint or audit infrastructure. Browser independently confirms no rulesets/classic branch protection, CodeQL not configured, Secret Protection and Push protection enabled.
- Created work branch and proposed design/plan only. No dependency installation, production-code edits, workflow edits, publication or hosted setting changes yet. Design and administrator/emergency policy await owner approval.

## Integration and hosted verification record

- Owner approved design/inline implementation, coordination with #22/#23, and publication. Work isolated in the native repository-protection worktree. No unrelated shared-checkout work was staged.
- Task 1 consumes #27 audit commits and #29 lint/format commit. Named contexts observed from GitHub Actions app 15368: verify, lint, Dependency vulnerability audit, static-security, secret-scan.
- Local: app 220 tests, runner 167 tests, both strict builds, lint/format, 45 combined tooling tests, real source/history/bundle scans and both live audits passed before hosted publication.
- Hosted initial CodeQL flagged two real local-fixture path traversal weaknesses, an over-specific lowercase test assertion, and one medium false positive for a checksum-verified download. Both fixture servers now use a pre-enumerated public-file map; traversal regressions and both real Edge suites pass. The assertion is case-insensitive. CodeQL combined SARIF references now resolve extension tool components, with a red-to-green regression reproducing the actual format.
- One false-positive review is bound to js/http-to-file-access, scanner source SHA-256, exact file/line, Kilian-Sosa ownership and expiry 2027-01-24. Changed source or expired review fails closed. Native CodeQL alert #4 was dismissed as false positive with the same evidence; no global query/path exclusion was added.
- First hosted verify also caught the callback wait lost while combining formatted prerequisite code; restored it and reran the exact Preview Edge test successfully.
- Active ruleset 25784626 was saved and independently read back through the GitHub connector: exact main target, five Actions contexts, strict checks, PR/conversation requirements, medium+ CodeQL/error thresholds, no bypass actors, deletion/force-push blocks.
- An unstarted, unimported temporary HTTP/command-injection fixture was published at ec17ed0 solely to verify a real CodeQL failure. It must be removed before final handoff; clean final hosted results and bootstrap eligibility are still pending.

- Full SARIF (before PR filtering) also identified two archived-spike harness defects and two dedicated-Worker origin-check false positives. Removed the stat/read race and replaced URL-prefix matching with exact parsed origins. The unchanged Worker listeners have separately documented rule/file/line/source-hash/owner/expiry reviews, preserving the approved dedicated Worker trust boundary. Seven SARIF tests cover extension components, artifact references, exact review matching, source mutation and expiry.
