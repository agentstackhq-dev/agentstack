import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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
  const path = join(cwd, "agentstack.config.ts");
  try {
    const configStat = await stat(path);
    if (!configStat.isFile()) {
      throw Object.assign(new Error("agentstack.config.ts is not a file."), { code: "EISDIR" });
    }
  } catch (error) {
    if (isMissingManifestAnchorError(error)) {
      throw new Error(formatDiagnostic(createMissingGeneratedAnchorDiagnostic("agentstack.config.ts")));
    }
    throw error;
  }

  let imported: unknown;

  try {
    imported = await import(`${pathToFileURL(path).href}?agentstack=${Date.now()}`);
  } catch (error) {
    throw new Error(`FAIL manifest.invalid-config\n${(error as Error).message}`);
  }

  const exportedConfig = readDefaultConfigExport(imported);
  const parsed = parseManifest(exportedConfig);
  if (!parsed.ok) {
    throw new Error(parsed.diagnostics.map(formatDiagnostic).join("\n"));
  }

  return { cwd, manifest: parsed.value, serviceOrder: readRawServiceOrder(exportedConfig) };
}

function readDefaultConfigExport(imported: unknown): unknown {
  if (typeof imported !== "object" || imported === null || !("default" in imported)) {
    throw new Error("FAIL manifest.invalid-config\nagentstack.config.ts must default-export defineAgentstackConfig(...).");
  }

  return (imported as { default: unknown }).default;
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
