#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const appSlug = "__APP_SLUG__";
const evidenceDir = "docs/milestones/evidence/M1-preview-e2e";
const authUserEvidencePath = resolve(`${evidenceDir}/clerk-smoke-user.txt`);
const localStatePath = ".agentstack/m1-auth-user.json";
const createdAt = process.env.AGENTSTACK_M1_CREATED_AT ?? new Date().toISOString().slice(0, 10);
const args = parseArgs(process.argv.slice(2));
const action = args.action ?? "ensure";

if (args.help) {
  printUsage();
  process.exit(0);
}

if (!["ensure", "update", "delete"].includes(action)) {
  console.log("FAIL m1 auth user.action-invalid");
  console.log("Evidence: m1-auth-user");
  console.log(`Reason: unsupported action ${action}`);
  console.log("Provider mutation: none");
  console.log("Ledger mutation: none");
  console.log("Local mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

if (!args["confirm-live-mutation"]) {
  console.log("FAIL m1 auth user.confirmation-required");
  console.log("Evidence: m1-auth-user");
  console.log("Provider mutation: none");
  console.log("Ledger mutation: none");
  console.log("Local mutation: none");
  console.log("Telemetry mutation: none");
  process.exit(1);
}

const createdBy = readOptionalString(args["created-by"]) ?? detectCreatedBy();

try {
  if (action === "delete") {
    await deleteSmokeUser();
  } else {
    await ensureOrUpdateSmokeUser(action);
  }
} catch (error) {
  await writeAuthUserEvidence("FAIL", action, [
    `Blocker: ${redact(String(error instanceof Error ? error.message : error))}`
  ]);
  console.log(`FAIL m1 auth user ${action}`);
  console.log("Evidence: m1-auth-user");
  console.log(`Reason: ${redact(String(error instanceof Error ? error.message : error))}`);
  console.log("Provider mutation: partial or failed Clerk user lifecycle");
  console.log("Ledger mutation: planned/active/cleaned row may have been recorded before failure");
  console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt");
  console.log("Telemetry mutation: provider ledger telemetry only");
  process.exit(1);
}

async function ensureOrUpdateSmokeUser(mode) {
  const owner = readClerkOwner();
  const email = smokeUserEmail();
  const password = localPassword();
  let user;

  if (mode === "ensure") {
    user = findClerkUserByEmail(email);
    if (!user?.id) {
      await recordLedgerRow({
        status: "planned",
        owner,
        externalId: "pending",
        email,
        notes: "planned by m1:auth:user ensure before Clerk user mutation"
      });
      user = createClerkUser(email, password);
    }
  } else {
    const state = await readLocalState();
    assertStateMatchesFixture(state);
    user = { id: state.userId, email };
  }

  if (!user?.id) {
    throw new Error("Clerk smoke user id was unavailable after create/reuse.");
  }

  updateClerkUser(user.id, password);
  await writeLocalState({ userId: user.id, email, password });
  await recordLedgerRow({
    status: "active",
    owner,
    externalId: user.id,
    email,
    notes: `recorded by m1:auth:user ${mode}; client trust bypass requested`
  });
  await writeAuthUserEvidence("PASS", mode, [
    "Clerk smoke user: created or reused",
    "Client trust bypass: requested",
    "Local credential state: .agentstack/m1-auth-user.json"
  ]);

  console.log(`PASS m1 auth user ${mode}`);
  console.log("Evidence: m1-auth-user");
  console.log("Clerk smoke user: created or reused");
  console.log("Client trust bypass: requested");
  console.log("Provider mutation: clerk user create/update");
  console.log("Ledger mutation: docs/provider-resource-ledger.md");
  console.log("Local mutation: .agentstack/m1-auth-user.json");
  console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt");
  console.log("Telemetry mutation: provider ledger telemetry only");
}

async function deleteSmokeUser() {
  const owner = readClerkOwner();
  const state = await readLocalState();
  assertStateMatchesFixture(state);
  deleteClerkUser(state.userId);
  await recordLedgerRow({
    status: "cleaned",
    owner,
    externalId: state.userId,
    email: state.email,
    cleanedAt: createdAt,
    notes: "recorded by m1:auth:user delete; verified cleanup through Clerk API"
  });
  await rm(localStatePath, { force: true });
  await writeAuthUserEvidence("PASS", "delete", [
    "Clerk smoke user: deleted",
    "Client trust bypass: no longer applicable",
    "Local credential state: removed"
  ]);

  console.log("PASS m1 auth user delete");
  console.log("Evidence: m1-auth-user");
  console.log("Clerk smoke user: deleted");
  console.log("Provider mutation: clerk user delete");
  console.log("Ledger mutation: docs/provider-resource-ledger.md");
  console.log("Local mutation: removed .agentstack/m1-auth-user.json");
  console.log("Local mutation: docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt");
  console.log("Telemetry mutation: provider ledger telemetry only");
}

function readClerkOwner() {
  const whoami = runProvider(["clerk", "whoami", "--json"], {
    authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:auth:user -- ensure --confirm-live-mutation`."
  });
  return parseJson(whoami.stdout, "clerk whoami").email ?? "clerk-authenticated-user";
}

function findClerkUserByEmail(email) {
  const result = runProvider(["clerk", "api", `/users?email_address=${encodeURIComponent(email)}`], {
    authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:auth:user -- ensure --confirm-live-mutation`."
  });
  const parsed = parseJson(result.stdout, "clerk users list");
  const users = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
  return users.map(normalizeClerkUser).find((candidate) => candidate.id);
}

function createClerkUser(email, password) {
  const payload = {
    email_address: [email],
    password,
    skip_password_checks: true,
    skip_password_requirement: false,
    public_metadata: smokeUserMetadata()
  };
  const result = runProvider(["clerk", "api", "/users", "--data", JSON.stringify(payload), "--yes"], {
    authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:auth:user -- ensure --confirm-live-mutation`."
  });
  return normalizeClerkUser(parseJson(result.stdout, "clerk users create"));
}

function updateClerkUser(userId, password) {
  const payload = {
    password,
    skip_password_checks: true,
    bypass_client_trust: true,
    public_metadata: smokeUserMetadata()
  };
  runProvider(["clerk", "api", `/users/${userId}`, "--method", "PATCH", "--data", JSON.stringify(payload), "--yes"], {
    authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:auth:user -- update --confirm-live-mutation`."
  });
}

function deleteClerkUser(userId) {
  runProvider(["clerk", "api", `/users/${userId}`, "--method", "DELETE", "--yes"], {
    authHint: "Run `pnpm exec clerk auth login` and rerun `pnpm run m1:auth:user -- delete --confirm-live-mutation`."
  });
}

function normalizeClerkUser(entry) {
  if (!entry || typeof entry !== "object") {
    return {};
  }
  return {
    id: firstString(entry.id, entry.user_id),
    email: firstString(
      entry.email_address,
      ...(Array.isArray(entry.email_addresses)
        ? entry.email_addresses.map((emailEntry) => firstString(emailEntry?.email_address, emailEntry?.emailAddress))
        : [])
    )
  };
}

async function recordLedgerRow({ status, owner, externalId, email, cleanedAt = "", notes }) {
  const existing = await readExistingLedgerRow(email);
  const commandArgs = [
    "provider",
    "ledger",
    "record",
    ...(existing ? ["--replace"] : []),
    "--service",
    "clerk",
    "--env",
    "preview",
    "--resource-type",
    "user",
    "--name",
    email,
    "--external-id",
    externalId,
    "--owner",
    owner,
    "--purpose",
    "M1 preview Clerk sign-in smoke user",
    "--created-by",
    createdBy,
    "--created-at",
    createdAt,
    "--cleanup-trigger",
    "M1 pass or cleanup",
    "--cleanup",
    "delete through Clerk dashboard or `pnpm run m1:auth:user -- delete --confirm-live-mutation`",
    "--evidence",
    "docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt",
    "--notes",
    notes,
    "--status",
    status
  ];
  if (cleanedAt) {
    commandArgs.push("--cleaned-at", cleanedAt);
  }

  const code = runAgentstack(commandArgs);
  if (code !== 0) {
    throw new Error(`Failed to record Clerk smoke user ledger row with status ${status}.`);
  }
}

async function readExistingLedgerRow(email) {
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
  return rows.find(
    (cells) =>
      cells[1] === "clerk" &&
      cells[2] === "user" &&
      cells[3] === "preview" &&
      cells[5] === email
  );
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

function runProvider(args, { allowFailure = false, authHint } = {}) {
  const result = spawnSync("pnpm", ["exec", ...args], {
    encoding: "utf8",
    env: process.env
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

async function readLocalState() {
  let state;
  try {
    state = JSON.parse(await readFile(localStatePath, "utf8"));
  } catch {
    throw new Error("Missing .agentstack/m1-auth-user.json. Run `pnpm run m1:auth:user -- ensure --confirm-live-mutation` first.");
  }
  return state;
}

async function writeLocalState(state) {
  await mkdir(dirname(localStatePath), { recursive: true });
  await writeFile(
    localStatePath,
    `${JSON.stringify(
      {
        service: "clerk",
        environment: "preview",
        ...state,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );
}

function assertStateMatchesFixture(state) {
  const expectedEmail = smokeUserEmail();
  if (state?.service !== "clerk" || state?.environment !== "preview" || state?.email !== expectedEmail || !state?.userId) {
    throw new Error("Local auth-user state does not match this generated app's M1 Clerk smoke user.");
  }
}

async function writeAuthUserEvidence(result, actionName, notes) {
  const checkedAt = new Date().toISOString();
  const lines = [
    "# M1 Clerk Smoke User Evidence",
    "",
    `Result: ${result}`,
    `Checked at: ${checkedAt}`,
    `Action: ${actionName}`,
    "Provider: clerk",
    "Resource type: user",
    "Environment: preview",
    "Clerk smoke user: created or reused",
    "Client trust bypass: requested",
    "Local credential state: .agentstack/m1-auth-user.json",
    "Provider mutation: clerk user create/update/delete",
    "Ledger mutation: docs/provider-resource-ledger.md",
    "Local mutation: .agentstack/m1-auth-user.json",
    "Telemetry mutation: provider ledger telemetry only",
    "",
    "Notes:",
    ...notes.map((note) => `- ${redact(note)}`),
    "",
    "Raw passwords, OTP codes, session tokens, cookies, provider stdout, and full user payloads are not stored in this evidence file.",
    ""
  ];

  await mkdir(dirname(authUserEvidencePath), { recursive: true });
  await writeFile(authUserEvidencePath, lines.join("\n"));
}

function smokeUserEmail() {
  return `${appSlug}+m1-smoke+clerk_test@example.com`;
}

function smokeUserMetadata() {
  return {
    agentstack: "m1",
    appSlug,
    fixture: "clerk-smoke-user"
  };
}

function localPassword() {
  return process.env.AGENTSTACK_M1_AUTH_USER_PASSWORD ?? `Ag3ntstack-${randomBytes(18).toString("base64url")}!`;
}

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--") {
      continue;
    }
    if (!arg.startsWith("--") && parsed.action === undefined) {
      parsed.action = arg;
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

function detectCreatedBy() {
  const gitName = spawnSync("git", ["config", "user.name"], { encoding: "utf8" });
  const name = gitName.status === 0 ? gitName.stdout.trim() : "";
  return name || process.env.USER || "agentstack";
}

function redact(value) {
  return value
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{10,}\b/g, "[REDACTED]")
    .replace(/\b(?:password|session|token|cookie)\b\s*[:=]\s*["']?[^"',\s}]+["']?/gi, "$1=[REDACTED]")
    .replace(/Ag3ntstack-[A-Za-z0-9_-]+!/g, "[REDACTED]");
}

function printUsage() {
  console.log(
    [
      "Usage: pnpm run m1:auth:user -- <ensure|update|delete> --confirm-live-mutation [--created-by <name>]",
      "",
      "Creates, updates, or deletes the ledgered M1 Clerk smoke user for repeatable preview Auth/Data testing.",
      "Stores generated credentials only in .agentstack/m1-auth-user.json and writes redacted evidence to docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt."
    ].join("\n")
  );
}
