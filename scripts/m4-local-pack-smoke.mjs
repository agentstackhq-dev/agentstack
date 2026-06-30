#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packDir = resolve(
  process.env.AGENTSTACK_M4_PACK_DIR ?? join(tmpdir(), "agentstack-m4-pack")
);
const consumerDir = resolve(
  process.env.AGENTSTACK_M4_CONSUMER_DIR ?? join(tmpdir(), "agentstack-m4-consumer")
);
const appName = process.env.AGENTSTACK_M4_APP_NAME ?? "m4-smoke";

const packages = [
  { dir: "packages/core", name: "@agentstack/core" },
  { dir: "packages/adapters", name: "@agentstack/adapters" },
  { dir: "packages/telemetry", name: "@agentstack/telemetry" },
  { dir: "packages/cli", name: "@agentstack/cli" },
  { dir: "packages/agentstack", name: "agentstack" }
];

const internalPackageNames = packages
  .map((pkg) => pkg.name)
  .filter((name) => name !== "agentstack");

main();

function main() {
  resetDirectory(packDir);
  resetDirectory(consumerDir);

  const tarballs = packWorkspacePackages();
  const packageSpecs = Object.fromEntries(
    Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`])
  );

  writeLauncherPackage(packageSpecs);
  run("corepack", ["pnpm", "install"], consumerDir);

  const help = run("corepack", ["pnpm", "exec", "agentstack", "--help"], consumerDir);
  assertIncludes(help.stdout, "agentstack create <app-name>", "launcher help exposes create");
  assertIncludes(help.stdout, "--package-override <name=spec>", "launcher help exposes overrides");

  run(
    "corepack",
    [
      "pnpm",
      "exec",
      "agentstack",
      "create",
      appName,
      "--package-spec",
      packageSpecs.agentstack,
      ...internalPackageNames.flatMap((name) => ["--package-override", `${name}=${packageSpecs[name]}`])
    ],
    consumerDir
  );

  const appDir = join(consumerDir, appName);
  assertGeneratedPackage(appDir, packageSpecs);

  run("corepack", ["pnpm", "install"], appDir);
  const typecheck = run("corepack", ["pnpm", "run", "typecheck"], appDir);
  assertIncludes(typecheck.stdout, "tsc -p apps/convex/tsconfig.json", "generated app typecheck runs");
  const validate = run("corepack", ["pnpm", "run", "validate"], appDir);
  assertIncludes(validate.stdout, "PASS validate", "generated app validates");

  const devCheck = run("corepack", ["pnpm", "run", "dev:check"], appDir);
  assertIncludes(devCheck.stdout, "PASS dev preflight development web", "generated app dev check passes");

  const previewUp = run("corepack", ["pnpm", "run", "preview:up"], appDir, {
    allowedExitCodes: [1]
  });
  assertIncludes(
    `${previewUp.stdout}\n${previewUp.stderr}`,
    "FAIL preview.up.confirmation-required",
    "preview up refuses without live confirmation"
  );

  console.log("PASS m4 local-pack smoke");
  console.log(`Pack dir: ${packDir}`);
  console.log(`Consumer dir: ${consumerDir}`);
  console.log(`Generated app: ${appDir}`);
  console.log("Packed artifacts:");
  for (const pkg of packages) {
    console.log(`- ${pkg.name}: ${tarballs[pkg.name]}`);
  }
  console.log("Verified commands:");
  console.log("- packed launcher install");
  console.log("- agentstack --help from tarball install");
  console.log("- agentstack create from tarball install");
  console.log("- generated app pnpm install");
  console.log("- generated app pnpm run typecheck");
  console.log("- generated app pnpm run validate");
  console.log("- generated app pnpm run dev:check");
  console.log("- generated app preview:up confirmation gate");
}

function packWorkspacePackages() {
  const tarballs = {};

  for (const pkg of packages) {
    const packageDir = join(repoRoot, pkg.dir);
    const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
    const tarballPath = join(packDir, tarballName(manifest.name, manifest.version));

    run("corepack", ["pnpm", "--dir", packageDir, "pack", "--pack-destination", packDir], repoRoot);
    if (!existsSync(tarballPath)) {
      throw new Error(`Expected packed artifact not found: ${tarballPath}`);
    }
    tarballs[pkg.name] = tarballPath;
  }

  return tarballs;
}

function writeLauncherPackage(packageSpecs) {
  const launcherPackage = {
    private: true,
    type: "module",
    packageManager: "pnpm@9.15.4",
    dependencies: {
      agentstack: packageSpecs.agentstack
    },
    pnpm: {
      overrides: Object.fromEntries(internalPackageNames.map((name) => [name, packageSpecs[name]]))
    }
  };

  writeFileSync(join(consumerDir, "package.json"), `${JSON.stringify(launcherPackage, null, 2)}\n`);
}

function assertGeneratedPackage(appDir, packageSpecs) {
  const packagePath = join(appDir, "package.json");
  const packageManifest = JSON.parse(readFileSync(packagePath, "utf8"));
  const serialized = JSON.stringify(packageManifest, null, 2);

  if (packageManifest.dependencies?.agentstack !== packageSpecs.agentstack) {
    throw new Error("Generated app does not depend on the packed agentstack tarball.");
  }
  if (serialized.includes("link:")) {
    throw new Error("Generated app package.json contains a source link dependency.");
  }
  if (serialized.includes(repoRoot)) {
    throw new Error("Generated app package.json contains the framework repo source path.");
  }

  for (const name of internalPackageNames) {
    if (packageManifest.dependencies?.[name]) {
      throw new Error(`Generated app exposes internal dependency ${name}.`);
    }
    if (packageManifest.pnpm?.overrides?.[name] !== packageSpecs[name]) {
      throw new Error(`Generated app missing local-pack override for ${name}.`);
    }
  }
}

function run(command, args, cwd, options = {}) {
  const allowedExitCodes = options.allowedExitCodes ?? [0];
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
      PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: "false"
    }
  });

  if (result.error) {
    throw result.error;
  }

  if (!allowedExitCodes.includes(result.status ?? 1)) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        `cwd: ${cwd}`,
        `exit: ${result.status}`,
        result.stdout,
        result.stderr
      ].join("\n")
    );
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status
  };
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}.`);
  }
}

function resetDirectory(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

function tarballName(name, version) {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}
