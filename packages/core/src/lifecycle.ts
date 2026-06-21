import type { Diagnostic } from "./diagnostics.js";
import type { AgentstackManifest, EnvironmentName, ServiceName, SurfaceName } from "./manifest.js";

export type LifecycleStatus = "pass" | "warn" | "fail";

export type LifecycleProviderAdapterSummary = {
  service: ServiceName | string;
  displayName: string;
  capabilities: string[];
  realAdapterStatus: "contract-only" | "command-plan" | "available";
};

export type LifecycleProviderOperationSummary = {
  id: string;
  environment: EnvironmentName;
  service: ServiceName | string;
  kind: string;
  scope: string;
  target: string;
  source: string;
  summary: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type LifecycleCloudSummary = {
  environment: EnvironmentName;
  providerAdapters: LifecycleProviderAdapterSummary[];
  providerOperations: LifecycleProviderOperationSummary[];
  expectedServices: Array<ServiceName | string>;
  linkedServices: Array<ServiceName | string>;
  missingServices: Array<ServiceName | string>;
  staleServices: Array<ServiceName | string>;
  expectedEnv: string[];
  syncedEnv: string[];
  missingEnv: string[];
  staleEnv: string[];
  driftedEnv: string[];
};

export type LifecycleSummary = {
  status: LifecycleStatus;
  environment: EnvironmentName;
  app: {
    name: string;
    slug: string;
    frameworkVersion: string;
    guidanceVersion: string;
  };
  surfaces: SurfaceName[];
  environments: EnvironmentName[];
  enabledServices: string[];
  generated: {
    required: number;
    missing: string[];
  };
  diagnostics: Diagnostic[];
  cloud?: LifecycleCloudSummary;
  nextCommands: string[];
};

export type CreateLifecycleSummaryInput = {
  manifest: AgentstackManifest;
  environment: EnvironmentName;
  requiredAnchors: string[];
  missingAnchors: string[];
  diagnostics: Diagnostic[];
  cloud?: LifecycleCloudSummary;
};

export function createLifecycleSummary(input: CreateLifecycleSummaryInput): LifecycleSummary {
  const failed = input.diagnostics.some((diagnostic) => diagnostic.severity === "fail");
  const warned =
    !failed &&
    (input.diagnostics.some((diagnostic) => diagnostic.severity === "warn") ||
      Boolean(input.cloud?.missingServices.length) ||
      Boolean(input.cloud?.staleServices.length) ||
      Boolean(input.cloud?.providerOperations.length) ||
      Boolean(input.cloud?.missingEnv.length) ||
      Boolean(input.cloud?.staleEnv.length) ||
      Boolean(input.cloud?.driftedEnv.length));

  return {
    status: failed ? "fail" : warned ? "warn" : "pass",
    environment: input.environment,
    app: {
      name: input.manifest.app.name,
      slug: input.manifest.app.slug,
      frameworkVersion: input.manifest.frameworkVersion,
      guidanceVersion: input.manifest.guidanceVersion
    },
    surfaces: [...input.manifest.surfaces],
    environments: [...input.manifest.environments],
    enabledServices: Object.entries(input.manifest.services)
      .filter(([, service]) => service.enabled)
      .map(([name]) => name)
      .sort(),
    generated: {
      required: input.requiredAnchors.length,
      missing: [...input.missingAnchors].sort()
    },
    diagnostics: input.diagnostics,
    cloud: input.cloud,
    nextCommands: recommendLifecycleCommands({
      environment: input.environment,
      diagnostics: input.diagnostics,
      cloudMissing: [...(input.cloud?.missingServices ?? []), ...(input.cloud?.missingEnv ?? [])],
      cloudEnvNeedsSync: [
        ...(input.cloud?.providerOperations ?? []),
        ...(input.cloud?.missingEnv ?? []),
        ...(input.cloud?.staleEnv ?? []),
        ...(input.cloud?.driftedEnv ?? [])
      ]
    })
  };
}

export type RecommendLifecycleCommandsInput = {
  environment: EnvironmentName;
  diagnostics: Diagnostic[];
  cloudMissing: Array<ServiceName | string>;
  cloudEnvNeedsSync?: unknown[];
};

export function recommendLifecycleCommands(input: RecommendLifecycleCommandsInput): string[] {
  const commands = new Set<string>();

  for (const diagnostic of input.diagnostics) {
    if (!diagnostic.fix?.startsWith("Run ")) {
      continue;
    }
    commands.add(stripTrailingPeriod(diagnostic.fix.slice(4)));
  }

  if (input.cloudMissing.length > 0 || (input.cloudEnvNeedsSync?.length ?? 0) > 0) {
    commands.add(`agentstack sync --env ${input.environment} --apply`);
    commands.add(`agentstack validate --cloud --env ${input.environment}`);
  }

  if (commands.size === 0) {
    commands.add("agentstack validate");
    commands.add(`agentstack env inspect --env ${input.environment}`);
  }

  return Array.from(commands);
}

function stripTrailingPeriod(value: string): string {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}
