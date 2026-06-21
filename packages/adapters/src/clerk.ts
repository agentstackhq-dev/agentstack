import type { EnvironmentName } from "@agentstack/core";

import {
  createProviderExecutionResult,
  type ProviderCommandExecutor,
  type ProviderExactIdentityComparisonEvidence,
  type ProviderExactIdentityProofArtifact,
  type ProviderExactIdentityProofLabel,
  type ProviderExecutionResult,
  type ProviderLiveFactLabel
} from "./provider-executor.js";
import type { ProviderOperation } from "./provider-operations.js";

export type ClerkCommandKind =
  | "auth.bootstrap"
  | "auth.diagnostics"
  | "auth.env.pull"
  | "auth.config.pull"
  | "auth.apps.list"
  | "auth.production.status"
  | "env.pull"
  | "env.review";

export type ClerkCliCommand = {
  id: string;
  kind: ClerkCommandKind;
  environment: EnvironmentName;
  summary: string;
  args: string[];
  valueSource?: "clerk-dashboard";
  stdinLabel?: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type ClerkTarget = {
  environment: EnvironmentName;
  clerkEnvironment: "development" | "production";
  applicationSelector: string;
  bootstrapCommand: ClerkCliCommand;
  diagnosticsCommand: ClerkCliCommand;
  envPullCommand: ClerkCliCommand;
  configPullCommand: ClerkCliCommand;
  appsListCommand: ClerkCliCommand;
  productionStatusCommand?: ClerkCliCommand;
  requiredEnv: string[];
  warnings: string[];
  requiresConfirmation: boolean;
};

export type ClerkCommandPlanInput = {
  environment: EnvironmentName;
  operations: ProviderOperation[];
  includeBootstrap?: boolean;
};

export type ClerkCommandPlan = {
  service: "clerk";
  environment: EnvironmentName;
  target: ClerkTarget;
  commands: ClerkCliCommand[];
};

export type InspectClerkReadOnlyOptions = {
  environment: EnvironmentName;
  executor: ProviderCommandExecutor;
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  secretValues?: string[];
  exactProofContext?: ClerkExactProofContext;
};

export type ClerkExactProofContext = {
  expectedResourceName: string;
  ledgerExternalIdOrUrl: string;
  ledgerOwnerAccountOrProject: string;
};

export function createClerkTarget(environment: EnvironmentName): ClerkTarget {
  const isProduction = environment === "production";
  const clerkEnvironment = isProduction ? "production" : "development";
  const applicationSelector = isProduction
    ? "<clerk-production-application>"
    : "<clerk-development-application>";
  const requiresConfirmation = isProduction;

  return {
    environment,
    clerkEnvironment,
    applicationSelector,
    bootstrapCommand: command(
      environment,
      "auth.bootstrap",
      ["pnpm", "exec", "clerk", "init", "-y"],
      `Initialize Clerk ${clerkEnvironment} auth for ${environment}.`,
      false
    ),
    diagnosticsCommand: command(
      environment,
      "auth.diagnostics",
      ["pnpm", "exec", "clerk", "doctor", "--mode", "agent"],
      `Inspect Clerk ${clerkEnvironment} auth setup for ${environment}.`,
      false
    ),
    envPullCommand: command(
      environment,
      "auth.env.pull",
      ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
      `Pull Clerk ${clerkEnvironment} environment values for ${environment}.`,
      false
    ),
    configPullCommand: command(
      environment,
      "auth.config.pull",
      ["pnpm", "exec", "clerk", "config", "pull", "--mode", "agent"],
      `Inspect Clerk ${clerkEnvironment} configuration for ${environment}.`,
      false
    ),
    appsListCommand: command(
      environment,
      "auth.apps.list",
      ["pnpm", "exec", "clerk", "apps", "list", "--json"],
      `Inspect Clerk ${clerkEnvironment} applications list for ${environment}.`,
      false
    ),
    productionStatusCommand: isProduction
      ? command(
          environment,
          "auth.production.status",
          ["pnpm", "exec", "clerk", "deploy", "--mode", "agent"],
          "Inspect Clerk production deployment status.",
          true
        )
      : undefined,
    requiredEnv: isProduction ? ["CLERK_SECRET_KEY"] : [],
    warnings: [
      "Clerk commands use the Clerk CLI login and linked application state; review the selected application before running them.",
      "Clerk Billing webhooks are beta, so review billing webhook behavior in Clerk before treating it as automated provisioning."
    ],
    requiresConfirmation
  };
}

export function createClerkCommandPlan(input: ClerkCommandPlanInput): ClerkCommandPlan {
  const target = createClerkTarget(input.environment);
  const commands = [
    ...(input.includeBootstrap
      ? [
          target.bootstrapCommand,
          target.diagnosticsCommand,
          target.envPullCommand,
          target.configPullCommand,
          target.appsListCommand,
          ...(target.productionStatusCommand ? [target.productionStatusCommand] : [])
        ]
      : []),
    ...input.operations
      .filter((operation) => operation.service === "clerk")
      .flatMap((operation) => operationCommand(operation))
  ];

  return {
    service: "clerk",
    environment: input.environment,
    target,
    commands
  };
}

export async function inspectClerkReadOnly(
  options: InspectClerkReadOnlyOptions
): Promise<ProviderExecutionResult[]> {
  const target = createClerkTarget(options.environment);
  const commands = [
    target.diagnosticsCommand,
    target.envPullCommand,
    target.configPullCommand,
    target.appsListCommand
  ];
  const results: ProviderExecutionResult[] = [];

  for (const command of commands) {
    const [executable, ...args] = command.args;
    if (!executable) {
      throw new Error(`Clerk command ${command.id} has no executable.`);
    }

    const result = await options.executor.execute(executable, args, {
      cwd: options.cwd,
      env: options.env,
      timeoutMs: options.timeoutMs
    });
    const exactIdentityProof = exactIdentityProofForClerkRead(
      command.kind,
      options.environment,
      result,
      options.exactProofContext
    );

    results.push(
      createProviderExecutionResult({
        service: "clerk",
        environment: options.environment,
        commandKind: command.kind,
        command,
        result,
        secretValues: options.secretValues,
        liveIdentityFacts:
          liveCoherenceFactsForClerkExactAppsList(command.kind, options.environment, exactIdentityProof) ??
          liveIdentityFactsForClerkRead(command.kind, result.exitCode),
        identityCandidates: identityCandidatesForClerkRead(command.kind, options.environment, result),
        exactIdentityProof
      })
    );
  }

  return results;
}

function liveCoherenceFactsForClerkExactAppsList(
  commandKind: ClerkCommandKind,
  environment: EnvironmentName,
  exactIdentityProof: ProviderExactIdentityProofArtifact | undefined
): { identityConfidence: "partial"; facts: ProviderLiveFactLabel[] } | undefined {
  if (environment !== "preview" || commandKind !== "auth.apps.list" || !exactIdentityProof) {
    return undefined;
  }

  return {
    identityConfidence: "partial",
    facts: ["apps-list-read", "expected-resource-shape", "preview-environment"]
  };
}

function liveIdentityFactsForClerkRead(
  commandKind: ClerkCommandKind,
  exitCode: number
): { identityConfidence: "partial"; facts: ProviderLiveFactLabel[] } | undefined {
  if (exitCode !== 0) {
    return undefined;
  }

  const factByCommandKind: Partial<Record<ClerkCommandKind, ProviderLiveFactLabel>> = {
    "auth.diagnostics": "diagnostics-read",
    "auth.env.pull": "provider-env-read",
    "auth.config.pull": "provider-config-read"
  };
  const fact = factByCommandKind[commandKind];

  return fact ? { identityConfidence: "partial", facts: [fact] } : undefined;
}

function identityCandidatesForClerkRead(
  commandKind: ClerkCommandKind,
  environment: EnvironmentName,
  result: { exitCode: number; stdout: string }
) {
  if (commandKind !== "auth.apps.list" || result.exitCode !== 0) {
    return undefined;
  }

  const expectedClerkEnvironment = environment === "production" ? "production" : "development";
  const apps = parseClerkAppsList(result.stdout);
  const labels = new Set<"stable-provider-identity" | "provider-owner-identity" | "provider-resource-id" | "provider-environment-scope">();

  for (const app of apps) {
    if (
      !hasString(app.id) ||
      !hasOwnerIdentity(app) ||
      !hasMatchingEnvironmentScope(app, expectedClerkEnvironment)
    ) {
      continue;
    }

    labels.add("stable-provider-identity");
    labels.add("provider-owner-identity");
    if (hasString(app.resourceId) || hasString(app.resource_id)) {
      labels.add("provider-resource-id");
    }
    labels.add("provider-environment-scope");
  }

  return labels.size > 0
    ? {
        kind: "provider-identity-candidates" as const,
        evaluator: "provider-specific-identity-candidate-parser" as const,
        labels: [...labels]
      }
    : undefined;
}

function exactIdentityProofForClerkRead(
  commandKind: ClerkCommandKind,
  environment: EnvironmentName,
  result: { exitCode: number; stdout: string },
  context: ClerkExactProofContext | undefined
): ProviderExactIdentityProofArtifact | undefined {
  if (environment !== "preview" || commandKind !== "auth.apps.list" || result.exitCode !== 0 || !context) {
    return undefined;
  }

  const expectedClerkEnvironment = "development";
  const expectedName = context.expectedResourceName.trim();
  const expectedExternalId = context.ledgerExternalIdOrUrl.trim();
  const expectedOwner = context.ledgerOwnerAccountOrProject.trim();
  if (!expectedName || !expectedExternalId || !expectedOwner) {
    return undefined;
  }

  const matches = parseClerkAppsList(result.stdout).filter((app) =>
    clerkAppMatchesExactProofContext(app, {
      expectedClerkEnvironment,
      expectedName,
      expectedExternalId,
      expectedOwner
    })
  );
  if (matches.length !== 1) {
    return undefined;
  }

  const labels: ProviderExactIdentityProofLabel[] = [
    "ledger-comparable-identity",
    "ledger-external-id-match",
    "manifest-resource-name-match",
    "provider-environment-scope",
    "provider-owner-identity",
    "provider-resource-id",
    "provider-specific-identity-parser",
    "stable-provider-identity"
  ];
  const comparisons: ProviderExactIdentityComparisonEvidence[] = [
    { label: "stable-provider-identity", outcome: "matched" },
    { label: "ledger-comparable-identity", outcome: "matched" },
    { label: "manifest-resource-name-match", outcome: "matched" },
    { label: "ledger-external-id-match", outcome: "matched" },
    { label: "provider-owner-identity", outcome: "matched" },
    { label: "provider-resource-id", outcome: "matched" },
    { label: "provider-environment-scope", outcome: "matched" }
  ];

  return {
    kind: "provider-exact-identity-proof",
    evaluator: "provider-specific-identity-parser",
    labels,
    comparisons
  };
}

function clerkAppMatchesExactProofContext(
  app: Record<string, unknown>,
  context: {
    expectedClerkEnvironment: "development" | "production";
    expectedName: string;
    expectedExternalId: string;
    expectedOwner: string;
  }
): boolean {
  const resourceId = readFirstString(app.resourceId, app.resource_id);
  const owner = readFirstString(
    app.ownerId,
    app.owner_id,
    app.organizationId,
    app.organization_id,
    app.teamId,
    app.team_id
  );
  const appName = readFirstMatchingString(context.expectedName, app.name, app.slug, app.displayName);

  return (
    hasString(app.id) &&
    resourceId === context.expectedExternalId &&
    owner === context.expectedOwner &&
    hasMatchingEnvironmentScope(app, context.expectedClerkEnvironment) &&
    appName === context.expectedName
  );
}

function parseClerkAppsList(stdout: string): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }

  const apps = isRecord(parsed) && Array.isArray(parsed.data) ? parsed.data : [];

  return apps.filter(isRecord);
}

function hasOwnerIdentity(app: Record<string, unknown>): boolean {
  return (
    hasString(app.ownerId) ||
    hasString(app.owner_id) ||
    hasString(app.organizationId) ||
    hasString(app.organization_id) ||
    hasString(app.teamId) ||
    hasString(app.team_id)
  );
}

function hasMatchingEnvironmentScope(
  app: Record<string, unknown>,
  expectedClerkEnvironment: "development" | "production"
): boolean {
  const scope = app.environment ?? app.instanceEnvironmentType ?? app.environmentType ?? app.scope;
  return typeof scope === "string" && scope.toLowerCase() === expectedClerkEnvironment;
}

function hasString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (hasString(value)) {
      return value.trim();
    }
  }
  return undefined;
}

function readFirstMatchingString(expected: string, ...values: unknown[]): string | undefined {
  for (const value of values) {
    if (hasString(value) && value.trim() === expected) {
      return value.trim();
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function operationCommand(operation: ProviderOperation): ClerkCliCommand[] {
  const name = envName(operation.target);

  if (!name || (operation.kind !== "env.set" && operation.kind !== "env.remove")) {
    return [];
  }

  if (operation.kind === "env.remove") {
    return [
      {
        id: operation.id,
        kind: "env.review",
        environment: operation.environment,
        summary: `Review stale ${name} in Clerk for ${operation.scope} in ${operation.environment}.`,
        args: ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
        valueSource: "clerk-dashboard",
        stdinLabel: "<review in Clerk Dashboard / clerk env pull>",
        secret: operation.secret,
        requiresConfirmation: operation.requiresConfirmation
      }
    ];
  }

  return [
    {
      id: operation.id,
      kind: "env.pull",
      environment: operation.environment,
      summary: `Pull ${name} from Clerk for ${operation.scope} in ${operation.environment}.`,
      args: ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
      valueSource: "clerk-dashboard",
      stdinLabel: "<value from Clerk Dashboard / clerk env pull>",
      secret: operation.secret,
      requiresConfirmation: operation.requiresConfirmation
    }
  ];
}

function command(
  environment: EnvironmentName,
  kind: ClerkCommandKind,
  args: string[],
  summary: string,
  requiresConfirmation: boolean
): ClerkCliCommand {
  return {
    id: `${environment}.clerk.${kind}`,
    kind,
    environment,
    summary,
    args,
    secret: false,
    requiresConfirmation
  };
}

function envName(target: string): string | undefined {
  return target.startsWith("env:") ? target.slice("env:".length) : undefined;
}
