import type { Diagnostic } from "./diagnostics.js";
import type { AgentstackManifest, EnvironmentName, ServiceName, SurfaceName } from "./manifest.js";

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

export const serviceOrder = ["clerk", "convex", "vercel", "eas"] as const satisfies readonly ServiceName[];

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
