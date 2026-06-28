#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const appSlug = "__APP_SLUG__";
const evidenceDir = "docs/milestones/evidence/M1-preview-e2e";
const runbookPlaceholders = [
  "[redacted owner or account label]",
  "[operator name]",
  "[yyyy-mm-dd]",
  "[redacted login or project-selection note, or none]",
  "[not run | pass | fail]",
  "[redacted notes or blocker]",
  "[pass | fail | unchanged]",
  "[next action or blocker]"
];
const requiredRunbookSteps = [
  "Preview Provider Plans",
  "Bootstrap Preview Providers",
  "Link Local Provider State",
  "Deploy Preview",
  "Deployed Auth And Data Smoke",
  "Evidence Bundle Check"
];
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

if (Object.keys(args).length > 0) {
  printUsage();
  throw new Error("m1:evidence:check does not accept options.");
}

const failures = [];
const ledger = await readText("docs/provider-resource-ledger.md", "provider ledger");

if (ledger) {
  await checkLedgerRow({
    ledger,
    id: "clerk-preview-application",
    service: "clerk",
    resourceType: "application",
    environment: "preview",
    name: `${appSlug}-preview`,
    evidencePrefix: "provider-ledger-clerk-"
  });
  await checkLedgerRow({
    ledger,
    id: "convex-preview-deployment",
    service: "convex",
    resourceType: "deployment",
    environment: "preview",
    name: `${appSlug}-preview`,
    evidencePrefix: "provider-ledger-convex-"
  });
  await checkLedgerRow({
    ledger,
    id: "vercel-preview-project",
    service: "vercel",
    resourceType: "project",
    environment: "preview",
    name: appSlug,
    evidencePrefix: "provider-ledger-vercel-"
  });
}

const deployUrl = await readText(`${evidenceDir}/deploy-url.txt`, "deploy URL evidence");
const providerBootstrap = await readText(`${evidenceDir}/provider-bootstrap.txt`, "provider bootstrap evidence");
const providerLinks = await readText(`${evidenceDir}/provider-links.txt`, "provider link evidence");
const providerLinksState = await readOptionalText(".agentstack/provider-links.json");
const deployOutput = await readText(`${evidenceDir}/deploy-output.txt`, "deploy output evidence");
const smokeOutput = await readText(`${evidenceDir}/smoke-output.txt`, "smoke output evidence");
const runbook = await readText(`${evidenceDir}/runbook.md`, "runbook");

if (deployUrl && !isHttpsUrl(deployUrl.trim())) {
  failures.push("deploy URL evidence is not a valid https URL");
}

const normalizedDeployUrl = deployUrl ? normalizeHttpsUrl(deployUrl.trim()) : undefined;

if (providerBootstrap) {
  requireTopLevelResultPass(providerBootstrap, "provider bootstrap evidence");
  requireContains(
    providerBootstrap,
    "Clerk preview application:",
    "provider bootstrap evidence is missing Clerk bootstrap status"
  );
  requireContains(
    providerBootstrap,
    "Convex preview deployment:",
    "provider bootstrap evidence is missing Convex bootstrap status"
  );
  requireContains(
    providerBootstrap,
    "Vercel preview project:",
    "provider bootstrap evidence is missing Vercel bootstrap status"
  );
  requireContains(
    providerBootstrap,
    "Provider mutation: clerk app/link, convex preview deployment/deploy-key/env, vercel project/link/env",
    "provider bootstrap evidence mutation boundary is missing"
  );
}

if (providerLinks) {
  requireTopLevelResultPass(providerLinks, "provider link evidence");
  requireContains(providerLinks, "Clerk preview application: linked", "provider link evidence is missing Clerk link");
  requireContains(providerLinks, "Convex preview deployment: linked", "provider link evidence is missing Convex link");
  requireContains(providerLinks, "Vercel preview project: linked", "provider link evidence is missing Vercel link");
  requireContains(
    providerLinks,
    "Provider mutation: none",
    "provider link evidence mutation boundary is missing"
  );
  requireContains(providerLinks, "Ledger mutation: none", "provider link evidence ledger boundary is missing");
}

checkProviderLinksState(providerLinksState);

if (deployOutput) {
  requireTopLevelResultPass(deployOutput, "deploy output");
  requireContains(deployOutput, "Convex apply: completed", "deploy output is missing Convex apply completion");
  requireContains(deployOutput, "Vercel apply: completed", "deploy output is missing Vercel apply completion");
  requireContains(deployOutput, "Deploy URL:", "deploy output is missing deploy URL summary");
  requireMatchingDeployUrl({
    value: extractDeployUrl(deployOutput),
    normalizedDeployUrl,
    missingMessage: "deploy output is missing deploy URL summary",
    invalidMessage: "deploy output deploy URL is not a valid https URL",
    mismatchMessage: "deploy output deploy URL does not match deploy URL evidence"
  });
}

if (smokeOutput) {
  requireTopLevelResultPass(smokeOutput, "smoke output");
  requireContains(smokeOutput, "Deploy URL:", "smoke output is missing deploy URL summary");
  requireMatchingDeployUrl({
    value: extractDeployUrl(smokeOutput),
    normalizedDeployUrl,
    missingMessage: "smoke output is missing deploy URL summary",
    invalidMessage: "smoke output deploy URL is not a valid https URL",
    mismatchMessage: "smoke output deploy URL does not match deploy URL evidence"
  });
  requireContains(smokeOutput, "Auth state: signed-in", "smoke output is missing signed-in auth evidence");
  requireContains(
    smokeOutput,
    "Protected data state: protected-data-loaded",
    "smoke output is missing protected data evidence"
  );
  requireContains(smokeOutput, "Workspace id: present (redacted)", "smoke output is missing redacted workspace id evidence");
}

if (deployOutput && smokeOutput) {
  requireEvidenceTimestampOrder(deployOutput, smokeOutput);
}

if (runbook) {
  if (/^Status:\s*not run\s*$/im.test(runbook)) {
    failures.push("runbook not marked run");
  }
  for (const placeholder of runbookPlaceholders) {
    if (runbook.includes(placeholder)) {
      failures.push(`runbook contains unresolved placeholder: ${placeholder}`);
    }
  }
  checkRunbookResults(runbook);
  requireContains(
    runbook,
    "pnpm run m1:providers:bootstrap -- --confirm-live-mutation",
    "runbook is missing provider bootstrap command"
  );
  requireContains(runbook, "pnpm run m1:providers:link", "runbook is missing provider-link command");
  requireContains(
    runbook,
    "pnpm run m1:preview:deploy -- --confirm-live-mutation",
    "runbook is missing deploy command"
  );
  requireContains(runbook, "pnpm run m1:preview:smoke", "runbook is missing smoke command");
}

if (failures.length > 0) {
  console.log("FAIL m1 evidence check");
  console.log("Evidence: m1-evidence-check");
  for (const failure of failures) {
    console.log(`Reason: ${failure}`);
  }
  console.log("Provider mutation: none");
  console.log("Local mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

console.log("PASS m1 evidence check");
console.log("Evidence: m1-evidence-check");
console.log("Checked: provider ledger rows");
console.log("Checked: provider bootstrap evidence");
console.log("Checked: provider link evidence");
console.log("Checked: deploy evidence");
console.log("Checked: smoke evidence");
console.log("Checked: runbook");
console.log("Provider mutation: none");
console.log("Local mutation: none");
console.log("Telemetry mutation: none");

async function checkLedgerRow({ ledger, id, service, resourceType, environment, name, evidencePrefix }) {
  const line = ledger
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith("|") && candidate.includes(`| ${id} |`));

  if (!line) {
    failures.push(`missing provider ledger row for ${service} ${environment} ${resourceType}`);
    return;
  }

  const cells = line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

  const provider = cells[1];
  const rowResourceType = cells[2];
  const rowEnvironment = cells[3];
  const rowName = cells[5];
  const externalId = cells[6];
  const status = cells[11];
  const evidencePath = cells[14];

  if (provider !== service || rowResourceType !== resourceType || rowEnvironment !== environment || rowName !== name) {
    failures.push(`provider ledger row mismatch for ${service} ${environment} ${resourceType}`);
  }
  if (!externalId || externalId === "pending") {
    failures.push(`provider ledger external id is not recorded for ${service} ${environment} ${resourceType}`);
  }
  if (status !== "active") {
    failures.push(`provider ledger status is not active for ${service} ${environment} ${resourceType}`);
  }
  if (!evidencePath || !evidencePath.startsWith(`${evidenceDir}/${evidencePrefix}`)) {
    failures.push(`provider ledger evidence path is missing for ${service} ${environment} ${resourceType}`);
    return;
  }

  const evidence = await readText(evidencePath, `${service} ledger evidence`);
  if (evidence) {
    requireContains(evidence, "External id/url: recorded in provider ledger (redacted)", `${service} ledger evidence is not redacted`);
    requireContains(evidence, "Provider mutation: none", `${service} ledger evidence mutation boundary is missing`);
  }
}

async function readText(path, label) {
  try {
    return await readFile(path, "utf8");
  } catch {
    failures.push(`missing ${label}`);
    return undefined;
  }
}

async function readOptionalText(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function requireContains(value, required, message) {
  if (!value.includes(required)) {
    failures.push(message);
  }
}

function requireTopLevelResultPass(value, label) {
  const line = value.split(/\r?\n/).find((entry) => entry.startsWith("Result:"));
  if (!line) {
    failures.push(`${label} is missing top-level result`);
    return;
  }

  if (line.slice("Result:".length).trim() !== "PASS") {
    failures.push(`${label} top-level result is not PASS`);
  }
}

function checkRunbookResults(runbook) {
  const finalCheckboxes = new Set();
  const stepResults = new Set();
  let currentStep;

  for (const line of runbook.split(/\r?\n/)) {
    const stepHeading = line.match(/^### \d+\. (.+)\s*$/);
    if (stepHeading) {
      currentStep = stepHeading[1];
      continue;
    }

    if (/^## Final M1 Checkbox Review\s*$/.test(line)) {
      currentStep = undefined;
      continue;
    }

    const stepResult = line.match(/^Result:\s*(.+)\s*$/i);
    if (stepResult && currentStep && requiredRunbookSteps.includes(currentStep)) {
      stepResults.add(currentStep);
      if (normalizeRunbookValue(stepResult[1]).toLowerCase() !== "pass") {
        failures.push("runbook contains failed step result");
      }
    }

    const checkboxResult = line.match(/^- (Ledger|Connect|Deploy|Auth|Data|Evidence):\s*(.+)\s*$/i);
    if (checkboxResult) {
      finalCheckboxes.add(checkboxResult[1].toLowerCase());
      if (normalizeRunbookValue(checkboxResult[2]).toLowerCase() !== "pass") {
        failures.push(`runbook final ${checkboxResult[1]} checkbox is not pass`);
      }
    }
  }

  for (const required of requiredRunbookSteps) {
    if (!stepResults.has(required)) {
      failures.push(`runbook step ${required} result is missing`);
    }
  }

  for (const required of ["Ledger", "Connect", "Deploy", "Auth", "Data", "Evidence"]) {
    if (!finalCheckboxes.has(required.toLowerCase())) {
      failures.push(`runbook final ${required} checkbox is missing`);
    }
  }
}

function normalizeRunbookValue(value) {
  return value.trim().replace(/^`|`$/g, "");
}

function checkProviderLinksState(providerLinksState) {
  if (!providerLinksState) {
    failures.push("missing .agentstack/provider-links.json from m1:providers:link");
    return;
  }

  let parsedProviderLinks;
  try {
    parsedProviderLinks = JSON.parse(providerLinksState);
  } catch {
    failures.push(".agentstack/provider-links.json is not valid JSON");
    return;
  }

  const links = Array.isArray(parsedProviderLinks.links) ? parsedProviderLinks.links : [];
  if (!Array.isArray(parsedProviderLinks.links)) {
    failures.push(".agentstack/provider-links.json is missing links array");
    return;
  }

  for (const expected of [
    {
      service: "clerk",
      environment: "preview",
      resourceType: "application",
      name: `${appSlug}-preview`,
      label: "clerk preview application"
    },
    {
      service: "convex",
      environment: "preview",
      resourceType: "deployment",
      name: `${appSlug}-preview`,
      label: "convex preview deployment"
    },
    {
      service: "vercel",
      environment: "preview",
      resourceType: "project",
      name: appSlug,
      label: "vercel preview project"
    }
  ]) {
    const link = links.find(
      (candidate) =>
        candidate.service === expected.service &&
        candidate.environment === expected.environment &&
        candidate.resourceType === expected.resourceType &&
        candidate.name === expected.name
    );

    if (!link) {
      failures.push(`missing provider link state for ${expected.label}`);
      continue;
    }

    if (link.ledgerStatus !== "active") {
      failures.push(`provider link state ledger status is not active for ${expected.label}`);
    }
  }
}

function isHttpsUrl(value) {
  return normalizeHttpsUrl(value) !== undefined;
}

function normalizeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function extractDeployUrl(value) {
  const line = value.split(/\r?\n/).find((entry) => entry.startsWith("Deploy URL:"));
  return line ? line.slice("Deploy URL:".length).trim() : "";
}

function requireMatchingDeployUrl({ value, normalizedDeployUrl, missingMessage, invalidMessage, mismatchMessage }) {
  if (!value) {
    failures.push(missingMessage);
    return;
  }

  const normalizedValue = normalizeHttpsUrl(value);
  if (!normalizedValue) {
    failures.push(invalidMessage);
    return;
  }

  if (normalizedDeployUrl && normalizedValue !== normalizedDeployUrl) {
    failures.push(mismatchMessage);
  }
}

function requireEvidenceTimestampOrder(deployOutput, smokeOutput) {
  const deployCheckedAt = parseCheckedAt(deployOutput, "deploy output");
  const smokeCheckedAt = parseCheckedAt(smokeOutput, "smoke output");

  if (deployCheckedAt !== undefined && smokeCheckedAt !== undefined && smokeCheckedAt < deployCheckedAt) {
    failures.push("smoke output checked timestamp is older than deploy output");
  }
}

function parseCheckedAt(value, label) {
  const line = value.split(/\r?\n/).find((entry) => entry.startsWith("Checked at:"));
  if (!line) {
    failures.push(`${label} is missing checked timestamp`);
    return undefined;
  }

  const parsed = Date.parse(line.slice("Checked at:".length).trim());
  if (Number.isNaN(parsed)) {
    failures.push(`${label} checked timestamp is invalid`);
    return undefined;
  }

  return parsed;
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
      "Usage: pnpm run m1:evidence:check",
      "",
      "Checks the local redacted M1 evidence bundle.",
      "Does not call provider CLIs, mutate provider resources, write local state, or append telemetry."
    ].join("\n")
  );
}
