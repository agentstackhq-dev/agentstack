import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirnameFromUrl(import.meta.url), "..");

describe("release pipeline contract", () => {
  test("exposes package-owned release scripts", async () => {
    const manifest = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));

    expect(manifest.scripts).toMatchObject({
      "release:check": "node scripts/release/check.mjs",
      "release:bump": "node scripts/release/bump-version.mjs",
      "release:publish": "node scripts/release/publish.mjs",
      "release:registry:smoke": "node scripts/release/registry-smoke.mjs",
      "public:safety:check": "node scripts/public-safety-check.mjs"
    });
  });

  test("release contract check passes for the current workspace", async () => {
    const result = await execFileAsync("node", ["scripts/release/contract.mjs", "--check"], {
      cwd: repoRoot
    });

    expect(result.stdout).toContain("PASS release contract");
  });

  test("release check includes the public safety gate", async () => {
    const script = await readFile(join(repoRoot, "scripts/release/check.mjs"), "utf8");

    expect(script).toContain("public:safety:check");
  });

  test("ci workflow runs the full non-publishing release gate", async () => {
    const workflow = await readFile(join(repoRoot, ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain("on:");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toContain("version: 9.15.4");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain("corepack pnpm install --frozen-lockfile");
    expect(workflow).toContain("corepack pnpm run release:check -- --skip-npm-dry-run");
  });

  test("release workflow uses manual dispatch, trusted publishing, and registry smoke", async () => {
    const workflow = await readFile(join(repoRoot, ".github/workflows/release.yml"), "utf8");
    const publishScript = await readFile(join(repoRoot, "scripts/release/publish.mjs"), "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("environment: npm-production");
    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toContain("version: 9.15.4");
    expect(workflow).toContain("corepack pnpm run release:check -- --skip-npm-dry-run");
    expect(workflow).toContain("corepack pnpm run release:publish");
    expect(workflow).toContain("corepack pnpm run release:registry:smoke");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(publishScript).not.toContain("--provenance");
  });

  test("release publish verification retries stale npm dist-tags", async () => {
    const { verifyPublishedPackage } = await import(
      pathToFileURL(join(repoRoot, "scripts/release/publish.mjs")).href
    );
    const attempts: string[] = [];
    const viewPackage = (specifier: string) => {
      attempts.push(specifier);
      if (attempts.length === 1) {
        return {
          version: "0.1.0-beta.4",
          "dist-tags": { beta: "0.1.0-beta.4" }
        };
      }
      return {
        version: "0.1.0-beta.5",
        "dist-tags": { beta: "0.1.0-beta.5" }
      };
    };

    await expect(
      verifyPublishedPackage("@agentstackhq/cli", "0.1.0-beta.5", "beta", {
        attempts: 2,
        delayMs: 0,
        viewPackage
      })
    ).resolves.toMatchObject({
      version: "0.1.0-beta.5",
      "dist-tags": { beta: "0.1.0-beta.5" }
    });
    expect(attempts).toEqual(["@agentstackhq/cli@beta", "@agentstackhq/cli@beta"]);
  });

  test("release workflow documentation records versioning and trusted publishing rules", async () => {
    const doc = await readFile(
      join(repoRoot, "docs/releases/versioning-and-release-workflow.md"),
      "utf8"
    );

    expect(doc).toContain("Lockstep versioning");
    expect(doc).toContain("vX.Y.Z-beta.N");
    expect(doc).toContain("Trusted publishing");
    expect(doc).toContain("npm-production");
    expect(doc).toContain("@agentstackhq/agentstack");
  });

  test("m5 smoke does not require ripgrep on clean runners", async () => {
    const script = await readFile(join(repoRoot, "scripts/m5-preview-release-check.mjs"), "utf8");

    expect(script).not.toContain('"rg"');
    expect(script).toContain("function findMatches");
  });
});

function dirnameFromUrl(url: string): string {
  return new URL(".", url).pathname;
}
