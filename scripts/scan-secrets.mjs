import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const version = "8.30.1";
const archives = {
  linux: {
    name: "linux_x64.tar.gz",
    sha256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
  },
  win32: {
    name: "windows_x64.zip",
    sha256: "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e",
  },
};

export async function installGitleaks(destination) {
  const archive = process.arch === "x64" && archives[process.platform];
  if (!archive)
    throw new Error("The pinned scanner supports Linux/Windows x64 only.");
  mkdirSync(destination, { recursive: true });
  const name = "gitleaks_" + version + "_" + archive.name;
  const response = await fetch(
    "https://github.com/gitleaks/gitleaks/releases/download/v" +
      version +
      "/" +
      name,
    { signal: AbortSignal.timeout(60_000) },
  );
  if (!response.ok)
    throw new Error("Scanner download failed: HTTP " + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== archive.sha256)
    throw new Error("Scanner checksum mismatch.");
  const file = join(destination, name);
  writeFileSync(file, bytes);
  execFileSync("tar", ["-xf", file, "-C", destination], { stdio: "pipe" });
  const executable = join(
    destination,
    process.platform === "win32" ? "gitleaks.exe" : "gitleaks",
  );
  chmodSync(executable, 0o700);
  return executable;
}

function invoke(tool, args, cwd) {
  // Keep worktree ownership trust scoped to this child; never edit global Git config.
  const env = { ...process.env };
  const count = Number(env.GIT_CONFIG_COUNT || 0);
  env.GIT_CONFIG_COUNT = String(count + 1);
  env["GIT_CONFIG_KEY_" + count] = "safe.directory";
  env["GIT_CONFIG_VALUE_" + count] = resolve(cwd);
  const reportDir = mkdtempSync(join(tmpdir(), "lab-secret-report-"));
  try {
    const report = join(reportDir, "report.json");
    const config = fileURLToPath(new URL("../.gitleaks.toml", import.meta.url));
    const result = spawnSync(
      tool,
      [
        ...args,
        "--config",
        config,
        "--report-format=json",
        "--report-path",
        report,
        "--redact=100",
        "--ignore-gitleaks-allow",
        "--no-banner",
        "--exit-code=1",
      ],
      {
        cwd,
        env,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    if (result.error || ![0, 1].includes(result.status))
      throw new Error("Secret scanner failed to execute or complete.");
    const findings = existsSync(report)
      ? JSON.parse(readFileSync(report, "utf8"))
      : [];
    // Print locations, never matched source lines or secret values.
    const locations = findings
      .map((item) =>
        JSON.stringify({
          rule: item.RuleID,
          file: item.File,
          line: item.StartLine,
          commit: item.Commit,
        }),
      )
      .join("\n");
    return {
      status: result.status,
      output: (result.stderr || "") + locations + "\n",
    };
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
}

export function scanDirectory(tool, directory) {
  return invoke(tool, ["dir", directory], directory);
}

function git(root, args) {
  return execFileSync(
    "git",
    ["-c", "safe.directory=" + resolve(root), ...args],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

export function scanRepository(tool, root) {
  const snapshot = mkdtempSync(join(tmpdir(), "lab-tracked-scan-"));
  try {
    const files = git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
    if (!files.length) throw new Error("No tracked source files to scan.");
    for (const file of files) {
      const source = join(root, file);
      if (!existsSync(source)) continue; // Deletions remain covered by commit-history scanning.
      const stat = lstatSync(source);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error("Tracked source must be a regular file: " + file);
      const target = join(snapshot, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
    const current = scanDirectory(tool, snapshot);
    const history = invoke(tool, ["git", root, "--log-opts=HEAD"], root);
    return {
      status: current.status || history.status,
      output: current.output + history.output,
    };
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }
}

export function scanArtifacts(tool, directories) {
  if (!directories.length)
    throw new Error("At least one artifact directory is required.");
  let status = 0;
  let output = "";
  for (const directory of directories) {
    if (
      !existsSync(directory) ||
      !lstatSync(directory).isDirectory() ||
      !readdirSync(directory).length
    ) {
      throw new Error(
        "Build artifact directory is missing or empty: " + directory,
      );
    }
    const result = scanDirectory(tool, directory);
    status ||= result.status;
    output += result.output;
  }
  return { status, output };
}

async function main(args) {
  if (args[0] !== "--artifacts" || args.length < 3)
    throw new Error(
      "Usage: node scripts/scan-secrets.mjs --artifacts dist apps/runner/.vercel/output/static",
    );
  const temporary = mkdtempSync(join(tmpdir(), "lab-secret-scan-"));
  try {
    const tool = await installGitleaks(join(temporary, "tool"));
    const source = scanRepository(tool, process.cwd());
    const artifacts = scanArtifacts(
      tool,
      args.slice(1).map((path) => resolve(path)),
    );
    console.log(source.output + artifacts.output);
    process.exitCode = source.status || artifacts.status;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
