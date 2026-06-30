#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import {
  assertReleaseContract,
  assertReleaseVersionSyntax,
  npmViewJson,
  readReleaseVersion,
  releasePackages,
  repoRoot,
  runCommand
} from "./contract.mjs";
import { verifyPublishedPackage } from "./publish.mjs";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}

export async function main(args) {
  const version = readFlag(args, "--version") ?? readReleaseVersion();
  const tag = readFlag(args, "--tag");
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  const check = args.includes("--check");

  if (!tag) {
    throw new Error("Missing --tag <beta|latest>.");
  }
  if ([dryRun, apply, check].filter(Boolean).length !== 1) {
    throw new Error("Use exactly one of --dry-run, --apply, or --check.");
  }

  assertReleaseVersionSyntax(version);
  assertSupportedDistTag(tag);
  assertReleaseContract();
  if (readReleaseVersion() !== version) {
    throw new Error(`Workspace version ${readReleaseVersion()} does not match requested ${version}.`);
  }

  for (const pkg of releasePackages) {
    npmViewJson(`${pkg.name}@${version}`);
    if (check) {
      console.log(`$ npm view ${pkg.name}@${tag} version dist-tags --json (check)`);
    } else {
      const addArgs = buildDistTagAddArgs(pkg.name, version, tag);
      console.log(`$ ${redactDistTagAddArgs(["npm", ...addArgs])}${dryRun ? " (dry-run)" : ""}`);
      if (apply) {
        runCommand("npm", addArgs, { cwd: repoRoot, stdio: "inherit" });
      }
    }
  }

  if (apply || check) {
    for (const pkg of releasePackages) {
      await verifyPublishedPackage(pkg.name, version, tag);
    }
  }

  const mode = dryRun ? "dry-run" : apply ? "apply" : "check";
  console.log(`PASS release dist-tags ${mode} ${version} ${tag}`);
}

export function buildDistTagAddArgs(name, version, tag) {
  assertReleaseVersionSyntax(version);
  assertSupportedDistTag(tag);
  return ["dist-tag", "add", `${name}@${version}`, tag];
}

export function redactDistTagAddArgs(args) {
  const command = args[0] === "npm" ? args : ["npm", ...args];
  return command.map((arg) => (arg.startsWith("--otp=") ? "--otp=***" : arg)).join(" ");
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

function assertSupportedDistTag(tag) {
  if (!["beta", "latest"].includes(tag)) {
    throw new Error(`Unsupported npm dist-tag "${tag}". Use beta or latest.`);
  }
}
