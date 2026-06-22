import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { EnvironmentName } from "@agentstack/core";

import {
  createProviderExecutionResult,
  type ProviderCommandExecutor,
  type ProviderExactIdentityComparisonEvidence,
  type ProviderExactIdentityProofArtifact,
  type ProviderExactIdentityProofLabel,
  type ProviderExecutionResult,
  type ProviderIdentityCandidateLabel,
  type ProviderIdentityCandidatesArtifact,
  type ProviderLiveIdentityFacts
} from "./provider-executor.js";
import type { ProviderOperation } from "./provider-operations.js";

export type EasCommandKind =
  | "mobile.project.init"
  | "mobile.project.info"
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
  projectInfoCommand: EasCliCommand;
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
  exactProofContext?: EasExactProofContext;
};

export type EasExactProofContext = {
  expectedResourceName: string;
  ledgerExternalIdOrUrl: string;
  ledgerOwnerAccountOrProject: string;
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
    projectInfoCommand: command(
      environment,
      "mobile.project.info",
      ["pnpm", "exec", "eas", "project:info"],
      `Read EAS project identity metadata for ${environment}.`,
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
  const results: ProviderExecutionResult[] = [];
  const localProjectLink = await readEasLocalProjectLink(options.cwd);
  const commands = [
    target.envListCommand,
    ...(options.exactProofContext && localProjectLink ? [target.projectInfoCommand] : [])
  ];
  let environmentScopeFacts: ProviderLiveIdentityFacts | undefined;

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
    const liveIdentityFacts =
      command.kind === "mobile.env.list"
        ? parseEasEnvListFacts(result.stdout, result.exitCode, options.environment)
        : undefined;
    if (command.kind === "mobile.env.list") {
      environmentScopeFacts = liveIdentityFacts;
    }

    results.push(
      createProviderExecutionResult({
        service: "eas",
        environment: options.environment,
        commandKind: command.kind,
        command,
        result,
        secretValues: options.secretValues,
        liveIdentityFacts,
        identityCandidates:
          command.kind === "mobile.env.list"
            ? easEnvListIdentityCandidates({
                liveIdentityFacts,
                environment: options.environment,
                hasLocalProjectLink: Boolean(localProjectLink)
              })
            : easProjectInfoIdentityCandidates(result.stdout, result.exitCode, Boolean(localProjectLink)),
        exactIdentityProof:
          command.kind === "mobile.project.info"
            ? exactIdentityProofForEasProjectInfo(result.stdout, result.exitCode, {
                context: options.exactProofContext,
                localProjectLink,
                environmentScopeFacts,
                environment: options.environment
              })
            : undefined
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

function easEnvListIdentityCandidates(input: {
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

function easProjectInfoIdentityCandidates(
  stdout: string,
  exitCode: number,
  hasLocalProjectLink: boolean
): ProviderIdentityCandidatesArtifact | undefined {
  const projectInfo = parseEasProjectInfo(stdout, exitCode);
  if (!projectInfo) {
    return undefined;
  }

  const labels: ProviderIdentityCandidateLabel[] = [
    "stable-provider-identity",
    "provider-owner-identity",
    "provider-resource-id"
  ];
  if (hasLocalProjectLink) {
    labels.push("provider-project-link-proof");
  }

  return {
    kind: "provider-identity-candidates",
    evaluator: "provider-specific-identity-candidate-parser",
    labels
  };
}

function exactIdentityProofForEasProjectInfo(
  stdout: string,
  exitCode: number,
  input: {
    context: EasExactProofContext | undefined;
    localProjectLink: EasLocalProjectLink | undefined;
    environmentScopeFacts: ProviderLiveIdentityFacts | undefined;
    environment: "preview" | "production";
  }
): ProviderExactIdentityProofArtifact | undefined {
  if (
    exitCode !== 0 ||
    !input.context ||
    !input.localProjectLink ||
    !hasEasEnvironmentScope(input.environmentScopeFacts, input.environment)
  ) {
    return undefined;
  }

  const projectInfo = parseEasProjectInfo(stdout, exitCode);
  if (!projectInfo) {
    return undefined;
  }

  const expectedName = input.context.expectedResourceName.trim();
  const expectedExternalId = input.context.ledgerExternalIdOrUrl.trim();
  const expectedOwner = normalizeEasOwner(input.context.ledgerOwnerAccountOrProject);
  if (!expectedName || !expectedExternalId || !expectedOwner) {
    return undefined;
  }

  if (
    projectInfo.name !== expectedName ||
    projectInfo.projectId !== expectedExternalId ||
    normalizeEasOwner(projectInfo.owner) !== expectedOwner ||
    input.localProjectLink.projectId !== projectInfo.projectId
  ) {
    return undefined;
  }

  const labels: ProviderExactIdentityProofLabel[] = [
    "ledger-comparable-identity",
    "ledger-external-id-match",
    "manifest-resource-name-match",
    "provider-environment-scope",
    "provider-owner-identity",
    "provider-project-link-proof",
    "provider-resource-id",
    "provider-specific-identity-parser",
    "stable-provider-identity"
  ];
  const comparisons: ProviderExactIdentityComparisonEvidence[] = [
    { label: "stable-provider-identity", outcome: "matched" },
    { label: "ledger-comparable-identity", outcome: "matched" },
    { label: "manifest-resource-name-match", outcome: "matched" },
    { label: "ledger-external-id-match", outcome: "matched" },
    { label: "provider-environment-scope", outcome: "matched" },
    { label: "provider-owner-identity", outcome: "matched" },
    { label: "provider-resource-id", outcome: "matched" },
    { label: "provider-project-link-proof", outcome: "matched" }
  ];

  return {
    kind: "provider-exact-identity-proof",
    evaluator: "provider-specific-identity-parser",
    labels,
    comparisons
  };
}

function hasEasEnvironmentScope(
  facts: ProviderLiveIdentityFacts | undefined,
  environment: "preview" | "production"
): boolean {
  if (facts?.identityConfidence !== "partial") {
    return false;
  }
  return (
    facts.facts.includes("env-list-read") &&
    facts.facts.includes("expected-env-names") &&
    facts.facts.includes(environment === "preview" ? "preview-environment" : "production-environment")
  );
}

type EasProjectInfo = {
  fullName: string;
  owner: string;
  name: string;
  projectId: string;
};

function parseEasProjectInfo(stdout: string, exitCode: number): EasProjectInfo | undefined {
  if (exitCode !== 0) {
    return undefined;
  }

  let fullName: string | undefined;
  let projectId: string | undefined;
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z]+)\s*[:=]?\s+(.+?)\s*$/);
    if (!match) {
      continue;
    }
    const label = match[1]?.toLowerCase();
    const value = match[2]?.trim();
    if (label === "fullname") {
      fullName = value;
    }
    if (label === "id") {
      projectId = value;
    }
  }

  if (!fullName || !projectId) {
    return undefined;
  }

  const [owner, name] = fullName.split("/");
  if (!owner || !name || fullName.split("/").length !== 2) {
    return undefined;
  }

  return {
    fullName,
    owner: normalizeEasOwner(owner),
    name: name.trim(),
    projectId
  };
}

function normalizeEasOwner(value: string): string {
  return value.trim().replace(/^@/, "");
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
