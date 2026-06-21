import type { EnvironmentName } from "@agentstack/core";

import {
  createProviderExecutionResult,
  type ProviderCommandExecutor,
  type ProviderExecutionResult
} from "./provider-executor.js";
import type { ProviderOperation } from "./provider-operations.js";

export type EasCommandKind =
  | "mobile.project.init"
  | "mobile.env.list"
  | "mobile.build"
  | "env.create"
  | "env.update"
  | "env.delete";

export type EasCliCommand = {
  id: string;
  kind: EasCommandKind;
  environment: EnvironmentName;
  summary: string;
  args: string[];
  valueSource?: "argument";
  stdinLabel?: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type EasTarget = {
  environment: EnvironmentName;
  easEnvironment: "development" | "preview" | "production";
  buildProfile: "development" | "preview" | "production";
  platform: "all";
  distribution: "internal" | "store";
  projectInitCommand: EasCliCommand;
  envListCommand: EasCliCommand;
  buildCommand: EasCliCommand;
  requiredEnv: string[];
  warnings: string[];
  requiresConfirmation: boolean;
};

export type EasCommandPlanInput = {
  environment: EnvironmentName;
  operations: ProviderOperation[];
  includeBuild?: boolean;
};

export type EasCommandPlan = {
  service: "eas";
  environment: EnvironmentName;
  target: EasTarget;
  commands: EasCliCommand[];
};

export type InspectEasPreviewReadOnlyOptions = {
  environment: EnvironmentName;
  executor: ProviderCommandExecutor;
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  secretValues?: string[];
};

export function createEasTarget(environment: EnvironmentName): EasTarget {
  const buildProfile = environment;
  const easEnvironment = environment;
  const requiresConfirmation = environment === "production";
  const distribution = requiresConfirmation ? "store" : "internal";

  return {
    environment,
    easEnvironment,
    buildProfile,
    platform: "all",
    distribution,
    projectInitCommand: command(
      environment,
      "mobile.project.init",
      ["pnpm", "exec", "eas", "project:init", "--non-interactive"],
      `Initialize EAS project metadata for ${environment}.`,
      false
    ),
    envListCommand: command(
      environment,
      "mobile.env.list",
      ["pnpm", "exec", "eas", "env:list", "--environment", easEnvironment],
      `List EAS server env values for ${environment}.`,
      false
    ),
    buildCommand: command(
      environment,
      "mobile.build",
      [
        "pnpm",
        "exec",
        "eas",
        "build",
        "-p",
        "all",
        "-e",
        buildProfile,
        "--json",
        "--non-interactive"
      ],
      `Build EAS mobile profile ${buildProfile} for ${environment}.`,
      requiresConfirmation
    ),
    requiredEnv: ["EXPO_TOKEN"],
    warnings: [
      "EAS Build uses EAS server env values; local CI variables and .env files are not a substitute.",
      "Review Expo credentials and app-store readiness before running store-distribution builds.",
      "App-store submission is outside this command-plan boundary; this plan does not run eas submit."
    ],
    requiresConfirmation
  };
}

export function createEasCommandPlan(input: EasCommandPlanInput): EasCommandPlan {
  const target = createEasTarget(input.environment);
  const commands = [
    ...(input.includeBuild
      ? [target.projectInitCommand, target.envListCommand, target.buildCommand]
      : []),
    ...input.operations
      .filter((operation) => operation.service === "eas")
      .flatMap((operation) => operationCommand(operation, target))
  ];

  return {
    service: "eas",
    environment: input.environment,
    target,
    commands
  };
}

export async function inspectEasPreviewReadOnly(
  options: InspectEasPreviewReadOnlyOptions
): Promise<ProviderExecutionResult[]> {
  if (options.environment !== "preview") {
    throw new Error(
      "EAS runtime inspect supports preview env-list only. Production inspect, build, project:init, and env mutation execution are not available in this slice."
    );
  }

  const target = createEasTarget(options.environment);
  const commands = [target.envListCommand];
  const results: ProviderExecutionResult[] = [];

  for (const command of commands) {
    const [executable, ...args] = command.args;
    if (!executable) {
      throw new Error(`EAS command ${command.id} has no executable.`);
    }

    const result = await options.executor.execute(executable, args, {
      cwd: options.cwd,
      env: options.env,
      timeoutMs: options.timeoutMs
    });

    results.push(
      createProviderExecutionResult({
        service: "eas",
        environment: options.environment,
        commandKind: command.kind,
        command,
        result,
        secretValues: options.secretValues
      })
    );
  }

  return results;
}

function operationCommand(operation: ProviderOperation, target: EasTarget): EasCliCommand[] {
  const name = envName(operation.target);

  if (!name) {
    return [];
  }

  if (operation.kind === "env.set") {
    const kind = operation.source === "env.drifted" ? "env.update" : "env.create";
    const valueLabel = operation.secret
      ? "<secret from .agentstack/env-values.json>"
      : "<value from .agentstack/env-values.json>";

    return [
      {
        id: operation.id,
        kind,
        environment: operation.environment,
        summary: operation.summary,
        args: setEnvArgs(kind, name, target, valueLabel, operation.secret),
        valueSource: "argument",
        stdinLabel: valueLabel,
        secret: operation.secret,
        requiresConfirmation: operation.requiresConfirmation
      }
    ];
  }

  if (operation.kind === "env.remove") {
    return [
      {
        id: operation.id,
        kind: "env.delete",
        environment: operation.environment,
        summary: operation.summary,
        args: [
          "pnpm",
          "exec",
          "eas",
          "env:delete",
          target.easEnvironment,
          "--variable-name",
          name,
          "--variable-environment",
          target.easEnvironment,
          "--non-interactive"
        ],
        secret: operation.secret,
        requiresConfirmation: operation.requiresConfirmation
      }
    ];
  }

  return [];
}

function setEnvArgs(
  kind: Extract<EasCommandKind, "env.create" | "env.update">,
  name: string,
  target: EasTarget,
  valueLabel: string,
  secret: boolean
): string[] {
  if (kind === "env.update") {
    return [
      "pnpm",
      "exec",
      "eas",
      "env:update",
      target.easEnvironment,
      "--variable-name",
      name,
      "--variable-environment",
      target.easEnvironment,
      "--value",
      valueLabel,
      "--visibility",
      secret ? "secret" : "plaintext",
      "--non-interactive"
    ];
  }

  return [
    "pnpm",
    "exec",
    "eas",
    "env:create",
    target.easEnvironment,
    "--name",
    name,
    "--value",
    valueLabel,
    "--environment",
    target.easEnvironment,
    "--visibility",
    secret ? "secret" : "plaintext",
    "--non-interactive"
  ];
}

function command(
  environment: EnvironmentName,
  kind: EasCommandKind,
  args: string[],
  summary: string,
  requiresConfirmation: boolean
): EasCliCommand {
  return {
    id: `${environment}.eas.${kind}`,
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
