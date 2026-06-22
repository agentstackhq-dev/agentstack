import type { AgentstackManifest, EnvironmentName } from "@agentstack/core";

import {
  createProviderExecutionResult,
  type ProviderCommandExecutor,
  type ProviderExecutionResult,
  type ProviderIdentityCandidatesArtifact,
  type ProviderLiveFactLabel
} from "./provider-executor.js";
import type { ProviderOperation } from "./provider-operations.js";

export type ConvexCommandKind = "backend.deploy" | "env.list" | "env.set" | "env.remove";

export type ConvexCliCommand = {
  id: string;
  kind: ConvexCommandKind;
  environment: EnvironmentName;
  summary: string;
  args: string[];
  valueSource?: "stdin";
  stdinLabel?: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type ConvexTarget = {
  environment: EnvironmentName;
  deploymentSelector: string;
  previewName?: string;
  envScopeArgs: string[];
  envListCommand: ConvexCliCommand;
  deployCommand: ConvexCliCommand;
  requiredEnv: string[];
  warnings: string[];
  requiresConfirmation: boolean;
};

export type ConvexCommandPlanInput = {
  manifest: AgentstackManifest;
  environment: EnvironmentName;
  operations: ProviderOperation[];
  includeDeploy?: boolean;
};

export type ConvexCommandPlan = {
  service: "convex";
  environment: EnvironmentName;
  target: ConvexTarget;
  commands: ConvexCliCommand[];
};

export type ExecuteConvexApplyOptions = ConvexCommandPlanInput & {
  executor: ProviderCommandExecutor;
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  confirmProduction?: boolean;
  stdinByCommandId?: Record<string, string>;
  secretValues?: string[];
};

export type InspectConvexReadOnlyOptions = {
  manifest: AgentstackManifest;
  environment: EnvironmentName;
  executor: ProviderCommandExecutor;
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  secretValues?: string[];
};

export function createConvexTarget(
  manifest: AgentstackManifest,
  environment: EnvironmentName
): ConvexTarget {
  if (environment === "preview") {
    const previewName = `${manifest.app.slug}-preview`;

    return {
      environment,
      deploymentSelector: "<preview-deployment-name>",
      previewName,
      envScopeArgs: ["--deployment", "<preview-deployment-name>"],
      envListCommand: envListCommand(environment, ["--deployment", "<preview-deployment-name>"]),
      deployCommand: deployCommand(
        environment,
        ["pnpm", "exec", "convex", "deploy", "--preview-name", previewName],
        false
      ),
      requiredEnv: ["CONVEX_DEPLOY_KEY"],
      warnings: [
        "Set CONVEX_DEPLOY_KEY to a Convex preview deploy key before running preview deploy commands.",
        "Replace <preview-deployment-name> after the preview deployment exists."
      ],
      requiresConfirmation: false
    };
  }

  if (environment === "production") {
    return {
      environment,
      deploymentSelector: "prod",
      envScopeArgs: ["--prod"],
      envListCommand: envListCommand(environment, ["--prod"]),
      deployCommand: deployCommand(environment, ["pnpm", "exec", "convex", "deploy"], true),
      requiredEnv: ["CONVEX_DEPLOY_KEY"],
      warnings: [
        "Set CONVEX_DEPLOY_KEY to a Convex production deploy key before running production commands."
      ],
      requiresConfirmation: true
    };
  }

  return {
    environment,
    deploymentSelector: "dev",
    envScopeArgs: ["--deployment", "dev"],
    envListCommand: envListCommand(environment, ["--deployment", "dev"]),
    deployCommand: deployCommand(environment, ["pnpm", "exec", "convex", "dev"], false),
    requiredEnv: [],
    warnings: ["Development uses the developer's Convex login or local CONVEX_DEPLOYMENT state."],
    requiresConfirmation: false
  };
}

export function createConvexCommandPlan(input: ConvexCommandPlanInput): ConvexCommandPlan {
  const target = createConvexTarget(input.manifest, input.environment);
  const commands = [
    ...(input.includeDeploy ? [target.deployCommand] : []),
    ...input.operations
      .filter((operation) => operation.service === "convex")
      .flatMap((operation) => operationCommand(operation, target))
  ];

  return {
    service: "convex",
    environment: input.environment,
    target,
    commands
  };
}

export async function executeConvexApply(
  options: ExecuteConvexApplyOptions
): Promise<ProviderExecutionResult[]> {
  if (options.environment === "production" && options.confirmProduction !== true) {
    throw new Error("Convex production apply requires explicit confirmation.");
  }

  const plan = createConvexCommandPlan(options);
  const results: ProviderExecutionResult[] = [];

  for (const command of plan.commands) {
    const [executable, ...args] = command.args;
    if (!executable) {
      throw new Error(`Convex command ${command.id} has no executable.`);
    }

    const result = await options.executor.execute(executable, args, {
      cwd: options.cwd,
      env: options.env,
      stdin: command.valueSource === "stdin" ? options.stdinByCommandId?.[command.id] : undefined,
      timeoutMs: options.timeoutMs
    });

    results.push(
      createProviderExecutionResult({
        service: "convex",
        environment: options.environment,
        commandKind: command.kind,
        command,
        result,
        secretValues: [
          ...(options.secretValues ?? []),
          ...(command.valueSource === "stdin" && options.stdinByCommandId?.[command.id]
            ? [options.stdinByCommandId[command.id]]
            : [])
        ]
      })
    );
  }

  return results;
}

export async function inspectConvexReadOnly(
  options: InspectConvexReadOnlyOptions
): Promise<ProviderExecutionResult[]> {
  const target = createConvexTarget(options.manifest, options.environment);
  const commands = [target.envListCommand];
  const results: ProviderExecutionResult[] = [];

  for (const command of commands) {
    const [executable, ...args] = command.args;
    if (!executable) {
      throw new Error(`Convex command ${command.id} has no executable.`);
    }

    const result = await options.executor.execute(executable, args, {
      cwd: options.cwd,
      env: options.env,
      timeoutMs: options.timeoutMs
    });

    results.push(
      createProviderExecutionResult({
        service: "convex",
        environment: options.environment,
        commandKind: command.kind,
        command,
        result,
        secretValues: options.secretValues,
        resourceNames: [],
        identityCandidates: identityCandidatesForConvexRead(options.environment, result),
        liveIdentityFacts: liveFactsForConvexRead(options.environment, result)
      })
    );
  }

  return results;
}

function liveFactsForConvexRead(
  environment: EnvironmentName,
  result: { exitCode: number; stdout: string }
): { identityConfidence: "partial"; facts: ProviderLiveFactLabel[] } | undefined {
  if (result.exitCode !== 0) {
    return undefined;
  }

  const facts: ProviderLiveFactLabel[] = ["provider-env-read"];
  if (environment === "preview" && hasStructuredExpectedConvexEnvRow(result.stdout)) {
    facts.unshift("env-list-read", "expected-env-names", "preview-environment");
  }

  return { identityConfidence: "partial", facts };
}

function identityCandidatesForConvexRead(
  environment: EnvironmentName,
  result: { exitCode: number; stdout: string }
): ProviderIdentityCandidatesArtifact | undefined {
  if (environment !== "preview" || result.exitCode !== 0 || !hasStructuredExpectedConvexEnvRow(result.stdout)) {
    return undefined;
  }

  return {
    kind: "provider-identity-candidates",
    evaluator: "provider-specific-identity-candidate-parser",
    labels: ["provider-environment-scope"]
  };
}

const expectedConvexEnvNames = new Set([
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_MODE"
]);

function hasStructuredExpectedConvexEnvRow(stdout: string): boolean {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const headerIndex = lines.findIndex((line) => {
    const columns = line.split(/\s{2,}|\t+/).filter(Boolean);
    return columns.length >= 2 && /^name$/i.test(columns[0] ?? "") && /^value$/i.test(columns[1] ?? "");
  });

  if (headerIndex === -1) {
    return false;
  }

  return lines.slice(headerIndex + 1).some((line) => {
    const columns = line.split(/\s{2,}|\t+/).filter(Boolean);
    return columns.length >= 2 && expectedConvexEnvNames.has(columns[0] ?? "");
  });
}

function operationCommand(operation: ProviderOperation, target: ConvexTarget): ConvexCliCommand[] {
  const name = envName(operation.target);

  if (!name) {
    return [];
  }

  if (operation.kind === "env.set") {
    return [
      {
        id: operation.id,
        kind: "env.set",
        environment: operation.environment,
        summary: operation.summary,
        args: ["pnpm", "exec", "convex", "env", ...target.envScopeArgs, "set", name],
        valueSource: "stdin",
        stdinLabel: operation.secret
          ? "<secret from .agentstack/env-values.json>"
          : "<value from .agentstack/env-values.json>",
        secret: operation.secret,
        requiresConfirmation: operation.requiresConfirmation
      }
    ];
  }

  if (operation.kind === "env.remove") {
    return [
      {
        id: operation.id,
        kind: "env.remove",
        environment: operation.environment,
        summary: operation.summary,
        args: ["pnpm", "exec", "convex", "env", ...target.envScopeArgs, "remove", name],
        secret: operation.secret,
        requiresConfirmation: operation.requiresConfirmation
      }
    ];
  }

  return [];
}

function deployCommand(
  environment: EnvironmentName,
  args: string[],
  requiresConfirmation: boolean
): ConvexCliCommand {
  return {
    id: `${environment}.convex.backend.deploy`,
    kind: "backend.deploy",
    environment,
    summary: `Deploy Convex backend for ${environment}.`,
    args,
    secret: false,
    requiresConfirmation
  };
}

function envListCommand(environment: EnvironmentName, scopeArgs: string[]): ConvexCliCommand {
  return {
    id: `${environment}.convex.env.list`,
    kind: "env.list",
    environment,
    summary: `List Convex env values for ${environment}.`,
    args: ["pnpm", "exec", "convex", "env", ...scopeArgs, "list"],
    secret: false,
    requiresConfirmation: false
  };
}

function envName(target: string): string | undefined {
  return target.startsWith("env:") ? target.slice("env:".length) : undefined;
}
