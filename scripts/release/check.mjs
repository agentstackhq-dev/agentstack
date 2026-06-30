#!/usr/bin/env node
import {
  assertReleaseContract,
  readReleaseVersion,
  releaseDistTag,
  releasePackages,
  repoRoot,
  runCommand
} from "./contract.mjs";

const args = process.argv.slice(2);
const skipNpmDryRun = args.includes("--skip-npm-dry-run");

const commands = [
  ["corepack", ["pnpm", "build"]],
  ["node", ["scripts/release/contract.mjs", "--check"]],
  ["corepack", ["pnpm", "typecheck"]],
  ["corepack", ["pnpm", "test"]],
  ["corepack", ["pnpm", "run", "m5:release:check"]],
  ["diff", ["-rq", "templates/b2b-saas", "packages/agentstack/templates/b2b-saas"]],
  ["git", ["diff", "--check"]]
];

for (const [command, args] of commands) {
  console.log(`$ ${command} ${args.join(" ")}`);
  runCommand(command, args, { cwd: repoRoot, stdio: "inherit" });
}

assertReleaseContract();
const releaseTag = releaseDistTag(readReleaseVersion());

if (skipNpmDryRun) {
  console.log("SKIP npm publish dry-runs (--skip-npm-dry-run)");
} else {
  for (const pkg of releasePackages) {
    console.log(`$ npm publish --dry-run --access public --tag ${releaseTag} (${pkg.dir})`);
    runCommand("npm", ["publish", "--dry-run", "--access", "public", "--tag", releaseTag], {
      cwd: `${repoRoot}/${pkg.dir}`,
      stdio: "inherit"
    });
  }
}

console.log("PASS release check");
