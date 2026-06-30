import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const supportedSkillHarnesses = ["codex"] as const;

export type SupportedSkillHarness = (typeof supportedSkillHarnesses)[number];

export type SkillInstallFileResult = {
  path: string;
  status: "created" | "unchanged" | "overwritten";
};

export type SkillInstallConflict = {
  path: string;
};

export type SkillInstallResult =
  | {
      ok: true;
      harness: SupportedSkillHarness;
      destinationRoot: string;
      files: SkillInstallFileResult[];
    }
  | {
      ok: false;
      reason: "unsupported-harness";
      harness: string;
      supported: SupportedSkillHarness[];
    }
  | {
      ok: false;
      reason: "conflict";
      harness: SupportedSkillHarness;
      destinationRoot: string;
      conflicts: SkillInstallConflict[];
    };

const harnessDestinations: Record<SupportedSkillHarness, string> = {
  codex: ".agents/skills"
};

export async function installSkillPack(input: {
  cwd: string;
  harness: string;
  force?: boolean;
}): Promise<SkillInstallResult> {
  if (!isSupportedSkillHarness(input.harness)) {
    return {
      ok: false,
      reason: "unsupported-harness",
      harness: input.harness,
      supported: [...supportedSkillHarnesses]
    };
  }

  const sourceRoot = join(findCliPackageRoot(), "skills", input.harness);
  const destinationRoot = harnessDestinations[input.harness];
  const sourceFiles = await listPackFiles(sourceRoot);
  const conflicts: SkillInstallConflict[] = [];
  const plannedWrites: Array<{
    destinationPath: string;
    relativePath: string;
    content: string;
  }> = [];

  for (const sourcePath of sourceFiles) {
    const relativePath = toPortablePath(relative(sourceRoot, sourcePath));
    const destinationPath = join(input.cwd, destinationRoot, relativePath);
    const content = await readFile(sourcePath, "utf8");
    const existing = await readExistingFile(destinationPath);

    if (existing !== undefined && existing !== content && !input.force) {
      conflicts.push({ path: toPortablePath(join(destinationRoot, relativePath)) });
      continue;
    }

    plannedWrites.push({ destinationPath, relativePath, content });
  }

  if (conflicts.length > 0) {
    return {
      ok: false,
      reason: "conflict",
      harness: input.harness,
      destinationRoot: toPortablePath(join(destinationRoot, "agentstack")),
      conflicts
    };
  }

  const files: SkillInstallFileResult[] = [];
  for (const write of plannedWrites) {
    const existing = await readExistingFile(write.destinationPath);
    const outputPath = toPortablePath(join(destinationRoot, write.relativePath));
    if (existing === write.content) {
      files.push({ path: outputPath, status: "unchanged" });
      continue;
    }

    await mkdir(dirname(write.destinationPath), { recursive: true });
    await writeFile(write.destinationPath, write.content, "utf8");
    files.push({ path: outputPath, status: existing === undefined ? "created" : "overwritten" });
  }

  return {
    ok: true,
    harness: input.harness,
    destinationRoot: toPortablePath(join(destinationRoot, "agentstack")),
    files
  };
}

function isSupportedSkillHarness(value: string): value is SupportedSkillHarness {
  return (supportedSkillHarnesses as readonly string[]).includes(value);
}

function findCliPackageRoot(): string {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  return dirname(sourceDir);
}

async function listPackFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (entry.isFile()) {
        files.push(path);
      }
    }
  }

  await visit(root);
  return files.sort();
}

async function readExistingFile(path: string): Promise<string | undefined> {
  try {
    const pathStat = await stat(path);
    if (!pathStat.isFile()) {
      return undefined;
    }
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}
