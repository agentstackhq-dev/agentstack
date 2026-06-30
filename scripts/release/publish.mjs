#!/usr/bin/env node
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  assertReleaseContract,
  assertReleaseTag,
  npmViewJson,
  readReleaseVersion,
  releasePackages,
  repoRoot,
  runCommand
} from "./contract.mjs";

const defaultVerifyAttempts = 10;
const defaultVerifyDelayMs = 3000;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}

export async function main(args) {
  const tag = readFlag(args, "--tag") ?? "beta";
  const dryRun = args.includes("--dry-run");
  const publish = args.includes("--publish");

  if (dryRun === publish) {
    throw new Error("Use exactly one of --dry-run or --publish.");
  }

  const version = readReleaseVersion();
  assertReleaseTag(version, tag);
  assertReleaseContract();

  for (const pkg of releasePackages) {
    const publishArgs = ["publish", "--access", "public", "--tag", tag];
    if (dryRun) {
      publishArgs.push("--dry-run");
    }
    console.log(`$ npm ${publishArgs.join(" ")} (${pkg.dir})`);
    runCommand("npm", publishArgs, { cwd: `${repoRoot}/${pkg.dir}`, stdio: "inherit" });
  }

  if (publish) {
    for (const pkg of releasePackages) {
      await verifyPublishedPackage(pkg.name, version, tag);
    }
  }

  console.log(`${dryRun ? "PASS release publish dry-run" : "PASS release publish"} ${version} ${tag}`);
}

export async function verifyPublishedPackage(name, version, tag, options = {}) {
  const attempts = options.attempts ?? defaultVerifyAttempts;
  const delayMs = options.delayMs ?? defaultVerifyDelayMs;
  const viewPackage = options.viewPackage ?? npmViewJson;
  let lastError;
  let lastView;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      lastView = viewPackage(`${name}@${tag}`);
      if (lastView.version === version && lastView["dist-tags"]?.[tag] === version) {
        return lastView;
      }
      lastError = undefined;
    } catch (error) {
      lastError = error;
      lastView = undefined;
    }

    if (attempt === attempts) {
      break;
    }

    const observed = renderObservedRelease(name, tag, lastView, lastError);
    console.log(
      `${observed}; waiting for npm registry propagation before retry ${attempt + 1}/${attempts}.`
    );
    await setTimeout(delayMs);
  }

  const observed = renderObservedRelease(name, tag, lastView, lastError);
  throw new Error(`${name}@${tag} did not resolve to ${version}. ${observed}.`);
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

function renderObservedRelease(name, tag, view, error) {
  if (error) {
    return `${name}@${tag} was not readable: ${error.message}`;
  }
  const observedVersion = view?.version ?? "unknown";
  const observedTag = view?.["dist-tags"]?.[tag] ?? "unknown";
  return `${name}@${tag} resolved to version ${observedVersion} with ${tag} tag ${observedTag}`;
}
