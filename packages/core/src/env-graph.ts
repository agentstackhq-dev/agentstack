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

const serviceOrder: ServiceName[] = ["clerk", "convex", "vercel", "eas"];

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

    for (const environment of declaration.environments) {
      for (const surface of declaration.surfaces) {
        const value = values[environment]?.[surface]?.[name];
        if (!value) {
          diagnostics.push({
            severity: "fail",
            code: "env.custom.missing",
            path: `${environment}.${surface}.${name}`,
            message: `${name} is required for ${surface} in ${environment}, but no value is present.`,
            fix: `Run agentstack env set ${name} --env ${environment} --surface ${surface}.`,
            blocks: ["validate", "validate --cloud"]
          });
        }
      }
    }
  }

  return diagnostics;
}
