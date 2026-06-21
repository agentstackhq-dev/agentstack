import { createHash } from "node:crypto";
import { z } from "zod";
import { fail, pass, type Diagnostic, type Result } from "./diagnostics.js";
import {
  environmentSchema,
  surfaceSchema,
  type AgentstackManifest,
  type EnvironmentName,
  type ProviderEnvSource,
  type ServiceName,
  type SurfaceName
} from "./manifest.js";

export type EnvGraphNode = {
  environment: EnvironmentName;
  service: ServiceName;
  managed: boolean;
};

export type EnvGraphBinding = {
  environment: EnvironmentName;
  surface: SurfaceName;
  name: string;
  required: boolean;
  secret: boolean;
  validate?: string;
};

export type EnvGraph = {
  nodes: EnvGraphNode[];
  bindings: EnvGraphBinding[];
};

export type ProviderEnvResource = {
  environment: EnvironmentName;
  surface: SurfaceName;
  service: ServiceName;
  kind: "envVar";
  name: string;
  required: boolean;
  secret: boolean;
  source: ProviderEnvSource;
  valueHash?: string;
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
  const bindings: EnvGraphBinding[] = [];

  for (const environment of manifest.environments) {
    for (const service of serviceOrder) {
      const serviceConfig = manifest.services[service];
      if (serviceConfig.enabled && serviceConfig.requiredEnvironments.includes(environment)) {
        nodes.push({ environment, service, managed: serviceConfig.mode === "managed" });
      }
    }
  }

  for (const [name, declaration] of Object.entries(manifest.env.custom)) {
    const activeEnvironments = declaration.environments.filter((environment) =>
      manifest.environments.includes(environment)
    );
    const activeSurfaces = declaration.surfaces.filter((surface) => manifest.surfaces.includes(surface));

    for (const environment of activeEnvironments) {
      for (const surface of activeSurfaces) {
        bindings.push({
          environment,
          surface,
          name,
          required: declaration.required,
          secret: declaration.secret,
          ...(declaration.validate ? { validate: declaration.validate } : {})
        });
      }
    }
  }

  return { nodes, bindings };
}

export function buildProviderEnvResources(
  manifest: AgentstackManifest,
  values: EnvValueState = {}
): ProviderEnvResource[] {
  const resources: ProviderEnvResource[] = [];

  for (const [name, declaration] of Object.entries(manifest.env.custom)) {
    const activeEnvironments = declaration.environments.filter((environment) =>
      manifest.environments.includes(environment)
    );
    const activeSurfaces = declaration.surfaces.filter((surface) => manifest.surfaces.includes(surface));

    for (const environment of activeEnvironments) {
      for (const surface of activeSurfaces) {
        for (const target of declaration.providerTargets) {
          if (!target.environments.includes(environment) || !target.surfaces.includes(surface)) {
            continue;
          }

          const serviceConfig = manifest.services[target.service];
          if (!serviceConfig.enabled || !serviceConfig.requiredEnvironments.includes(environment)) {
            continue;
          }

          const value = values[environment]?.[surface]?.[name];
          if (target.source === "local-value" && !declaration.required && value === undefined) {
            continue;
          }

          resources.push({
            environment,
            surface,
            service: target.service,
            kind: "envVar",
            name,
            required: declaration.required,
            secret: declaration.secret,
            source: target.source,
            ...(target.source === "local-value" && value !== undefined
              ? { valueHash: hashProviderEnvValue(environment, surface, name, value) }
              : {})
          });
        }
      }
    }
  }

  return resources;
}

export function validateCustomEnvValues(
  manifest: AgentstackManifest,
  values: EnvValueState
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, declaration] of Object.entries(manifest.env.custom)) {
    const activeEnvironments = declaration.environments.filter((environment) =>
      manifest.environments.includes(environment)
    );
    const activeSurfaces = declaration.surfaces.filter((surface) => manifest.surfaces.includes(surface));

    for (const environment of activeEnvironments) {
      for (const surface of activeSurfaces) {
        const value = values[environment]?.[surface]?.[name];
        if (!value) {
          if (!declaration.required) {
            continue;
          }

          diagnostics.push({
            severity: "fail",
            code: "env.custom.missing",
            path: `${environment}.${surface}.${name}`,
            message: `${name} is required for ${surface} in ${environment}, but no value is present.`,
            fix: `Run agentstack env set --env ${environment} --surface ${surface} --name ${name} --value <value>.`,
            blocks: ["validate", "validate --cloud"]
          });
          continue;
        }

        const enumOptions = parseEnumValidation(declaration.validate);
        if (enumOptions && !enumOptions.includes(value)) {
          diagnostics.push({
            severity: "fail",
            code: "env.custom.invalid-enum",
            path: `${environment}.${surface}.${name}`,
            message: `${name} must be one of ${enumOptions.join(", ")} for ${surface} in ${environment}.`,
            fix: `Set ${environment}.${surface}.${name} to one of ${enumOptions.join(", ")}.`,
            blocks: ["validate", "validate --cloud"]
          });
        }
      }
    }
  }

  return diagnostics;
}

function parseEnumValidation(validate: string | undefined): string[] | undefined {
  if (!validate?.startsWith("enum:")) {
    return undefined;
  }

  return validate
    .slice("enum:".length)
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
}

function hashProviderEnvValue(
  environment: EnvironmentName,
  surface: SurfaceName,
  name: string,
  value: string
): string {
  return createHash("sha256").update(`${environment}:${surface}:${name}:${value}`).digest("hex");
}
