#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const appSlug = "__APP_SLUG__";
const ledgerPath = "docs/provider-resource-ledger.md";
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

rejectExternalIdArgs(args);

const owner = requireValue(args.owner, "--owner");
const createdBy = requireValue(args["created-by"], "--created-by");
const createdAt = requireDate(args["created-at"], "--created-at");
const status = readStatus(args.status);
const allowPending = args["allow-pending"] === true;
const replace = args.replace === true;

if (replace && status !== "active") {
  console.log("FAIL m1 ledger record.replace-status-required");
  console.log("Evidence: m1-provider-ledger-record");
  console.log("Fix: pass --status active when replacing pending M1 rows with real provider ids or dashboard URLs.");
  console.log("Provider mutation: none");
  console.log("Local mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

const evidenceSuffix = replace ? "-active" : "";

const records = [
  {
    service: "clerk",
    resourceType: "application",
    name: `${appSlug}-preview`,
    externalId: process.env.M1_CLERK_EXTERNAL_ID ?? "pending",
    purpose: "M1 preview Clerk auth smoke",
    cleanup: "delete through Clerk dashboard",
    evidence: `docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-${createdAt}${evidenceSuffix}.md`
  },
  {
    service: "convex",
    resourceType: "deployment",
    name: `${appSlug}-preview`,
    externalId: process.env.M1_CONVEX_EXTERNAL_ID ?? "pending",
    purpose: "M1 preview protected Convex data smoke",
    cleanup: "delete through Convex dashboard",
    evidence: `docs/milestones/evidence/M1-preview-e2e/provider-ledger-convex-${createdAt}${evidenceSuffix}.md`
  },
  {
    service: "vercel",
    resourceType: "project",
    name: appSlug,
    externalId: process.env.M1_VERCEL_EXTERNAL_ID ?? "pending",
    purpose: "M1 preview Vercel deploy smoke",
    cleanup: "delete through Vercel dashboard",
    evidence: `docs/milestones/evidence/M1-preview-e2e/provider-ledger-vercel-${createdAt}${evidenceSuffix}.md`
  }
];

const pendingRecords = records.filter((record) => record.externalId === "pending");
if (pendingRecords.length > 0 && (replace || !allowPending)) {
  console.log("FAIL m1 ledger record.external-id-required");
  console.log("Evidence: m1-provider-ledger-record");
  console.log(`Missing: ${pendingRecords.map((record) => `M1_${record.service.toUpperCase()}_EXTERNAL_ID`).join(", ")}`);
  console.log(
    replace
      ? "Fix: set all M1_*_EXTERNAL_ID values before using --replace."
      : "Fix: set all M1_*_EXTERNAL_ID values or pass --allow-pending for pre-creation planned rows."
  );
  console.log("Provider mutation: none");
  console.log("Local mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

validateCells([owner, createdBy, createdAt, status, ...records.flatMap((record) => [record.externalId])]);

const localSnapshots = await snapshotLocalFiles([ledgerPath, ...records.map((record) => record.evidence)]);

for (const record of records) {
  const code = runAgentstack([
    "provider",
    "ledger",
    "record",
    ...(replace ? ["--replace"] : []),
    "--service",
    record.service,
    "--env",
    "preview",
    "--resource-type",
    record.resourceType,
    "--name",
    record.name,
    "--external-id",
    record.externalId,
    "--owner",
    owner,
    "--purpose",
    record.purpose,
    "--created-by",
    createdBy,
    "--created-at",
    createdAt,
    "--cleanup-trigger",
    "M1 pass or pivot",
    "--cleanup",
    record.cleanup,
    "--evidence",
    record.evidence,
    "--notes",
    "recorded by m1:ledger:record",
    "--status",
    status,
    "--write-evidence"
  ]);

  if (code !== 0) {
    await restoreLocalFiles(localSnapshots);
    console.log("FAIL m1 ledger record");
    console.log("Evidence: m1-provider-ledger-record");
    console.log(`Failed service: ${record.service}`);
    console.log("Provider mutation: none");
    console.log("Local mutation: restored docs/provider-resource-ledger.md and M1 provider ledger evidence");
    console.log("Telemetry mutation: none");
    process.exit(code);
  }
}

console.log("PASS m1 ledger record");
console.log("Evidence: m1-provider-ledger-record");
console.log(`${replace ? "Replaced" : "Recorded"}: clerk preview application`);
console.log(`${replace ? "Replaced" : "Recorded"}: convex preview deployment`);
console.log(`${replace ? "Replaced" : "Recorded"}: vercel preview project`);
if (pendingRecords.length > 0) {
  console.log("Pending external IDs: yes");
  console.log("M1 Ledger checkbox: unchanged until real external IDs replace pending rows");
}
console.log("Provider mutation: none");
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

async function snapshotLocalFiles(paths) {
  const snapshots = new Map();
  for (const path of paths) {
    snapshots.set(path, await readOptionalText(path));
  }
  return snapshots;
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

async function restoreLocalFiles(snapshots) {
  for (const [path, snapshot] of snapshots) {
    if (snapshot === undefined) {
      await rm(path, { force: true });
      continue;
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, snapshot);
  }
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
    if (key === "allow-pending" || key === "replace") {
      parsed[key] = true;
      continue;
    }

    const value = rawArgs[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function requireValue(value, flag) {
  if (!value) {
    printUsage();
    throw new Error(`Missing required ${flag}`);
  }

  return value;
}

function requireDate(value, flag) {
  const date = requireValue(value, flag);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${flag} must use yyyy-mm-dd`);
  }
  return date;
}

function readStatus(value) {
  if (value === undefined) {
    return "planned";
  }
  if (value === "planned" || value === "active") {
    return value;
  }
  throw new Error("--status must be planned or active");
}

function validateCells(values) {
  const invalid = values.find((value) => /[\r\n|]/.test(value));
  if (invalid !== undefined) {
    throw new Error("Ledger values cannot contain pipes or newlines.");
  }
}

function rejectExternalIdArgs(parsed) {
  const forbidden = ["clerk-external-id", "convex-external-id", "vercel-external-id"].find(
    (key) => parsed[key] !== undefined
  );
  if (forbidden !== undefined) {
    throw new Error(`Do not pass --${forbidden}; set M1_${forbidden.replace(/-/g, "_").toUpperCase()} instead.`);
  }
}

function printUsage() {
  console.log(
    [
      "Usage: pnpm run m1:ledger:record -- --owner <account-or-project> --created-by <name> --created-at <yyyy-mm-dd>",
      "",
      "Required external ID environment variables:",
      "  M1_CLERK_EXTERNAL_ID=<id-or-url>",
      "  M1_CONVEX_EXTERNAL_ID=<id-or-url>",
      "  M1_VERCEL_EXTERNAL_ID=<id-or-url>",
      "",
      "  --status <planned|active>",
      "  --allow-pending   Record pre-creation planned rows with pending external IDs instead",
      "  --replace         Replace matching pending rows with real external IDs; requires --status active",
      "",
      "Writes only docs/provider-resource-ledger.md and redacted M1 evidence notes."
    ].join("\n")
  );
}
