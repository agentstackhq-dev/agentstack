#!/usr/bin/env node
import {
  assertReleaseContract,
  assertReleaseTag,
  npmViewJson,
  readReleaseVersion,
  releasePackages,
  repoRoot,
  runCommand
} from "./contract.mjs";

const args = process.argv.slice(2);
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
  } else {
    publishArgs.push("--provenance");
  }
  console.log(`$ npm ${publishArgs.join(" ")} (${pkg.dir})`);
  runCommand("npm", publishArgs, { cwd: `${repoRoot}/${pkg.dir}`, stdio: "inherit" });
}

if (publish) {
  for (const pkg of releasePackages) {
    const view = npmViewJson(`${pkg.name}@${tag}`);
    if (view.version !== version || view["dist-tags"]?.[tag] !== version) {
      throw new Error(`${pkg.name}@${tag} did not resolve to ${version}.`);
    }
  }
}

console.log(`${dryRun ? "PASS release publish dry-run" : "PASS release publish"} ${version} ${tag}`);

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
