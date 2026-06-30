#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertReleaseContract,
  assertReleaseVersionSyntax,
  readReleaseVersion,
  releasePackages,
  repoRoot
} from "./contract.mjs";

const version = readFlag(process.argv.slice(2), "--version");
if (!version) {
  throw new Error("Usage: corepack pnpm run release:bump -- --version <X.Y.Z-beta.N|X.Y.Z>");
}

assertReleaseVersionSyntax(version);
const currentVersion = readReleaseVersion();

for (const pkg of releasePackages) {
  const packagePath = join(repoRoot, pkg.dir, "package.json");
  const manifest = readJson(packagePath);
  manifest.version = version;
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (name.startsWith("@agentstackhq/")) {
      manifest.dependencies[name] = version;
    }
  }
  writeJson(packagePath, manifest);
}

for (const file of [
  "packages/core/src/manifest.ts",
  "packages/core/src/manifest.test.ts",
  "scripts/m5-preview-release-check.mjs",
  "tests/package-metadata.test.ts",
  "templates/b2b-saas/agentstack.config.ts",
  "packages/agentstack/templates/b2b-saas/agentstack.config.ts",
  "docs/releases/versioning-and-release-workflow.md"
]) {
  replaceAll(join(repoRoot, file), currentVersion, version);
}

console.log(`Updated Agentstack release version ${currentVersion} -> ${version}`);
console.log("Run: corepack pnpm install --lockfile-only");
assertReleaseContract();

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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceAll(path, from, to) {
  const original = readFileSync(path, "utf8");
  const next = original.split(from).join(to);
  writeFileSync(path, next);
}
