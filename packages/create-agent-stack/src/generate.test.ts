import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { generateProject } from "./generate.js";

describe("generateProject", () => {
  test("generates a B2B SaaS project with app tokens replaced", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const manifest = JSON.parse(
        await readFile(join(targetDir, "agentstack.config.json"), "utf8")
      );
      const agents = await readFile(join(targetDir, "AGENTS.md"), "utf8");

      expect(manifest.app.slug).toBe("acme-crm");
      expect(agents).toContain("Run `agentstack validate` before completion.");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
