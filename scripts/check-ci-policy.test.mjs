import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

test("all workflow actions use immutable commits and avoid privileged PR execution", () => {
  for (const name of readdirSync(".github/workflows")) {
    const yaml = readFileSync(".github/workflows/" + name, "utf8");
    assert.ok(!/\b(pull_request_target|workflow_run)\s*:/.test(yaml), name);
    for (const match of yaml.matchAll(/uses:\s*([^\s#]+)/g)) {
      assert.match(
        match[1],
        /^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/,
        "Unpinned action: " + match[1],
      );
    }
    assert.ok(
      !/contents:\s*write|write-all|id-token:\s*write/.test(yaml),
      name,
    );
    assert.ok(!/continue-on-error:\s*true/.test(yaml), name);
  }
});
test("security jobs run on PR/main and scan built assets with isolated permissions", () => {
  const yaml = readFileSync(".github/workflows/security.yml", "utf8");
  assert.match(yaml, /pull_request:/);
  assert.match(yaml, /push:/);
  assert.ok(
    !/paths:|paths-ignore:|if:/.test(yaml),
    "Security gates must not silently skip PRs",
  );
  for (const name of ["static-security", "secret-scan"])
    assert.ok(yaml.includes("  " + name + ":"));
  assert.match(yaml, /security-events: write/);
  assert.match(yaml, /build-mode: none/);
  assert.match(yaml, /languages: javascript-typescript/);
  assert.match(
    yaml,
    /scan-secrets\.mjs --artifacts dist apps\/runner\/\.vercel\/output\/static/,
  );
  assert.match(yaml, /fetch-depth: 0/);
  assert.match(yaml, /persist-credentials: false/);
  assert.ok(!/\$\{\{\s*secrets\./.test(yaml));
});
test("desired main policy requires strict checks, findings, PRs and no bypass", () => {
  const policy = JSON.parse(readFileSync(".github/main-ruleset.json", "utf8"));
  assert.equal(policy.enforcement, "active");
  assert.deepEqual(policy.bypass_actors, []);
  assert.deepEqual(policy.conditions.ref_name, {
    include: ["refs/heads/main"],
    exclude: [],
  });
  const rule = (type) => policy.rules.find((item) => item.type === type);
  for (const type of ["pull_request", "deletion", "non_fast_forward"])
    assert.ok(rule(type));
  const status = rule("required_status_checks").parameters;
  assert.equal(status.strict_required_status_checks_policy, true);
  assert.deepEqual(
    status.required_status_checks.map((item) => item.context).sort(),
    [
      "verify",
      "lint",
      "Dependency vulnerability audit",
      "static-security",
      "secret-scan",
    ].sort(),
  );
  for (const item of status.required_status_checks)
    assert.equal(item.integration_id, 15368);
  assert.deepEqual(rule("code_scanning").parameters.code_scanning_tools, [
    {
      tool: "CodeQL",
      alerts_threshold: "errors",
      security_alerts_threshold: "medium_or_higher",
    },
  ]);
});
