#!/usr/bin/env tsx
import { resolve } from "node:path";

import { runAgentstack } from "@agentstack/cli";
import { generateProject } from "./create/generate.js";

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
      "  dev           Start a local app surface after preflight",
      "  doctor        Diagnose readiness without starting servers",
      "  sync          Rehearse local provider state under .agentstack/",
      "  env           Inspect or set local validation env values",
      "  preview       Run live preview happy-path commands",
      "  deploy        Plan or apply deploy actions",
      "  provider      Bootstrap, link, inspect, adopt, or ledger provider resources",
      "  auth          Manage package-owned auth fixtures",
      "  billing       Bootstrap and verify Clerk Billing entitlement fixtures",
      "  smoke         Validate preview auth/data smoke evidence",
      "  evidence      Check package-owned validation evidence",
      "  observe       Inspect telemetry and journey evidence",
      "  skills        Install or inspect repo-local agent skills",
      "  theme         Validate generated theme tokens",
      "",
      "Create options:",
      "  --package-spec <spec>",
      "  --package-override <name=spec>",
      "",
      "Examples:",
      "  agentstack create <app-name>",
      "  agentstack create <app-name> --package-spec link:/path/to/agentstack",
      "  agentstack create <app-name> --package-spec file:/tmp/agentstack.tgz --package-override @agentstack/cli=file:/tmp/agentstack-cli.tgz",
      "  agentstack skills install codex",
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
    process.stdout.write(
      "Usage: agentstack create <app-name> [--package-spec <spec>] [--package-override <name=spec>]\n"
    );
    return 0;
  }

  if (!parsed.name) {
    process.stderr.write(
      "Usage: agentstack create <app-name> [--package-spec <spec>] [--package-override <name=spec>]\n"
    );
    return 1;
  }

  await generateProject({
    name: parsed.name,
    targetDir: resolve(process.cwd(), parsed.name),
    packageSpec: parsed.packageSpec ?? process.env.AGENTSTACK_PACKAGE_SPEC,
    packageOverrides: parsed.packageOverrides
  });
  process.stdout.write(`Created ${parsed.name}\n`);
  return 0;
}

function parseCreateArgs(argv: string[]): {
  name?: string;
  packageSpec?: string;
  packageOverrides: Record<string, string>;
  help: boolean;
} {
  const parsed: {
    name?: string;
    packageSpec?: string;
    packageOverrides: Record<string, string>;
    help: boolean;
  } = { help: false, packageOverrides: {} };

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
    if (arg === "--package-override") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--") || !value.includes("=")) {
        throw new Error(
          "Usage: agentstack create <app-name> [--package-spec <spec>] [--package-override <name=spec>]"
        );
      }
      const separatorIndex = value.indexOf("=");
      const name = value.slice(0, separatorIndex);
      const spec = value.slice(separatorIndex + 1);
      if (!name || !spec) {
        throw new Error(
          "Usage: agentstack create <app-name> [--package-spec <spec>] [--package-override <name=spec>]"
        );
      }
      parsed.packageOverrides[name] = spec;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown create option: ${arg}`);
    }
    if (parsed.name) {
      throw new Error(
        "Usage: agentstack create <app-name> [--package-spec <spec>] [--package-override <name=spec>]"
      );
    }
    parsed.name = arg;
  }

  return parsed;
}
