import { readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fsExtra = require("fs-extra") as {
  copy(source: string, destination: string): Promise<void>;
};

export type GenerateProjectInput = {
  name: string;
  targetDir: string;
  packageSpec?: string;
  packageOverrides?: Record<string, string>;
};

export async function generateProject(input: GenerateProjectInput): Promise<void> {
  const appSlug = slugify(input.name);
  if (!appSlug) {
    throw new Error("Project name must contain at least one letter or number.");
  }

  const appName = titleCaseSlug(appSlug);
  const templateDir = findTemplateDir();

  await fsExtra.copy(templateDir, input.targetDir);
  await ensureGeneratedGitignore(input.targetDir);
  await replaceTokens(input.targetDir, {
    __APP_SLUG__: appSlug,
    __APP_NAME__: appName,
    __AGENTSTACK_PACKAGE_SPEC__: input.packageSpec ?? "0.0.0"
  });
  await writePackageOverrides(input.targetDir, input.packageOverrides);
}

function findTemplateDir(): string {
  return join(findPackageRoot(), "templates", "b2b-saas");
}

function findPackageRoot(): string {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  return dirname(dirname(sourceDir));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function replaceTokens(
  directory: string,
  replacements: Record<string, string>
): Promise<void> {
  const entries = await readdir(directory);

  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry);
      const entryStat = await stat(path);

      if (entryStat.isDirectory()) {
        await replaceTokens(path, replacements);
        return;
      }

      if (!entryStat.isFile()) {
        return;
      }

      const content = await readFile(path, "utf8");
      const replaced = Object.entries(replacements).reduce(
        (current, [token, value]) => current.replaceAll(token, value),
        content
      );

      if (replaced !== content) {
        await writeFile(path, replaced);
      }
    })
  );
}

async function ensureGeneratedGitignore(targetDir: string): Promise<void> {
  const gitignorePath = join(targetDir, ".gitignore");
  const fallbackPath = join(targetDir, "_gitignore");
  const hasGitignore = await fileExists(gitignorePath);
  const hasFallback = await fileExists(fallbackPath);

  if (hasGitignore && hasFallback) {
    await rm(fallbackPath);
    return;
  }

  if (!hasGitignore && hasFallback) {
    await rename(fallbackPath, gitignorePath);
  }
}

async function writePackageOverrides(
  targetDir: string,
  packageOverrides: Record<string, string> | undefined
): Promise<void> {
  if (!packageOverrides || Object.keys(packageOverrides).length === 0) {
    return;
  }

  const packageJsonPath = join(targetDir, "package.json");
  const packageManifest = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    pnpm?: { overrides?: Record<string, string> };
  };
  packageManifest.pnpm = {
    ...packageManifest.pnpm,
    overrides: {
      ...packageManifest.pnpm?.overrides,
      ...packageOverrides
    }
  };
  await writeFile(packageJsonPath, `${JSON.stringify(packageManifest, null, 2)}\n`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const pathStat = await stat(path);
    return pathStat.isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
