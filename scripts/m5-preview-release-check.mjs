#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packDir = resolve(
  process.env.AGENTSTACK_M5_PACK_DIR ?? join(tmpdir(), "agentstack-m5-pack")
);
const consumerDir = resolve(
  process.env.AGENTSTACK_M5_CONSUMER_DIR ?? join(tmpdir(), "agentstack-m5-consumer")
);
const appName = process.env.AGENTSTACK_M5_APP_NAME ?? "m5-beta-smoke";
const previewVersion = "0.1.0-beta.6";
const publicPackageName = "@agentstackhq/agentstack";
const localUserPathMarker = ["/", "Users", "/"].join("");
const packages = [
  { dir: "packages/core", name: "@agentstackhq/core", files: ["dist"] },
  { dir: "packages/adapters", name: "@agentstackhq/adapters", files: ["dist"] },
  { dir: "packages/telemetry", name: "@agentstackhq/telemetry", files: ["dist"] },
  { dir: "packages/cli", name: "@agentstackhq/cli", files: ["dist", "skills"] },
  { dir: "packages/agentstack", name: publicPackageName, files: ["dist", "templates"] }
];
const internalPackageNames = packages
  .map((pkg) => pkg.name)
  .filter((name) => name !== publicPackageName);

main();

function main() {
  resetDirectory(packDir);
  resetDirectory(consumerDir);

  run("corepack", ["pnpm", "build"], repoRoot);
  const tarballs = packWorkspacePackages();
  const packageSpecs = Object.fromEntries(
    Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`])
  );

  writeLauncherPackage(packageSpecs);
  run("corepack", ["pnpm", "install"], consumerDir);

  const help = run("corepack", ["pnpm", "exec", "agentstack", "--help"], consumerDir);
  assertIncludes(help.stdout, "agentstack create <app-name>", "launcher help exposes create");

  run(
    "corepack",
    [
      "pnpm",
      "exec",
      "agentstack",
      "create",
      appName,
      "--package-spec",
      packageSpecs[publicPackageName],
      ...internalPackageNames.flatMap((name) => ["--package-override", `${name}=${packageSpecs[name]}`])
    ],
    consumerDir
  );

  const appDir = join(consumerDir, appName);
  assertGeneratedPackage(appDir, packageSpecs);

  run("corepack", ["pnpm", "install"], appDir);
  run("corepack", ["pnpm", "run", "typecheck"], appDir);
  const validate = run("corepack", ["pnpm", "run", "validate"], appDir);
  assertIncludes(validate.stdout, "PASS validate", "generated app validates");
  const devCheck = run("corepack", ["pnpm", "run", "dev:check"], appDir);
  assertIncludes(devCheck.stdout, "PASS dev preflight development web", "generated app dev check passes");
  run("corepack", ["pnpm", "--filter", "@app/web", "build"], appDir);

  const previewUp = run("corepack", ["pnpm", "run", "preview:up"], appDir, {
    allowedExitCodes: [1]
  });
  assertIncludes(
    `${previewUp.stdout}\n${previewUp.stderr}`,
    "FAIL preview.up.confirmation-required",
    "preview up refuses without live confirmation"
  );

  assertNoForbiddenGeneratedSurface(appDir);

  console.log("PASS m5 preview release check");
  console.log(`Pack dir: ${packDir}`);
  console.log(`Consumer dir: ${consumerDir}`);
  console.log(`Generated app: ${appDir}`);
  console.log("Packed artifacts:");
  for (const pkg of packages) {
    console.log(`- ${pkg.name}: ${tarballs[pkg.name]}`);
  }
  console.log("Verified commands:");
  console.log("- package build");
  console.log("- packed package manifest inspection");
  console.log("- packed launcher install");
  console.log("- agentstack --help from tarball install");
  console.log("- agentstack create from tarball install");
  console.log("- generated app pnpm install");
  console.log("- generated app pnpm run typecheck");
  console.log("- generated app pnpm run validate");
  console.log("- generated app pnpm run dev:check");
  console.log("- generated web build");
  console.log("- generated app preview:up confirmation gate");
  console.log("- generated app scoped package and no legacy Convex API assertions");
}

function packWorkspacePackages() {
  const tarballs = {};

  for (const pkg of packages) {
    const packageDir = join(repoRoot, pkg.dir);
    const sourceManifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
    const tarballPath = join(packDir, tarballName(sourceManifest.name, sourceManifest.version));

    assertSourceManifest(pkg, sourceManifest);
    run("corepack", ["pnpm", "--dir", packageDir, "pack", "--pack-destination", packDir], repoRoot);
    if (!existsSync(tarballPath)) {
      throw new Error(`Expected packed artifact not found: ${tarballPath}`);
    }
    assertPackedManifest(pkg, readPackedPackageJson(tarballPath));
    assertPackedExecutable(pkg, tarballPath);
    tarballs[pkg.name] = tarballPath;
  }

  return tarballs;
}

function assertSourceManifest(pkg, manifest) {
  if (manifest.name !== pkg.name) {
    throw new Error(`Expected ${pkg.dir} package name ${pkg.name}, received ${manifest.name}.`);
  }
  if (manifest.version !== previewVersion) {
    throw new Error(`Expected ${pkg.name} version ${previewVersion}, received ${manifest.version}.`);
  }
  assertJsonDoesNotInclude(
    manifest,
    ["workspace:", "link:", localUserPathMarker],
    `${pkg.name} source manifest`
  );
  for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
    if (name.startsWith("@agentstackhq/") && spec !== previewVersion) {
      throw new Error(`Source dependency ${name} in ${pkg.name} must resolve to ${previewVersion}.`);
    }
  }
}

function assertPackedManifest(pkg, manifest) {
  if (manifest.name !== pkg.name) {
    throw new Error(`Packed manifest name mismatch for ${pkg.name}.`);
  }
  if (manifest.version !== previewVersion) {
    throw new Error(`Packed manifest version mismatch for ${pkg.name}.`);
  }
  if (JSON.stringify(manifest.files ?? []) !== JSON.stringify(pkg.files)) {
    throw new Error(`Packed manifest files mismatch for ${pkg.name}.`);
  }
  if (pkg.name === publicPackageName) {
    if (manifest.bin?.agentstack !== "dist/bin.js") {
      throw new Error("Public package must expose the agentstack binary from dist/bin.js.");
    }
    if (manifest.exports?.["./config"]?.default !== "./dist/config.js") {
      throw new Error("Public package must expose @agentstackhq/agentstack/config from dist/config.js.");
    }
  }

  for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
    if (name.startsWith("@agentstackhq/") && spec !== previewVersion) {
      throw new Error(`Packed dependency ${name} in ${pkg.name} must resolve to ${previewVersion}.`);
    }
  }
  assertJsonDoesNotInclude(
    manifest,
    ["workspace:", "link:", localUserPathMarker],
    `${pkg.name} packed manifest`
  );
}

function assertPackedExecutable(pkg, tarballPath) {
  if (pkg.name !== publicPackageName) {
    return;
  }

  const bin = run("tar", ["-xOf", tarballPath, "package/dist/bin.js"], repoRoot).stdout;
  if (!bin.startsWith("#!/usr/bin/env node")) {
    throw new Error("Public package dist/bin.js must use the Node shebang, not a dev-only runtime.");
  }
  if (bin.includes("env tsx")) {
    throw new Error("Public package dist/bin.js must not require tsx at runtime.");
  }
}

function readPackedPackageJson(tarballPath) {
  const result = run("tar", ["-xOf", tarballPath, "package/package.json"], repoRoot);
  return JSON.parse(result.stdout);
}

function writeLauncherPackage(packageSpecs) {
  const launcherPackage = {
    private: true,
    type: "module",
    packageManager: "pnpm@9.15.4",
    dependencies: {
      [publicPackageName]: packageSpecs[publicPackageName]
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

  if (packageManifest.dependencies?.[publicPackageName] !== packageSpecs[publicPackageName]) {
    throw new Error(`Generated app does not depend on the packed ${publicPackageName} tarball.`);
  }
  if (packageManifest.dependencies?.agentstack) {
    throw new Error("Generated app still exposes the legacy unscoped agentstack dependency.");
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

function assertNoForbiddenGeneratedSurface(appDir) {
  const checks = [
    {
      pattern: /from "convex\/server"|anyApi|makeFunctionReference| as ProtectedWorkspaceStatus| as EntitlementGate/,
      roots: ["apps/web", "apps/mobile"],
      label: "legacy untyped Convex access"
    },
    {
      pattern: /from "agentstack\/config|"agentstack"\s*:/,
      roots: ["package.json", "agentstack.config.ts", "apps/web", "apps/mobile"],
      label: "legacy unscoped package references"
    }
  ];

  for (const check of checks) {
    const matches = findMatches(appDir, check.roots, check.pattern);
    if (matches.length > 0) {
      throw new Error(`Generated app contains ${check.label}:\n${matches.join("\n")}`);
    }
  }

  const forbiddenRoots = ["docs", "scripts", "skills", ".agents", ".claude", "packages", "convex"];
  const presentForbiddenRoots = forbiddenRoots.filter((root) => existsSync(join(appDir, root)));
  if (presentForbiddenRoots.length > 0) {
    throw new Error(`Generated app contains forbidden framework roots: ${presentForbiddenRoots.join(", ")}`);
  }
}

function findMatches(appDir, roots, pattern) {
  const matches = [];
  for (const root of roots) {
    for (const file of collectFiles(join(appDir, root))) {
      const text = readFileSync(file, "utf8");
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          matches.push(`${relative(appDir, file)}:${index + 1}:${line.trim()}`);
        }
      });
    }
  }
  return matches;
}

function collectFiles(path) {
  if (!existsSync(path)) {
    return [];
  }
  const stat = statSync(path);
  if (stat.isFile()) {
    return [path];
  }
  if (!stat.isDirectory()) {
    return [];
  }
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() && (entry.name === "node_modules" || entry.name === ".git")
      ? []
      : collectFiles(join(path, entry.name))
  );
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

function assertJsonDoesNotInclude(value, needles, label) {
  const serialized = JSON.stringify(value, null, 2);
  for (const needle of needles) {
    if (serialized.includes(needle)) {
      throw new Error(`${label} contains forbidden value ${JSON.stringify(needle)}.`);
    }
  }
}

function resetDirectory(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

function tarballName(name, version) {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}
