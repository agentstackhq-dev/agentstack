import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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
      "release:registry:smoke": "node scripts/release/registry-smoke.mjs"
    });
  });

  test("release contract check passes for the current workspace", async () => {
    const result = await execFileAsync("node", ["scripts/release/contract.mjs", "--check"], {
      cwd: repoRoot
    });

    expect(result.stdout).toContain("PASS release contract");
  });

  test("ci workflow runs the full non-publishing release gate", async () => {
    const workflow = await readFile(join(repoRoot, ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain("on:");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain("corepack pnpm install --frozen-lockfile");
    expect(workflow).toContain("corepack pnpm run release:check -- --skip-npm-dry-run");
  });

  test("release workflow uses manual dispatch, trusted publishing, and registry smoke", async () => {
    const workflow = await readFile(join(repoRoot, ".github/workflows/release.yml"), "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("environment: npm-production");
    expect(workflow).toContain("corepack pnpm run release:check -- --skip-npm-dry-run");
    expect(workflow).toContain("corepack pnpm run release:publish");
    expect(workflow).toContain("corepack pnpm run release:registry:smoke");
    expect(workflow).not.toContain("NPM_TOKEN");
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
});

function dirnameFromUrl(url: string): string {
  return new URL(".", url).pathname;
}
