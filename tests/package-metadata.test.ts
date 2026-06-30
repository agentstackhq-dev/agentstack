import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(dirnameFromUrl(import.meta.url), "..");
const previewVersion = "0.1.0-beta.4";

const publishedPackages = [
  {
    dir: "packages/core",
    name: "@agentstackhq/core",
    files: ["dist"]
  },
  {
    dir: "packages/adapters",
    name: "@agentstackhq/adapters",
    files: ["dist"]
  },
  {
    dir: "packages/telemetry",
    name: "@agentstackhq/telemetry",
    files: ["dist"]
  },
  {
    dir: "packages/cli",
    name: "@agentstackhq/cli",
    files: ["dist", "skills"]
  },
  {
    dir: "packages/agentstack",
    name: "@agentstackhq/agentstack",
    files: ["dist", "templates"]
  }
] as const;

describe("npm preview package metadata", () => {
  test("uses the scoped public package facade while keeping the agentstack binary", async () => {
    const manifest = await readManifest("packages/agentstack");

    expect(manifest.name).toBe("@agentstackhq/agentstack");
    expect(manifest.version).toBe(previewVersion);
    expect(manifest.bin).toEqual({ agentstack: "dist/bin.js" });
    expect(manifest.main).toBe("dist/index.js");
    expect(manifest.types).toBe("dist/index.d.ts");
    expect(manifest.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        default: "./dist/index.js"
      },
      "./config": {
        types: "./dist/config.d.ts",
        default: "./dist/config.js"
      }
    });
    expect(manifest.dependencies).not.toHaveProperty("tsx");
  });

  test("uses exact publishable specs for scoped internal packages", async () => {
    for (const pkg of publishedPackages) {
      const manifest = await readManifest(pkg.dir);

      expect(manifest.name).toBe(pkg.name);
      expect(manifest.version).toBe(previewVersion);
      expect(manifest.files).toEqual(pkg.files);
      expect(manifest.publishConfig).toMatchObject({ access: "public", tag: "beta" });

      for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
        if (name.startsWith("@agentstackhq/")) {
          expect(spec).toBe(previewVersion);
        }
        expect(spec).not.toContain("workspace:");
        expect(spec).not.toContain("link:");
      }
    }
  });
});

async function readManifest(packageDir: string): Promise<{
  name: string;
  version: string;
  main?: string;
  types?: string;
  exports?: unknown;
  bin?: unknown;
  dependencies?: Record<string, string>;
  files?: string[];
  publishConfig?: Record<string, string>;
}> {
  return JSON.parse(await readFile(join(repoRoot, packageDir, "package.json"), "utf8"));
}

function dirnameFromUrl(url: string): string {
  return new URL(".", url).pathname;
}
