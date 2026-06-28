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
      "  agentstack validate",
      "  agentstack deploy --env preview"
    ].join("\n")
  );
  process.stdout.write("\n");
  return 0;
}

async function createCommand(argv: string[]): Promise<number> {
  const [name] = argv;

  if (name === "--help" || name === "-h") {
    process.stdout.write("Usage: agentstack create <app-name>\n");
    return 0;
  }

  if (!name) {
    process.stderr.write("Usage: agentstack create <app-name>\n");
    return 1;
  }

  await generateProject({ name, targetDir: resolve(process.cwd(), name) });
  process.stdout.write(`Created ${name}\n`);
  return 0;
}
