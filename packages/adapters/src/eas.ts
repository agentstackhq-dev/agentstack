import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { EnvironmentName } from "@agentstack/core";

import {
  createProviderExecutionResult,
  type ProviderCommandExecutor,
  type ProviderExecutionResult,
  type ProviderIdentityCandidatesArtifact,
  type ProviderLiveIdentityFacts
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

export type InspectEasReadOnlyOptions = {
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

export async function inspectEasReadOnly(options: InspectEasReadOnlyOptions): Promise<ProviderExecutionResult[]> {
  if (options.environment !== "preview" && options.environment !== "production") {
    throw new Error(
      "EAS runtime inspect supports preview and production env-list reads only. Build, project:init, and env mutation execution are not available in this slice."
    );
  }

  const target = createEasTarget(options.environment);
  const commands = [target.envListCommand];
  const results: ProviderExecutionResult[] = [];
  const localProjectLink = await readEasLocalProjectLink(options.cwd);

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
    const liveIdentityFacts = parseEasEnvListFacts(result.stdout, result.exitCode, options.environment);

    results.push(
      createProviderExecutionResult({
        service: "eas",
        environment: options.environment,
        commandKind: command.kind,
        command,
        result,
        secretValues: options.secretValues,
        liveIdentityFacts,
        identityCandidates: easIdentityCandidates({
          liveIdentityFacts,
          environment: options.environment,
          hasLocalProjectLink: Boolean(localProjectLink)
        })
      })
    );
  }

  return results;
}

function parseEasEnvListFacts(
  stdout: string,
  exitCode: number,
  environment: "preview" | "production"
): ProviderLiveIdentityFacts | undefined {
  if (exitCode !== 0) {
    return undefined;
  }

  const hasExpectedEnvRow = parseEasEnvListRows(stdout).some(
    (row) => isExpectedEasEnvName(row.name) && row.environments.includes(environment)
  );
  if (!hasExpectedEnvRow) {
    return undefined;
  }

  return {
    identityConfidence: "partial",
    facts: [
      "expected-env-names",
      environment === "preview" ? "preview-environment" : "production-environment",
      "env-list-read"
    ]
  };
}

function easIdentityCandidates(input: {
  liveIdentityFacts: ProviderLiveIdentityFacts | undefined;
  environment: "preview" | "production";
  hasLocalProjectLink: boolean;
}): ProviderIdentityCandidatesArtifact | undefined {
  const environmentFact = input.environment === "preview" ? "preview-environment" : "production-environment";
  const labels: Array<"provider-environment-scope" | "provider-project-link-proof"> = [];
  if (
    input.liveIdentityFacts?.identityConfidence === "partial" &&
    input.liveIdentityFacts.facts.includes("expected-env-names") &&
    input.liveIdentityFacts.facts.includes(environmentFact) &&
    input.liveIdentityFacts.facts.includes("env-list-read")
  ) {
    labels.push("provider-environment-scope");
  }
  if (input.hasLocalProjectLink) {
    labels.push("provider-project-link-proof");
  }

  return labels.length > 0
    ? {
        kind: "provider-identity-candidates",
        evaluator: "provider-specific-identity-candidate-parser",
        labels
      }
    : undefined;
}

type EasLocalProjectLink = {
  projectId: string;
};

const easLocalConfigPaths = [
  ["apps", "mobile", "app.json"],
  ["apps", "mobile", "app.config.json"],
  ["apps", "mobile", "app.config.ts"],
  ["app.json"],
  ["app.config.json"],
  ["app.config.ts"]
] as const;

async function readEasLocalProjectLink(cwd: string | undefined): Promise<EasLocalProjectLink | undefined> {
  if (!cwd) {
    return undefined;
  }

  for (const pathParts of easLocalConfigPaths) {
    const path = join(cwd, ...pathParts);
    let content: string;
    try {
      content = await readFile(path, "utf8");
    } catch {
      continue;
    }

    const projectId = path.endsWith(".json")
      ? readEasProjectIdFromJson(content)
      : readEasProjectIdFromSource(content);
    if (projectId) {
      return { projectId };
    }
  }

  return undefined;
}

function readEasProjectIdFromJson(content: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return undefined;
  }

  if (!isRecord(parsed)) {
    return undefined;
  }

  const root = isRecord(parsed.expo) ? parsed.expo : parsed;
  return readEasProjectId(root.extra);
}

function readEasProjectIdFromSource(content: string): string | undefined {
  const easBlockMatch = content.match(/\beas\s*:\s*{[\s\S]{0,800}?\bprojectId\s*:\s*["']([^"']+)["']/);
  const projectId = easBlockMatch?.[1]?.trim();
  return isEasProjectId(projectId) ? projectId : undefined;
}

function readEasProjectId(extra: unknown): string | undefined {
  if (!isRecord(extra) || !isRecord(extra.eas)) {
    return undefined;
  }

  const projectId = extra.eas.projectId;
  return isEasProjectId(projectId) ? projectId : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEasProjectId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

function parseEasEnvListRows(stdout: string): Array<{ name: string; environments: string[] }> {
  const lines = stdout
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isTableBorder(line));
  const headerIndex = lines.findIndex((line) => {
    const columns = parseTableColumns(line).map((column) => normalizeHeader(column));
    return columns.includes("name") && (columns.includes("environment") || columns.includes("environments"));
  });
  if (headerIndex === -1) {
    return [];
  }

  const headerColumns = parseTableColumns(lines[headerIndex] ?? "").map((column) => normalizeHeader(column));
  const environmentIndex = headerColumns.findIndex(
    (column) => column === "environment" || column === "environments"
  );
  const nameIndex = headerColumns.findIndex((column) => column === "name");
  if (nameIndex === -1 || environmentIndex === -1) {
    return [];
  }

  return lines.slice(headerIndex + 1).flatMap((line) => {
    const columns = parseTableColumns(line);
    const name = columns[nameIndex] ?? "";
    const environment = columns[environmentIndex] ?? "";
    if (!name || !environment) {
      return [];
    }

    return [{ name, environments: environment.split(",").map((value) => value.trim().toLowerCase()) }];
  });
}

function parseTableColumns(line: string): string[] {
  if (line.includes("|")) {
    return line
      .split("|")
      .map((column) => column.trim())
      .filter(Boolean);
  }

  const spacedColumns = line.split(/\s{2,}/).map((column) => column.trim()).filter(Boolean);
  if (spacedColumns.length > 1) {
    return spacedColumns;
  }

  return line.split(/\s+/).map((column) => column.trim()).filter(Boolean);
}

function normalizeHeader(column: string): string {
  return column.toLowerCase().replace(/[^a-z]/g, "");
}

function isTableBorder(line: string): boolean {
  return /^[+\-|=\s]+$/.test(line);
}

function isExpectedEasEnvName(name: string): boolean {
  return /^(?:EXPO_PUBLIC_APP_URL|SENTRY_AUTH_TOKEN|API_TOKEN)$/.test(name);
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
