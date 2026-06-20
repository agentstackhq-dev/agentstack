import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createMissingGeneratedAnchorDiagnostic,
  formatDiagnostic,
  parseManifest,
  type AgentstackManifest
} from "@agentstack/core";

export type ProjectContext = {
  cwd: string;
  manifest: AgentstackManifest;
};

export async function loadProjectContext(cwd: string): Promise<ProjectContext> {
  const path = join(cwd, "agentstack.config.json");
  let raw: string;

  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingManifestAnchorError(error)) {
      throw new Error(formatDiagnostic(createMissingGeneratedAnchorDiagnostic("agentstack.config.json")));
    }
    throw error;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new Error(`FAIL manifest.invalid-json\n${(error as Error).message}`);
  }

  const parsed = parseManifest(parsedJson);
  if (!parsed.ok) {
    throw new Error(parsed.diagnostics.map(formatDiagnostic).join("\n"));
  }

  return { cwd, manifest: parsed.value };
}

function isMissingManifestAnchorError(error: unknown): boolean {
  return ["ENOENT", "EISDIR"].includes((error as NodeJS.ErrnoException).code ?? "");
}
