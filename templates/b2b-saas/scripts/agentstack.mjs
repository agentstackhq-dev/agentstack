#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const environments = ["development", "preview", "production"];
const surfaces = ["web", "mobile", "convex"];
const services = ["clerk", "convex", "vercel", "eas"];

const command = process.argv[2];
const subcommand = process.argv[3];

try {
  if (command === "validate") {
    process.exitCode = await validate(process.argv.slice(3));
  } else if (command === "init" && subcommand === "cloud") {
    process.exitCode = await initCloud();
  } else {
    console.log("FAIL cli.unknown-command");
    process.exitCode = 1;
  }
} catch (error) {
  console.log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function validate(args) {
  const manifest = await loadManifest();
  const diagnostics = validateManifest(manifest);

  for (const diagnostic of diagnostics) {
    console.log(formatDiagnostic(diagnostic));
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  if (args.includes("--cloud")) {
    const cloudDiagnostics = await validateCloud(manifest, "preview");
    for (const diagnostic of cloudDiagnostics) {
      console.log(formatDiagnostic(diagnostic));
    }
    return cloudDiagnostics.some((diagnostic) => diagnostic.severity === "fail") ? 1 : 0;
  }

  console.log("PASS validate");
  return 0;
}

async function initCloud() {
  const manifest = await loadManifest();

  for (const environment of ["development", "preview"]) {
    const changes = await syncCloud(manifest, environment);
    console.log(`APPLIED ${environment}`);
    for (const change of changes) {
      console.log(`- ${change}`);
    }
  }

  return 0;
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile("agentstack.config.json", "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error("FAIL manifest.missing\nagentstack.config.json was not found.");
    }
    throw error;
  }
}

function validateManifest(manifest) {
  const diagnostics = [];

  if (!manifest.app?.name) {
    diagnostics.push(fail("manifest.invalid", "app.name", "App name is required."));
  }
  if (!/^[a-z0-9-]+$/.test(manifest.app?.slug ?? "")) {
    diagnostics.push(fail("manifest.invalid", "app.slug", "App slug must use lowercase letters, numbers, and hyphens."));
  }
  for (const environment of manifest.environments ?? []) {
    if (!environments.includes(environment)) {
      diagnostics.push(fail("manifest.invalid", "environments", `Unsupported environment: ${environment}.`));
    }
  }
  for (const surface of manifest.surfaces ?? []) {
    if (!surfaces.includes(surface)) {
      diagnostics.push(fail("manifest.invalid", "surfaces", `Unsupported surface: ${surface}.`));
    }
  }
  for (const service of services) {
    if (typeof manifest.services?.[service]?.enabled !== "boolean") {
      diagnostics.push(fail("manifest.invalid", `services.${service}.enabled`, `${service} enabled state is required.`));
    }
  }
  if (!manifest.telemetry?.enabled) {
    diagnostics.push({
      severity: "warn",
      code: "telemetry.disabled",
      message: "Telemetry is disabled, so journey inspection will not be available.",
      fix: "Set telemetry.enabled to true in agentstack.config.json."
    });
  }
  if (!manifest.telemetry?.redaction?.forbidRawSecrets) {
    diagnostics.push(fail(
      "telemetry.redaction.disabled",
      "telemetry.redaction.forbidRawSecrets",
      "Telemetry redaction must forbid raw secrets.",
      "Set telemetry.redaction.forbidRawSecrets to true."
    ));
  }

  return diagnostics;
}

async function validateCloud(manifest, environment) {
  const state = await readCloudState();
  const diagnostics = [];

  for (const service of services.filter((candidate) => manifest.services?.[candidate]?.enabled)) {
    const linked = state.services.some(
      (candidate) => candidate.environment === environment && candidate.service === service && candidate.linked
    );
    if (!linked) {
      diagnostics.push(fail(
        "cloud.service.missing",
        `${environment}.${service}`,
        `${service} is not linked in ${environment}.`,
        `Run pnpm run init:cloud.`
      ));
    }
  }

  return diagnostics;
}

async function syncCloud(manifest, environment) {
  const state = await readCloudState();
  const changes = [];

  for (const service of services.filter((candidate) => manifest.services?.[candidate]?.enabled)) {
    const index = state.services.findIndex(
      (candidate) => candidate.environment === environment && candidate.service === service
    );

    if (index === -1) {
      changes.push(`link ${environment}.${service}`);
      state.services.push({ environment, service, linked: true, env: {} });
    } else if (!state.services[index].linked) {
      changes.push(`link ${environment}.${service}`);
      state.services[index].linked = true;
    }
  }

  await writeCloudState(state);
  return changes;
}

async function readCloudState() {
  try {
    return JSON.parse(await readFile(cloudStatePath(), "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { services: [] };
    }
    throw error;
  }
}

async function writeCloudState(state) {
  await mkdir(".agentstack", { recursive: true });
  await writeFile(cloudStatePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function cloudStatePath() {
  return join(".agentstack", "local-cloud.json");
}

function fail(code, path, message, fix = "Update agentstack.config.json.") {
  return { severity: "fail", code, path, message, fix };
}

function formatDiagnostic(diagnostic) {
  return `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${diagnostic.path ? ` ${diagnostic.path}` : ""}: ${diagnostic.message}\nFix: ${diagnostic.fix}`;
}
