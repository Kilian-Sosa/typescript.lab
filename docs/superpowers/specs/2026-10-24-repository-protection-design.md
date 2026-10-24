# Repository protection design — issue #24

**Status:** Approved by owner on 2026-10-24; implementation in progress. Repository enforcement requires hosted evidence/readback.
**Date:** 2026-10-24
**Issue:** [#24](https://github.com/Kilian-Sosa/typescript.lab/issues/24)
**Governing requirements:** [Product design, sections 7–8](2026-10-16-typescript-lab-design.md), [ADR-0001](../../decisions/0001-frontend-platform.md), and the roadmap's engineering quality gates.

**Spec impact: add a focused spec.** Existing requirements establish CI and least privilege but do not define repository merge enforcement, security scanner thresholds or administrator exceptions. Product behavior and Shared Contracts v1 remain unchanged.

## Observed baseline

- Local checkout was clean on `main` at `cf6ef5a`; `origin` is `Kilian-Sosa/typescript.lab`. Work branch: `chore/repository-protection`.
- `.github/workflows/ci.yml` runs one `verify` job for pushes and PRs targeting `main`. Preserve every existing functional/build/browser command.
- Checkout, Node setup and pnpm setup use mutable `v4` tags. There are no lint, formatting, dependency-audit or static-security jobs/configurations.
- Three tracked dependency manifests/lockfiles exist: root, `apps/runner`, and the historical `spikes/runner` feasibility fixture. The two active CI install boundaries are audited by issue #23; its documented historical-spike exclusion is retained.
- On 2026-10-24, the signed-in repository Settings pages showed **no rulesets and no classic branch-protection rules**. The account/repository match the GitHub connector, which reports admin permission.
- Advanced Security settings offered CodeQL **Set up**; Secret Protection was enabled and Push protection checked. Leave those protections enabled.
- The GitHub connector exposes no protection/ruleset administration tool. A CLI read failed to connect; browser Settings supplied the read-only evidence. No credentials were inspected or refreshed.

## Approaches

1. **Recommended:** CodeQL for JS/TS, Gitleaks CLI for credentials, ESLint for JS/TS/Vue plus whitespace checks, pnpm dependency audits, and one branch ruleset. Consume the independently owned lint/format implementation from issue #22 and audit implementation from issue #23 rather than duplicating them. These tools have distinct purposes and produce required, stable checks without scanner-specific account secrets.
2. GitHub native code/secret scanning alone minimizes local tooling, but native push protection does not supply the requested deterministic tracked-source and built-artifact PR secret check.
3. A large third-party security suite adds overlapping tools and access/configuration burden without a demonstrated need. Do not adopt it for this issue.

The owner approved this recommendation and policy on 2026-10-24.

## Required checks and trust boundaries

| Stable Actions job name | Required behavior |
| --- | --- |
| `verify` | Retain current typechecks, tests, builds and browser coverage. |
| `lint` | ESLint supported JS/TS and Vue SFC source, including maintained scripts and runner code, with zero warnings; check changed tracked text for whitespace errors. Keep legitimate sandbox/adversarial fixtures explicit rather than disabling rules globally. No broad cosmetic reformat. |
| `Dependency vulnerability audit` | Audit both active dependency graphs, including development dependencies; fail on high/critical advisories or an unavailable audit service. No blanket advisory ignores or silent network success. |
| `static-security` | CodeQL JS/TS analysis with the security-extended suite and Vue coverage verified against supported extraction. Analysis/setup/upload failures fail this job. |
| `secret-scan` | Scan tracked content and PR commits for credentials; build app/runner outputs with synthetic public configuration and scan generated web artifacts, including emitted maps. Findings or scanner/build failures fail the job. |

Require CodeQL **findings** through the ruleset's code-scanning rule as well as requiring `static-security`. Successful analysis does not imply clean results. Proposed thresholds: security findings **medium or higher** and non-security findings **errors**. Read back the exact tool and thresholds after configuration.

All jobs run on `pull_request` to `main` and `push` to `main`, without path filters that leave required checks missing. Use unique job names. Fork PRs receive no repository secrets, deployment credentials, OIDC grants or write-capable checkout credentials. Never run PR code under `pull_request_target` or a privileged `workflow_run` bridge. Preserve GitHub's approval requirement for first-time fork contributors.

Default workflow permissions remain `contents: read`; grant `security-events: write` only to the CodeQL job where required by GitHub's supported public/fork workflow. Disable persisted checkout credentials. Pin reviewed actions to full commit SHAs with release annotations, validate their action runtimes, and use a checksum-verified pinned Gitleaks CLI release rather than a license/token-dependent scanning action. Prefer maintained pnpm setup, checking the official successor's migration guidance before selecting a pin. Add narrowly scoped Dependabot Actions update proposals so immutable pins remain maintainable.

Use Gitleaks defaults with narrow documented exceptions for demonstrably synthetic fixtures. Never exclude whole source trees, CI files, built bundles or all environment files. Never print discovered credential values; redact scanner output and avoid uploading raw reports. Built-output scanning uses fresh CI builds, not local private recovery buffers, `.env.local`, or user output directories. Document binary/WASM and scanner coverage limitations honestly.

## Proposed `main` policy

Create one active branch ruleset named `main-required-checks`, targeting exactly `refs/heads/main`:

- Require a pull request and resolution of review conversations. Do not require a second-person approval in this single-owner repository.
- Require all five job names above, tied to GitHub Actions as the expected source where supported, with strict/up-to-date checks.
- Require CodeQL results with the stated thresholds. Block force pushes and branch deletion.
- Keep the bypass list empty, including administrators. Direct pushes to `main` must fail; routine and emergency fixes use a checked PR.
- Repository owner Kilian-Sosa owns emergency administration. No permanent emergency exception: any exceptional rule edit requires an explicit owner instruction, a recorded reason, a bounded duration, restoration and an independent settings readback. This does not pretend an administrator cannot edit repository rules.

Stage enforcement only after clean and seeded failing checks have run and the exact contexts are known. Do not activate missing new checks against `main` without a documented bootstrap sequence. Configure the implementation PR's required contexts after they exist; do not merge it as part of this task. If settings cannot be saved/read back, provide exact UI steps and report enforcement as pending.

## Acceptance and evidence

1. A clean PR runs all five jobs successfully with existing coverage retained, including a representative public/fork execution or an explicit pending fork-verification item.
2. Construct a nonfunctional synthetic credential in a temporary tracked file/commit and generated bundle; the real scanner fails without printing it. Remove the fixture afterward and confirm green. Generate the marker at test time so the permanent test is not itself an ignored credential leak.
3. A safe, non-deployed CodeQL fixture produces an actual finding meeting the configured threshold. Confirm that findings block merge even when the analysis job succeeds; remove it and confirm green.
4. A real PR with failing or missing required checks is visibly blocked. Test each required context, then confirm the clean, up-to-date PR becomes eligible. Do not click Merge or attempt a direct push to `main` to prove the policy.
5. Independently reopen the saved ruleset and branch-rule views; record target, enforcement, check contexts/source, strictness, CodeQL thresholds and empty bypass list. A proposed JSON policy or local test alone is not enforcement evidence.

## Exclusions and rollout

No Vercel/Supabase changes, deployments, public runner exposure, billing, Production changes or new long-lived credentials. No runtime environment-variable or feature-flag changes. Publishing this branch/validation PRs is a separate explicit publication step; it must not be confused with merging or deploying them. Local implementation and tests can precede that step once this design is approved.

The [implementation plan](../plans/2026-10-24-repository-protection.md) divides local CI work and hosted enforcement into independently verifiable slices. No automatic independent reviewer or worker is required; the owner implementation policy applies.

Implementation ruling: inspect CodeQL SARIF locally in the static-security job as well as enforcing the findings rule when the main baseline exists. This guarantees a failing named status for medium+ security/error findings, including during the initial advanced-setup bootstrap. Runner artifacts are emitted to apps/runner/.vercel/output/static, not apps/runner/dist. The owner separately authorized coordination with the #22/#23 chats and branch/PR publication on 2026-10-24.

Reviewed CodeQL false positives may be accepted only through an auditable exact rule/file/line entry bound to complete source SHA-256, owner, reason and expiry; changed source or expiry fails closed. The initial three entries cover the checksum-verified archive download and the two dedicated-Worker channel listeners. No query or source-tree exclusion is permitted as a substitute for review. Actual test-harness file-access and URL-origin findings were fixed rather than accepted.
