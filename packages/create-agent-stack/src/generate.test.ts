import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { generateProject } from "./generate.js";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(sourceDir, "..");
const repoRoot = resolve(packageRoot, "../..");
const rootTemplateDir = join(repoRoot, "templates/b2b-saas");
const packageTemplateDir = join(packageRoot, "templates/b2b-saas");
const templateTokens = ["__APP_SLUG__", "__APP_NAME__"];

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
      await expectNoTemplateTokens(targetDir);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects names that cannot produce a slug", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "invalid");

    try {
      await expect(generateProject({ name: "!!!", targetDir })).rejects.toThrow(
        "Project name must contain at least one letter or number."
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("packaged template", () => {
  test("includes key files in the package-local template directory", async () => {
    await expect(stat(packageTemplateDir)).resolves.toMatchObject({
      isDirectory: expect.any(Function)
    });
    await expect(
      readFile(join(packageTemplateDir, "agentstack.config.json"), "utf8")
    ).resolves.toContain("__APP_SLUG__");
    await expect(
      readFile(join(packageTemplateDir, "AGENTS.md"), "utf8")
    ).resolves.toContain("Run `agentstack validate` before completion.");
  });

  test("keeps repo-root and package-local templates identical", async () => {
    const rootFiles = await listFiles(rootTemplateDir);
    const packageFiles = await listFiles(packageTemplateDir);

    expect(packageFiles).toEqual(rootFiles);

    await Promise.all(
      rootFiles.map(async (file) => {
        await expect(readFile(join(packageTemplateDir, file), "utf8")).resolves.toBe(
          await readFile(join(rootTemplateDir, file), "utf8")
        );
      })
    );
  });
});

async function expectNoTemplateTokens(directory: string): Promise<void> {
  const files = await listFiles(directory);

  await Promise.all(
    files.map(async (file) => {
      const content = await readFile(join(directory, file), "utf8");
      for (const token of templateTokens) {
        expect(content).not.toContain(token);
      }
    })
  );
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry);
      const entryStat = await stat(path);

      if (entryStat.isDirectory()) {
        return (await listFiles(path)).map((file) => join(entry, file));
      }

      if (entryStat.isFile()) {
        return [relative(directory, path)];
      }

      return [];
    })
  );

  return files.flat().sort();
}
