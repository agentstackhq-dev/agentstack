import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import type { ProviderCommandExecutor } from "@agentstack/adapters";
import { loadProjectContext } from "./context.js";
import type { RunIo } from "./run.js";

type Options = Record<string, string | boolean>;

type M2ProviderResource = {
  service: "clerk" | "convex" | "vercel";
  resourceType: "application" | "deployment" | "project";
  name: string;
  externalId: string;
  owner: string;
  url?: string;
  publishableKey?: string;
  issuerDomain?: string;
};

type M2ProviderResourcesState = {
  environment: "preview";
  resources: M2ProviderResource[];
  updatedAt: string;
};

type M2AuthUserState = {
  service: "clerk";
  environment: "preview";
  email: string;
  userId: string;
  password: string;
  updatedAt: string;
};

type ProviderRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type ClerkAppRow = {
  id?: string;
  name?: string;
  publishableKey?: string;
};

type VercelProjectRow = {
  id?: string;
  name?: string;
  owner?: string;
};

const evidenceDir = ".agentstack/evidence/M2-agent-completes-m1";
const providerResourcesPath = ".agentstack/provider-resources.json";
const providerLinksPath = ".agentstack/provider-links.json";
const authUserStatePath = ".agentstack/auth-user.json";
const convexPreviewEnvPath = ".agentstack/convex-preview.env";

export async function m2ProviderBootstrapCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readPreviewEnvironment(options.env, "Run agentstack provider bootstrap --env preview --confirm-live-mutation.");

  if (options.help === true) {
    writeProviderBootstrapUsage(io);
    return 0;
  }

  if (options["confirm-live-mutation"] !== true) {
    io.write("FAIL provider.bootstrap.confirmation-required");
    io.write("Evidence: m2-provider-bootstrap");
    io.write("Provider mutation: none");
    io.write("Local mutation: none");
    io.write("Telemetry mutation: none");
    return 1;
  }

  const context = await loadProjectContext(io.cwd);
  const slug = context.manifest.app.slug;
  const executor = resolveExecutor(io);
  const notes: string[] = [];
  const resources: M2ProviderResource[] = [];

  try {
    const clerk = await bootstrapClerk({ cwd: io.cwd, executor, slug, notes });
    resources.push(clerk);

    const convex = await bootstrapConvex({ cwd: io.cwd, executor, slug, clerk, notes });
    resources.push(convex);

    const vercel = await bootstrapVercel({ cwd: io.cwd, executor, slug, clerk, convex, notes });
    resources.push(vercel);

    await writeProviderResourcesState(io.cwd, resources);
    await writeText(
      io.cwd,
      `${evidenceDir}/provider-bootstrap.txt`,
      [
        "# M2 Provider Bootstrap Evidence",
        "",
        "Result: PASS",
        `Checked at: ${new Date().toISOString()}`,
        "Clerk preview application: active",
        "Convex preview deployment: active",
        "Vercel preview project: active",
        "Provider mutation: clerk app/link, convex preview deployment/deploy-key/env, vercel project/link/env",
        `Local mutation: ${providerResourcesPath}`,
        `Local mutation: ${convexPreviewEnvPath}`,
        "Notes:",
        ...notes.map((note) => `- ${redact(note)}`),
        "",
        "Raw provider stdout, identifiers, tokens, secrets, deploy keys, cookies, and sessions are not stored.",
        ""
      ].join("\n")
    );

    io.write(`PASS provider bootstrap ${environment}`);
    io.write("Evidence: m2-provider-bootstrap");
    io.write("Bootstrapped: clerk preview application");
    io.write("Bootstrapped: convex preview deployment");
    io.write("Bootstrapped: vercel preview project");
    io.write("Provider mutation: clerk app/link, convex preview deployment/deploy-key/env, vercel project/link/env");
    io.write(`Local mutation: ${providerResourcesPath}`);
    io.write(`Local mutation: ${evidenceDir}/provider-bootstrap.txt`);
    io.write("Telemetry mutation: none");
    return 0;
  } catch (error) {
    await writeText(
      io.cwd,
      `${evidenceDir}/provider-bootstrap.txt`,
      [
        "# M2 Provider Bootstrap Evidence",
        "",
        "Result: FAIL",
        `Checked at: ${new Date().toISOString()}`,
        `Reason: ${redact(errorMessage(error))}`,
        "",
        "Raw provider stdout, identifiers, tokens, secrets, deploy keys, cookies, and sessions are not stored.",
        ""
      ].join("\n")
    );
    io.write(`FAIL provider bootstrap ${environment}`);
    io.write("Evidence: m2-provider-bootstrap");
    io.write(`Reason: ${redact(errorMessage(error))}`);
    io.write("Provider mutation: partial or failed provider bootstrap");
    io.write(`Local mutation: ${evidenceDir}/provider-bootstrap.txt`);
    io.write("Telemetry mutation: none");
    return 1;
  }
}

export async function m2ProviderLinkCommand(argv: string[], io: RunIo): Promise<number | undefined> {
  const options = parseOptions(argv);
  if (options.service !== undefined) {
    return undefined;
  }

  const environment = readPreviewEnvironment(options.env, "Run agentstack provider link --env preview.");
  const state = await readProviderResourcesState(io.cwd);
  const missing = requiredProviderResources(state).filter((resource) => resource === undefined);
  if (missing.length > 0) {
    io.write(`FAIL provider link ${environment}`);
    io.write("Evidence: m2-provider-link");
    io.write("Reason: missing provider bootstrap state");
    io.write(`Fix: Run agentstack provider bootstrap --env preview --confirm-live-mutation.`);
    io.write("Provider mutation: none");
    io.write("Local mutation: none");
    return 1;
  }

  await writeText(
    io.cwd,
    providerLinksPath,
    `${JSON.stringify(
      {
        environment,
        links: state.resources.map(({ service, resourceType, name }) => ({
          service,
          resourceType,
          name,
          environment,
          linkedAt: new Date().toISOString()
        }))
      },
      null,
      2
    )}\n`
  );
  await writeText(
    io.cwd,
    `${evidenceDir}/provider-links.txt`,
    [
      "# M2 Provider Link Evidence",
      "",
      "Result: PASS",
      `Checked at: ${new Date().toISOString()}`,
      "Clerk preview application: linked",
      "Convex preview deployment: linked",
      "Vercel preview project: linked",
      `Local mutation: ${providerLinksPath}`,
      "Provider mutation: none",
      "Telemetry mutation: none",
      ""
    ].join("\n")
  );

  io.write(`PASS provider link ${environment}`);
  io.write("Evidence: m2-provider-link");
  io.write("Linked: clerk preview application");
  io.write("Linked: convex preview deployment");
  io.write("Linked: vercel preview project");
  io.write(`Local mutation: ${providerLinksPath}`);
  io.write(`Local mutation: ${evidenceDir}/provider-links.txt`);
  io.write("Provider mutation: none");
  return 0;
}

export async function m2DeployPreviewLiveCommand(argv: string[], io: RunIo): Promise<number | undefined> {
  const options = parseOptions(argv);
  const environment = readPreviewEnvironment(options.env, "Run agentstack deploy --env preview --confirm-live-mutation.");
  if (environment !== "preview" || options["confirm-live-mutation"] !== true) {
    return undefined;
  }

  const context = await loadProjectContext(io.cwd);
  const slug = context.manifest.app.slug;
  const state = await readProviderResourcesState(io.cwd);
  await requireProviderLinks(io.cwd);
  const executor = resolveExecutor(io);
  const convexEnv = await readEnvFile(join(io.cwd, convexPreviewEnvPath));

  try {
    const convex = await runProvider(executor, {
      cwd: join(io.cwd, "apps", "convex"),
      env: { ...convexEnv },
      args: ["convex", "deploy", "--preview-name", `${slug}-preview`],
      hint: "Run agentstack provider bootstrap --env preview --confirm-live-mutation to create the Convex preview deploy key."
    });
    if (convex.exitCode !== 0) {
      throw new Error(`Convex preview deploy failed. ${providerDetail(convex)}`);
    }

    const vercel = await runProvider(executor, {
      cwd: join(io.cwd, "apps", "web"),
      args: [
        "vercel",
        "deploy",
        "--target=preview",
        "--yes",
        "--force",
        ...vercelBuildEnvArgs(state),
        ...vercelScopeArgs(state)
      ],
      hint: "Run pnpm exec vercel login if the Vercel CLI is not authenticated."
    });
    if (vercel.exitCode !== 0) {
      throw new Error(`Vercel preview deploy failed. ${providerDetail(vercel)}`);
    }

    const deployUrl = extractDeployUrl(`${vercel.stdout}\n${vercel.stderr}`);
    if (!deployUrl) {
      throw new Error("Vercel preview deploy completed without a parseable vercel.app URL.");
    }

    await writeText(io.cwd, `${evidenceDir}/deploy-url.txt`, `${deployUrl}\n`);
    await writeText(
      io.cwd,
      `${evidenceDir}/deploy-output.txt`,
      [
        "# M2 Preview Deploy Output",
        "",
        "Result: PASS",
        `Checked at: ${new Date().toISOString()}`,
        "Convex apply: completed",
        "Vercel apply: completed",
        `Deploy URL: ${deployUrl}`,
        "",
        "Raw provider stdout, identifiers, tokens, secrets, deploy keys, cookies, and sessions are not stored.",
        ""
      ].join("\n")
    );

    io.write("PASS deploy preview");
    io.write("Evidence: m2-preview-deploy");
    io.write(`Deploy URL: ${deployUrl}`);
    io.write("Provider mutation: convex preview deploy, vercel preview deploy");
    io.write(`Local mutation: ${evidenceDir}/deploy-url.txt`);
    io.write(`Local mutation: ${evidenceDir}/deploy-output.txt`);
    io.write(`Resources: ${state.resources.length}`);
    return 0;
  } catch (error) {
    await rm(join(io.cwd, evidenceDir, "deploy-url.txt"), { force: true });
    await writeText(
      io.cwd,
      `${evidenceDir}/deploy-output.txt`,
      [
        "# M2 Preview Deploy Output",
        "",
        "Result: FAIL",
        `Checked at: ${new Date().toISOString()}`,
        `Reason: ${redact(errorMessage(error))}`,
        ""
      ].join("\n")
    );
    io.write("FAIL deploy preview");
    io.write("Evidence: m2-preview-deploy");
    io.write(`Reason: ${redact(errorMessage(error))}`);
    io.write("Provider mutation: partial or failed preview deploy");
    io.write(`Local mutation: ${evidenceDir}/deploy-output.txt`);
    return 1;
  }
}

export async function m2AuthUserCommand(argv: string[], io: RunIo): Promise<number> {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const [maybeAction, ...rest] = normalizedArgv;
  const action = maybeAction && !maybeAction.startsWith("--") ? maybeAction : "ensure";
  const options = parseOptions(maybeAction && !maybeAction.startsWith("--") ? rest : normalizedArgv);
  const environment = readPreviewEnvironment(options.env, "Run agentstack auth user ensure --env preview --confirm-live-mutation.");

  if (!["ensure", "update", "delete"].includes(action)) {
    io.write("FAIL auth.user.action-invalid");
    io.write("Evidence: m2-auth-user");
    io.write(`Reason: unsupported action ${action}`);
    return 1;
  }

  if (options["confirm-live-mutation"] !== true) {
    io.write("FAIL auth.user.confirmation-required");
    io.write("Evidence: m2-auth-user");
    io.write("Provider mutation: none");
    io.write("Local mutation: none");
    return 1;
  }

  const context = await loadProjectContext(io.cwd);
  const slug = context.manifest.app.slug;
  const executor = resolveExecutor(io);
  const email = `${slug}+m2-smoke+clerk_test@example.com`;
  const owner = await readClerkOwner({ cwd: io.cwd, executor });

  try {
    if (action === "delete") {
      const state = await readAuthUserState(io.cwd);
      await runRequiredProvider(executor, {
        cwd: io.cwd,
        args: ["clerk", "api", `/users/${state.userId}`, "--method", "DELETE", "--yes"],
        hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
      });
      await rm(join(io.cwd, authUserStatePath), { force: true });
      await writeAuthEvidence(io.cwd, "PASS", action, ["Clerk smoke user: deleted", `Owner: ${owner}`]);
      io.write("PASS auth user delete");
      io.write("Evidence: m2-auth-user");
      io.write("Clerk smoke user: deleted");
      io.write("Provider mutation: clerk user delete");
      io.write(`Local mutation: removed ${authUserStatePath}`);
      return 0;
    }

    const password = `Ag3ntstack-${randomBytes(18).toString("base64url")}!`;
    const existing = await findClerkUserByEmail({ cwd: io.cwd, executor, email });
    const userId = existing?.id ?? (await createClerkUser({ cwd: io.cwd, executor, email, password })).id;
    if (!userId) {
      throw new Error("Clerk smoke user id was unavailable after create/reuse.");
    }
    await updateClerkUser({ cwd: io.cwd, executor, userId, password });
    await writeText(
      io.cwd,
      authUserStatePath,
      `${JSON.stringify(
        {
          service: "clerk",
          environment,
          email,
          userId,
          password,
          updatedAt: new Date().toISOString()
        } satisfies M2AuthUserState,
        null,
        2
      )}\n`
    );
    await writeAuthEvidence(io.cwd, "PASS", action, [
      "Clerk smoke user: created or reused",
      "Client trust bypass: requested",
      `Local credential state: ${authUserStatePath}`
    ]);
    io.write(`PASS auth user ${action}`);
    io.write("Evidence: m2-auth-user");
    io.write("Clerk smoke user: created or reused");
    io.write("Client trust bypass: requested");
    io.write("Provider mutation: clerk user create/update");
    io.write(`Local mutation: ${authUserStatePath}`);
    io.write(`Local mutation: ${evidenceDir}/clerk-smoke-user.txt`);
    return 0;
  } catch (error) {
    await writeAuthEvidence(io.cwd, "FAIL", action, [`Reason: ${redact(errorMessage(error))}`]);
    io.write(`FAIL auth user ${action}`);
    io.write("Evidence: m2-auth-user");
    io.write(`Reason: ${redact(errorMessage(error))}`);
    io.write("Provider mutation: partial or failed Clerk user lifecycle");
    io.write(`Local mutation: ${evidenceDir}/clerk-smoke-user.txt`);
    return 1;
  }
}

export async function m2SmokeCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readPreviewEnvironment(options.env, "Run agentstack smoke --env preview --url <url> --dom-file <path>.");
  const url = readRequiredOption(options.url, "url", "Run agentstack smoke --env preview --url <url> --dom-file <path>.");
  const domFile = readRequiredOption(options["dom-file"], "dom-file", "Run agentstack smoke --env preview --url <url> --dom-file <path>.");
  const parsedUrl = parseHttpsUrl(url, "--url");
  const deployEvidence = await readDeployEvidence(io.cwd);
  const deployFailures = validateDeployEvidence(deployEvidence, parsedUrl.href);
  if (deployFailures.length > 0) {
    io.write(`FAIL smoke ${environment}`);
    io.write("Evidence: m2-preview-smoke");
    deployFailures.forEach((failure) => io.write(`Reason: ${failure}`));
    io.write("Provider mutation: none");
    io.write("Local mutation: none");
    return 1;
  }

  const dom = await readFile(resolve(io.cwd, domFile), "utf8");
  const authStates = getAttributeValues(dom, "data-agentstack-auth-state");
  const protectedStates = getAttributeValues(dom, "data-agentstack-protected-data-state");
  const workspaceIds = getAttributeValues(dom, "data-agentstack-protected-workspace-id").filter(Boolean);
  const failures: string[] = [];
  if (isVercelDeploymentProtection(dom)) {
    failures.push("vercel deployment protection page detected");
  }
  if (!authStates.includes("signed-in")) {
    failures.push('missing data-agentstack-auth-state="signed-in"');
  }
  if (!protectedStates.includes("protected-data-loaded")) {
    failures.push('missing data-agentstack-protected-data-state="protected-data-loaded"');
  }
  if (workspaceIds.length === 0) {
    failures.push("missing non-empty data-agentstack-protected-workspace-id");
  }

  await writeText(
    io.cwd,
    `${evidenceDir}/smoke-output.txt`,
    [
      "# M2 Preview Smoke Output",
      "",
      `Result: ${failures.length === 0 ? "PASS" : "FAIL"}`,
      `Checked at: ${new Date().toISOString()}`,
      `Deploy URL: ${parsedUrl.href}`,
      `Auth state: ${authStates.includes("signed-in") ? "signed-in" : "missing signed-in"}`,
      `Protected data state: ${
        protectedStates.includes("protected-data-loaded") ? "protected-data-loaded" : "missing protected-data-loaded"
      }`,
      `Workspace id: ${workspaceIds.length > 0 ? "present (redacted)" : "missing"}`,
      ...failures.map((failure) => `Reason: ${failure}`),
      "",
      "Raw DOM snapshots, provider identifiers, cookies, and tokens are not stored.",
      ""
    ].join("\n")
  );

  if (failures.length > 0) {
    io.write(`FAIL smoke ${environment}`);
    io.write("Evidence: m2-preview-smoke");
    failures.forEach((failure) => io.write(`Reason: ${failure}`));
    io.write(`Local mutation: ${evidenceDir}/smoke-output.txt`);
    return 1;
  }

  io.write(`PASS smoke ${environment}`);
  io.write("Evidence: m2-preview-smoke");
  io.write(`Deploy URL: ${parsedUrl.href}`);
  io.write("Auth state: signed-in");
  io.write("Protected data state: protected-data-loaded");
  io.write("Workspace id: present (redacted)");
  io.write(`Local mutation: ${evidenceDir}/smoke-output.txt`);
  return 0;
}

export async function m2EvidenceCheckCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readPreviewEnvironment(options.env, "Run agentstack evidence check --env preview.");
  const required = [
    ["provider bootstrap evidence", `${evidenceDir}/provider-bootstrap.txt`, "Result: PASS"],
    ["provider link evidence", `${evidenceDir}/provider-links.txt`, "Result: PASS"],
    ["deploy URL evidence", `${evidenceDir}/deploy-url.txt`, "https://"],
    ["deploy output evidence", `${evidenceDir}/deploy-output.txt`, "Result: PASS"],
    ["Clerk smoke user evidence", `${evidenceDir}/clerk-smoke-user.txt`, "Result: PASS"],
    ["smoke output evidence", `${evidenceDir}/smoke-output.txt`, "Result: PASS"]
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
    io.write("Evidence: m2-evidence-check");
    failures.forEach((failure) => io.write(`Reason: ${failure}`));
    io.write("Provider mutation: none");
    io.write("Local mutation: none");
    return 1;
  }

  io.write(`PASS evidence check ${environment}`);
  io.write("Evidence: m2-evidence-check");
  io.write("Checked: provider bootstrap evidence");
  io.write("Checked: provider link evidence");
  io.write("Checked: deploy evidence");
  io.write("Checked: Clerk smoke user evidence");
  io.write("Checked: smoke evidence");
  io.write("Provider mutation: none");
  io.write("Local mutation: none");
  return 0;
}

async function bootstrapClerk(input: {
  cwd: string;
  executor: ProviderCommandExecutor;
  slug: string;
  notes: string[];
}): Promise<M2ProviderResource> {
  const webCwd = join(input.cwd, "apps", "web");
  const whoami = await runRequiredProvider(input.executor, {
    cwd: input.cwd,
    args: ["clerk", "whoami", "--json"],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
  const owner = parseJson(whoami.stdout, "clerk whoami").email ?? "clerk-authenticated-user";
  const expectedName = `${input.slug}-preview`;
  let apps = await listClerkApps(input.cwd, input.executor);
  let app = apps.find((candidate) => candidate.name === expectedName);
  if (!app) {
    input.notes.push("Clerk preview application: creating");
    await runRequiredProvider(input.executor, {
      cwd: input.cwd,
      args: ["clerk", "apps", "create", expectedName, "--json"],
      hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
    });
    apps = await listClerkApps(input.cwd, input.executor);
    app = apps.find((candidate) => candidate.name === expectedName);
  } else {
    input.notes.push("Clerk preview application: reusing exact-name application");
  }
  if (!app?.id || !app.publishableKey) {
    throw new Error("Clerk bootstrap could not discover the preview application id and publishable key.");
  }

  await runRequiredProvider(input.executor, {
    cwd: input.cwd,
    args: ["clerk", "link", "--app", app.id],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
  await ensureClerkJwtTemplate(input.cwd, input.executor, input.notes);

  return {
    service: "clerk",
    resourceType: "application",
    name: expectedName,
    owner,
    externalId: app.id,
    publishableKey: app.publishableKey,
    issuerDomain: clerkIssuerDomainFromPublishableKey(app.publishableKey)
  };
}

async function bootstrapConvex(input: {
  cwd: string;
  executor: ProviderCommandExecutor;
  slug: string;
  clerk: M2ProviderResource;
  notes: string[];
}): Promise<M2ProviderResource> {
  const name = `${input.slug}-preview`;
  const convexCwd = join(input.cwd, "apps", "convex");
  const create = await runProvider(input.executor, {
    cwd: convexCwd,
    args: ["convex", "deployment", "create", name, "--type", "preview", "--expiration", "in 5 days"]
  });
  if (create.exitCode !== 0 && !/already exists|already.*deployment/i.test(`${create.stdout}\n${create.stderr}`)) {
    throw new Error(
      "Convex preview deployment bootstrap needs an authenticated Convex project context in apps/convex. Run cd apps/convex && pnpm exec convex dev --once --configure new or existing."
    );
  }
  const combined = `${create.stdout}\n${create.stderr}`;
  const deploymentReference =
    parseConvexDeploymentReference(combined) ?? (await readConvexProjectDeploymentReference(input.cwd, name)) ?? name;
  const convexUrl = parseConvexUrl(combined);
  const issuerDomain = input.clerk.issuerDomain;
  if (!issuerDomain) {
    throw new Error("Clerk issuer domain could not be derived for Convex auth.");
  }

  await runRequiredProvider(input.executor, {
    cwd: convexCwd,
    args: ["convex", "env", "--deployment", deploymentReference, "set", "CLERK_JWT_ISSUER_DOMAIN", issuerDomain],
    hint: "Run cd apps/convex && pnpm exec convex dev --once --configure existing if the Convex CLI is not authenticated."
  });
  await mkdir(join(input.cwd, ".agentstack"), { recursive: true });
  await runRequiredProvider(input.executor, {
    cwd: convexCwd,
    args: [
      "convex",
      "deployment",
      "token",
      "create",
      `agentstack-m2-preview-${Date.now()}`,
      "--deployment",
      deploymentReference,
      "--save-env",
      join(input.cwd, convexPreviewEnvPath)
    ],
    hint: "Run cd apps/convex && pnpm exec convex dev --once --configure existing if the Convex CLI is not authenticated."
  });

  return {
    service: "convex",
    resourceType: "deployment",
    name,
    owner: parseConvexOwner(deploymentReference) ?? "convex-selected-project",
    externalId: deploymentReference,
    url: convexUrl
  };
}

async function bootstrapVercel(input: {
  cwd: string;
  executor: ProviderCommandExecutor;
  slug: string;
  clerk: M2ProviderResource;
  convex: M2ProviderResource;
  notes: string[];
}): Promise<M2ProviderResource> {
  const webCwd = join(input.cwd, "apps", "web");
  const whoami = await runRequiredProvider(input.executor, {
    cwd: input.cwd,
    args: ["vercel", "whoami"],
    hint: "Run pnpm exec vercel login if the Vercel CLI is not authenticated."
  });
  const account = parseLastNonCliLine(whoami.stdout) ?? "vercel-authenticated-user";
  const projects = await listVercelProjects(input.cwd, input.executor);
  const existing = projects.find((project) => project.name === input.slug);
  if (!existing) {
    input.notes.push("Vercel preview project: creating");
    const add = await runProvider(input.executor, {
      cwd: input.cwd,
      args: ["vercel", "project", "add", input.slug]
    });
    if (add.exitCode !== 0 && !/already exists|conflict/i.test(`${add.stdout}\n${add.stderr}`)) {
      throw new Error(`Vercel project creation failed. ${providerDetail(add)}`);
    }
  } else {
    input.notes.push("Vercel preview project: reusing exact-name project");
  }

  await runRequiredProvider(input.executor, {
    cwd: webCwd,
    args: ["vercel", "link", "--yes", "--project", input.slug, ...vercelScopeArgsForOwner(existing?.owner)],
    hint: "Run pnpm exec vercel login if the Vercel CLI is not authenticated."
  });
  const projectLink = await readVercelProjectLink(webCwd);
  const projectId = projectLink?.projectId ?? existing?.id;
  const owner = projectLink?.orgId ?? existing?.owner ?? account;
  if (!projectId) {
    throw new Error("Vercel bootstrap linked the project but could not discover a project id.");
  }

  await setVercelPreviewEnv(webCwd, input.executor, "VITE_CLERK_PUBLISHABLE_KEY", input.clerk.publishableKey);
  if (input.convex.url) {
    await setVercelPreviewEnv(webCwd, input.executor, "VITE_CONVEX_URL", input.convex.url);
  }

  return {
    service: "vercel",
    resourceType: "project",
    name: input.slug,
    owner,
    externalId: projectId
  };
}

async function listClerkApps(cwd: string, executor: ProviderCommandExecutor): Promise<ClerkAppRow[]> {
  const result = await runRequiredProvider(executor, {
    cwd,
    args: ["clerk", "apps", "list", "--json"],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
  const parsed = parseJson(result.stdout, "clerk apps list");
  const rawApps: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
  return rawApps
    .filter((entry: unknown) => entry && typeof entry === "object")
    .map((entry: unknown) => {
      const app = entry as Record<string, unknown>;
      return {
        id: firstString(app.application_id, app.id, app.resource_id),
        name: firstString(app.name, app.slug, app.display_name),
        publishableKey: firstString(
          ...(Array.isArray(app.instances)
            ? app.instances.map((instance) =>
                firstString(
                  (instance as Record<string, unknown> | undefined)?.publishable_key,
                  (instance as Record<string, unknown> | undefined)?.publishableKey
                )
              )
            : []),
          app.publishable_key,
          app.publishableKey
        )
      };
    })
    .filter((entry) => entry.id && entry.name);
}

async function ensureClerkJwtTemplate(cwd: string, executor: ProviderCommandExecutor, notes: string[]): Promise<void> {
  const list = await runRequiredProvider(executor, {
    cwd,
    args: ["clerk", "api", "/jwt_templates"],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
  const parsed = parseJson(list.stdout, "clerk jwt templates list");
  const rawTemplates: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
  const templates = rawTemplates
    .map(normalizeClerkJwtTemplate)
    .filter((template) => template.id && template.name);
  if (templates.some((template) => template.name === "convex")) {
    notes.push("Clerk JWT template: reusing convex");
    return;
  }
  await runRequiredProvider(executor, {
    cwd,
    args: ["clerk", "api", "/jwt_templates", "--data", JSON.stringify({ name: "convex", claims: { aud: "convex" } }), "--yes"],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
  notes.push("Clerk JWT template: creating convex");
}

function normalizeClerkJwtTemplate(entry: unknown): { id?: string; name?: string } {
  if (!entry || typeof entry !== "object") {
    return {};
  }
  const value = entry as Record<string, unknown>;
  return {
    id: firstString(value.id, value.template_id, value.jwt_template_id),
    name: firstString(value.name, value.slug)
  };
}

async function listVercelProjects(cwd: string, executor: ProviderCommandExecutor): Promise<VercelProjectRow[]> {
  const result = await runRequiredProvider(executor, {
    cwd,
    args: ["vercel", "project", "ls", "--json"],
    hint: "Run pnpm exec vercel login if the Vercel CLI is not authenticated."
  });
  const parsed = parseJson(result.stdout.replace(/^Vercel CLI .*\n/, ""), "vercel project ls");
  const rawProjects: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.projects) ? parsed.projects : [];
  return rawProjects
    .filter((entry: unknown) => entry && typeof entry === "object")
    .map((entry: unknown) => {
      const project = entry as Record<string, unknown>;
      return {
        id: firstString(project.id, project.projectId, project.project_id),
        name: firstString(project.name),
        owner: firstString(project.accountId, project.account_id, project.ownerId, project.owner_id, project.orgId, project.org_id)
      };
    })
    .filter((entry) => entry.id && entry.name);
}

async function setVercelPreviewEnv(
  cwd: string,
  executor: ProviderCommandExecutor,
  name: string,
  value: string | undefined
): Promise<void> {
  if (!value) {
    throw new Error(`Cannot configure Vercel preview env ${name}; value is missing.`);
  }
  await runProvider(executor, { cwd, args: ["vercel", "env", "rm", name, "preview", "--yes"] });
  await runRequiredProvider(executor, {
    cwd,
    args: ["vercel", "env", "add", name, "preview"],
    stdin: `${value}\n`,
    hint: "Run pnpm exec vercel login if the Vercel CLI is not authenticated."
  });
}

async function readClerkOwner(input: { cwd: string; executor: ProviderCommandExecutor }): Promise<string> {
  const result = await runRequiredProvider(input.executor, {
    cwd: input.cwd,
    args: ["clerk", "whoami", "--json"],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
  return parseJson(result.stdout, "clerk whoami").email ?? "clerk-authenticated-user";
}

async function findClerkUserByEmail(input: {
  cwd: string;
  executor: ProviderCommandExecutor;
  email: string;
}): Promise<{ id?: string; email?: string } | undefined> {
  const result = await runRequiredProvider(input.executor, {
    cwd: input.cwd,
    args: ["clerk", "api", `/users?email_address=${encodeURIComponent(input.email)}`],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
  const parsed = parseJson(result.stdout, "clerk users list");
  const users: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
  return users.map(normalizeClerkUser).find((candidate) => candidate.id);
}

async function createClerkUser(input: { cwd: string; executor: ProviderCommandExecutor; email: string; password: string }) {
  const payload = {
    email_address: [input.email],
    password: input.password,
    skip_password_checks: true,
    skip_password_requirement: false
  };
  const result = await runRequiredProvider(input.executor, {
    cwd: input.cwd,
    args: ["clerk", "api", "/users", "--data", JSON.stringify(payload), "--yes"],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
  return normalizeClerkUser(parseJson(result.stdout, "clerk user create"));
}

async function updateClerkUser(input: { cwd: string; executor: ProviderCommandExecutor; userId: string; password: string }) {
  const payload = {
    password: input.password,
    skip_password_checks: true,
    bypass_client_trust: true
  };
  await runRequiredProvider(input.executor, {
    cwd: input.cwd,
    args: ["clerk", "api", `/users/${input.userId}`, "--method", "PATCH", "--data", JSON.stringify(payload), "--yes"],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
  await runRequiredProvider(input.executor, {
    cwd: input.cwd,
    args: [
      "clerk",
      "api",
      `/users/${input.userId}/metadata`,
      "--method",
      "PATCH",
      "--data",
      JSON.stringify({ public_metadata: { agentstack: "m2", fixture: "clerk-smoke-user" } }),
      "--yes"
    ],
    hint: "Run pnpm exec clerk auth login if the Clerk CLI is not authenticated."
  });
}

function normalizeClerkUser(entry: unknown): { id?: string; email?: string } {
  if (!entry || typeof entry !== "object") {
    return {};
  }
  const value = entry as Record<string, unknown>;
  return {
    id: firstString(value.id, value.user_id),
    email: firstString(
      value.email_address,
      ...(Array.isArray(value.email_addresses)
        ? value.email_addresses.map((emailEntry) =>
            firstString(
              (emailEntry as Record<string, unknown> | undefined)?.email_address,
              (emailEntry as Record<string, unknown> | undefined)?.emailAddress
            )
          )
        : [])
    )
  };
}

async function writeAuthEvidence(cwd: string, result: "PASS" | "FAIL", action: string, notes: string[]): Promise<void> {
  await writeText(
    cwd,
    `${evidenceDir}/clerk-smoke-user.txt`,
    [
      "# M2 Clerk Smoke User Evidence",
      "",
      `Result: ${result}`,
      `Checked at: ${new Date().toISOString()}`,
      `Action: ${action}`,
      "Provider: clerk",
      "Resource type: user",
      "Environment: preview",
      ...notes.map((note) => redact(note)),
      "",
      "Raw passwords, OTP codes, session tokens, cookies, provider stdout, and full user payloads are not stored.",
      ""
    ].join("\n")
  );
}

function requiredProviderResources(state: M2ProviderResourcesState): Array<M2ProviderResource | undefined> {
  return [
    state.resources.find((resource) => resource.service === "clerk" && resource.resourceType === "application"),
    state.resources.find((resource) => resource.service === "convex" && resource.resourceType === "deployment"),
    state.resources.find((resource) => resource.service === "vercel" && resource.resourceType === "project")
  ];
}

async function requireProviderLinks(cwd: string): Promise<void> {
  const text = await readOptionalText(cwd, providerLinksPath);
  if (!text) {
    throw new Error("Missing provider link state. Run agentstack provider link --env preview.");
  }
  JSON.parse(text);
}

async function readProviderResourcesState(cwd: string): Promise<M2ProviderResourcesState> {
  const text = await readOptionalText(cwd, providerResourcesPath);
  if (!text) {
    return { environment: "preview", resources: [], updatedAt: new Date(0).toISOString() };
  }
  return JSON.parse(text) as M2ProviderResourcesState;
}

async function writeProviderResourcesState(cwd: string, resources: M2ProviderResource[]): Promise<void> {
  await writeText(
    cwd,
    providerResourcesPath,
    `${JSON.stringify({ environment: "preview", resources, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}

async function readAuthUserState(cwd: string): Promise<M2AuthUserState> {
  const text = await readOptionalText(cwd, authUserStatePath);
  if (!text) {
    throw new Error("Missing .agentstack/auth-user.json. Run agentstack auth user ensure --confirm-live-mutation first.");
  }
  return JSON.parse(text) as M2AuthUserState;
}

async function readDeployEvidence(cwd: string): Promise<{ url?: string; output?: string }> {
  return {
    url: await readOptionalText(cwd, `${evidenceDir}/deploy-url.txt`),
    output: await readOptionalText(cwd, `${evidenceDir}/deploy-output.txt`)
  };
}

function validateDeployEvidence(evidence: { url?: string; output?: string }, expectedUrl: string): string[] {
  const failures: string[] = [];
  if (!evidence.url) {
    failures.push("missing deploy URL evidence");
  } else if (normalizeUrl(evidence.url.trim()) !== expectedUrl) {
    failures.push("deploy URL evidence does not match --url");
  }
  if (!evidence.output) {
    failures.push("missing deploy output evidence");
  } else {
    if (!evidence.output.includes("Result: PASS")) {
      failures.push("deploy output evidence is not PASS");
    }
    const outputDeployUrl = evidence.output.match(/^Deploy URL:\s*(\S+)\s*$/m)?.[1];
    if (!outputDeployUrl || normalizeUrl(outputDeployUrl) !== expectedUrl) {
      failures.push("deploy output evidence does not match --url");
    }
  }
  return failures;
}

async function readEnvFile(path: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  const text = await readOptionalAbsoluteText(path);
  if (!text) {
    return env;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    env[trimmed.slice(0, separator)] = trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, "");
  }
  return env;
}

async function readVercelProjectLink(cwd: string): Promise<{ projectId?: string; orgId?: string } | undefined> {
  const text = await readOptionalText(cwd, ".vercel/project.json");
  if (!text) {
    return undefined;
  }
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return {
    projectId: firstString(parsed.projectId, parsed.project_id),
    orgId: firstString(parsed.orgId, parsed.org_id)
  };
}

async function readConvexProjectDeploymentReference(cwd: string, deploymentName: string): Promise<string | undefined> {
  const envLocal = await readOptionalText(cwd, "apps/convex/.env.local");
  const context = envLocal?.match(/#\s*team:\s*([a-z0-9_-]+),\s*project:\s*([a-z0-9_-]+)/i);
  return context ? `${context[1]}:${context[2]}:preview/${deploymentName}` : undefined;
}

function resolveExecutor(io: RunIo): ProviderCommandExecutor {
  return io.providerExecutor ?? {
    async execute(command, args, options) {
      return await new Promise((resolve) => {
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
          resolve({ exitCode: 127, stdout, stderr: `${stderr}\n${error.message}`, durationMs: 0 });
        });
        child.on("close", (exitCode) => {
          resolve({ exitCode: exitCode ?? 1, stdout, stderr, durationMs: 0 });
        });
      });
    }
  };
}

async function runRequiredProvider(
  executor: ProviderCommandExecutor,
  input: { cwd: string; args: string[]; hint: string; stdin?: string; env?: Record<string, string | undefined> }
): Promise<ProviderRunResult> {
  const result = await runProvider(executor, input);
  if (result.exitCode !== 0) {
    throw new Error(`Provider command failed: pnpm exec ${input.args.join(" ")}. ${providerDetail(result)} ${input.hint}`);
  }
  return result;
}

async function runProvider(
  executor: ProviderCommandExecutor,
  input: { cwd: string; args: string[]; hint?: string; stdin?: string; env?: Record<string, string | undefined> }
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
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    if (current === root) {
      return undefined;
    }
    current = dirname(current);
  }
}

function providerDetail(result: ProviderRunResult): string {
  return redact(result.stderr.trim() || result.stdout.trim())
    .split(/\r?\n/)
    .slice(0, 8)
    .join(" ");
}

function vercelScopeArgs(state: M2ProviderResourcesState): string[] {
  const owner = state.resources.find(
    (resource) => resource.service === "vercel" && resource.resourceType === "project"
  )?.owner;
  return vercelScopeArgsForOwner(owner);
}

function vercelScopeArgsForOwner(owner: string | undefined): string[] {
  return owner ? ["--scope", owner] : [];
}

function vercelBuildEnvArgs(state: M2ProviderResourcesState): string[] {
  const clerk = state.resources.find(
    (resource) => resource.service === "clerk" && resource.resourceType === "application"
  );
  const convex = state.resources.find(
    (resource) => resource.service === "convex" && resource.resourceType === "deployment"
  );
  const args: string[] = [];
  if (clerk?.publishableKey) {
    args.push("--build-env", `VITE_CLERK_PUBLISHABLE_KEY=${clerk.publishableKey}`);
  }
  if (convex?.url) {
    args.push("--build-env", `VITE_CONVEX_URL=${convex.url}`);
  }
  return args;
}

function parseOptions(argv: string[]): Options {
  const parsed: Options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function readPreviewEnvironment(value: string | boolean | undefined, fix: string): "preview" {
  if (value === undefined || value === false) {
    return "preview";
  }
  if (value === "preview") {
    return "preview";
  }
  throw new Error(["FAIL m2.environment.unsupported", "M2 live preview commands support --env preview only.", `Fix: ${fix}`].join("\n"));
}

function readRequiredOption(value: string | boolean | undefined, flag: string, fix: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new Error(["FAIL cli.option.missing", `--${flag} requires a value.`, `Fix: ${fix}`].join("\n"));
}

function parseJson(value: string, label: string): any {
  const trimmed = value.trim();
  const objectIndex = trimmed.indexOf("{");
  const arrayIndex = trimmed.indexOf("[");
  const indexes = [objectIndex, arrayIndex].filter((index) => index >= 0);
  const start = indexes.length > 0 ? Math.min(...indexes) : 0;
  try {
    return JSON.parse(trimmed.slice(start));
  } catch {
    throw new Error(`Could not parse ${label} JSON output.`);
  }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function clerkIssuerDomainFromPublishableKey(publishableKey: string): string | undefined {
  const encoded = publishableKey.match(/^pk_(?:test|live)_([A-Za-z0-9_-]+)/)?.[1];
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

function parseLastNonCliLine(value: string): string | undefined {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("Vercel CLI "))
    .at(-1);
}

function parseConvexDeploymentReference(output: string): string | undefined {
  return output.match(/\b([a-z0-9_-]+:[a-z0-9_-]+:preview\/[a-z0-9_-]+)\b/i)?.[1];
}

function parseConvexUrl(output: string): string | undefined {
  return output.match(/\bhttps:\/\/[a-z0-9-]+\.convex\.cloud\b/i)?.[0];
}

function parseConvexOwner(output: string): string | undefined {
  const reference = output.match(/\b([a-z0-9_-]+):([a-z0-9_-]+):preview\/[a-z0-9_-]+\b/i);
  return reference ? `${reference[1]}:${reference[2]}` : undefined;
}

function extractDeployUrl(output: string): string | undefined {
  return output.match(/https:\/\/[^\s"'<>]+\.vercel\.app\b[^\s"'<>]*/)?.[0];
}

function parseHttpsUrl(value: string, flag: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("not https");
    }
    return url;
  } catch {
    throw new Error(`Invalid ${flag}: expected an https URL.`);
  }
}

function normalizeUrl(value: string): string {
  return parseHttpsUrl(value, "url").href;
}

function getAttributeValues(markup: string, attributeName: string): string[] {
  const escaped = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "g");
  const values: string[] = [];
  let match = pattern.exec(markup);
  while (match) {
    values.push(match[1] ?? match[2] ?? match[3] ?? "");
    match = pattern.exec(markup);
  }
  return values;
}

function isVercelDeploymentProtection(markup: string): boolean {
  return (
    /<title>\s*Login\s+[–-]\s+Vercel\s*<\/title>/i.test(markup) ||
    (/Log in to Vercel/i.test(markup) && /Continue with (Email|GitHub|Google)/i.test(markup))
  );
}

async function writeText(cwd: string, relativePath: string, text: string): Promise<void> {
  const path = join(cwd, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}

async function readOptionalText(cwd: string, relativePath: string): Promise<string | undefined> {
  try {
    return await readFile(join(cwd, relativePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function readOptionalAbsoluteText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redact(value: string): string {
  return value
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{10,}\b/g, "[REDACTED]")
    .replace(/\b[A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Z0-9_]*=[^\s]+/gi, "[REDACTED]")
    .replace(/Ag3ntstack-[A-Za-z0-9_-]+!/g, "[REDACTED]");
}

function writeProviderBootstrapUsage(io: RunIo): void {
  io.write("Usage: agentstack provider bootstrap --env preview --confirm-live-mutation");
  io.write("Creates or reuses preview Clerk, Convex, and Vercel resources using provider CLIs.");
}
