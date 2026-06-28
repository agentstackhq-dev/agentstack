#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const appSlug = "__APP_SLUG__";
const evidenceDir = "docs/milestones/evidence/M1-preview-e2e";
const bootstrapEvidencePath = resolve(`${evidenceDir}/provider-bootstrap.txt`);
const convexEnvPath = ".agentstack/convex-preview.env";
const runStamp = process.env.AGENTSTACK_M1_RUN_STAMP ?? new Date().toISOString().replace(/[:.]/g, "-");
const createdAt = process.env.AGENTSTACK_M1_CREATED_AT ?? new Date().toISOString().slice(0, 10);
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

if (!args["confirm-live-mutation"]) {
  console.log("FAIL m1 providers bootstrap.confirmation-required");
  console.log("Evidence: m1-provider-bootstrap");
  console.log("Provider mutation: none");
  console.log("Ledger mutation: none");
  console.log("Local mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

const createdBy = readOptionalString(args["created-by"]) ?? detectCreatedBy();
const resources = [];
const notes = [];

try {
  const clerk = await bootstrapClerk();
  resources.push(clerk);

  const convex = await bootstrapConvex(clerk);
  resources.push(convex);

  const vercel = await bootstrapVercel({ clerk, convex });
  resources.push(vercel);

  await writeBootstrapEvidence("PASS", resources, notes);
  console.log("PASS m1 providers bootstrap");
  console.log("Evidence: m1-provider-bootstrap");
  console.log("Bootstrapped: clerk preview application");
  console.log("Bootstrapped: convex preview deployment");
  console.log("Bootstrapped: vercel preview project");
  console.log("Provider mutation: clerk app/link, convex preview deployment/deploy-key/env, vercel project/link/env");
  console.log("Ledger mutation: docs/provider-resource-ledger.md");
  console.log("Local mutation: .vercel, .agentstack/convex-preview.env");
  console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/provider-bootstrap.txt");
  console.log("Telemetry mutation: provider ledger telemetry only");
} catch (error) {
  await writeBootstrapEvidence("FAIL", resources, [
    ...notes,
    `Blocker: ${redact(String(error instanceof Error ? error.message : error))}`
  ]);
  console.log("FAIL m1 providers bootstrap");
  console.log("Evidence: m1-provider-bootstrap");
  console.log(`Reason: ${redact(String(error instanceof Error ? error.message : error))}`);
  if (resources.length > 0) {
    console.log(`Ledgered before failure: ${resources.map((resource) => resource.service).join(", ")}`);
  }
  console.log("Provider mutation: partial or failed provider bootstrap");
  console.log("Ledger mutation: planned/active rows recorded for resources reached before failure");
  console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/provider-bootstrap.txt");
  console.log("Telemetry mutation: provider ledger telemetry only");
  process.exit(1);
}

async function bootstrapClerk() {
  const whoami = runProvider(["clerk", "whoami", "--json"], {
    authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
  });
  const owner = parseJson(whoami.stdout, "clerk whoami").email ?? "clerk-authenticated-user";
  const expectedName = `${appSlug}-preview`;
  let apps = listClerkApps();
  let app = apps.find((candidate) => candidate.name === expectedName);
  const baseResource = {
    service: "clerk",
    resourceType: "application",
    name: expectedName,
    owner,
    purpose: "M1 preview Clerk auth smoke",
    cleanup: "delete through Clerk dashboard"
  };

  if (!app) {
    await ensurePlannedLedgerRow(baseResource);
    notes.push("Clerk preview application: creating");
    runProvider(["clerk", "apps", "create", expectedName, "--json"], {
      authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
    });
    apps = listClerkApps();
    app = apps.find((candidate) => candidate.name === expectedName);
  } else {
    notes.push("Clerk preview application: reusing exact-name application");
  }

  if (!app?.id) {
    throw new Error("Clerk bootstrap could not discover the preview application id after create/list.");
  }

  const clerkPublishableKey = app.publishableKey;
  const clerkIssuerDomain = clerkIssuerDomainFromPublishableKey(clerkPublishableKey);
  if (!clerkPublishableKey || !clerkIssuerDomain) {
    throw new Error("Clerk bootstrap could not derive publishable key and issuer domain from the preview application.");
  }

  const resource = {
    ...activeResource(baseResource, app.id, "created or reused and linked"),
    clerkPublishableKey,
    clerkIssuerDomain
  };
  await recordActiveLedgerRow(resource);

  runProvider(["clerk", "link", "--app", app.id], {
    authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
  });

  await ensureClerkConvexJwtTemplate(owner);

  return resource;
}

async function ensureClerkConvexJwtTemplate(owner) {
  const baseResource = {
    service: "clerk",
    resourceType: "jwt-template",
    name: "convex",
    owner,
    purpose: "M1 preview Clerk JWT template for Convex auth",
    cleanup: "delete through Clerk dashboard",
    evidenceStem: "clerk-jwt-template"
  };
  let templates = listClerkJwtTemplates();
  let template = templates.find((candidate) => candidate.name === "convex");

  if (!template) {
    await ensurePlannedLedgerRow(baseResource);
    notes.push("Clerk JWT template: creating convex");
    const create = runProvider(
      ["clerk", "api", "/jwt_templates", "--data", JSON.stringify({ name: "convex", claims: { aud: "convex" } }), "--yes"],
      {
        authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
      }
    );
    template = normalizeClerkJwtTemplate(parseJson(create.stdout, "clerk jwt template create"));

    if (!template?.id) {
      templates = listClerkJwtTemplates();
      template = templates.find((candidate) => candidate.name === "convex");
    }
  } else {
    notes.push("Clerk JWT template: reusing convex");
  }

  if (!template?.id) {
    throw new Error("Clerk bootstrap could not discover the convex JWT template id after create/list.");
  }

  await recordActiveLedgerRow(activeResource(baseResource, template.id, "created or reused for Convex auth"));
  notes.push("Clerk JWT template: created or reused for Convex auth");
}

function listClerkJwtTemplates() {
  const result = runProvider(["clerk", "api", "/jwt_templates"], {
    authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
  });
  const parsed = parseJson(result.stdout, "clerk jwt templates list");
  const rawTemplates = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];

  return rawTemplates.map(normalizeClerkJwtTemplate).filter((template) => template.id && template.name);
}

function normalizeClerkJwtTemplate(entry) {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }

  return {
    id: firstString(entry.id, entry.template_id, entry.jwt_template_id),
    name: firstString(entry.name, entry.slug)
  };
}

function listClerkApps() {
  const result = runProvider(["clerk", "apps", "list", "--json"], {
    authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
  });
  const parsed = parseJson(result.stdout, "clerk apps list");
  const rawApps = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];

  return rawApps
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: firstString(entry.application_id, entry.id, entry.resource_id),
      name: firstString(entry.name, entry.slug, entry.display_name),
      publishableKey: firstString(
        ...(Array.isArray(entry.instances)
          ? entry.instances.map((instance) =>
              firstString(instance?.publishable_key, instance?.publishableKey)
            )
          : []),
        entry.publishable_key,
        entry.publishableKey
      )
    }))
    .filter((entry) => entry.id && entry.name);
}

async function bootstrapConvex(clerk) {
  const reference = `${appSlug}-preview`;
  const tokenName = `agentstack-m1-preview-${runStamp}`;
  const baseResource = {
    service: "convex",
    resourceType: "deployment",
    name: reference,
    owner: "convex-selected-project",
    purpose: "M1 preview protected Convex data smoke",
    cleanup: "delete through Convex dashboard"
  };
  await ensurePlannedLedgerRow(baseResource);

  const create = runProvider(
    ["convex", "deployment", "create", reference, "--type", "preview", "--expiration", "in 5 days"],
    {
      allowFailure: true
    }
  );

  if (create.code !== 0 && !/already exists|already.*deployment/i.test(`${create.stdout}\n${create.stderr}`)) {
    throw new Error(
      [
        "Convex preview deployment bootstrap needs an authenticated Convex project context.",
        "Run `pnpm exec convex dev --once --configure new` or select an existing project with `pnpm exec convex dev --once --configure existing`, then rerun the M1 bootstrap command."
      ].join(" ")
    );
  }

  if (create.code === 0) {
    notes.push("Convex preview deployment: created");
  } else {
    notes.push("Convex preview deployment: reusing existing reference");
  }
  const deploymentReference =
    parseConvexDeploymentReference(`${create.stdout}\n${create.stderr}`) ??
    (await readConvexProjectDeploymentReference(reference)) ??
    reference;
  const convexUrl = parseConvexUrl(`${create.stdout}\n${create.stderr}`);

  const resource = activeResource(
    {
      ...baseResource,
      owner: parseConvexOwner(deploymentReference) ?? parseConvexOwner(`${create.stdout}\n${create.stderr}`) ?? baseResource.owner
    },
    deploymentReference,
    `preview deployment ensured; deploy key saved to ${convexEnvPath}`
  );
  await recordActiveLedgerRow(resource);
  runProvider(
    [
      "convex",
      "env",
      "--deployment",
      deploymentReference,
      "set",
      "CLERK_JWT_ISSUER_DOMAIN",
      clerk.clerkIssuerDomain
    ],
    {
      authHint:
        "Run `pnpm exec convex dev --once --configure new` or log in with Convex, then rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
    }
  );
  notes.push("Convex preview env: Clerk issuer configured");
  await mkdir(dirname(convexEnvPath), { recursive: true });

  const token = runProvider(
    ["convex", "deployment", "token", "create", tokenName, "--deployment", deploymentReference, "--save-env", convexEnvPath],
    {
      authHint:
        "Run `pnpm exec convex dev --once --configure new` or log in with Convex, then rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
    }
  );
  if (token.code !== 0) {
    throw new Error("Convex deploy-key bootstrap failed.");
  }

  return {
    ...resource,
    convexUrl
  };
}

async function bootstrapVercel({ clerk, convex }) {
  const whoami = runProvider(["vercel", "whoami"], {
    authHint: "Run `pnpm exec vercel login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
  });
  const account = parseLastNonCliLine(whoami.stdout) ?? "vercel-authenticated-user";
  const projectName = appSlug;
  const projects = listVercelProjects();
  const existing = projects.find((project) => project.name === projectName);
  const baseResource = {
    service: "vercel",
    resourceType: "project",
    name: projectName,
    owner: existing?.owner ?? account,
    purpose: "M1 preview Vercel deploy smoke",
    cleanup: "delete through Vercel dashboard"
  };

  if (!existing) {
    await ensurePlannedLedgerRow(baseResource);
    notes.push("Vercel preview project: creating");
    const add = runProvider(["vercel", "project", "add", projectName], {
      allowFailure: true
    });
    if (add.code !== 0 && !/already exists|conflict/i.test(`${add.stdout}\n${add.stderr}`)) {
      throw new Error("Vercel project creation failed. Run `pnpm exec vercel login` if the CLI is not authenticated.");
    }
  } else {
    notes.push("Vercel preview project: reusing exact-name project");
  }

  runProvider(["vercel", "link", "--yes", "--project", projectName], {
    authHint: "Run `pnpm exec vercel login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
  });

  const projectLink = parseJson(await readFile(".vercel/project.json", "utf8"), ".vercel/project.json");
  const projectId = firstString(projectLink.projectId, projectLink.project_id);
  const owner = firstString(projectLink.orgId, projectLink.org_id) ?? account;
  if (!projectId) {
    throw new Error("Vercel bootstrap linked the project but .vercel/project.json does not contain a projectId.");
  }

  const resource = activeResource({ ...baseResource, owner }, projectId, "project ensured and linked");
  await recordActiveLedgerRow(resource);
  setVercelPreviewEnv("VITE_CLERK_PUBLISHABLE_KEY", clerk.clerkPublishableKey);
  if (convex.convexUrl) {
    setVercelPreviewEnv("VITE_CONVEX_URL", convex.convexUrl);
  } else {
    notes.push("Vercel preview env: Convex URL not set because bootstrap could not parse it from Convex output");
  }
  notes.push("Vercel preview env: web runtime configured");
  return resource;
}

function setVercelPreviewEnv(name, value) {
  if (!value) {
    throw new Error(`Cannot configure Vercel preview env ${name}; value is missing.`);
  }
  runProvider(["vercel", "env", "rm", name, "preview", "--yes"], {
    allowFailure: true
  });
  runProvider(["vercel", "env", "add", name, "preview"], {
    input: `${value}\n`,
    authHint: "Run `pnpm exec vercel login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
  });
}

function listVercelProjects() {
  const result = runProvider(["vercel", "project", "ls", "--json"], {
    authHint: "Run `pnpm exec vercel login` and rerun `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`."
  });
  const parsed = parseJson(result.stdout.replace(/^Vercel CLI .*\n/, ""), "vercel project ls");
  const rawProjects = Array.isArray(parsed) ? parsed : Array.isArray(parsed.projects) ? parsed.projects : [];
  return rawProjects
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: firstString(entry.id, entry.projectId, entry.project_id),
      name: firstString(entry.name),
      owner: firstString(entry.accountId, entry.account_id, entry.ownerId, entry.owner_id, entry.orgId, entry.org_id)
    }))
    .filter((entry) => entry.id && entry.name);
}

function activeResource(baseResource, externalId, mutation) {
  return {
    ...baseResource,
    externalId,
    evidence: `${evidenceDir}/provider-ledger-${baseResource.evidenceStem ?? baseResource.service}-${createdAt}-${runStamp}.md`,
    mutation
  };
}

function plannedResource(baseResource) {
  return {
    ...baseResource,
    externalId: "pending",
    evidence: `${evidenceDir}/provider-ledger-${baseResource.evidenceStem ?? baseResource.service}-${createdAt}-${runStamp}-planned.md`,
    mutation: "planned before provider mutation"
  };
}

async function ensurePlannedLedgerRow(baseResource) {
  const existing = await readExistingLedgerRow(baseResource);
  if (existing?.status === "active" && existing.externalId && existing.externalId !== "pending") {
    return;
  }
  await recordProviderLedgerRow(plannedResource(baseResource), "planned");
}

async function recordActiveLedgerRow(resource) {
  await recordProviderLedgerRow(resource, "active");
}

async function recordProviderLedgerRow(resource, status) {
  const existing = await readExistingLedgerRow(resource);
  if (
    status === "active" &&
    existing &&
    existing.status === "active" &&
    existing.externalId &&
    existing.externalId !== "pending" &&
    existing.externalId !== resource.externalId
  ) {
    throw new Error(`Active ${resource.service} ledger row already points at a different provider resource.`);
  }

  const code = runAgentstack([
    "provider",
    "ledger",
    "record",
    ...(existing ? ["--replace"] : []),
    "--service",
    resource.service,
    "--env",
    "preview",
    "--resource-type",
    resource.resourceType,
    "--name",
    resource.name,
    "--external-id",
    resource.externalId,
    "--owner",
    resource.owner,
    "--purpose",
    resource.purpose,
    "--created-by",
    createdBy,
    "--created-at",
    createdAt,
    "--cleanup-trigger",
    "M1 pass or pivot",
    "--cleanup",
    resource.cleanup,
    "--evidence",
    resource.evidence,
    "--notes",
    `recorded by m1:providers:bootstrap (${status})`,
    "--status",
    status,
    "--write-evidence"
  ]);

  if (code !== 0) {
    throw new Error(`Failed to record active ${resource.service} provider ledger row.`);
  }
}

async function readExistingLedgerRow(resource) {
  let ledger;
  try {
    ledger = await readFile("docs/provider-resource-ledger.md", "utf8");
  } catch {
    return undefined;
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
  const row = rows.find(
    (cells) =>
      cells[1] === resource.service &&
      cells[2] === resource.resourceType &&
      cells[3] === "preview" &&
      cells[5] === resource.name
  );

  return row ? { externalId: row[6], status: row[11] } : undefined;
}

function runAgentstack(commandArgs) {
  const result = spawnSync(process.execPath, ["scripts/agentstack.mjs", ...commandArgs], {
    encoding: "utf8",
    env: process.env
  });

  if (result.stdout) {
    process.stdout.write(redact(result.stdout));
  }
  if (result.stderr) {
    process.stderr.write(redact(result.stderr));
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

function runProvider(args, { allowFailure = false, authHint, input } = {}) {
  const result = spawnSync("pnpm", ["exec", ...args], {
    encoding: "utf8",
    env: process.env,
    input
  });
  const code = result.status ?? (result.error ? 1 : 0);
  const output = {
    code,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };

  if (result.error) {
    output.stderr = `${output.stderr}\n${result.error.message}`.trim();
  }
  if (result.signal) {
    output.stderr = `${output.stderr}\nprovider command exited from signal ${result.signal}`.trim();
  }
  if (code !== 0 && !allowFailure) {
    const hint = authHint ? ` ${authHint}` : "";
    const detail = redact(output.stderr.trim() || output.stdout.trim())
      .split(/\r?\n/)
      .slice(0, 3)
      .join(" ");
    throw new Error(`Provider command failed: pnpm exec ${args.join(" ")}.${detail ? ` ${detail}.` : ""}${hint}`);
  }

  return output;
}

async function writeBootstrapEvidence(result, ledgeredResources, extraNotes) {
  const checkedAt = new Date().toISOString();
  const lines = [
    "# M1 Provider Bootstrap Evidence",
    "",
    `Result: ${result}`,
    `Checked at: ${checkedAt}`,
    `Clerk preview application: ${statusFor(ledgeredResources, "clerk")}`,
    `Convex preview deployment: ${statusFor(ledgeredResources, "convex")}`,
    `Vercel preview project: ${statusFor(ledgeredResources, "vercel")}`,
    "Provider mutation: clerk app/link, convex preview deployment/deploy-key/env, vercel project/link/env",
    "Ledger mutation: docs/provider-resource-ledger.md",
    "Local mutation: .vercel, .agentstack/convex-preview.env",
    "Telemetry mutation: provider ledger telemetry only",
    "",
    "Notes:",
    ...extraNotes.map((note) => `- ${redact(note)}`),
    "",
    "Raw provider stdout, provider identifiers, tokens, secrets, deploy keys, cookies, and sessions are not stored in this evidence file.",
    ""
  ];

  await mkdir(dirname(bootstrapEvidencePath), { recursive: true });
  await writeFile(bootstrapEvidencePath, lines.join("\n"));
}

function statusFor(resources, service) {
  const resource = resources.find((candidate) => candidate.service === service);
  return resource ? resource.mutation : "not completed";
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
    if (key === "confirm-live-mutation") {
      parsed[key] = true;
      continue;
    }
    if (key !== "created-by") {
      throw new Error(`Unexpected option: ${arg}`);
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

function parseJson(value, label) {
  const trimmed = value.trim();
  const jsonStart = Math.min(
    ...[trimmed.indexOf("{"), trimmed.indexOf("[")].filter((index) => index >= 0)
  );
  const candidate = Number.isFinite(jsonStart) ? trimmed.slice(jsonStart) : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error(`Could not parse ${label} JSON output.`);
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function readOptionalString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseLastNonCliLine(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("Vercel CLI "))
    .at(-1);
}

function parseConvexOwner(output) {
  const reference = output.match(/\b([a-z0-9_-]+):([a-z0-9_-]+):preview\/[a-z0-9_-]+\b/i);
  if (reference) {
    return `${reference[1]}:${reference[2]}`;
  }
  const team = output.match(/\bteam(?:Slug)?:\s*([a-z0-9_-]+)/i)?.[1];
  const project = output.match(/\bproject(?:Slug)?:\s*([a-z0-9_-]+)/i)?.[1];
  return team && project ? `${team}:${project}` : undefined;
}

function parseConvexDeploymentReference(output) {
  return output.match(/\b([a-z0-9_-]+:[a-z0-9_-]+:preview\/[a-z0-9_-]+)\b/i)?.[1];
}

function parseConvexUrl(output) {
  return output.match(/\bhttps:\/\/[a-z0-9-]+\.convex\.cloud\b/i)?.[0];
}

async function readConvexProjectDeploymentReference(deploymentName) {
  let envLocal;
  try {
    envLocal = await readFile(".env.local", "utf8");
  } catch {
    return undefined;
  }
  const context = envLocal.match(/#\s*team:\s*([a-z0-9_-]+),\s*project:\s*([a-z0-9_-]+)/i);
  return context ? `${context[1]}:${context[2]}:preview/${deploymentName}` : undefined;
}

function detectCreatedBy() {
  const gitName = spawnSync("git", ["config", "user.name"], { encoding: "utf8" });
  const name = gitName.status === 0 ? gitName.stdout.trim() : "";
  return name || process.env.USER || "agentstack";
}

function clerkIssuerDomainFromPublishableKey(publishableKey) {
  const encoded = publishableKey?.match(/^pk_(?:test|live)_([A-Za-z0-9_-]+)/)?.[1];
  if (!encoded) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8").replace(/\$$/, "");
    return decoded.startsWith("http://") || decoded.startsWith("https://") ? decoded : `https://${decoded}`;
  } catch {
    return undefined;
  }
}

function redact(value) {
  return value
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{10,}\b/g, "[REDACTED]")
    .replace(/\b[A-Za-z0-9_-]*deploy[_-]?key[A-Za-z0-9_-]*=[^\s]+/gi, (match) => {
      const assignmentIndex = match.indexOf("=");
      return assignmentIndex === -1 ? "[REDACTED]" : `${match.slice(0, assignmentIndex + 1)}[REDACTED]`;
    })
    .replace(/\bCONVEX_DEPLOY_KEY=\S+/g, "CONVEX_DEPLOY_KEY=[REDACTED]");
}

function printUsage() {
  console.log(
    [
      "Usage: pnpm run m1:providers:bootstrap -- --confirm-live-mutation [--created-by <name>]",
      "",
      "Creates or links the M1 preview Clerk application, Convex preview deployment, and Vercel project using provider CLIs.",
      "Writes active provider ledger rows and redacted provider-bootstrap evidence.",
      "Requires authenticated Clerk, Convex, and Vercel CLIs; if Convex has no project context, run the interactive Convex project configuration command printed in the failure output."
    ].join("\n")
  );
}
