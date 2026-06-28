#!/usr/bin/env tsx
import { resolve } from "node:path";

import { runAgentstack } from "@agentstack/cli";
import { generateProject } from "create-agent-stack";

const argv = process.argv.slice(2);
const [command, ...rest] = argv;

const code =
  command === "--help" || command === "-h" || command === "help"
    ? writeTopLevelUsage()
    : command === "create"
      ? await createCommand(rest)
      : await runAgentstack(argv, {
          cwd: process.cwd(),
          write: (line) => process.stdout.write(`${line}\n`)
        });

process.exitCode = code;

function writeTopLevelUsage(): number {
  process.stdout.write(
    [
      "Usage: agentstack <command> [options]",
      "",
      "Commands:",
      "  create        Create a lean Agentstack app",
      "  validate      Validate project structure and release readiness",
      "  dev           Print local development preflight",
      "  deploy        Plan or apply deploy actions",
      "  provider      Plan, inspect, link, adopt, or ledger provider resources",
      "  observe       Inspect telemetry and journey evidence",
      "  theme         Validate generated theme tokens",
      "",
      "Examples:",
      "  agentstack create <app-name>",
      "  agentstack create <app-name> --package-spec link:/path/to/agentstack",
      "  agentstack validate",
      "  agentstack deploy --env preview"
    ].join("\n")
  );
  process.stdout.write("\n");
  return 0;
}

async function createCommand(argv: string[]): Promise<number> {
  const parsed = parseCreateArgs(argv);

  if (parsed.help) {
    process.stdout.write("Usage: agentstack create <app-name> [--package-spec <spec>]\n");
    return 0;
  }

  if (!parsed.name) {
    process.stderr.write("Usage: agentstack create <app-name> [--package-spec <spec>]\n");
    return 1;
  }

  await generateProject({
    name: parsed.name,
    targetDir: resolve(process.cwd(), parsed.name),
    packageSpec: parsed.packageSpec ?? process.env.AGENTSTACK_PACKAGE_SPEC
  });
  process.stdout.write(`Created ${parsed.name}\n`);
  return 0;
}

function parseCreateArgs(argv: string[]): { name?: string; packageSpec?: string; help: boolean } {
  const parsed: { name?: string; packageSpec?: string; help: boolean } = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--package-spec") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Usage: agentstack create <app-name> [--package-spec <spec>]");
      }
      parsed.packageSpec = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown create option: ${arg}`);
    }
    if (parsed.name) {
      throw new Error("Usage: agentstack create <app-name> [--package-spec <spec>]");
    }
    parsed.name = arg;
  }

  return parsed;
}
