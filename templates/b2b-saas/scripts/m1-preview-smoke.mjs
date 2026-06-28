#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

const deployUrl = requireValue(args.url, "--url");
const domFile = requireValue(args["dom-file"], "--dom-file");
const evidenceDir = args["evidence-dir"] ?? "docs/milestones/evidence/M1-preview-e2e";
const deployUrlPath = resolve(`${evidenceDir}/deploy-url.txt`);
const deployOutputPath = resolve(`${evidenceDir}/deploy-output.txt`);
const smokeOutputPath = resolve(`${evidenceDir}/smoke-output.txt`);
const resolvedDomFile = resolve(domFile);

const parsedUrl = parseDeployUrl(deployUrl);
await requireMatchingDeployEvidence(parsedUrl);
const dom = await readFile(resolvedDomFile, "utf8");
const authStates = getAttributeValues(dom, "data-agentstack-auth-state");
const protectedDataStates = getAttributeValues(dom, "data-agentstack-protected-data-state");
const workspaceIds = getAttributeValues(dom, "data-agentstack-protected-workspace-id").filter(
  (value) => value.trim().length > 0
);

const failures = [];

if (isVercelDeploymentProtection(dom)) {
  failures.push(
    "vercel deployment protection page detected; authenticate with Vercel, configure Protection Bypass for Automation, or disable protection for this preview before Clerk smoke"
  );
}

if (!authStates.includes("signed-in")) {
  failures.push("missing data-agentstack-auth-state=\"signed-in\"");
}

if (!protectedDataStates.includes("protected-data-loaded")) {
  failures.push("missing data-agentstack-protected-data-state=\"protected-data-loaded\"");
}

if (workspaceIds.length === 0) {
  failures.push("missing non-empty data-agentstack-protected-workspace-id");
}

if (failures.length > 0) {
  await writeSmokeOutput({
    result: "FAIL",
    deployUrl: parsedUrl.href,
    domFile,
    authStates,
    protectedDataStates,
    workspaceIds,
    failures
  });

  console.log("FAIL m1 preview smoke");
  console.log("Evidence: m1-preview-smoke");
  console.log(`Deploy URL: ${parsedUrl.href}`);
  for (const failure of failures) {
    console.log(`Reason: ${failure}`);
  }
  console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/smoke-output.txt");
  process.exitCode = 1;
} else {
  await mkdir(dirname(deployUrlPath), { recursive: true });
  await writeFile(deployUrlPath, `${parsedUrl.href}\n`);
  await writeSmokeOutput({
    result: "PASS",
    deployUrl: parsedUrl.href,
    domFile,
    authStates,
    protectedDataStates,
    workspaceIds,
    failures: []
  });

  console.log("PASS m1 preview smoke");
  console.log("Evidence: m1-preview-smoke");
  console.log(`Deploy URL: ${parsedUrl.href}`);
  console.log("Auth state: signed-in");
  console.log("Protected data state: protected-data-loaded");
  console.log("Workspace id: present (redacted)");
  console.log(`Local mutation: ${evidenceDir}/deploy-url.txt`);
  console.log(`Local mutation: ${evidenceDir}/smoke-output.txt`);
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

function parseDeployUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid --url: ${value}`);
  }

  if (url.protocol !== "https:") {
    throw new Error("--url must use https");
  }

  return url;
}

async function requireMatchingDeployEvidence(parsedUrl) {
  const failures = [];
  const deployUrlEvidence = await readEvidenceFile(deployUrlPath);
  const deployOutputEvidence = await readEvidenceFile(deployOutputPath);

  if (!deployUrlEvidence) {
    failures.push("missing deploy-url.txt from m1:preview:deploy");
  }

  if (!deployOutputEvidence) {
    failures.push("missing deploy-output.txt from m1:preview:deploy");
  }

  if (deployOutputEvidence) {
    requireTopLevelDeployResultPass(deployOutputEvidence, failures);
  }

  const deployUrlEvidenceValue = deployUrlEvidence?.trim();
  if (deployUrlEvidenceValue) {
    compareDeployUrlEvidence({
      actual: deployUrlEvidenceValue,
      expected: parsedUrl.href,
      label: "deploy-url.txt",
      failures
    });
  } else if (deployUrlEvidence) {
    failures.push("deploy-url.txt is empty");
  }

  const deployOutputUrl = deployOutputEvidence ? extractDeployOutputUrl(deployOutputEvidence) : "";
  if (deployOutputEvidence && !deployOutputUrl) {
    failures.push("deploy-output.txt is missing Deploy URL");
  } else if (deployOutputUrl) {
    compareDeployUrlEvidence({
      actual: deployOutputUrl,
      expected: parsedUrl.href,
      label: "deploy-output.txt Deploy URL",
      failures
    });
  }

  if (failures.length === 0) {
    return;
  }

  console.log("FAIL m1 preview smoke.deploy-evidence-required");
  console.log("Evidence: m1-preview-smoke");
  console.log(`Deploy URL: ${parsedUrl.href}`);
  for (const failure of failures) {
    console.log(`Reason: ${failure}`);
  }
  console.log("Provider mutation: none");
  console.log("Local mutation: none");
  console.log("Ledger mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

async function readEvidenceFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

function compareDeployUrlEvidence({ actual, expected, label, failures }) {
  let actualUrl;

  try {
    actualUrl = parseDeployUrl(actual);
  } catch {
    failures.push(`${label} is not a valid https URL`);
    return;
  }

  if (actualUrl.href !== expected) {
    failures.push(`${label} does not match --url`);
  }
}

function requireTopLevelDeployResultPass(output, failures) {
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith("Result:"));
  if (!line) {
    failures.push("deploy-output.txt is missing top-level result");
    return;
  }

  if (line.slice("Result:".length).trim() !== "PASS") {
    failures.push("deploy-output.txt top-level result is not PASS");
  }
}

function extractDeployOutputUrl(output) {
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith("Deploy URL:"));
  return line ? line.slice("Deploy URL:".length).trim() : "";
}

async function writeSmokeOutput({ result, deployUrl, authStates, protectedDataStates, workspaceIds, failures }) {
  const checkedAt = new Date().toISOString();
  const smokeOutput = [
    "# M1 Preview Smoke Output",
    "",
    `Result: ${result}`,
    `Checked at: ${checkedAt}`,
    `Deploy URL: ${deployUrl}`,
    `Auth state: ${authStates.includes("signed-in") ? "signed-in" : "missing signed-in"}`,
    `Protected data state: ${
      protectedDataStates.includes("protected-data-loaded")
        ? "protected-data-loaded"
        : "missing protected-data-loaded"
    }`,
    `Workspace id: ${workspaceIds.length > 0 ? "present (redacted)" : "missing"}`,
    "DOM snapshot source: local temporary file (redacted)",
    ...failures.map((failure) => `Reason: ${failure}`),
    "",
    "Raw DOM snapshots, provider identifiers, cookies, and tokens are not stored in this evidence file.",
    ""
  ].join("\n");

  await mkdir(dirname(smokeOutputPath), { recursive: true });
  await writeFile(smokeOutputPath, smokeOutput);
}

function getAttributeValues(markup, attributeName) {
  const escaped = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "g");
  const values = [];
  let match = pattern.exec(markup);

  while (match) {
    values.push(match[1] ?? match[2] ?? match[3] ?? "");
    match = pattern.exec(markup);
  }

  return values;
}

function isVercelDeploymentProtection(markup) {
  return (
    /<title>\s*Login\s+[–-]\s+Vercel\s*<\/title>/i.test(markup) ||
    (/Log in to Vercel/i.test(markup) && /Continue with (Email|GitHub|Google)/i.test(markup))
  );
}

function printUsage() {
  console.log(
    [
      "Usage: pnpm run m1:preview:smoke -- --url <https-url> --dom-file <path>",
      "",
      "Example:",
      "  pnpm run m1:preview:smoke -- --url https://app-git-m1.vercel.app --dom-file .agentstack/m1-preview-dom.html",
      "",
      "Requires matching PASS deploy evidence from pnpm run m1:preview:deploy -- --confirm-live-mutation.",
      "",
      "The DOM file should be a temporary post-sign-in snapshot and should not be committed."
    ].join("\n")
  );
}
