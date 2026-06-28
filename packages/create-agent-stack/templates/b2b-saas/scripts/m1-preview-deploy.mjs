#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const appSlug = "__APP_SLUG__";
const evidenceDir = "docs/milestones/evidence/M1-preview-e2e";
const deployUrlPath = resolve(`${evidenceDir}/deploy-url.txt`);
const deployOutputPath = resolve(`${evidenceDir}/deploy-output.txt`);
const smokeOutputPath = resolve(`${evidenceDir}/smoke-output.txt`);
const providerLinksPath = resolve(".agentstack/provider-links.json");
const providerLinksEvidencePath = resolve(`${evidenceDir}/provider-links.txt`);
const convexPreviewEnvPath = ".agentstack/convex-preview.env";
const args = parseArgs(process.argv.slice(2));
const expectedM1Resources = [
  {
    service: "clerk",
    resourceType: "application",
    name: `${appSlug}-preview`,
    label: "clerk preview application",
    evidenceLine: "Clerk preview application: linked"
  },
  {
    service: "convex",
    resourceType: "deployment",
    name: `${appSlug}-preview`,
    label: "convex preview deployment",
    evidenceLine: "Convex preview deployment: linked"
  },
  {
    service: "vercel",
    resourceType: "project",
    name: appSlug,
    label: "vercel preview project",
    evidenceLine: "Vercel preview project: linked"
  }
];

if (args.help) {
  printUsage();
  process.exit(0);
}

if (!args["confirm-live-mutation"]) {
  console.log("FAIL m1 preview deploy.confirmation-required");
  console.log("Evidence: m1-preview-deploy");
  console.log("Provider mutation: none");
  console.log("Local mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

const ledgerFailures = await findInactiveLedgerRows(expectedM1Resources);

if (ledgerFailures.length > 0) {
  console.log("FAIL m1 preview deploy.ledger-active-required");
  console.log("Evidence: m1-preview-deploy");
  for (const failure of ledgerFailures) {
    console.log(`Reason: ${failure}`);
  }
  console.log("Provider mutation: none");
  console.log("Local mutation: none");
  console.log("Ledger mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

const providerLinkFailures = await findMissingProviderLinks(expectedM1Resources);
if (providerLinkFailures.length > 0) {
  console.log("FAIL m1 preview deploy.provider-links-required");
  console.log("Evidence: m1-preview-deploy");
  for (const failure of providerLinkFailures) {
    console.log(`Reason: ${failure}`);
  }
  console.log("Provider mutation: none");
  console.log("Local mutation: none");
  console.log("Ledger mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

const convex = runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
  env: await readEnvFile(convexPreviewEnvPath)
});

if (convex.code !== 0) {
  await printFailure("convex preview apply", convex.code, {
    convexStatus: "failed",
    vercelStatus: "not attempted"
  });
}

const vercel = runAgentstack(["provider", "apply", "--service", "vercel", "--env", "preview"]);

if (vercel.code !== 0) {
  await printFailure("vercel preview deploy", vercel.code, {
    convexStatus: "completed",
    vercelStatus: "failed"
  });
}

const deployUrl = extractDeployUrl(vercel.combined);

if (!deployUrl) {
  await removeStaleDeployUrl();
  await removeStaleSmokeOutput();
  await writeDeployOutput({
    result: "FAIL",
    failedStage: "vercel preview deploy URL extraction",
    convexStatus: "completed",
    vercelStatus: "completed",
    deployUrl: undefined
  });
  console.log("FAIL m1 preview deploy.deploy-url-missing");
  console.log("Evidence: m1-preview-deploy");
  console.log("Failed stage: vercel preview deploy");
  console.log("Provider mutation: convex preview apply, vercel preview deploy");
  console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/deploy-output.txt");
  console.log("Telemetry mutation: provider apply telemetry");
  process.exit(1);
}

await removeStaleSmokeOutput();
await mkdir(dirname(deployUrlPath), { recursive: true });
await writeFile(deployUrlPath, `${deployUrl}\n`);
await writeDeployOutput({
  result: "PASS",
  failedStage: undefined,
  convexStatus: "completed",
  vercelStatus: "completed",
  deployUrl
});

console.log("PASS m1 preview deploy");
console.log("Evidence: m1-preview-deploy");
console.log(`Deploy URL: ${deployUrl}`);
console.log("Provider mutation: convex preview apply, vercel preview deploy");
console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/deploy-url.txt");
console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/deploy-output.txt");
console.log("Telemetry mutation: provider apply telemetry");

function runAgentstack(commandArgs, options = {}) {
  const result = spawnSync(process.execPath, ["scripts/agentstack.mjs", ...commandArgs], {
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) }
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return {
      code: 1,
      combined: `${stdout}${stderr}${result.error.message}\n`
    };
  }
  if (result.signal) {
    const message = `agentstack exited from signal ${result.signal}\n`;
    process.stderr.write(message);
    return {
      code: 1,
      combined: `${stdout}${stderr}${message}`
    };
  }

  return {
    code: result.status ?? 1,
    combined: `${stdout}${stderr}`
  };
}

async function readEnvFile(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }

  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    env[key] = value.replace(/^['"]|['"]$/g, "");
  }
  return env;
}

async function printFailure(stage, code, { convexStatus, vercelStatus }) {
  await removeStaleDeployUrl();
  await removeStaleSmokeOutput();
  await writeDeployOutput({
    result: "FAIL",
    failedStage: stage,
    convexStatus,
    vercelStatus,
    deployUrl: undefined
  });
  console.log("FAIL m1 preview deploy");
  console.log("Evidence: m1-preview-deploy");
  console.log(`Failed stage: ${stage}`);
  console.log("Provider mutation: partial or failed provider apply");
  console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/deploy-output.txt");
  console.log("Telemetry mutation: provider apply telemetry");
  process.exit(code);
}

async function writeDeployOutput({ result, failedStage, convexStatus, vercelStatus, deployUrl }) {
  const checkedAt = new Date().toISOString();
  const deployOutput = [
    "# M1 Preview Deploy Output",
    "",
    `Result: ${result}`,
    `Checked at: ${checkedAt}`,
    ...(failedStage ? [`Failed stage: ${failedStage}`] : []),
    `Convex apply: ${convexStatus}`,
    `Vercel apply: ${vercelStatus}`,
    `Deploy URL: ${deployUrl ?? "unavailable"}`,
    "",
    "Raw provider stdout, stderr, provider identifiers, tokens, and secrets are not stored in this evidence file.",
    ""
  ].join("\n");

  await mkdir(dirname(deployOutputPath), { recursive: true });
  await writeFile(deployOutputPath, deployOutput);
}

async function removeStaleDeployUrl() {
  await rm(deployUrlPath, { force: true });
}

async function removeStaleSmokeOutput() {
  await rm(smokeOutputPath, { force: true });
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

async function findMissingProviderLinks(expectedLinks) {
  const failures = [];
  let parsedProviderLinks;

  try {
    const providerLinks = await readFile(providerLinksPath, "utf8");
    parsedProviderLinks = JSON.parse(providerLinks);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      failures.push("missing .agentstack/provider-links.json from m1:providers:link");
    } else if (error instanceof SyntaxError) {
      failures.push(".agentstack/provider-links.json is not valid JSON");
    } else {
      throw error;
    }
  }

  const links = Array.isArray(parsedProviderLinks?.links) ? parsedProviderLinks.links : [];
  if (parsedProviderLinks && !Array.isArray(parsedProviderLinks.links)) {
    failures.push(".agentstack/provider-links.json is missing links array");
  }

  for (const expected of expectedLinks) {
    const link = links.find(
      (candidate) =>
        candidate.service === expected.service &&
        candidate.environment === "preview" &&
        candidate.resourceType === expected.resourceType &&
        candidate.name === expected.name
    );

    if (!link) {
      failures.push(`missing provider link for ${expected.label}`);
      continue;
    }

    if (link.ledgerStatus !== "active") {
      failures.push(`provider link ledger status is not active for ${expected.label}`);
    }
  }

  let providerLinksEvidence;
  try {
    providerLinksEvidence = await readFile(providerLinksEvidencePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      failures.push("missing provider-links.txt evidence from m1:providers:link");
    } else {
      throw error;
    }
  }

  if (providerLinksEvidence) {
    requireTopLevelProviderLinksResultPass(providerLinksEvidence, failures);

    for (const expected of expectedLinks) {
      if (!providerLinksEvidence.includes(expected.evidenceLine)) {
        failures.push(`provider-links.txt is missing ${expected.label}`);
      }
    }
  }

  return failures;
}

function requireTopLevelProviderLinksResultPass(output, failures) {
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith("Result:"));
  if (!line) {
    failures.push("provider-links.txt is missing top-level result");
    return;
  }

  if (line.slice("Result:".length).trim() !== "PASS") {
    failures.push("provider-links.txt top-level result is not PASS");
  }
}

function extractDeployUrl(output) {
  const match = output.match(/Deploy URL:\s*(https:\/\/[^\s"'<>]+)/) ?? output.match(/https:\/\/[^\s"'<>]+\.vercel\.app[^\s"'<>]*/);
  if (!match) {
    return undefined;
  }

  const candidate = match[1] ?? match[0];

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") {
      return undefined;
    }
    return candidate;
  } catch {
    return undefined;
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
    const value = rawArgs[index + 1];

    if (value && !value.startsWith("--")) {
      throw new Error(`Unexpected value for ${arg}: ${value}`);
    }

    if (key !== "confirm-live-mutation") {
      throw new Error(`Unexpected option: ${arg}`);
    }

    parsed[key] = true;
  }

  return parsed;
}

function printUsage() {
  console.log(
    [
      "Usage: pnpm run m1:preview:deploy -- --confirm-live-mutation",
      "",
      "Requires active M1 provider ledger rows, then runs the ledger-gated Convex preview apply and Vercel preview deploy apply.",
      "Writes redacted deploy evidence under docs/milestones/evidence/M1-preview-e2e/."
    ].join("\n")
  );
}
