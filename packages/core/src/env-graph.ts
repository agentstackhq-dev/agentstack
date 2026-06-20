import { z } from "zod";
import { fail, pass, type Diagnostic, type Result } from "./diagnostics.js";
import {
  environmentSchema,
  surfaceSchema,
  type AgentstackManifest,
  type EnvironmentName,
  type ServiceName,
  type SurfaceName
} from "./manifest.js";

export type EnvGraphNode = {
  environment: EnvironmentName;
  service: ServiceName;
  managed: boolean;
};

export type EnvGraph = {
  nodes: EnvGraphNode[];
};

export type EnvValueState = Partial<
  Record<EnvironmentName, Partial<Record<SurfaceName, Record<string, string | undefined>>>>
>;

const envValueStateSchema = z.record(environmentSchema, z.record(surfaceSchema, z.record(z.string())));

export const serviceOrder = ["clerk", "convex", "vercel", "eas"] as const satisfies readonly ServiceName[];

export function parseEnvValueState(input: unknown): Result<EnvValueState> {
  const parsed = envValueStateSchema.safeParse(input);

  if (parsed.success) {
    return pass(parsed.data);
  }

  const diagnostics: Diagnostic[] = parsed.error.issues.map((issue) => ({
    severity: "fail",
    code: "env.values.invalid-shape",
    path: issue.path.length ? issue.path.join(".") : undefined,
    message: issue.message,
    fix: "Update .agentstack/env-values.json so it uses environment -> surface -> variable -> string values.",
    blocks: ["validate", "validate --cloud"]
  }));

  return fail(diagnostics);
}

export function buildEnvGraph(manifest: AgentstackManifest): EnvGraph {
  const nodes: EnvGraphNode[] = [];

  for (const environment of manifest.environments) {
    for (const service of serviceOrder) {
      if (manifest.services[service].enabled) {
        nodes.push({ environment, service, managed: true });
      }
    }
  }

  return { nodes };
}

export function validateCustomEnvValues(
  manifest: AgentstackManifest,
  values: EnvValueState
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, declaration] of Object.entries(manifest.env.custom)) {
    if (!declaration.required) {
      continue;
    }

    const activeEnvironments = declaration.environments.filter((environment) =>
      manifest.environments.includes(environment)
    );
    const activeSurfaces = declaration.surfaces.filter((surface) => manifest.surfaces.includes(surface));

    for (const environment of activeEnvironments) {
      for (const surface of activeSurfaces) {
        const value = values[environment]?.[surface]?.[name];
        if (!value) {
          diagnostics.push({
            severity: "fail",
            code: "env.custom.missing",
            path: `${environment}.${surface}.${name}`,
            message: `${name} is required for ${surface} in ${environment}, but no value is present.`,
            fix: `Add ${environment}.${surface}.${name} to .agentstack/env-values.json.`,
            blocks: ["validate", "validate --cloud"]
          });
        }
      }
    }
  }

  return diagnostics;
}
