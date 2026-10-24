# Repository security checks and merge protection

Issue [#24](https://github.com/Kilian-Sosa/typescript.lab/issues/24) implements the [approved protection design](../superpowers/specs/2026-10-24-repository-protection-design.md). This is repository infrastructure, not deployment or runner-release approval.

## Required checks

| Check context | Purpose |
| --- | --- |
| `verify` | Existing app/runner functional tests, typechecks, builds and browser suites. |
| `lint` | App and runner ESLint/Prettier gates from issue #22. |
| `Dependency vulnerability audit` | Both active installation graphs, high/critical policy and explicit time-bounded waivers from issue #23. The historical runner spike is outside active CI installations. |
| `static-security` | CodeQL security-extended JavaScript/TypeScript analysis, including Vue extraction, followed by a fail-closed SARIF severity check. Medium+ security findings and non-security errors fail. |
| `secret-scan` | Checksum-pinned Gitleaks scans tracked current content, all commits reachable from HEAD, and fresh app/runner web artifacts. Real negative-fixture tests also run in this job. |

Checks run for PRs targeting main and main pushes without path filtering. A first-time fork contributor may need the normal GitHub workflow approval; no repository secrets, deployment keys or OIDC permissions are needed. Only the CodeQL job requests security-events write permission, using GitHub's supported public PR upload flow. There is no pull_request_target or privileged workflow_run bridge.

### Local security verification

Use Node 24 with the repository's pinned pnpm. On Windows, use PowerShell:

```powershell
node --test scripts/check-ci-policy.test.mjs scripts/check-codeql-results.test.mjs scripts/scan-secrets.test.mjs
pnpm build
$env:VITE_RUNNER_PARENT_ORIGIN = 'https://lab-app.vercel.app'
$env:VITE_RUNNER_ORIGIN = 'https://lab-runner.vercel.app'
pnpm --dir apps/runner install --ignore-workspace --frozen-lockfile
pnpm --dir apps/runner build
node scripts/scan-secrets.mjs --artifacts dist apps/runner/.vercel/output/static
```

The origin values above are existing build configuration used only for local/CI validation; this command does not deploy. Scanning requires Git, tar, outbound access to the pinned official Gitleaks release and Linux/Windows x64. Download, checksum, missing/empty artifact and process errors fail; an unavailable scanner never means a clean scan. Tools/reports/fixture repositories use temporary directories and are removed after each invocation.

Gitleaks scans text, including emitted source maps when present; it does not promise detection in binary WASM, arbitrary encodings, obfuscation or unknown token formats. It scans only tracked repository content and fresh build directories, never local untracked environment files or private learner recovery buffers. The main scan includes full reachable history, so deleting a committed credential does not repair the leak: revoke/rotate it and investigate before publication.

Reports print rule IDs, file locations, line numbers and commit IDs with values redacted, never source excerpts or secret values. No raw secret-scanning reports are uploaded. The only baseline exception is the demonstrably nonfunctional M4 browser-test key in exactly scripts/check-recovery.mjs, scoped to both the file path and exact marker in .gitleaks.toml. A real-scanner regression proves the same marker is detected outside that file. Do not add directory-wide exclusions or inline allow comments; inline allow comments are ignored by this check.

## Reviewed tooling pins

Reviewed 2026-10-24 against official releases/action manifests:

| Action | Release | Immutable commit |
| --- | --- | --- |
| actions/checkout | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| pnpm/setup | [v3.1.1](https://github.com/pnpm/setup/releases/tag/v3.1.1) | `a0881977cd8ea73b1ed212236c99ca10dcc80cf4` |
| github/codeql-action | [v4.38.3](https://github.com/github/codeql-action/releases/tag/v4.38.3) | `24c54180a607b1449ed407dd24f251e4e9147c8d` |

All four manifests use Node 24. pnpm/setup is the maintained successor linked by pnpm/action-setup; its automatic install is explicitly disabled to retain the existing frozen-install steps. Checkout credentials are not persisted. Dependabot proposes weekly Actions updates; review the release, runtime, permissions and new full commit before accepting an update.

Gitleaks CLI [v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) is pinned by official release asset SHA-256 in scripts/scan-secrets.mjs. Updating it requires reviewing the official asset digest and passing real clean/negative scans on the supported platforms. It needs no Gitleaks license token or added GitHub credential.

## Main policy and exact administration steps

The desired API policy is [.github/main-ruleset.json](../../.github/main-ruleset.json). A versioned file is not evidence of active enforcement.

1. Verify the signed-in account and repository are Kilian-Sosa/typescript.lab.
2. Open Settings → Rulesets. Inspect existing rules and Settings → Branches first to avoid replacing unrelated policy.
3. Create/import a branch ruleset named main-required-checks, target exactly refs/heads/main and choose Active after the bootstrap checks are stable.
4. Leave the bypass list empty, including administrators. Require a PR and resolved review conversations, with zero mandatory second-person approvals for this single-owner repository.
5. Require all five exact check contexts above from GitHub Actions. Enable requiring branches to be up to date. Block force pushes and deletion.
6. Require CodeQL scanning results with Alerts: Errors and Security alerts: Medium or higher once the main baseline exists. The static-security SARIF gate also enforces those severities directly, including during bootstrap.
7. Save, reopen the ruleset independently and verify target/enforcement, exact checks and expected source, strictness, thresholds and empty bypass list. Recheck classic branch rules and preserve native Secret Protection/Push protection.
8. Inspect an otherwise mergeable validation PR with a failed or missing required context and confirm the merge box is blocked. Use a harmless unstarted Node HTTP command-injection fixture to prove a real CodeQL finding, then remove it and confirm green. Credential-negative fixtures run in disposable local repositories so fake tokens do not pollute permanent project history.
9. Confirm the clean up-to-date PR is eligible, without clicking Merge or attempting a main push.

For the initial advanced-CodeQL setup, the default branch has no analysis baseline yet. Do not create an unrecoverable bootstrap requirement: verify whether GitHub can enforce the findings rule for the initial PR. If the missing main baseline blocks bootstrap, activate the five status checks (the direct SARIF gate still blocks findings), document the temporary omission, and add the CodeQL findings rule immediately after the owner merges the bootstrap and its main analysis finishes. This is an explicit staged configuration, not an administrator bypass. Never claim the final desired policy is active while this stage is pending.

Administrators use the same checked PR path for ordinary and emergency fixes. There is no standing bypass or direct-push exception. Kilian-Sosa owns exceptional administration: an explicit owner instruction, recorded reason, bounded duration, restoration and independent readback are required for an emergency rule edit. Admins can edit repository settings, so this is an accountable owner policy, not a claim of protection against a malicious administrator.

## Execution evidence

- 2026-10-24 baseline: signed-in Rulesets and Branches pages independently showed no rulesets/classic protection. Advanced Security showed CodeQL not configured and existing native Secret Protection/Push protection enabled.
- Local: 220 app tests and 167 runner tests passed; both production builds/typechecks passed. Real Gitleaks regressions detect current content, removed commit history and built bundles with redacted output; all source/history/app/runner scans passed after the exact synthetic-fixture exception.
- Hosted checks, safe CodeQL finding proof and saved settings readback: pending publication/configuration. Do not interpret the desired JSON or local policy tests as hosted enforcement.
- Environment-variable contract: unchanged. No feature flags, long-lived credentials, deployment or provider changes.

### CodeQL false-positive review

The checksum-verified Gitleaks download triggers js/http-to-file-access because the analysis does not model the fixed official SHA-256 validation. The sole accepted entry in .github/codeql/accepted-findings.json is pinned to its exact source SHA-256, rule, file and line; owner Kilian-Sosa; expiry 2027-01-24. Changing the source or letting the review expire fails the static-security gate. The native alert is dismissed as false positive with matching evidence. All other results remain subject to the normal thresholds. No query or source tree is excluded. Review the checksum trust boundary again before renewing this entry.
