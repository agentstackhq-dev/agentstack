import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createMissingGeneratedAnchorDiagnostic,
  formatDiagnostic,
  parseEnvValueState,
  parseManifest,
  type AgentstackManifest,
  type EnvValueState
} from "@agentstack/core";

export type ProjectContext = {
  cwd: string;
  manifest: AgentstackManifest;
  serviceOrder: string[];
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

  return { cwd, manifest: parsed.value, serviceOrder: readRawServiceOrder(parsedJson) };
}

function readRawServiceOrder(parsedJson: unknown): string[] {
  if (typeof parsedJson !== "object" || parsedJson === null || !("services" in parsedJson)) {
    return [];
  }

  const services = (parsedJson as { services?: unknown }).services;
  if (typeof services !== "object" || services === null || Array.isArray(services)) {
    return [];
  }

  return Object.keys(services);
}

export async function loadLocalEnvValues(cwd: string): Promise<EnvValueState> {
  const relativePath = ".agentstack/env-values.json";
  const path = join(cwd, relativePath);
  let raw: string;

  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }

  try {
    const parsedJson = JSON.parse(raw);
    const parsed = parseEnvValueState(parsedJson);
    if (!parsed.ok) {
      throw new Error(
        [
          "FAIL env.values.invalid-shape",
          `Path: ${relativePath}`,
          parsed.diagnostics.map(formatDiagnostic).join("\n")
        ].join("\n")
      );
    }

    return parsed.value;
  } catch (error) {
    if ((error as Error).message.startsWith("FAIL env.values.invalid-shape")) {
      throw error;
    }
    throw new Error(
      [
        "FAIL env.values.invalid-json",
        `Path: ${relativePath}`,
        (error as Error).message,
        "Fix: Update .agentstack/env-values.json so it contains valid JSON in EnvValueState shape."
      ].join("\n")
    );
  }
}

function isMissingManifestAnchorError(error: unknown): boolean {
  return ["ENOENT", "EISDIR"].includes((error as NodeJS.ErrnoException).code ?? "");
}
