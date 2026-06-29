#!/usr/bin/env tsx
import { resolve } from "node:path";

import { generateProject } from "./generate.js";

const parsed = parseArgs(process.argv.slice(2));

if (parsed.help) {
  process.stdout.write("Usage: create-agent-stack <app-name> [--package-spec <spec>]\n");
} else if (!parsed.name) {
  process.stderr.write("Usage: create-agent-stack <app-name> [--package-spec <spec>]\n");
  process.exitCode = 1;
} else {
  await generateProject({
    name: parsed.name,
    targetDir: resolve(process.cwd(), parsed.name),
    packageSpec: parsed.packageSpec ?? process.env.AGENTSTACK_PACKAGE_SPEC
  });
  process.stdout.write(`Created ${parsed.name}\n`);
}

function parseArgs(argv: string[]): { name?: string; packageSpec?: string; help: boolean } {
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
        throw new Error("Usage: create-agent-stack <app-name> [--package-spec <spec>]");
      }
      parsed.packageSpec = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown create option: ${arg}`);
    }
    if (parsed.name) {
      throw new Error("Usage: create-agent-stack <app-name> [--package-spec <spec>]");
    }
    parsed.name = arg;
  }

  return parsed;
}
