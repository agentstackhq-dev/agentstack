import { stat } from "node:fs/promises";
import { join } from "node:path";
import { LocalCloudAdapter } from "@agentstack/adapters";
import {
  formatDiagnostic,
  getRequiredGeneratedAnchors,
  validateGeneratedAnchors,
  validateLocalProject,
  type AgentstackManifest,
  type EnvironmentName
} from "@agentstack/core";
import {
  JsonlTelemetryStore,
  type TelemetryEnvironment,
  type TelemetryQuery,
  type TelemetrySurface
} from "@agentstack/telemetry";
import { loadLocalEnvValues, loadProjectContext } from "./context.js";

export type RunIo = {
  cwd: string;
  write: (line: string) => void;
};

type ParsedOptions = Record<string, string | boolean>;

const environmentValues = ["development", "preview", "production"] as const;
const telemetrySurfaceValues = [
  "web",
  "mobile",
  "convex",
  "clerk",
  "vercel",
  "eas",
  "cli",
  "control-plane"
] as const;

const observeValueOptions = [
  "env",
  "surface",
  "event",
  "journey",
  "trace",
  "correlation",
  "journey-id"
] as const;

export async function runAgentstack(argv: string[], io: RunIo): Promise<number> {
  try {
    const [command, subcommand, ...rest] = argv;

    if (command === "validate") {
      return await validateCommand(argv.slice(1), io);
    }

    if (command === "sync") {
      return await syncCommand(argv.slice(1), io);
    }

    if (command === "init" && subcommand === "cloud") {
      return await initCloudCommand(io);
    }

    if (command === "observe") {
      return await observeCommand([subcommand, ...rest].filter(Boolean), io);
    }

    io.write("FAIL cli.unknown-command");
    return 1;
  } catch (error) {
    io.write((error as Error).message);
    return 1;
  }
}

async function validateCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const context = await loadProjectContext(io.cwd);
  const envValues = await loadLocalEnvValues(io.cwd);
  const localResult = validateLocalProject({ manifest: context.manifest, envValues });
  const anchorResult = validateGeneratedAnchors({
    manifest: context.manifest,
    missingPaths: await findMissingGeneratedAnchors(context.cwd, context.manifest)
  });
  const diagnostics = [...localResult.diagnostics, ...anchorResult.diagnostics];
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  if (!localResult.ok || !anchorResult.ok) {
    return 1;
  }

  if (options.cloud) {
    const adapter = new LocalCloudAdapter(io.cwd);
    const diagnostics = await adapter.validate(context.manifest, "preview");
    diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
    if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
      return 1;
    }
    io.write("PASS validate --cloud");
    return 0;
  }

  io.write("PASS validate");
  return 0;
}

async function findMissingGeneratedAnchors(
  cwd: string,
  manifest: AgentstackManifest
): Promise<string[]> {
  const anchors = getRequiredGeneratedAnchors(manifest);
  const checks = await Promise.all(
    anchors.map(async (anchor) => {
      try {
        const anchorStat = await stat(join(cwd, anchor));
        return anchorStat.isFile() ? undefined : anchor;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return anchor;
        }
        throw error;
      }
    })
  );

  return checks.filter((anchor): anchor is string => Boolean(anchor));
}

async function syncCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix: "Run agentstack sync --env preview --apply."
  });
  const context = await loadProjectContext(io.cwd);
  const adapter = new LocalCloudAdapter(io.cwd);
  const plan = await adapter.sync(context.manifest, environment, { apply: Boolean(options.apply) });

  io.write(`${plan.applied ? "APPLIED" : "PLAN"} ${plan.environment}`);
  plan.changes.forEach((change) => io.write(`- ${change}`));
  return 0;
}

async function initCloudCommand(io: RunIo): Promise<number> {
  const context = await loadProjectContext(io.cwd);
  const adapter = new LocalCloudAdapter(io.cwd);

  for (const environment of ["development", "preview"] as const) {
    const plan = await adapter.sync(context.manifest, environment, { apply: true });
    io.write(`APPLIED ${plan.environment}`);
    plan.changes.forEach((change) => io.write(`- ${change}`));
  }

  return 0;
}

async function observeCommand(argv: string[], io: RunIo): Promise<number> {
  const [mode, ...rest] = argv;

  if (mode !== "query") {
    io.write("FAIL cli.unknown-command");
    return 1;
  }

  const options = parseOptions(rest);
  requireOptionValues(options, observeValueOptions, {
    event: "Run agentstack observe query --event billing.*.",
    env: "Run agentstack observe query --env preview.",
    surface: "Run agentstack observe query --surface web."
  });
  const store = new JsonlTelemetryStore(join(io.cwd, ".agentstack", "events.jsonl"));
  const query: TelemetryQuery = {
    environment: readTelemetryEnvironmentOption(options.env),
    surface: readTelemetrySurfaceOption(options.surface),
    event: readString(options.event),
    journey: readString(options.journey),
    traceId: readString(options.trace),
    correlationId: readString(options.correlation),
    journeyId: readString(options["journey-id"])
  };
  const events = await store.query(query);

  io.write(`PASS observe ${mode} ${events.length}`);
  for (const event of events) {
    io.write(`${event.timestamp} ${event.environment} ${event.surface} ${event.name}`);
    io.write(JSON.stringify(event.state));
  }

  return 0;
}

function parseOptions(argv: string[]): ParsedOptions {
  const options: ParsedOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

function readEnvironmentOption(
  value: string | boolean | undefined,
  options: { flag: string; fix: string }
): EnvironmentName {
  if (typeof value !== "string") {
    throw new Error(
      [
        "FAIL cli.option.missing",
        `--${options.flag} requires a value.`,
        `Expected one of: ${environmentValues.join(", ")}.`,
        `Fix: ${options.fix}`
      ].join("\n")
    );
  }

  if (isEnvironment(value)) {
    return value;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --${options.flag} value: ${value}. Expected one of: ${environmentValues.join(", ")}.`,
      `Fix: ${options.fix}`
    ].join("\n")
  );
}

function readTelemetryEnvironmentOption(
  value: string | boolean | undefined
): TelemetryEnvironment | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throwMissingOption("env", "Run agentstack observe query --env preview.");
  }

  if (isEnvironment(value)) {
    return value;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --env value: ${value}. Expected one of: ${environmentValues.join(", ")}.`,
      "Fix: Run agentstack observe query --env preview."
    ].join("\n")
  );
}

function readTelemetrySurfaceOption(value: string | boolean | undefined): TelemetrySurface | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throwMissingOption("surface", "Run agentstack observe query --surface web.");
  }

  if (isTelemetrySurface(value)) {
    return value;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --surface value: ${value}. Expected one of: ${telemetrySurfaceValues.join(", ")}.`,
      "Fix: Run agentstack observe query --surface web."
    ].join("\n")
  );
}

function requireOptionValues(
  options: ParsedOptions,
  flags: readonly string[],
  fixes: Partial<Record<string, string>>
): void {
  for (const flag of flags) {
    if (options[flag] === true) {
      throwMissingOption(flag, fixes[flag] ?? `Run agentstack observe query --${flag} value.`);
    }
  }
}

function throwMissingOption(flag: string, fix: string): never {
  throw new Error(["FAIL cli.option.missing", `--${flag} requires a value.`, `Fix: ${fix}`].join("\n"));
}

function isEnvironment(value: string): value is EnvironmentName {
  return environmentValues.includes(value as EnvironmentName);
}

function isTelemetrySurface(value: string): value is TelemetrySurface {
  return telemetrySurfaceValues.includes(value as TelemetrySurface);
}

function readString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
