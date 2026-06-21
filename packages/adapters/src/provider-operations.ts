import type { AgentstackManifest, EnvironmentName, ServiceName } from "@agentstack/core";

import type { InspectEnvResource, InspectReport, InspectServiceResource } from "./types.js";

export type ProviderAdapterCapability =
  | "service.lifecycle"
  | "env.sync"
  | "auth.sync"
  | "billing.sync"
  | "webhook.sync"
  | "backend.deploy"
  | "web.deploy"
  | "mobile.build";

export type ProviderAdapterDefinition = {
  service: ServiceName;
  displayName: string;
  capabilities: ProviderAdapterCapability[];
  realAdapterStatus: ProviderAdapterStatus;
};

export type ProviderAdapterStatus = "contract-only" | "command-plan" | "available";

export type ProviderOperationKind = "service.link" | "service.unlink" | "env.set" | "env.remove";

export type ProviderOperationSource =
  | "service.missing"
  | "service.stale"
  | "env.missing"
  | "env.drifted"
  | "env.stale";

export type ProviderOperation = {
  id: string;
  environment: EnvironmentName;
  service: ServiceName | string;
  kind: ProviderOperationKind;
  scope: string;
  target: string;
  source: ProviderOperationSource;
  summary: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type ProviderOperationPlan = {
  environment: EnvironmentName;
  operations: ProviderOperation[];
};

const providerOrder = ["clerk", "convex", "vercel", "eas"] as const satisfies readonly ServiceName[];

export const providerAdapterDefinitions: Record<ServiceName, ProviderAdapterDefinition> = {
  clerk: {
    service: "clerk",
    displayName: "Clerk",
    capabilities: ["service.lifecycle", "auth.sync", "billing.sync", "webhook.sync", "env.sync"],
    realAdapterStatus: "command-plan"
  },
  convex: {
    service: "convex",
    displayName: "Convex",
    capabilities: ["service.lifecycle", "env.sync", "backend.deploy"],
    realAdapterStatus: "command-plan"
  },
  vercel: {
    service: "vercel",
    displayName: "Vercel",
    capabilities: ["service.lifecycle", "env.sync", "web.deploy"],
    realAdapterStatus: "command-plan"
  },
  eas: {
    service: "eas",
    displayName: "EAS",
    capabilities: ["service.lifecycle", "env.sync", "mobile.build"],
    realAdapterStatus: "contract-only"
  }
};

export function getEnabledProviderAdapterDefinitions(
  manifest: AgentstackManifest
): ProviderAdapterDefinition[] {
  return providerOrder
    .filter((service) => manifest.services[service].enabled)
    .map((service) => providerAdapterDefinitions[service]);
}

export function createProviderOperationPlan(report: InspectReport): ProviderOperationPlan {
  return {
    environment: report.environment,
    operations: [
      ...report.missing.map((resource) =>
        serviceOperation(report.environment, "service.link", "service.missing", resource)
      ),
      ...report.stale.map((resource) =>
        serviceOperation(report.environment, "service.unlink", "service.stale", resource)
      ),
      ...report.missingEnv.map((resource) =>
        envOperation(report.environment, "env.set", "env.missing", resource)
      ),
      ...report.driftedEnv.map((resource) =>
        envOperation(report.environment, "env.set", "env.drifted", resource)
      ),
      ...report.staleEnv.map((resource) =>
        envOperation(report.environment, "env.remove", "env.stale", resource)
      )
    ]
  };
}

function serviceOperation(
  environment: EnvironmentName,
  kind: Extract<ProviderOperationKind, "service.link" | "service.unlink">,
  source: Extract<ProviderOperationSource, "service.missing" | "service.stale">,
  resource: InspectServiceResource
): ProviderOperation {
  const action = kind === "service.link" ? "Link" : "Unlink";

  return {
    id: `${environment}.${resource.service}.${kind}`,
    environment,
    service: resource.service,
    kind,
    scope: "service",
    target: "service",
    source,
    summary: `${action} ${resource.service} service for ${environment}.`,
    secret: false,
    requiresConfirmation: requiresConfirmation(environment)
  };
}

function envOperation(
  environment: EnvironmentName,
  kind: Extract<ProviderOperationKind, "env.set" | "env.remove">,
  source: Extract<ProviderOperationSource, "env.missing" | "env.drifted" | "env.stale">,
  resource: InspectEnvResource
): ProviderOperation {
  const action = kind === "env.set" ? "Set" : "Remove";

  return {
    id: `${environment}.${resource.service}.${kind}.${resource.surface}.${resource.name}`,
    environment,
    service: resource.service,
    kind,
    scope: resource.surface,
    target: `env:${resource.name}`,
    source,
    summary: `${action} ${resource.name} for ${resource.service} ${resource.surface} in ${environment}.`,
    secret: resource.secret,
    requiresConfirmation: requiresConfirmation(environment)
  };
}

function requiresConfirmation(environment: EnvironmentName): boolean {
  return environment === "production";
}
