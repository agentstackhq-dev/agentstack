#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { publicPackageName, readReleaseVersion, runCommand } from "./contract.mjs";

const args = process.argv.slice(2);
const version = readFlag(args, "--version") ?? readReleaseVersion();
const packageSpec = readFlag(args, "--package-spec") ?? `${publicPackageName}@${version}`;
const appName = readFlag(args, "--app-name") ?? "registry-smoke";
const root = readFlag(args, "--work-dir") ?? mkdtempSync(join(tmpdir(), "agentstack-registry-smoke-"));
const cache = mkdtempSync(join(tmpdir(), "agentstack-registry-smoke-cache-"));
const env = {
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
  PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: "false",
  XDG_CACHE_HOME: cache
};

try {
  runCommand("corepack", ["pnpm", `--package=${packageSpec}`, "dlx", "agentstack", "create", appName], {
    cwd: root,
    env,
    stdio: "inherit"
  });

  const appDir = join(root, appName);
  runCommand("corepack", ["pnpm", "install"], { cwd: appDir, env, stdio: "inherit" });
  runCommand("corepack", ["pnpm", "run", "typecheck"], { cwd: appDir, env, stdio: "inherit" });
  runCommand("corepack", ["pnpm", "run", "validate"], { cwd: appDir, env, stdio: "inherit" });
  runCommand("corepack", ["pnpm", "run", "dev:check"], { cwd: appDir, env, stdio: "inherit" });
  runCommand("corepack", ["pnpm", "--filter", "@app/web", "build"], {
    cwd: appDir,
    env,
    stdio: "inherit"
  });

  const preview = runCommand("corepack", ["pnpm", "run", "preview:up"], {
    cwd: appDir,
    env,
    allowedExitCodes: [1]
  });
  const output = `${preview.stdout}\n${preview.stderr}`;
  if (!output.includes("FAIL preview.up.confirmation-required")) {
    throw new Error("preview:up must refuse without --confirm-live-mutation.");
  }

  console.log(`PASS registry smoke ${packageSpec}`);
  console.log(`Generated app: ${appDir}`);
} finally {
  rmSync(cache, { recursive: true, force: true });
}

function readFlag(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }
  return value;
}
