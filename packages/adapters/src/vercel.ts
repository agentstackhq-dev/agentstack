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

export type VercelCommandKind =
  | "web.deploy"
  | "env.list"
  | "project.list"
  | "env.add"
  | "env.update"
  | "env.remove";

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

export type InspectVercelReadOnlyOptions = {
  environment: EnvironmentName;
  executor: ProviderCommandExecutor;
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  secretValues?: string[];
  exactProofContext?: VercelExactProofContext;
};

export type VercelExactProofContext = {
  expectedResourceName: string;
  ledgerExternalIdOrUrl: string;
  ledgerOwnerAccountOrProject: string;
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

export async function inspectVercelReadOnly(
  options: InspectVercelReadOnlyOptions
): Promise<ProviderExecutionResult[]> {
  if (options.environment !== "preview" && options.environment !== "production") {
    throw new Error(
      "Vercel runtime inspect supports preview and production env-list reads only. Development inspect, deploy, and env mutation execution are not available in this slice."
    );
  }

  const target = createVercelTarget(options.environment);
  const commands = [target.envListCommand, projectListCommand(options.environment)];
  const results: ProviderExecutionResult[] = [];
  let environmentScopeFacts: ProviderLiveIdentityFacts | undefined;

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

    const localProjectLink = await readVercelLocalProjectLink(options.cwd);
    const liveIdentityFacts =
      command.kind === "env.list"
        ? parseVercelEnvListFacts(result.stdout, result.exitCode, options.environment)
        : undefined;
    if (command.kind === "env.list") {
      environmentScopeFacts = liveIdentityFacts;
    }
    const identityCandidates =
      command.kind === "env.list"
        ? await parseVercelIdentityCandidates({
            localProjectLink,
            exitCode: result.exitCode,
            liveIdentityFacts,
            environment: options.environment
          })
        : identityCandidatesForVercelProjectList(result.stdout, result.exitCode);
    const exactIdentityProof =
      command.kind === "project.list"
        ? exactIdentityProofForVercelProjectList(result.stdout, result.exitCode, {
            context: options.exactProofContext,
            localProjectLink,
            environmentScopeFacts,
            environment: options.environment
          })
        : undefined;

    results.push(
      createProviderExecutionResult({
        service: "vercel",
        environment: options.environment,
        commandKind: command.kind,
        command,
        result,
        secretValues: options.secretValues,
        liveIdentityFacts,
        identityCandidates,
        exactIdentityProof
      })
    );
  }

  return results;
}

function parseVercelEnvListFacts(
  stdout: string,
  exitCode: number,
  environment: "preview" | "production"
): ProviderLiveIdentityFacts | undefined {
  if (exitCode !== 0) {
    return undefined;
  }

  const hasExpectedEnvRow = parseVercelEnvListRows(stdout).some(
    (row) => isExpectedVercelEnvName(row.name) && row.environments.includes(environment)
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

async function parseVercelIdentityCandidates(input: {
  localProjectLink: VercelLocalProjectLink | undefined;
  exitCode: number;
  liveIdentityFacts: ProviderLiveIdentityFacts | undefined;
  environment: "preview" | "production";
}): Promise<ProviderIdentityCandidatesArtifact | undefined> {
  if (input.exitCode !== 0) {
    return undefined;
  }

  const labels: ProviderIdentityCandidateLabel[] = [];
  if (hasVercelEnvironmentScope(input.liveIdentityFacts, input.environment)) {
    labels.push("provider-environment-scope");
  }
  if (input.localProjectLink) {
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

function hasVercelEnvironmentScope(
  facts: ProviderLiveIdentityFacts | undefined,
  environment: "preview" | "production"
): boolean {
  if (facts?.identityConfidence !== "partial") {
    return false;
  }
  const labels = new Set(facts.facts);
  return (
    labels.has("env-list-read") &&
    labels.has("expected-env-names") &&
    labels.has(environment === "preview" ? "preview-environment" : "production-environment")
  );
}

type VercelLocalProjectLink = {
  projectId: string;
  orgId: string;
};

async function readVercelLocalProjectLink(cwd: string | undefined): Promise<VercelLocalProjectLink | undefined> {
  if (!cwd) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(join(cwd, ".vercel", "project.json"), "utf8"));
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }

  const project = parsed as { projectId?: unknown; orgId?: unknown };
  if (!isNonEmptyString(project.projectId) || !isNonEmptyString(project.orgId)) {
    return undefined;
  }
  return { projectId: project.projectId.trim(), orgId: project.orgId.trim() };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type VercelProjectListRow = {
  id: string;
  name: string;
  owner: string;
};

function identityCandidatesForVercelProjectList(
  stdout: string,
  exitCode: number
): ProviderIdentityCandidatesArtifact | undefined {
  const project = parseSingleVercelProjectListRow(stdout, exitCode);
  if (!project) {
    return undefined;
  }

  return {
    kind: "provider-identity-candidates",
    evaluator: "provider-specific-identity-candidate-parser",
    labels: ["stable-provider-identity", "provider-owner-identity", "provider-resource-id"]
  };
}

function exactIdentityProofForVercelProjectList(
  stdout: string,
  exitCode: number,
  input: {
    context: VercelExactProofContext | undefined;
    localProjectLink: VercelLocalProjectLink | undefined;
    environmentScopeFacts: ProviderLiveIdentityFacts | undefined;
    environment: "preview" | "production";
  }
): ProviderExactIdentityProofArtifact | undefined {
  if (
    exitCode !== 0 ||
    !input.context ||
    !input.localProjectLink ||
    !hasVercelEnvironmentScope(input.environmentScopeFacts, input.environment)
  ) {
    return undefined;
  }

  const expectedName = input.context.expectedResourceName.trim();
  const expectedExternalId = input.context.ledgerExternalIdOrUrl.trim();
  const expectedOwner = input.context.ledgerOwnerAccountOrProject.trim();
  if (!expectedName || !expectedExternalId || !expectedOwner) {
    return undefined;
  }

  const project = parseSingleVercelProjectListRow(stdout, exitCode);
  if (!project) {
    return undefined;
  }

  if (
    project.name !== expectedName ||
    project.id !== expectedExternalId ||
    project.owner !== expectedOwner ||
    input.localProjectLink.projectId !== project.id ||
    input.localProjectLink.orgId !== project.owner
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

function parseSingleVercelProjectListRow(
  stdout: string,
  exitCode: number
): VercelProjectListRow | undefined {
  if (exitCode !== 0) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsed) || parsed.length !== 1) {
    return undefined;
  }

  const row = parsed[0];
  if (!row || typeof row !== "object") {
    return undefined;
  }
  const project = row as Record<string, unknown>;
  const owner = firstNonEmptyString(
    project.accountId,
    project.account_id,
    project.ownerId,
    project.owner_id,
    project.teamId,
    project.team_id,
    project.orgId,
    project.org_id
  );
  if (!isNonEmptyString(project.id) || !isNonEmptyString(project.name) || !owner) {
    return undefined;
  }

  return { id: project.id.trim(), name: project.name.trim(), owner };
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }
  return undefined;
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
        secretValues: options.secretValues,
        deploymentUrl: extractVercelDeploymentUrl(result.stdout)
      })
    );
  }

  return results;
}

function extractVercelDeploymentUrl(stdout: string): string | undefined {
  const match = stdout.match(/https:\/\/[^\s"'<>]+\.vercel\.app\b[^\s"'<>]*/);
  return match?.[0];
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

function projectListCommand(environment: EnvironmentName): VercelCliCommand {
  return {
    id: `${environment}.vercel.project.list`,
    kind: "project.list",
    environment,
    summary: `List Vercel projects as JSON for ${environment} identity evidence.`,
    args: ["pnpm", "exec", "vercel", "project", "ls", "--json"],
    secret: false,
    requiresConfirmation: false
  };
}

function envName(target: string): string | undefined {
  return target.startsWith("env:") ? target.slice("env:".length) : undefined;
}
