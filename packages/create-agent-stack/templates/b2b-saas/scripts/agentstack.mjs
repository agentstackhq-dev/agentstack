#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { delimiter } from "node:path";

const args = process.argv.slice(2);
const cliBin = process.env.AGENTSTACK_CLI_BIN;
const tsxBin = process.env.AGENTSTACK_TSX_BIN ?? "tsx";
const localBinDir = new URL("../node_modules/.bin", import.meta.url).pathname;
const env = {
  ...process.env,
  PATH: [localBinDir, process.env.PATH].filter(Boolean).join(delimiter)
};

if (!cliBin) {
  run("agentstack", args, env);
} else if (cliBin.endsWith(".ts")) {
  run(tsxBin, [cliBin, ...args], env);
} else {
  run(cliBin, args, env);
}

function run(command, commandArgs, commandEnv) {
  const result = spawnSync(command, commandArgs, { env: commandEnv, stdio: "inherit" });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      process.stderr.write(
        [
          "FAIL cli.unavailable",
          "No agentstack CLI is available for this generated project.",
          "Install an agentstack CLI dependency or set AGENTSTACK_CLI_BIN to a local prototype CLI entrypoint.",
          "For source smoke, run AGENTSTACK_CLI_BIN=../../packages/cli/src/bin.ts AGENTSTACK_TSX_BIN=../../node_modules/.bin/tsx pnpm run validate."
        ].join("\n") + "\n"
      );
    } else {
      process.stderr.write(`${result.error.message}\n`);
    }
    process.exitCode = 1;
  } else if (result.signal) {
    process.kill(process.pid, result.signal);
  } else {
    process.exitCode = result.status ?? 1;
  }
}
