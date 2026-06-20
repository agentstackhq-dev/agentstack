import { join } from "node:path";
import { LocalCloudAdapter } from "@agentstack/adapters";
import {
  formatDiagnostic,
  validateLocalProject,
  type EnvironmentName
} from "@agentstack/core";
import { JsonlTelemetryStore, type TelemetryQuery } from "@agentstack/telemetry";
import { loadProjectContext } from "./context.js";

export type RunIo = {
  cwd: string;
  write: (line: string) => void;
};

type ParsedOptions = Record<string, string | boolean>;

export async function runAgentstack(argv: string[], io: RunIo): Promise<number> {
  try {
    const [command, subcommand, ...rest] = argv;

    if (command === "validate") {
      return validateCommand(argv.slice(1), io);
    }

    if (command === "sync") {
      return syncCommand(argv.slice(1), io);
    }

    if (command === "init" && subcommand === "cloud") {
      return initCloudCommand(io);
    }

    if (command === "observe") {
      return observeCommand([subcommand, ...rest].filter(Boolean), io);
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

  if (options.cloud) {
    const adapter = new LocalCloudAdapter(io.cwd);
    const diagnostics = await adapter.validate(context.manifest, "preview");
    diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
    return diagnostics.some((diagnostic) => diagnostic.severity === "fail") ? 1 : 0;
  }

  const result = validateLocalProject({ manifest: context.manifest, envValues: {} });
  result.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  if (!result.ok) {
    return 1;
  }

  io.write("PASS validate");
  return 0;
}

async function syncCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readEnvironment(options.env);
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
  const store = new JsonlTelemetryStore(join(io.cwd, ".agentstack", "events.jsonl"));
  const query: TelemetryQuery = {
    environment: options.env as TelemetryQuery["environment"],
    surface: options.surface as TelemetryQuery["surface"],
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

function readEnvironment(value: string | boolean | undefined): EnvironmentName {
  if (value === "development" || value === "preview" || value === "production") {
    return value;
  }

  throw new Error("FAIL cli.env.invalid");
}

function readString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
