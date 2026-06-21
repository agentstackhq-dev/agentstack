import type { EnvironmentName } from "@agentstack/core";

import type { ProviderOperation } from "./provider-operations.js";

export type VercelCommandKind = "web.deploy" | "env.add" | "env.update" | "env.remove";

export type VercelCliCommand = {
  id: string;
  kind: VercelCommandKind;
  environment: EnvironmentName;
  summary: string;
  args: string[];
  valueSource?: "stdin";
  stdinLabel?: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type VercelTarget = {
  environment: EnvironmentName;
  vercelEnvironment: "development" | "preview" | "production";
  deployCommand: VercelCliCommand;
  requiredEnv: string[];
  warnings: string[];
  requiresConfirmation: boolean;
};

export type VercelCommandPlanInput = {
  environment: EnvironmentName;
  operations: ProviderOperation[];
  includeDeploy?: boolean;
};

export type VercelCommandPlan = {
  service: "vercel";
  environment: EnvironmentName;
  target: VercelTarget;
  commands: VercelCliCommand[];
};

export function createVercelTarget(environment: EnvironmentName): VercelTarget {
  if (environment === "preview") {
    return {
      environment,
      vercelEnvironment: "preview",
      deployCommand: deployCommand(
        environment,
        ["pnpm", "exec", "vercel", "deploy", "--target=preview"],
        false
      ),
      requiredEnv: ["VERCEL_TOKEN"],
      warnings: ["Run vercel link first or ensure .vercel/project.json exists for this project."],
      requiresConfirmation: false
    };
  }

  if (environment === "production") {
    return {
      environment,
      vercelEnvironment: "production",
      deployCommand: deployCommand(environment, ["pnpm", "exec", "vercel", "--prod"], true),
      requiredEnv: ["VERCEL_TOKEN"],
      warnings: ["Run vercel link first or ensure .vercel/project.json exists for this project."],
      requiresConfirmation: true
    };
  }

  return {
    environment,
    vercelEnvironment: "development",
    deployCommand: deployCommand(environment, ["pnpm", "exec", "vercel", "dev"], false),
    requiredEnv: [],
    warnings: ["Development uses the developer's Vercel login and linked project state."],
    requiresConfirmation: false
  };
}

export function createVercelCommandPlan(input: VercelCommandPlanInput): VercelCommandPlan {
  const target = createVercelTarget(input.environment);
  const commands = [
    ...(input.includeDeploy ? [target.deployCommand] : []),
    ...input.operations
      .filter((operation) => operation.service === "vercel")
      .flatMap((operation) => operationCommand(operation, target))
  ];

  return {
    service: "vercel",
    environment: input.environment,
    target,
    commands
  };
}

function operationCommand(operation: ProviderOperation, target: VercelTarget): VercelCliCommand[] {
  const name = envName(operation.target);

  if (!name) {
    return [];
  }

  if (operation.kind === "env.set") {
    const kind = operation.source === "env.drifted" ? "env.update" : "env.add";
    const action = kind === "env.update" ? "update" : "add";

    return [
      {
        id: operation.id,
        kind,
        environment: operation.environment,
        summary: operation.summary,
        args: [
          "pnpm",
          "exec",
          "vercel",
          "env",
          action,
          name,
          target.vercelEnvironment,
          ...(operation.secret ? ["--sensitive"] : [])
        ],
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
        args: ["pnpm", "exec", "vercel", "env", "rm", name, target.vercelEnvironment],
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
): VercelCliCommand {
  return {
    id: `${environment}.vercel.web.deploy`,
    kind: "web.deploy",
    environment,
    summary: `Deploy Vercel web for ${environment}.`,
    args,
    secret: false,
    requiresConfirmation
  };
}

function envName(target: string): string | undefined {
  return target.startsWith("env:") ? target.slice("env:".length) : undefined;
}
