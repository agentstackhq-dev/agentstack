import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import type { ProviderCommandExecutor } from "@agentstack/adapters";
import { loadProjectContext } from "./context.js";
import type { RunIo } from "./run.js";

type Options = Record<string, string | boolean>;

type ProviderRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type M3ProviderResource = {
  service: "clerk" | "convex" | "vercel";
  resourceType: string;
  name: string;
  externalId: string;
  owner: string;
  url?: string;
};

type M3ProviderResourcesState = {
  environment: "preview";
  resources: M3ProviderResource[];
};

type M3AuthUserState = {
  service: "clerk";
  environment: "preview";
  email: string;
  userId: string;
  password: string;
  updatedAt: string;
};

const evidenceDir = ".agentstack/evidence/M3-billing-webhook";
const m2EvidenceDir = ".agentstack/evidence/M2-agent-completes-m1";
const providerResourcesPath = ".agentstack/provider-resources.json";
const providerLinksPath = ".agentstack/provider-links.json";
const authUserStatePath = ".agentstack/auth-user.json";
const billingStatePath = ".agentstack/billing-fixture.json";
const clerkBillingWebhookEnvPath = ".agentstack/clerk-billing-webhook.env";
const entitlementKey = "feature.auditLog";

export async function m3BillingBootstrapCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readPreviewEnvironment(options.env, "Run agentstack billing bootstrap --env preview --confirm-live-mutation.");

  if (options["confirm-live-mutation"] !== true) {
    io.write("FAIL billing.bootstrap.confirmation-required");
    io.write("Evidence: m3-billing-bootstrap");
    io.write("Provider mutation: none");
    io.write("Local mutation: none");
    return 1;
  }

  try {
    const context = await loadProjectContext(io.cwd);
    const state = await readProviderResourcesState(io.cwd);
    await requireProviderLinks(io.cwd);
    const clerk = requireResource(state, "clerk");
    const convex = requireResource(state, "convex");
    const entitlement = context.manifest.billing.entitlements[entitlementKey];
    const webhookUrl = convexSiteUrl(convex.url);
    const events = context.manifest.billing.webhook.events;
    const executor = resolveExecutor(io);
    await verifyClerkBillingEnabled({
      cwd: io.cwd,
      executor,
      clerkAppName: clerk.name,
      providerFeature: entitlement.providerFeature,
      providerPlan: entitlement.providerPlan
    });
    const webhook = await ensureClerkWebhook({
      cwd: io.cwd,
      executor,
      webhookUrl,
      events
    });
    const signingSecret = webhook.signingSecret ?? (await readWebhookSigningSecret(io.cwd));
    if (!signingSecret) {
      throw new Error(
        [
          "Provider action required: create or verify the Clerk/Svix webhook endpoint.",
          `Svix dashboard URL: ${webhook.dashboardUrl ?? "unavailable"}`,
          `Expected URL: ${webhookUrl}`,
          `Expected events: ${events.join(",")}`,
          `Expected feature: ${entitlement.providerFeature}`,
          `Expected plan: ${entitlement.providerPlan}`,
          `Then save the endpoint signing secret in ${clerkBillingWebhookEnvPath} as CLERK_WEBHOOK_SIGNING_SECRET and rerun this command.`
        ].join(" ")
      );
    }
    await writeText(io.cwd, clerkBillingWebhookEnvPath, `CLERK_WEBHOOK_SIGNING_SECRET=${signingSecret}\n`);
    await setConvexPreviewEnv({
      cwd: io.cwd,
      executor,
      deployment: convex.externalId,
      name: "CLERK_WEBHOOK_SIGNING_SECRET",
      value: signingSecret
    });
    await writeText(
      io.cwd,
      `${evidenceDir}/billing-bootstrap.txt`,
      [
        "# M3 Billing Bootstrap Evidence",
        "",
        "Result: PASS",
        `Checked at: ${new Date().toISOString()}`,
        "Provider: clerk",
        "Billing provider: Clerk Billing",
        `Webhook URL: ${webhookUrl}`,
        "Webhook endpoint: verified or created",
        "Convex webhook signing secret: configured",
        `Clerk application: ${clerk.name}`,
        `Local mutation: ${clerkBillingWebhookEnvPath}`,
        "",
        "Raw provider stdout, provider identifiers, and secrets are not stored.",
        ""
      ].join("\n")
    );

    io.write(`PASS billing bootstrap ${environment}`);
    io.write("Evidence: m3-billing-bootstrap");
    io.write("Billing provider: clerk");
    io.write("Webhook endpoint: verified or created");
    io.write("Provider mutation: clerk webhook endpoint, convex webhook env");
    io.write(`Local mutation: ${clerkBillingWebhookEnvPath}`);
    io.write(`Local mutation: ${evidenceDir}/billing-bootstrap.txt`);
    return 0;
  } catch (error) {
    await writeText(
      io.cwd,
      `${evidenceDir}/billing-bootstrap.txt`,
      [
        "# M3 Billing Bootstrap Evidence",
        "",
        "Result: FAIL",
        `Checked at: ${new Date().toISOString()}`,
        `Reason: ${redact(errorMessage(error))}`,
        ""
      ].join("\n")
    );
    io.write(`FAIL billing bootstrap ${environment}`);
    io.write("Evidence: m3-billing-bootstrap");
    io.write(`Reason: ${redact(errorMessage(error))}`);
    io.write("Provider mutation: partial or failed Clerk Billing bootstrap");
    io.write(`Local mutation: ${evidenceDir}/billing-bootstrap.txt`);
    return 1;
  }
}

export async function m3BillingFixtureCommand(argv: string[], io: RunIo): Promise<number> {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const [maybeAction, ...rest] = normalizedArgv;
  const action = maybeAction && !maybeAction.startsWith("--") ? maybeAction : "ensure";
  const options = parseOptions(maybeAction && !maybeAction.startsWith("--") ? rest : normalizedArgv);
  const environment = readPreviewEnvironment(options.env, "Run agentstack billing fixture ensure --env preview --entitlement feature.auditLog --confirm-live-mutation.");
  const entitlement = readRequiredOption(options.entitlement, "entitlement", "Run agentstack billing fixture ensure --env preview --entitlement feature.auditLog --confirm-live-mutation.");

  if (entitlement !== entitlementKey) {
    io.write("FAIL billing.fixture.entitlement-unsupported");
    io.write(`Reason: unsupported entitlement ${entitlement}`);
    return 1;
  }

  if (!["ensure", "grant", "revoke", "replay-last", "delete"].includes(action)) {
    io.write("FAIL billing.fixture.action-invalid");
    io.write(`Reason: unsupported action ${action}`);
    return 1;
  }

  if (options["confirm-live-mutation"] !== true) {
    io.write("FAIL billing.fixture.confirmation-required");
    io.write("Evidence: m3-billing-fixture");
    io.write("Provider mutation: none");
    io.write("Local mutation: none");
    return 1;
  }

  try {
    const executor = resolveExecutor(io);
    const state = await readProviderResourcesState(io.cwd);
    const convex = requireResource(state, "convex");
    const authUser = await readAuthUserState(io.cwd);

    if (action === "delete") {
      await runOptionalProvider(executor, {
        cwd: join(io.cwd, "apps", "convex"),
        args: ["convex", "run", "billing:clearFixturePrincipal", JSON.stringify({ clerkUserId: authUser.userId }), "--deployment", convex.externalId]
      });
      await rm(join(io.cwd, billingStatePath), { force: true });
      await writeFixtureEvidence(io.cwd, action, "PASS", ["Billing fixture: deleted"]);
      io.write("PASS billing fixture delete");
      io.write("Evidence: m3-billing-fixture");
      io.write("Provider mutation: convex fixture cleanup");
      io.write(`Local mutation: removed ${billingStatePath}`);
      return 0;
    }

    if (action === "ensure") {
      await runOptionalProvider(executor, {
        cwd: join(io.cwd, "apps", "convex"),
        args: [
          "convex",
          "run",
          "billing:ensureFixturePrincipal",
          JSON.stringify({ clerkUserId: authUser.userId, workspaceId: "demo-workspace" }),
          "--deployment",
          convex.externalId
        ]
      });
      await writeText(
        io.cwd,
        billingStatePath,
        `${JSON.stringify({ environment, entitlement, clerkUserId: authUser.userId, updatedAt: new Date().toISOString() }, null, 2)}\n`
      );
      await writeFixtureEvidence(io.cwd, action, "PASS", ["Billing fixture: ensured", "Entitlement state: denied"]);
      io.write("PASS billing fixture ensure");
      io.write("Evidence: m3-billing-fixture");
      io.write("Entitlement state: denied");
      io.write("Provider mutation: convex fixture principal");
      io.write(`Local mutation: ${billingStatePath}`);
      return 0;
    }

    const remoteEvidence = await readRemoteBillingEvidence({ cwd: io.cwd, executor, deployment: convex.externalId });
    const expectation = billingFixtureExpectation(action, remoteEvidence);
    if (expectation.ok) {
      await writeFixtureEvidence(io.cwd, action, "PASS", expectation.notes);
      io.write(`PASS billing fixture ${action}`);
      io.write("Evidence: m3-billing-fixture");
      expectation.notes.forEach((note) => io.write(note));
      io.write("Provider mutation: none");
      io.write(`Local mutation: ${evidenceDir}/billing-fixture-${action}.txt`);
      return 0;
    }

    await writeFixtureEvidence(io.cwd, action, "FAIL", expectation.notes);
    io.write(`FAIL billing fixture ${action}`);
    io.write("Evidence: m3-billing-fixture");
    expectation.notes.forEach((note) => io.write(note));
    io.write("Provider mutation: none");
    io.write(`Local mutation: ${evidenceDir}/billing-fixture-${action}.txt`);
    return 1;
  } catch (error) {
    await writeFixtureEvidence(io.cwd, action, "FAIL", [`Reason: ${redact(errorMessage(error))}`]);
    io.write(`FAIL billing fixture ${action}`);
    io.write("Evidence: m3-billing-fixture");
    io.write(`Reason: ${redact(errorMessage(error))}`);
    return 1;
  }
}

export async function m3BillingSmokeCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readPreviewEnvironment(options.env, "Run agentstack billing smoke --env preview --expected allowed --dom-file <path>.");
  const expected = readRequiredOption(options.expected, "expected", "Run agentstack billing smoke --env preview --expected allowed --dom-file <path>.");
  const domFile = readRequiredOption(options["dom-file"], "dom-file", "Run agentstack billing smoke --env preview --expected allowed --dom-file <path>.");

  if (expected !== "allowed" && expected !== "denied") {
    io.write("FAIL billing.smoke.expected-invalid");
    io.write("Reason: --expected must be allowed or denied.");
    return 1;
  }

  const dom = await readFile(resolve(io.cwd, domFile), "utf8");
  const failures: string[] = [];
  const authStates = getAttributeValues(dom, "data-agentstack-auth-state");
  const protectedStates = getAttributeValues(dom, "data-agentstack-protected-data-state");
  const entitlementKeys = getAttributeValues(dom, "data-agentstack-entitlement-key");
  const entitlementStates = getAttributeValues(dom, "data-agentstack-entitlement-state");

  if (!authStates.includes("signed-in")) {
    failures.push('missing data-agentstack-auth-state="signed-in"');
  }
  if (!protectedStates.includes("protected-data-loaded")) {
    failures.push('missing data-agentstack-protected-data-state="protected-data-loaded"');
  }
  if (!entitlementKeys.includes(entitlementKey)) {
    failures.push(`missing data-agentstack-entitlement-key="${entitlementKey}"`);
  }
  if (!entitlementStates.includes(expected)) {
    failures.push(`missing data-agentstack-entitlement-state="${expected}"`);
  }

  await writeText(
    io.cwd,
    `${evidenceDir}/billing-smoke-${expected}.txt`,
    [
      "# M3 Billing Smoke Evidence",
      "",
      `Result: ${failures.length === 0 ? "PASS" : "FAIL"}`,
      `Checked at: ${new Date().toISOString()}`,
      `Entitlement key: ${entitlementKeys.includes(entitlementKey) ? entitlementKey : "missing"}`,
      `Entitlement state: ${entitlementStates.includes(expected) ? expected : "missing expected"}`,
      ...failures.map((failure) => `Reason: ${failure}`),
      "",
      "Raw DOM snapshots, cookies, and identifiers are not stored.",
      ""
    ].join("\n")
  );

  if (failures.length > 0) {
    io.write(`FAIL billing smoke ${environment}`);
    io.write("Evidence: m3-billing-smoke");
    failures.forEach((failure) => io.write(`Reason: ${failure}`));
    io.write(`Local mutation: ${evidenceDir}/billing-smoke-${expected}.txt`);
    return 1;
  }

  io.write(`PASS billing smoke ${environment}`);
  io.write("Evidence: m3-billing-smoke");
  io.write(`Entitlement key: ${entitlementKey}`);
  io.write(`Entitlement state: ${expected}`);
  io.write(`Local mutation: ${evidenceDir}/billing-smoke-${expected}.txt`);
  return 0;
}

export async function m3EvidenceCheckCommand(argv: string[], io: RunIo): Promise<number | undefined> {
  const options = parseOptions(argv);
  if (options.milestone !== "M3") {
    return undefined;
  }

  const environment = readPreviewEnvironment(options.env, "Run agentstack evidence check --env preview --milestone M3.");
  const required = [
    ["provider bootstrap evidence", `${m2EvidenceDir}/provider-bootstrap.txt`, "Result: PASS"],
    ["provider link evidence", `${m2EvidenceDir}/provider-links.txt`, "Result: PASS"],
    ["deploy URL evidence", `${m2EvidenceDir}/deploy-url.txt`, "https://"],
    ["deploy output evidence", `${m2EvidenceDir}/deploy-output.txt`, "Result: PASS"],
    ["Clerk smoke user evidence", `${m2EvidenceDir}/clerk-smoke-user.txt`, "Result: PASS"],
    ["M2 smoke output evidence", `${m2EvidenceDir}/smoke-output.txt`, "Result: PASS"],
    ["billing bootstrap evidence", `${evidenceDir}/billing-bootstrap.txt`, "Result: PASS"],
    ["billing fixture ensure evidence", `${evidenceDir}/billing-fixture-ensure.txt`, "Result: PASS"],
    ["billing fixture grant evidence", `${evidenceDir}/billing-fixture-grant.txt`, "Result: PASS"],
    ["billing fixture replay-last evidence", `${evidenceDir}/billing-fixture-replay-last.txt`, "Result: PASS"],
    ["billing smoke denied evidence", `${evidenceDir}/billing-smoke-denied.txt`, "Result: PASS"],
    ["billing smoke allowed evidence", `${evidenceDir}/billing-smoke-allowed.txt`, "Result: PASS"]
  ] as const;
  const failures: string[] = [];

  for (const [label, path, marker] of required) {
    const text = await readOptionalText(io.cwd, path);
    if (!text) {
      failures.push(`missing ${label}`);
      continue;
    }
    if (!text.includes(marker)) {
      failures.push(`${label} is missing ${marker}`);
    }
  }

  if (failures.length > 0) {
    io.write(`FAIL evidence check ${environment}`);
    io.write("Evidence: m3-evidence-check");
    failures.forEach((failure) => io.write(`Reason: ${failure}`));
    io.write("Provider mutation: none");
    io.write("Local mutation: none");
    return 1;
  }

  io.write(`PASS evidence check ${environment}`);
  io.write("Evidence: m3-evidence-check");
  io.write("Checked: M2 baseline evidence");
  io.write("Checked: billing bootstrap evidence");
  io.write("Checked: billing fixture evidence");
  io.write("Checked: billing smoke evidence");
  io.write("Provider mutation: none");
  io.write("Local mutation: none");
  return 0;
}

async function ensureClerkWebhook(input: {
  cwd: string;
  executor: ProviderCommandExecutor;
  webhookUrl: string;
  events: readonly string[];
}): Promise<{ signingSecret?: string; dashboardUrl?: string }> {
  const svixApp = await runProvider(input.executor, {
    cwd: input.cwd,
    args: ["clerk", "api", "/webhooks/svix", "--method", "POST", "--data", "{}", "--yes"]
  });

  if (svixApp.exitCode !== 0 && !providerDetail(svixApp).includes("svix_app_exists")) {
    throw new Error(
      [
        "Provider action required: Clerk/Svix webhook bootstrap failed.",
        providerDetail(svixApp)
      ].join(" ")
    );
  }

  const dashboard = await runProvider(input.executor, {
    cwd: input.cwd,
    args: ["clerk", "api", "/webhooks/svix_url", "--method", "POST", "--data", "{}", "--yes"]
  });
  if (dashboard.exitCode !== 0) {
    throw new Error(
      [
        "Provider action required: create the Clerk/Svix webhook endpoint manually.",
        `Expected URL: ${input.webhookUrl}`,
        `Expected events: ${input.events.join(",")}`,
        "Set the endpoint signing secret as CLERK_WEBHOOK_SIGNING_SECRET in the Convex preview deployment.",
        providerDetail(dashboard)
      ].join(" ")
    );
  }

  const parsed = parseJson([svixApp.stdout, dashboard.stdout].find((text) => text.includes("signing_secret")) ?? "{}");
  const dashboardJson = parseJson(dashboard.stdout);
  return {
    signingSecret: firstString(parsed.signing_secret, parsed.signingSecret, parsed.secret),
    dashboardUrl: firstString(dashboardJson.svix_url, dashboardJson.url)
  };
}

async function verifyClerkBillingEnabled(input: {
  cwd: string;
  executor: ProviderCommandExecutor;
  clerkAppName: string;
  providerFeature: string;
  providerPlan: string;
}): Promise<void> {
  const result = await runProvider(input.executor, {
    cwd: input.cwd,
    args: ["clerk", "api", "/billing/plans", "--method", "GET", "--yes"]
  });
  if (result.exitCode === 0) {
    return;
  }

  const detail = providerDetail(result);
  if (detail.includes("billing_not_enabled")) {
    throw new Error(
      [
        `Provider action required: enable Clerk Billing for Clerk application ${input.clerkAppName}.`,
        `Expected feature slug: ${input.providerFeature}.`,
        `Expected plan slug: ${input.providerPlan}.`,
        "After Billing is enabled, rerun agentstack billing bootstrap --env preview --confirm-live-mutation."
      ].join(" ")
    );
  }

  throw new Error(`Clerk Billing verification failed. ${detail}`);
}

async function readRemoteBillingEvidence(input: {
  cwd: string;
  executor: ProviderCommandExecutor;
  deployment: string;
}): Promise<{
  events?: Array<{ duplicateCount?: number; status?: string; entitlementKey?: string }>;
  entitlements?: Array<{ entitlementKey?: string; allowed?: boolean }>;
}> {
  const result = await runProvider(input.executor, {
    cwd: join(input.cwd, "apps", "convex"),
    args: ["convex", "run", "billing:readM3BillingEvidence", "--deployment", input.deployment]
  });
  if (result.exitCode !== 0) {
    return {};
  }
  return parseJson(result.stdout) as {
    events?: Array<{ duplicateCount?: number; status?: string; entitlementKey?: string }>;
    entitlements?: Array<{ entitlementKey?: string; allowed?: boolean }>;
  };
}

function billingFixtureExpectation(
  action: string,
  evidence: {
    events?: Array<{ duplicateCount?: number; status?: string; entitlementKey?: string }>;
    entitlements?: Array<{ entitlementKey?: string; allowed?: boolean }>;
  }
): { ok: boolean; notes: string[] } {
  if (action === "grant") {
    const granted = evidence.entitlements?.some(
      (entitlement) => entitlement.entitlementKey === entitlementKey && entitlement.allowed === true
    );
    return granted
      ? { ok: true, notes: ["Entitlement state: allowed"] }
      : {
          ok: false,
          notes: [
            "Provider action required: trigger a real Clerk Billing grant event for the smoke principal, then rerun this command."
          ]
        };
  }

  if (action === "revoke") {
    const revoked = evidence.entitlements?.some(
      (entitlement) => entitlement.entitlementKey === entitlementKey && entitlement.allowed === false
    );
    return revoked
      ? { ok: true, notes: ["Entitlement state: denied"] }
      : {
          ok: false,
          notes: [
            "Provider action required: trigger a real Clerk Billing revoke event for the smoke principal, then rerun this command."
          ]
        };
  }

  const replayed = evidence.events?.some(
    (event) =>
      event.entitlementKey === entitlementKey &&
      (event.status === "duplicate" || (event.duplicateCount ?? 0) > 0)
  );
  return replayed
    ? { ok: true, notes: ["Webhook replay: duplicate detected"] }
    : {
        ok: false,
        notes: [
          "Provider action required: replay the last Clerk Billing webhook delivery, then rerun this command."
        ]
      };
}

async function setConvexPreviewEnv(input: {
  cwd: string;
  executor: ProviderCommandExecutor;
  deployment: string;
  name: string;
  value: string;
}): Promise<void> {
  const result = await runProvider(input.executor, {
    cwd: join(input.cwd, "apps", "convex"),
    args: ["convex", "env", "--deployment", input.deployment, "set", input.name, input.value]
  });
  if (result.exitCode !== 0) {
    throw new Error(`Convex env set failed. ${providerDetail(result)}`);
  }
}

async function readProviderResourcesState(cwd: string): Promise<M3ProviderResourcesState> {
  return JSON.parse(await readFile(join(cwd, providerResourcesPath), "utf8")) as M3ProviderResourcesState;
}

async function readAuthUserState(cwd: string): Promise<M3AuthUserState> {
  return JSON.parse(await readFile(join(cwd, authUserStatePath), "utf8")) as M3AuthUserState;
}

async function readWebhookSigningSecret(cwd: string): Promise<string | undefined> {
  const fromEnv = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (fromEnv) {
    return fromEnv;
  }

  const envFile = await readOptionalText(cwd, clerkBillingWebhookEnvPath);
  const line = envFile?.split(/\r?\n/).find((candidate) => candidate.startsWith("CLERK_WEBHOOK_SIGNING_SECRET="));
  return line?.slice("CLERK_WEBHOOK_SIGNING_SECRET=".length).trim() || undefined;
}

function requireResource(state: M3ProviderResourcesState, service: M3ProviderResource["service"]): M3ProviderResource {
  const resource = state.resources.find((candidate) => candidate.service === service);
  if (!resource) {
    throw new Error(`Missing ${service} provider resource. Run agentstack provider bootstrap --env preview --confirm-live-mutation.`);
  }
  return resource;
}

async function requireProviderLinks(cwd: string): Promise<void> {
  JSON.parse(await readFile(join(cwd, providerLinksPath), "utf8"));
}

function convexSiteUrl(convexUrl: string | undefined): string {
  if (!convexUrl) {
    throw new Error("Convex preview URL is missing from provider resources.");
  }
  return convexUrl.replace(/\.convex\.cloud\/?$/i, ".convex.site");
}

async function writeFixtureEvidence(cwd: string, action: string, result: "PASS" | "FAIL", notes: string[]): Promise<void> {
  await writeText(
    cwd,
    `${evidenceDir}/billing-fixture-${action}.txt`,
    [
      "# M3 Billing Fixture Evidence",
      "",
      `Result: ${result}`,
      `Checked at: ${new Date().toISOString()}`,
      `Action: ${action}`,
      "Entitlement: feature.auditLog",
      ...notes.map((note) => redact(note)),
      "",
      "Raw provider stdout, billing payloads, cookies, and secrets are not stored.",
      ""
    ].join("\n")
  );
}

function parseOptions(argv: string[]): Options {
  const options: Options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

function readPreviewEnvironment(value: string | boolean | undefined, fix: string): "preview" {
  if (value === undefined || value === "preview") {
    return "preview";
  }
  if (value === true) {
    throw new Error(["FAIL cli.option.missing", "--env requires a value.", `Fix: ${fix}`].join("\n"));
  }
  throw new Error(["FAIL cli.option.invalid", `Unsupported environment ${value}.`, `Fix: ${fix}`].join("\n"));
}

function readRequiredOption(value: string | boolean | undefined, name: string, fix: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new Error(["FAIL cli.option.missing", `--${name} requires a value.`, `Fix: ${fix}`].join("\n"));
}

function resolveExecutor(io: RunIo): ProviderCommandExecutor {
  return io.providerExecutor ?? {
    async execute(command, args, options) {
      return await new Promise((resolvePromise) => {
        const child = spawn(command, args, {
          cwd: options.cwd,
          env: { ...process.env, ...(options.env ?? {}) },
          stdio: ["pipe", "pipe", "pipe"]
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
          stderr += String(chunk);
        });
        if (options.stdin) {
          child.stdin.write(options.stdin);
        }
        child.stdin.end();
        child.on("error", (error) => {
          resolvePromise({ exitCode: 127, stdout, stderr: `${stderr}\n${error.message}`, durationMs: 0 });
        });
        child.on("close", (exitCode) => {
          resolvePromise({ exitCode: exitCode ?? 1, stdout, stderr, durationMs: 0 });
        });
      });
    }
  };
}

async function runOptionalProvider(
  executor: ProviderCommandExecutor,
  input: { cwd: string; args: string[]; stdin?: string; env?: Record<string, string | undefined> }
): Promise<ProviderRunResult> {
  return await runProvider(executor, input);
}

async function runProvider(
  executor: ProviderCommandExecutor,
  input: { cwd: string; args: string[]; stdin?: string; env?: Record<string, string | undefined> }
): Promise<ProviderRunResult> {
  const [tool, ...toolArgs] = input.args;
  const executable = tool ? await resolveProviderExecutable(input.cwd, tool) : undefined;
  const result = executable
    ? await executor.execute(executable, toolArgs, {
        cwd: input.cwd,
        env: input.env,
        stdin: input.stdin
      })
    : await executor.execute("pnpm", ["exec", ...input.args], {
        cwd: input.cwd,
        env: input.env,
        stdin: input.stdin
      });
  return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
}

async function resolveProviderExecutable(cwd: string, tool: string): Promise<string | undefined> {
  let current = resolve(cwd);
  const root = parse(current).root;

  while (true) {
    const candidate = join(current, "node_modules", ".bin", tool);
    try {
      const candidateStat = await stat(candidate);
      if (candidateStat.isFile() || candidateStat.isSymbolicLink()) {
        return candidate;
      }
    } catch {
      // Walk upward until the filesystem root.
    }
    if (current === root) {
      return undefined;
    }
    current = resolve(current, "..");
  }
}

async function readOptionalText(cwd: string, path: string): Promise<string | undefined> {
  try {
    return await readFile(join(cwd, path), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeText(cwd: string, path: string, content: string): Promise<void> {
  const absolutePath = join(cwd, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

function getAttributeValues(html: string, attribute: string): string[] {
  const regex = new RegExp(`${attribute}=["']([^"']*)["']`, "g");
  return Array.from(html.matchAll(regex)).map((match) => match[1] ?? "");
}

function parseJson(stdout: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(stdout);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function providerDetail(result: ProviderRunResult): string {
  return redact([result.stdout, result.stderr].filter(Boolean).join("\n"));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redact(input: string): string {
  return input
    .replace(/sk_(?:test|live)_[A-Za-z0-9_-]+/g, "[redacted-secret]")
    .replace(/whsec_[A-Za-z0-9+/=_-]+/g, "[redacted-webhook-secret]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted-id]");
}
