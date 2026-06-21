import type { EnvironmentName } from "@agentstack/core";

import {
  createProviderExecutionResult,
  type ProviderCommandExecutor,
  type ProviderExecutionResult,
  type ProviderLiveIdentityFacts
} from "./provider-executor.js";
import type { ProviderOperation } from "./provider-operations.js";

export type VercelCommandKind = "web.deploy" | "env.list" | "env.add" | "env.update" | "env.remove";

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
  envListCommand: VercelCliCommand;
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

export type ExecuteVercelPreviewApplyOptions = VercelCommandPlanInput & {
  executor: ProviderCommandExecutor;
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  secretValues?: string[];
};

export type InspectVercelPreviewReadOnlyOptions = {
  environment: EnvironmentName;
  executor: ProviderCommandExecutor;
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  secretValues?: string[];
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
      envListCommand: envListCommand(environment, "preview"),
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
      envListCommand: envListCommand(environment, "production"),
      requiredEnv: ["VERCEL_TOKEN"],
      warnings: ["Run vercel link first or ensure .vercel/project.json exists for this project."],
      requiresConfirmation: true
    };
  }

  return {
    environment,
    vercelEnvironment: "development",
    deployCommand: deployCommand(environment, ["pnpm", "exec", "vercel", "dev"], false),
    envListCommand: envListCommand(environment, "development"),
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

export async function inspectVercelPreviewReadOnly(
  options: InspectVercelPreviewReadOnlyOptions
): Promise<ProviderExecutionResult[]> {
  if (options.environment !== "preview") {
    throw new Error(
      "Vercel runtime inspect supports preview env-list only. Production inspect, deploy, and env mutation execution are not available in this slice."
    );
  }

  const target = createVercelTarget(options.environment);
  const commands = [target.envListCommand];
  const results: ProviderExecutionResult[] = [];

  for (const command of commands) {
    const [executable, ...args] = command.args;
    if (!executable) {
      throw new Error(`Vercel command ${command.id} has no executable.`);
    }

    const result = await options.executor.execute(executable, args, {
      cwd: options.cwd,
      env: options.env,
      timeoutMs: options.timeoutMs
    });

    results.push(
      createProviderExecutionResult({
        service: "vercel",
        environment: options.environment,
        commandKind: command.kind,
        command,
        result,
        secretValues: options.secretValues,
        liveIdentityFacts: parseVercelPreviewEnvListFacts(result.stdout, result.exitCode)
      })
    );
  }

  return results;
}

function parseVercelPreviewEnvListFacts(stdout: string, exitCode: number): ProviderLiveIdentityFacts | undefined {
  if (exitCode !== 0) {
    return undefined;
  }

  const hasExpectedPreviewEnvRow = parseVercelEnvListRows(stdout).some(
    (row) => isExpectedVercelEnvName(row.name) && row.environments.includes("preview")
  );
  if (!hasExpectedPreviewEnvRow) {
    return undefined;
  }

  return {
    identityConfidence: "partial",
    facts: ["expected-env-names", "preview-environment", "env-list-read"]
  };
}

function parseVercelEnvListRows(stdout: string): Array<{ name: string; environments: string[] }> {
  const lines = stdout
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerIndex = lines.findIndex((line) => {
    const columns = line.split(/\s+/).map((column) => column.toLowerCase());
    return columns.includes("name") && (columns.includes("environment") || columns.includes("environments"));
  });
  if (headerIndex === -1) {
    return [];
  }

  const headerColumns = lines[headerIndex]?.split(/\s+/).map((column) => column.toLowerCase()) ?? [];
  const environmentIndex = headerColumns.findIndex(
    (column) => column === "environment" || column === "environments"
  );
  const nameIndex = headerColumns.findIndex((column) => column === "name");
  if (nameIndex === -1 || environmentIndex === -1) {
    return [];
  }

  return lines.slice(headerIndex + 1).flatMap((line) => {
    const columns = line.split(/\s+/);
    const name = columns[nameIndex] ?? "";
    const environment = columns[environmentIndex] ?? "";
    if (!name || !environment) {
      return [];
    }

    return [{ name, environments: environment.split(",").map((value) => value.toLowerCase()) }];
  });
}

function isExpectedVercelEnvName(name: string): boolean {
  return /^(?:NEXT_PUBLIC_APP_URL|PUBLIC_API_URL|API_TOKEN|SENTRY_AUTH_TOKEN)$/.test(name);
}

export async function executeVercelPreviewApply(
  options: ExecuteVercelPreviewApplyOptions
): Promise<ProviderExecutionResult[]> {
  if (options.environment !== "preview") {
    throw new Error(
      "Vercel runtime apply supports preview deploy only. Production apply and env mutation execution are not available in this slice."
    );
  }

  const plan = createVercelCommandPlan({ ...options, includeDeploy: true });
  const commands = plan.commands.filter((command) => command.kind === "web.deploy");
  const results: ProviderExecutionResult[] = [];

  for (const command of commands) {
    const [executable, ...args] = command.args;
    if (!executable) {
      throw new Error(`Vercel command ${command.id} has no executable.`);
    }

    const result = await options.executor.execute(executable, args, {
      cwd: options.cwd,
      env: options.env,
      timeoutMs: options.timeoutMs
    });

    results.push(
      createProviderExecutionResult({
        service: "vercel",
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

function envListCommand(
  environment: EnvironmentName,
  vercelEnvironment: VercelTarget["vercelEnvironment"]
): VercelCliCommand {
  return {
    id: `${environment}.vercel.env.list`,
    kind: "env.list",
    environment,
    summary: `List Vercel env values for ${environment}.`,
    args: ["pnpm", "exec", "vercel", "env", "ls", vercelEnvironment],
    secret: false,
    requiresConfirmation: false
  };
}

function envName(target: string): string | undefined {
  return target.startsWith("env:") ? target.slice("env:".length) : undefined;
}
