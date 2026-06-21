import type { EnvironmentName, ServiceName } from "@agentstack/core";

export type ProviderCommandExecutorOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdin?: string;
  timeoutMs?: number;
};

export type ProviderCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export interface ProviderCommandExecutor {
  execute(
    command: string,
    args: string[],
    options: ProviderCommandExecutorOptions
  ): Promise<ProviderCommandResult>;
}

export type ProviderExecutionStatus = "success" | "failed";

export type ProviderFailureClass = "auth" | "timeout" | "not-found" | "rate-limit" | "unknown";
export type ProviderLiveIdentityConfidence = "none" | "partial" | "exact";
export type ProviderLiveFactLabel = "expected-env-names" | "preview-environment" | "env-list-read";

export type ProviderLiveIdentityFacts = {
  identityConfidence: ProviderLiveIdentityConfidence;
  facts: ProviderLiveFactLabel[];
};

export type ProviderExecutionResult = {
  service: ServiceName | string;
  environment: EnvironmentName;
  commandKind: string;
  status: ProviderExecutionStatus;
  exitCode: number;
  durationMs: number;
  stdoutSummary: string;
  stderrSummary: string;
  stdoutLines: number;
  stderrLines: number;
  stdoutBytes: number;
  stderrBytes: number;
  outputRedacted: boolean;
  resourceNames?: string[];
  providerResourceId?: string;
  liveIdentityFacts?: ProviderLiveIdentityFacts;
  failureClass?: ProviderFailureClass;
};

export type ProviderArtifactCommand = {
  id: string;
  args: string[];
  secret?: boolean;
};

export type ProviderExecutionResultInput = {
  service: ServiceName | string;
  environment: EnvironmentName;
  commandKind: string;
  command: ProviderArtifactCommand;
  result: ProviderCommandResult;
  secretValues?: string[];
  providerResourceId?: string;
  liveIdentityFacts?: ProviderLiveIdentityFacts;
  captureOutput?: "redacted-summary" | "redacted-text";
};

export type RedactionOptions = {
  secretValues?: string[];
};

const COMMON_SECRET_PATTERNS = [
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{10,}\b/g,
  /\b[A-Za-z0-9_-]*deploy[_-]?key[A-Za-z0-9_-]*=[^\s]+/gi,
  /\b(?:CLERK_SECRET_KEY|CONVEX_DEPLOY_KEY|OPENAI_API_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET)=\S+/g
];

export function redactProviderText(text: string, options: RedactionOptions = {}): string {
  let redacted = text;

  for (const secret of options.secretValues ?? []) {
    if (secret.length === 0) {
      continue;
    }
    redacted = redacted.split(secret).join("[REDACTED]");
  }

  for (const pattern of COMMON_SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      const assignmentIndex = match.indexOf("=");
      return assignmentIndex === -1 ? "[REDACTED]" : `${match.slice(0, assignmentIndex + 1)}[REDACTED]`;
    });
  }

  return redacted;
}

export function createProviderExecutionResult(
  input: ProviderExecutionResultInput
): ProviderExecutionResult {
  const status: ProviderExecutionStatus = input.result.exitCode === 0 ? "success" : "failed";
  const output = summarizeProviderOutput(input.result, {
    captureOutput: input.captureOutput ?? "redacted-summary",
    secretValues: input.secretValues
  });
  const artifact: ProviderExecutionResult = {
    service: input.service,
    environment: input.environment,
    commandKind: input.commandKind,
    status,
    exitCode: input.result.exitCode,
    durationMs: input.result.durationMs,
    ...output,
    resourceNames: inferResourceNames(input.command.args),
    providerResourceId: input.providerResourceId
      ? redactProviderText(input.providerResourceId, { secretValues: input.secretValues })
      : undefined,
    liveIdentityFacts: input.liveIdentityFacts
      ? {
          identityConfidence: input.liveIdentityFacts.identityConfidence,
          facts: [...input.liveIdentityFacts.facts]
        }
      : undefined
  };

  if (status === "failed") {
    artifact.failureClass = classifyProviderFailure(input.result);
  }

  return artifact;
}

export function classifyProviderFailure(
  result: Pick<ProviderCommandResult, "exitCode" | "stderr" | "stdout">
): ProviderFailureClass {
  const diagnostics = `${result.stdout} ${result.stderr}`.toLowerCase();

  if (result.exitCode === 124 || diagnostics.includes("timed out") || diagnostics.includes("timeout")) {
    return "timeout";
  }

  if (
    diagnostics.includes("auth") ||
    diagnostics.includes("unauthorized") ||
    diagnostics.includes("forbidden") ||
    diagnostics.includes("invalid token")
  ) {
    return "auth";
  }

  if (diagnostics.includes("not found") || diagnostics.includes("enoent")) {
    return "not-found";
  }

  if (diagnostics.includes("rate limit") || diagnostics.includes("too many requests")) {
    return "rate-limit";
  }

  return "unknown";
}

function summarizeProviderOutput(
  result: Pick<ProviderCommandResult, "stdout" | "stderr">,
  options: RedactionOptions & { captureOutput: "redacted-summary" | "redacted-text" }
): Pick<
  ProviderExecutionResult,
  | "stdoutSummary"
  | "stderrSummary"
  | "stdoutLines"
  | "stderrLines"
  | "stdoutBytes"
  | "stderrBytes"
  | "outputRedacted"
> {
  const stdoutStats = providerTextStats(result.stdout);
  const stderrStats = providerTextStats(result.stderr);

  if (options.captureOutput === "redacted-text") {
    return {
      stdoutSummary: summarizeProviderText(result.stdout, options),
      stderrSummary: summarizeProviderText(result.stderr, options),
      stdoutLines: stdoutStats.lines,
      stderrLines: stderrStats.lines,
      stdoutBytes: stdoutStats.bytes,
      stderrBytes: stderrStats.bytes,
      outputRedacted: true
    };
  }

  return {
    stdoutSummary: redactedProviderOutputSummary("stdout", stdoutStats),
    stderrSummary: redactedProviderOutputSummary("stderr", stderrStats),
    stdoutLines: stdoutStats.lines,
    stderrLines: stderrStats.lines,
    stdoutBytes: stdoutStats.bytes,
    stderrBytes: stderrStats.bytes,
    outputRedacted: true
  };
}

function summarizeProviderText(text: string, options: RedactionOptions): string {
  const redacted = redactProviderText(text, options).trim();
  return redacted.length > 2_000 ? `${redacted.slice(0, 2_000)}...` : redacted;
}

function providerTextStats(text: string): { lines: number; bytes: number } {
  return {
    lines: text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length,
    bytes: Buffer.byteLength(text, "utf8")
  };
}

function redactedProviderOutputSummary(
  stream: "stdout" | "stderr",
  stats: { lines: number; bytes: number }
): string {
  if (stats.bytes === 0) {
    return "";
  }

  return `<redacted provider ${stream}: ${stats.lines} ${stats.lines === 1 ? "line" : "lines"}, ${stats.bytes} ${stats.bytes === 1 ? "byte" : "bytes"}>`;
}

function inferResourceNames(args: string[]): string[] | undefined {
  const names = args.filter((arg, index) => {
    const previous = args[index - 1];
    return (
      previous === "set" ||
      previous === "remove" ||
      previous === "--preview-name" ||
      previous === "--deployment"
    );
  });

  return names.length > 0 ? names : undefined;
}
