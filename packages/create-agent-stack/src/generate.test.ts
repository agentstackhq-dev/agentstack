import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { generateProject } from "./generate.js";

const require = createRequire(import.meta.url);
const sourceDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(sourceDir, "..");
const repoRoot = resolve(packageRoot, "../..");
const packageManifestPath = join(packageRoot, "package.json");
const rootTemplateDir = join(repoRoot, "templates/b2b-saas");
const packageTemplateDir = join(packageRoot, "templates/b2b-saas");
const templateTokens = ["__APP_SLUG__", "__APP_NAME__"];
const execFileAsync = promisify(execFile);

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
      expect(agents).toContain("Run `pnpm run validate` before completion.");
      await expectNoTemplateTokens(targetDir);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("generates package scripts that execute from the generated project", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await expect(runPackageScript(targetDir, "validate", sourceCliEnv())).resolves.toContain(
        "PASS validate"
      );
      await expect(runPackageScript(targetDir, "validate:cloud", sourceCliEnv())).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL cloud.service.missing")
      });
      await expect(runPackageScript(targetDir, "init:cloud", sourceCliEnv())).resolves.toContain(
        "APPLIED preview"
      );
      const cloudState = JSON.parse(
        await readFile(join(targetDir, ".agentstack/local-cloud.json"), "utf8")
      );
      expect(cloudState.services).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ environment: "preview", service: "clerk", linked: true }),
          expect.objectContaining({ environment: "preview", service: "convex", linked: true }),
          expect.objectContaining({ environment: "preview", service: "vercel", linked: true }),
          expect.objectContaining({ environment: "preview", service: "eas", linked: true })
        ])
      );
      await expect(runPackageScript(targetDir, "validate:cloud", sourceCliEnv())).resolves.toBeDefined();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("generated validate delegates to the real manifest schema", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const manifestPath = join(targetDir, "agentstack.config.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      delete manifest.env.custom;
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      await expect(runPackageScript(targetDir, "validate", sourceCliEnv())).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL manifest.invalid")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("does not embed local source paths when generating outside the repo", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-outside-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const files = await listFiles(targetDir);
      const generatedContent = await Promise.all(
        files.map((file) => readFile(join(targetDir, file), "utf8"))
      );

      for (const content of generatedContent) {
        expect(content).not.toContain("<user-home>/");
        expect(content).not.toContain("__AGENTSTACK_");
      }
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
    ).resolves.toContain("Run `pnpm run validate` before completion.");
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

describe("package metadata", () => {
  test("does not depend on unpublished workspace packages at runtime", async () => {
    const packageManifest = JSON.parse(
      await readFile(packageManifestPath, "utf8")
    );

    expect(packageManifest.dependencies).not.toHaveProperty("@agentstack/core");
    expect(packageManifest.bin["create-agent-stack"]).toBe("src/bin.js");
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

function sourceCliEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    AGENTSTACK_CLI_BIN: join(repoRoot, "packages/cli/src/bin.ts"),
    AGENTSTACK_TSX_BIN: require.resolve("tsx/cli")
  };
}

async function runPackageScript(
  cwd: string,
  script: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const { stdout, stderr } = await execFileAsync("pnpm", ["run", script], { cwd, env });
  return `${stdout}${stderr}`;
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
