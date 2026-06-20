#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(projectRoot, "__AGENTSTACK_REPO_ROOT__");
const cliPath = resolve(repoRoot, "packages/cli/src/bin.ts");
const tsxCli = resolve(projectRoot, "__AGENTSTACK_TSX_CLI__");

const result = spawnSync(
  process.execPath,
  [tsxCli, cliPath, ...process.argv.slice(2)],
  { cwd: projectRoot, stdio: "inherit" }
);

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exitCode = 1;
} else if (result.signal) {
  process.kill(process.pid, result.signal);
} else {
  process.exitCode = result.status ?? 1;
}
