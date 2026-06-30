#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const publicPackageName = "@agentstackhq/agentstack";
export const releasePackages = [
  { dir: "packages/core", name: "@agentstackhq/core", files: ["dist"] },
  { dir: "packages/telemetry", name: "@agentstackhq/telemetry", files: ["dist"] },
  { dir: "packages/adapters", name: "@agentstackhq/adapters", files: ["dist"] },
  { dir: "packages/cli", name: "@agentstackhq/cli", files: ["dist", "skills"] },
  { dir: "packages/agentstack", name: publicPackageName, files: ["dist", "templates"] }
];
const localUserPathMarker = ["/", "Users", "/"].join("");

const currentSurfaceScanRoots = [
  "AGENTS.md",
  "README.md",
  "ARCHITECTURE.md",
  "package.json",
  "pnpm-lock.yaml",
  "scripts",
  "packages",
  "templates",
  "tests",
  "docs/README.md",
  "docs/milestones/README.md",
  "docs/milestones/M5-preview-beta-publishability.md",
  "docs/releases",
  "docs/references/local-quickstart.md",
  "docs/validation-hypothesis.md",
  "docs/validation-operating-model.md"
];

const textVersionFiles = [
  "packages/core/src/manifest.ts",
  "packages/core/src/manifest.test.ts",
  "scripts/m5-preview-release-check.mjs",
  "tests/package-metadata.test.ts",
  "templates/b2b-saas/agentstack.config.ts",
  "packages/agentstack/templates/b2b-saas/agentstack.config.ts"
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] ?? "--check";
  if (command !== "--check") {
    fail(`Unknown contract command: ${command}`);
  }
  assertReleaseContract();
  console.log(`PASS release contract ${readReleaseVersion()}`);
}

export function readReleaseVersion(root = repoRoot) {
  return readJson(join(root, "packages/core/package.json")).version;
}

export function releaseDistTag(version) {
  assertReleaseVersionSyntax(version);
  return version.includes("-beta.") ? "beta" : "latest";
}

export function assertReleaseVersionSyntax(version) {
  if (!/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(version)) {
    fail(`Invalid release version "${version}". Use X.Y.Z-beta.N for beta or X.Y.Z for stable.`);
  }
}

export function assertReleaseTag(version, tag) {
  const expectedTag = releaseDistTag(version);
  if (tag !== expectedTag) {
    fail(`Version ${version} must be published with dist-tag "${expectedTag}", received "${tag}".`);
  }
}

export function assertReleaseContract(root = repoRoot) {
  const version = readReleaseVersion(root);
  assertReleaseVersionSyntax(version);
  assertPackageManifests(root, version);
  assertVersionedFiles(root, version);
  assertGeneratedTemplates(root, version);
  assertCurrentSurfaceHasNoLegacyScope(root);
  assertWorkflowFiles(root);
}

function assertPackageManifests(root, version) {
  for (const pkg of releasePackages) {
    const manifestPath = join(root, pkg.dir, "package.json");
    const manifest = readJson(manifestPath);

    assertEqual(manifest.name, pkg.name, `${pkg.dir} package name`);
    assertEqual(manifest.version, version, `${pkg.name} version`);
    assertDeepEqual(manifest.files, pkg.files, `${pkg.name} files`);
    assertEqual(manifest.type, "module", `${pkg.name} module type`);
    assertEqual(manifest.main, "dist/index.js", `${pkg.name} main`);
    assertEqual(manifest.types, "dist/index.d.ts", `${pkg.name} types`);
    assertEqual(manifest.publishConfig?.access, "public", `${pkg.name} publish access`);

    for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
      if (name.startsWith("@agentstackhq/")) {
        assertEqual(spec, version, `${pkg.name} dependency ${name}`);
      }
      assertDoesNotContain(spec, "workspace:", `${pkg.name} dependency ${name}`);
      assertDoesNotContain(spec, "link:", `${pkg.name} dependency ${name}`);
      assertDoesNotContain(spec, localUserPathMarker, `${pkg.name} dependency ${name}`);
    }

    if (pkg.name === publicPackageName) {
      assertEqual(manifest.bin?.agentstack, "dist/bin.js", "public bin path");
      assertEqual(manifest.exports?.["./config"]?.default, "./dist/config.js", "config export");
      if (manifest.dependencies?.tsx || manifest.devDependencies?.tsx === undefined) {
        fail("Public package must keep tsx out of dependencies and scoped to devDependencies.");
      }
    }
  }
}

function assertVersionedFiles(root, version) {
  for (const file of textVersionFiles) {
    assertFileContains(root, file, version);
  }

  const agentstackBin = readText(join(root, "packages/agentstack/src/bin.ts"));
  if (!agentstackBin.startsWith("#!/usr/bin/env node")) {
    fail("packages/agentstack/src/bin.ts must use the Node shebang.");
  }
  assertDoesNotContain(agentstackBin, "env tsx", "packages/agentstack/src/bin.ts");

  const cliBin = readText(join(root, "packages/cli/src/bin.ts"));
  if (!cliBin.startsWith("#!/usr/bin/env node")) {
    fail("packages/cli/src/bin.ts must use the Node shebang.");
  }
  assertDoesNotContain(cliBin, "env tsx", "packages/cli/src/bin.ts");
}

function assertGeneratedTemplates(root, version) {
  for (const prefix of ["templates/b2b-saas", "packages/agentstack/templates/b2b-saas"]) {
    const appManifest = readJson(join(root, prefix, "package.json"));
    assertEqual(
      appManifest.dependencies?.[publicPackageName],
      "__AGENTSTACK_PACKAGE_SPEC__",
      `${prefix}/package.json ${publicPackageName}`
    );
    if (appManifest.dependencies?.agentstack) {
      fail(`${prefix}/package.json must not depend on legacy unscoped agentstack.`);
    }
    assertFileContains(root, `${prefix}/agentstack.config.ts`, `frameworkVersion: "${version}"`);
  }
}

function assertCurrentSurfaceHasNoLegacyScope(root) {
  const forbidden = [/@agentstack\//, new RegExp(`agentstack-${"agentstack"}`)];
  for (const file of currentSurfaceFiles(root)) {
    const text = readText(file);
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        fail(`Legacy package reference ${pattern} found in ${relative(root, file)}.`);
      }
    }
  }
}

function assertWorkflowFiles(root) {
  const ci = readText(join(root, ".github/workflows/ci.yml"));
  assertDoesNotContain(ci, "NPM_TOKEN", ".github/workflows/ci.yml");
  assertFileContains(root, ".github/workflows/ci.yml", "pnpm/action-setup@v4");
  assertFileContains(root, ".github/workflows/ci.yml", "version: 9.15.4");
  assertFileContains(
    root,
    ".github/workflows/ci.yml",
    "corepack pnpm run release:check -- --skip-npm-dry-run"
  );

  const release = readText(join(root, ".github/workflows/release.yml"));
  assertFileContains(root, ".github/workflows/release.yml", "workflow_dispatch:");
  assertFileContains(root, ".github/workflows/release.yml", "id-token: write");
  assertFileContains(root, ".github/workflows/release.yml", "environment: npm-production");
  assertFileContains(root, ".github/workflows/release.yml", "pnpm/action-setup@v4");
  assertFileContains(root, ".github/workflows/release.yml", "version: 9.15.4");
  assertFileContains(
    root,
    ".github/workflows/release.yml",
    "corepack pnpm run release:check -- --skip-npm-dry-run"
  );
  assertDoesNotContain(release, "NPM_TOKEN", ".github/workflows/release.yml");
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
  const allowedExitCodes = options.allowedExitCodes ?? [0];
  if (!allowedExitCodes.includes(result.status ?? 1)) {
    const rendered = [result.stdout, result.stderr].filter(Boolean).join("\n");
    fail(`${command} ${args.join(" ")} failed with exit ${result.status ?? "unknown"}\n${rendered}`);
  }
  return result;
}

export function npmViewJson(packageName) {
  const result = execFileSync("npm", ["view", packageName, "version", "dist-tags", "--json"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return JSON.parse(result);
}

function currentSurfaceFiles(root) {
  const files = [];
  for (const entry of currentSurfaceScanRoots) {
    const absolute = join(root, entry);
    if (!existsSync(absolute)) {
      continue;
    }
    collectTextFiles(absolute, files);
  }
  return files.filter((file) => {
    const rel = relative(root, file);
    return (
      !rel.includes("/dist/") &&
      !rel.includes("/node_modules/") &&
      !rel.includes("/.agentstack/") &&
      !rel.startsWith("docs/superpowers/") &&
      !rel.startsWith("docs/milestones/evidence/M4-clean-machine-smoke/")
    );
  });
}

function collectTextFiles(path, files) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const child of readdirSync(path)) {
      collectTextFiles(join(path, child), files);
    }
    return;
  }
  if (/\.(?:ts|tsx|js|mjs|json|md|yml|yaml|html|css)$/.test(path)) {
    files.push(path);
  }
}

function assertFileContains(root, file, expected) {
  const text = readText(join(root, file));
  if (!text.includes(expected)) {
    fail(`${file} must include ${JSON.stringify(expected)}.`);
  }
}

function assertDoesNotContain(value, forbidden, label) {
  if (String(value).includes(forbidden)) {
    fail(`${label} must not include ${JSON.stringify(forbidden)}.`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function fail(message) {
  throw new Error(message);
}
