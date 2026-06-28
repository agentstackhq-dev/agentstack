#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const appSlug = "__APP_SLUG__";
const evidenceDir = "docs/milestones/evidence/M1-preview-e2e";
const providerLinksEvidencePath = resolve(`${evidenceDir}/provider-links.txt`);
const providerLinksStatePath = resolve(".agentstack/provider-links.json");
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

if (Object.keys(args).length > 0) {
  printUsage();
  throw new Error("m1:providers:link does not accept options.");
}

const links = [
  {
    service: "clerk",
    resourceType: "application",
    name: `${appSlug}-preview`,
    label: "clerk preview application"
  },
  {
    service: "convex",
    resourceType: "deployment",
    name: `${appSlug}-preview`,
    label: "convex preview deployment"
  },
  {
    service: "vercel",
    resourceType: "project",
    name: appSlug,
    label: "vercel preview project"
  }
];

const ledgerFailures = await findInactiveLedgerRows(links);
if (ledgerFailures.length > 0) {
  console.log("FAIL m1 providers link.ledger-active-required");
  console.log("Evidence: m1-provider-link");
  for (const failure of ledgerFailures) {
    console.log(`Reason: ${failure}`);
  }
  console.log("Provider mutation: none");
  console.log("Local mutation: none");
  console.log("Ledger mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

const providerLinksSnapshot = await readOptionalText(providerLinksStatePath);

for (const link of links) {
  const code = runAgentstack([
    "provider",
    "link",
    "--service",
    link.service,
    "--env",
    "preview",
    "--resource-type",
    link.resourceType,
    "--name",
    link.name
  ]);

  if (code !== 0) {
    await restoreProviderLinksState(providerLinksSnapshot);
    await removeProviderLinksEvidence();
    console.log("FAIL m1 providers link");
    console.log("Evidence: m1-provider-link");
    console.log(`Failed service: ${link.service}`);
    console.log("Provider mutation: none");
    console.log("Local mutation: restored .agentstack/provider-links.json");
    console.log("Local mutation: removed docs/milestones/evidence/M1-preview-e2e/provider-links.txt");
    console.log("Ledger mutation: none");
    console.log("Telemetry mutation: none");
    process.exit(code);
  }
}

const checkedAt = new Date().toISOString();
const evidence = [
  "# M1 Provider Link Evidence",
  "",
  "Result: PASS",
  `Checked at: ${checkedAt}`,
  "Clerk preview application: linked",
  "Convex preview deployment: linked",
  "Vercel preview project: linked",
  "Local mutation: .agentstack/provider-links.json",
  "Provider mutation: none",
  "Ledger mutation: none",
  "Telemetry mutation: none",
  "",
  "Raw provider identifiers, tokens, secrets, and provider stdout are not stored in this evidence file.",
  ""
].join("\n");

await mkdir(dirname(providerLinksEvidencePath), { recursive: true });
await writeFile(providerLinksEvidencePath, evidence);

console.log("PASS m1 providers link");
console.log("Evidence: m1-provider-link");
console.log("Linked: clerk preview application");
console.log("Linked: convex preview deployment");
console.log("Linked: vercel preview project");
console.log("Local mutation: .agentstack/provider-links.json");
console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/provider-links.txt");
console.log("Provider mutation: none");
console.log("Ledger mutation: none");
console.log("Telemetry mutation: none");

function runAgentstack(commandArgs) {
  const result = spawnSync(process.execPath, ["scripts/agentstack.mjs", ...commandArgs], {
    encoding: "utf8",
    env: process.env
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }
  if (result.signal) {
    process.stderr.write(`agentstack exited from signal ${result.signal}\n`);
    return 1;
  }

  return result.status ?? 1;
}

async function readOptionalText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function restoreProviderLinksState(snapshot) {
  if (snapshot === undefined) {
    await rm(providerLinksStatePath, { force: true });
    return;
  }

  await mkdir(dirname(providerLinksStatePath), { recursive: true });
  await writeFile(providerLinksStatePath, snapshot);
}

async function removeProviderLinksEvidence() {
  await rm(providerLinksEvidencePath, { force: true });
}

async function findInactiveLedgerRows(expectedRows) {
  let ledger;
  try {
    ledger = await readFile("docs/provider-resource-ledger.md", "utf8");
  } catch {
    return ["missing docs/provider-resource-ledger.md"];
  }

  const rows = ledger
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|") && !line.includes("| --- "))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    );

  const failures = [];

  for (const expected of expectedRows) {
    const row = rows.find(
      (cells) =>
        cells[1] === expected.service &&
        cells[2] === expected.resourceType &&
        cells[3] === "preview" &&
        cells[5] === expected.name
    );

    if (!row) {
      failures.push(`missing active provider ledger row for ${expected.label}`);
      continue;
    }

    const externalId = row[6];
    const status = row[11];

    if (!externalId || externalId === "pending") {
      failures.push(`provider ledger external id is not recorded for ${expected.label}`);
    }
    if (status !== "active") {
      failures.push(`provider ledger status is not active for ${expected.label}`);
    }
  }

  return failures;
}

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = rawArgs[index + 1];

    if (value && !value.startsWith("--")) {
      throw new Error(`Unexpected value for ${arg}: ${value}`);
    }

    parsed[key] = true;
  }

  return parsed;
}

function printUsage() {
  console.log(
    [
      "Usage: pnpm run m1:providers:link",
      "",
      "Requires existing active M1 provider ledger rows.",
      "Writes .agentstack/provider-links.json and redacted M1 provider-link evidence."
    ].join("\n")
  );
}
