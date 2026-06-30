#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sourceDir = dirname(fileURLToPath(import.meta.url));
const binTs = join(sourceDir, "bin.ts");
const tsconfigPath = join(dirname(dirname(dirname(sourceDir))), "tsconfig.base.json");

let tsxCli;

try {
  tsxCli = require.resolve("tsx/cli");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Unable to resolve tsx runtime: ${message}\n`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [tsxCli, "--tsconfig", tsconfigPath, binTs, ...process.argv.slice(2)],
  { stdio: "inherit" }
);

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exitCode = 1;
} else if (result.signal) {
  process.kill(process.pid, result.signal);
} else {
  process.exitCode = result.status ?? 1;
}
