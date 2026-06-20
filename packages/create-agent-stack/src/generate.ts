import { readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fsExtra = require("fs-extra") as {
  copy(source: string, destination: string): Promise<void>;
};

export type GenerateProjectInput = {
  name: string;
  targetDir: string;
};

export async function generateProject(input: GenerateProjectInput): Promise<void> {
  const appSlug = slugify(input.name);
  if (!appSlug) {
    throw new Error("Project name must contain at least one letter or number.");
  }

  const appName = titleCaseSlug(appSlug);
  const templateDir = findTemplateDir();
  const repoRoot = findRepoRoot();

  await fsExtra.copy(templateDir, input.targetDir);
  const realTargetDir = await realpath(input.targetDir);
  const realRepoRoot = await realpath(repoRoot);
  const realTsxCli = await realpath(require.resolve("tsx/cli"));
  await replaceTokens(input.targetDir, {
    __APP_SLUG__: appSlug,
    __APP_NAME__: appName,
    __AGENTSTACK_REPO_ROOT__: toPortableRelativePath(realTargetDir, realRepoRoot),
    __AGENTSTACK_TSX_CLI__: toPortableRelativePath(realTargetDir, realTsxCli)
  });
}

function findTemplateDir(): string {
  return join(findPackageRoot(), "templates", "b2b-saas");
}

function findRepoRoot(): string {
  return dirname(dirname(findPackageRoot()));
}

function findPackageRoot(): string {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  return dirname(sourceDir);
}

function toPortableRelativePath(from: string, to: string): string {
  const path = relative(from, to).replaceAll("\\", "/");
  return path || ".";
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
