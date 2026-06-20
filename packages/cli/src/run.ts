import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LocalCloudAdapter } from "@agentstack/adapters";
import {
  buildEnvGraph,
  formatDiagnostic,
  getRequiredGeneratedAnchors,
  planTelemetryEventFiles,
  planFeatureFiles,
  validateCustomEnvValues,
  validateGeneratedAnchors,
  validateLocalProject,
  validateThemeTokens,
  type EnvValueState,
  type AgentstackManifest,
  type Diagnostic,
  type EnvironmentName,
  type SurfaceName
} from "@agentstack/core";
import {
  createWideEvent,
  JsonlTelemetryStore,
  type TelemetryEnvironment,
  type TelemetryQuery,
  type TelemetrySurface
} from "@agentstack/telemetry";
import { loadLocalEnvValues, loadProjectContext } from "./context.js";

export type RunIo = {
  cwd: string;
  write: (line: string) => void;
};

type ParsedOptions = Record<string, string | boolean>;

const environmentValues = ["development", "preview", "production"] as const;
const surfaceValues = ["web", "mobile", "convex"] as const;
const telemetrySurfaceValues = [
  "web",
  "mobile",
  "convex",
  "clerk",
  "vercel",
  "eas",
  "cli",
  "control-plane"
] as const;

const observeValueOptions = [
  "env",
  "surface",
  "event",
  "journey",
  "trace",
  "correlation",
  "journey-id"
] as const;

export async function runAgentstack(argv: string[], io: RunIo): Promise<number> {
  try {
    const [command, subcommand, ...rest] = argv;

    if (command === "validate") {
      return await validateCommand(argv.slice(1), io);
    }

    if (command === "sync") {
      return await syncCommand(argv.slice(1), io);
    }

    if (command === "deploy") {
      return await deployCommand(argv.slice(1), io);
    }

    if (command === "build" && subcommand === "mobile") {
      return await buildMobileCommand(rest, io);
    }

    if (command === "theme" && subcommand === "validate") {
      return await themeValidateCommand(io);
    }

    if (command === "env" && subcommand === "inspect") {
      return await envInspectCommand(rest, io);
    }

    if (command === "env" && subcommand === "set") {
      return await envSetCommand(rest, io);
    }

    if (command === "add" && subcommand === "feature") {
      return await addFeatureCommand(rest, io);
    }

    if (command === "add" && subcommand === "event") {
      return await addEventCommand(rest, io);
    }

    if (command === "init" && subcommand === "cloud") {
      return await initCloudCommand(io);
    }

    if (command === "observe") {
      return await observeCommand([subcommand, ...rest].filter(Boolean), io);
    }

    io.write("FAIL cli.unknown-command");
    return 1;
  } catch (error) {
    io.write((error as Error).message);
    return 1;
  }
}

async function validateCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const { context, diagnostics } = await runLocalValidationGate(io.cwd);
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    await recordCommandEvent(io, {
      name: "agentstack.validate.completed",
      environment: "development",
      journey: "validation",
      command: ["validate", ...argv].join(" "),
      status: "fail",
      state: { diagnostics: diagnostics.length }
    });
    return 1;
  }

  if (options.cloud) {
    const environment =
      options.env === undefined
        ? "preview"
        : readEnvironmentOption(options.env, {
            flag: "env",
            fix: "Run agentstack validate --cloud --env preview."
          });
    const adapter = new LocalCloudAdapter(io.cwd);
    const diagnostics = await adapter.validate(context.manifest, environment);
    diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
    if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
      await recordCommandEvent(io, {
        name: "agentstack.validate.completed",
        environment,
        journey: "validation",
        command: ["validate", ...argv].join(" "),
        status: "fail",
        state: { diagnostics: diagnostics.length }
      });
      return 1;
    }
    io.write("PASS validate --cloud");
    io.write(`Environment: ${environment}`);
    await recordCommandEvent(io, {
      name: "agentstack.validate.completed",
      environment,
      journey: "validation",
      command: ["validate", ...argv].join(" "),
      status: "ok",
      state: { diagnostics: diagnostics.length }
    });
    return 0;
  }

  io.write("PASS validate");
  await recordCommandEvent(io, {
    name: "agentstack.validate.completed",
    environment: "development",
    journey: "validation",
    command: ["validate", ...argv].join(" "),
    status: "ok",
    state: { diagnostics: diagnostics.length }
  });
  return 0;
}

async function deployCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix: "Run agentstack deploy --env preview."
  });
  if (environment !== "preview") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "deploy.environment.unsupported",
        path: environment,
        message: "Local deploy rehearsal currently supports the preview environment only.",
        fix: "Run agentstack deploy --env preview.",
        blocks: ["deploy"]
      })
    );
    return 1;
  }
  const { context, diagnostics } = await runLocalValidationGate(io.cwd);
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  const deployPlan = await new LocalCloudAdapter(io.cwd).deploy(context.manifest, environment, {
    apply: Boolean(options.apply)
  });
  io.write(`${deployPlan.applied ? "APPLIED" : "PLAN"} deploy ${deployPlan.environment}`);
  deployPlan.steps.forEach((step) =>
    io.write(`- ${step.status} ${step.action} ${step.environment}.${step.service}`)
  );

  await recordCommandEvent(io, {
    name: "agentstack.deploy.completed",
    environment,
    journey: "deployment",
    command: ["deploy", ...argv].join(" "),
    status: "ok",
    state: {
      applied: deployPlan.applied,
      steps: deployPlan.steps.length,
      services: Array.from(new Set(deployPlan.steps.map((step) => step.service)))
    }
  });
  return 0;
}

async function buildMobileCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix: "Run agentstack build mobile --env preview."
  });
  const { context, diagnostics } = await runLocalValidationGate(io.cwd);
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  const adapter = new LocalCloudAdapter(io.cwd);
  const easDiagnostics = (await adapter.validate(context.manifest, environment)).filter(
    (diagnostic) => diagnostic.path === `${environment}.eas`
  );
  easDiagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (easDiagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  const mobilePlan = await adapter.mobileBuild(context.manifest, environment, {
    apply: Boolean(options.apply),
    confirmProduction: Boolean(options["confirm-production"])
  });
  const status = mobilePlan.applied ? "applied" : "planned";

  io.write(`${mobilePlan.applied ? "APPLIED" : "PLAN"} mobile build ${mobilePlan.environment}`);
  io.write(
    `- ${status} eas profile ${mobilePlan.profile} distribution ${mobilePlan.distribution} development-client=${
      mobilePlan.developmentClient ? "yes" : "no"
    }`
  );

  await recordCommandEvent(io, {
    name: "agentstack.mobile.build.completed",
    environment,
    journey: "mobile-build",
    command: ["build", "mobile", ...argv].join(" "),
    status: "ok",
    state: {
      applied: mobilePlan.applied,
      profile: mobilePlan.profile,
      distribution: mobilePlan.distribution,
      developmentClient: mobilePlan.developmentClient,
      service: mobilePlan.service
    }
  });
  return 0;
}

async function runLocalValidationGate(cwd: string): Promise<{
  context: Awaited<ReturnType<typeof loadProjectContext>>;
  localResult: ReturnType<typeof validateLocalProject>;
  anchorResult: ReturnType<typeof validateGeneratedAnchors>;
  themeDiagnostics: Diagnostic[];
  sourcePolicyDiagnostics: Diagnostic[];
  diagnostics: Diagnostic[];
}> {
  const context = await loadProjectContext(cwd);
  const envValues = await loadLocalEnvValues(cwd);
  const localResult = validateLocalProject({ manifest: context.manifest, envValues });
  const anchorResult = validateGeneratedAnchors({
    manifest: context.manifest,
    missingPaths: await findMissingGeneratedAnchors(context.cwd, context.manifest)
  });
  const themeDiagnostics = await findThemeDiagnostics(context.cwd);
  const sourcePolicyDiagnostics = await findSourcePolicyDiagnostics(context.cwd);
  const diagnostics = [
    ...localResult.diagnostics,
    ...anchorResult.diagnostics,
    ...themeDiagnostics,
    ...sourcePolicyDiagnostics
  ];

  return { context, localResult, anchorResult, themeDiagnostics, sourcePolicyDiagnostics, diagnostics };
}

async function themeValidateCommand(io: RunIo): Promise<number> {
  const diagnostics = await findThemeDiagnostics(io.cwd);
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    await recordCommandEvent(io, {
      name: "agentstack.theme.validate.completed",
      environment: "development",
      journey: "theming",
      command: "theme validate",
      status: "fail",
      state: { diagnostics: diagnostics.length }
    });
    return 1;
  }

  io.write("PASS theme validate");
  await recordCommandEvent(io, {
    name: "agentstack.theme.validate.completed",
    environment: "development",
    journey: "theming",
    command: "theme validate",
    status: "ok",
    state: { diagnostics: diagnostics.length }
  });
  return 0;
}

async function findThemeDiagnostics(cwd: string): Promise<Diagnostic[]> {
  const tokenPath = join(cwd, "packages/theme/tokens.json");

  try {
    const tokens = JSON.parse(await readFile(tokenPath, "utf8")) as unknown;
    return [...validateThemeTokens(tokens), ...(await findThemeMirrorDiagnostics(cwd))];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [
        {
          severity: "fail",
          code: "theme.tokens.missing",
          path: "packages/theme/tokens.json",
          message: "Theme token file is missing.",
          fix: "Restore packages/theme/tokens.json or rerun agentstack init for this project.",
          blocks: ["validate", "validate --cloud", "deploy"]
        }
      ];
    }

    if (error instanceof SyntaxError) {
      return [
        {
          severity: "fail",
          code: "theme.tokens.invalid-json",
          path: "packages/theme/tokens.json",
          message: `Theme token file must be valid JSON: ${error.message}`,
          fix: "Fix packages/theme/tokens.json so it parses as JSON.",
          blocks: ["validate", "validate --cloud", "deploy"]
        }
      ];
    }

    throw error;
  }
}

async function findThemeMirrorDiagnostics(cwd: string): Promise<Diagnostic[]> {
  const mirrorPath = "packages/theme/src/index.ts";

  try {
    const source = await readFile(join(cwd, mirrorPath), "utf8");
    if (source.includes("../tokens.json") && source.includes("themeTokens")) {
      return [];
    }

    return [
      {
        severity: "fail",
        code: "theme.tokens.mirror-drift",
        path: mirrorPath,
        message: "The typed theme mirror must import packages/theme/tokens.json instead of duplicating token values.",
        fix: "Update packages/theme/src/index.ts to import ../tokens.json and export themeTokens from that JSON source.",
        blocks: ["validate", "validate --cloud", "deploy"]
      }
    ];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [
        {
          severity: "fail",
          code: "theme.tokens.mirror-missing",
          path: mirrorPath,
          message: "Typed theme mirror is missing.",
          fix: "Restore packages/theme/src/index.ts or rerun agentstack init for this project.",
          blocks: ["validate", "validate --cloud", "deploy"]
        }
      ];
    }

    throw error;
  }
}

async function findMissingGeneratedAnchors(
  cwd: string,
  manifest: AgentstackManifest
): Promise<string[]> {
  const anchors = getRequiredGeneratedAnchors(manifest);
  const checks = await Promise.all(
    anchors.map(async (anchor) => {
      try {
        const anchorStat = await stat(join(cwd, anchor));
        return anchorStat.isFile() ? undefined : anchor;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return anchor;
        }
        throw error;
      }
    })
  );

  return checks.filter((anchor): anchor is string => Boolean(anchor));
}

async function findSourcePolicyDiagnostics(cwd: string): Promise<Diagnostic[]> {
  const files = await listProjectFiles(cwd);
  const diagnostics: Diagnostic[] = [];

  for (const file of files) {
    const content = await readFile(join(cwd, file), "utf8");
    if (containsSecretLikeValue(content)) {
      diagnostics.push({
        severity: "fail",
        code: "source.secret.detected",
        path: file,
        message: `Potential raw secret found in ${file}.`,
        fix: "Move the value to a provider secret store or set local validation state with agentstack env set.",
        blocks: ["validate", "validate --cloud", "deploy"]
      });
    }
  }

  return diagnostics;
}

const skippedSourcePolicyDirs = new Set([
  ".agentstack",
  ".git",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".vite",
  "build",
  "cache",
  ".cache",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target"
]);

async function listProjectFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(relativeDir: string): Promise<void> {
    const entries = await readdir(join(cwd, relativeDir), { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (!skippedSourcePolicyDirs.has(entry.name)) {
          await visit(relativePath);
        }
        continue;
      }

      if (entry.isFile() && entry.name !== ".env.example") {
        files.push(relativePath);
      }
    }
  }

  await visit("");
  return files;
}

function containsSecretLikeValue(content: string): boolean {
  const secretPatterns = [
    /\bsk_(?:live|test|proj|ant|or|[a-z0-9]+)_[A-Za-z0-9_-]{20,}\b/,
    /\bsk-(?:live|test|proj|ant|or)-[A-Za-z0-9_-]{20,}\b/,
    /\b(?:api[_-]?key|secret|token|password|private[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{20,}["']?/i,
    /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/
  ];

  return secretPatterns.some((pattern) => pattern.test(content));
}

async function syncCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix: "Run agentstack sync --env preview --apply."
  });
  const context = await loadProjectContext(io.cwd);
  const adapter = new LocalCloudAdapter(io.cwd);
  const plan = await adapter.sync(context.manifest, environment, { apply: Boolean(options.apply) });

  io.write(`${plan.applied ? "APPLIED" : "PLAN"} ${plan.environment}`);
  plan.changes.forEach((change) => io.write(`- ${change}`));
  await recordCommandEvent(io, {
    name: "agentstack.sync.completed",
    environment,
    journey: "environment-sync",
    command: ["sync", ...argv].join(" "),
    status: "ok",
    state: { applied: plan.applied, changes: plan.changes }
  });
  return 0;
}

async function envInspectCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix: "Run agentstack env inspect --env preview."
  });
  const context = await loadProjectContext(io.cwd);
  const envValues = await loadLocalEnvValues(io.cwd);
  const graph = buildEnvGraph(context.manifest);
  const adapter = new LocalCloudAdapter(io.cwd);
  const report = await adapter.inspect(context.manifest, environment);
  const linked = new Set(report.linked.map((resource) => resource.service));

  io.write(`PASS env inspect ${environment}`);
  for (const resource of report.expected) {
    io.write(`- service ${resource.service} linked=${linked.has(resource.service) ? "yes" : "no"}`);
  }
  for (const binding of graph.bindings.filter((candidate) => candidate.environment === environment)) {
    io.write(
      `- env ${binding.surface}.${binding.name} required=${binding.required ? "yes" : "no"} secret=${binding.secret ? "yes" : "no"} present=${envValues[environment]?.[binding.surface]?.[binding.name] ? "yes" : "no"}`
    );
  }

  await recordCommandEvent(io, {
    name: "agentstack.env.inspect.completed",
    environment,
    journey: "environment-sync",
    command: ["env", "inspect", ...argv].join(" "),
    status: "ok",
    state: {
      expectedServices: report.expected.map((resource) => resource.service),
      linkedServices: report.linked.map((resource) => resource.service),
      missingServices: report.missing.map((resource) => resource.service)
    }
  });
  return 0;
}

async function envSetCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix: "Run agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox."
  });
  const surface = readSurfaceOption(options.surface, {
    flag: "surface",
    fix: "Run agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox."
  });
  const name = readRequiredStringOption(
    options.name,
    "name",
    "Run agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox."
  );
  const value = readRequiredStringOption(
    options.value,
    "value",
    "Run agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox."
  );
  const context = await loadProjectContext(io.cwd);
  const graph = buildEnvGraph(context.manifest);
  const binding = graph.bindings.find(
    (candidate) =>
      candidate.environment === environment && candidate.surface === surface && candidate.name === name
  );

  if (!context.manifest.env.custom[name]) {
    throw new Error(
      [
        "FAIL env.custom.undeclared",
        `Path: env.custom.${name}`,
        `${name} is not declared in agentstack.config.json.`,
        "Fix: Declare the custom env value in agentstack.config.json before setting a local value."
      ].join("\n")
    );
  }

  if (!binding) {
    throw new Error(
      [
        "FAIL env.custom.out-of-scope",
        `Path: ${environment}.${surface}.${name}`,
        `${name} is not declared for ${surface} in ${environment}.`,
        "Fix: Add the environment and surface to env.custom declaration or choose a declared binding."
      ].join("\n")
    );
  }

  const currentValues = await loadLocalEnvValues(io.cwd);
  const nextValues = setEnvValue(currentValues, environment, surface, name, value);
  const diagnosticPath = `${environment}.${surface}.${name}`;
  const diagnostics = validateCustomEnvValues(context.manifest, nextValues).filter(
    (diagnostic) => diagnostic.path === diagnosticPath && diagnostic.code === "env.custom.invalid-enum"
  );
  if (diagnostics.length > 0) {
    throw new Error(diagnostics.map(formatDiagnostic).join("\n"));
  }

  await saveLocalEnvValues(io.cwd, nextValues);

  io.write(`PASS env set ${environment} ${surface}.${name}`);
  io.write(`Secret: ${binding.secret ? "yes" : "no"}`);
  await recordCommandEvent(io, {
    name: "agentstack.env.set.completed",
    environment,
    journey: "environment-sync",
    command: ["env", "set", ...argv].join(" "),
    status: "ok",
    state: {
      surface,
      name,
      secret: binding.secret,
      changed: true
    }
  });
  return 0;
}

async function addFeatureCommand(argv: string[], io: RunIo): Promise<number> {
  const [featureName, ...rest] = argv;
  if (!featureName || featureName.startsWith("--")) {
    throw new Error(
      [
        "FAIL feature.name.missing",
        "Feature name is required.",
        "Fix: Run agentstack add feature invoices --surfaces web,mobile --backend convex."
      ].join("\n")
    );
  }

  const options = parseOptions(rest);
  const surfacesValue = readRequiredStringOption(
    options.surfaces,
    "surfaces",
    "Run agentstack add feature invoices --surfaces web,mobile --backend convex."
  );
  const backendValue = readRequiredStringOption(
    options.backend,
    "backend",
    "Run agentstack add feature invoices --surfaces web,mobile --backend convex."
  );
  let plan: ReturnType<typeof planFeatureFiles>;
  try {
    plan = planFeatureFiles(featureName, {
      surfaces: surfacesValue.split(",").map((surface) => surface.trim()).filter(Boolean),
      backend: backendValue
    });
  } catch (error) {
    throw new Error(
      [
        "FAIL feature.invalid",
        (error as Error).message,
        "Fix: Run agentstack add feature invoices --surfaces web,mobile --backend convex."
      ].join("\n")
    );
  }

  const existing = await findExistingFeatureFiles(io.cwd, plan.files);
  if (existing.length > 0) {
    throw new Error(
      [
        "FAIL feature.file.exists",
        "Feature generation refuses to overwrite existing files.",
        ...existing.map((path) => `Path: ${path}`),
        "Fix: Choose a new feature name or update the existing feature anchors intentionally."
      ].join("\n")
    );
  }

  for (const file of plan.files) {
    const path = join(io.cwd, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.content, "utf8");
  }
  await registerGeneratedAnchors(io.cwd, plan.files.map((file) => file.path));

  io.write(`CREATED feature ${plan.name.slug}`);
  for (const file of plan.files) {
    io.write(`- ${file.path}`);
  }

  await recordCommandEvent(io, {
    name: "agentstack.feature.added",
    environment: "development",
    journey: "feature-generation",
    command: ["add", "feature", ...argv].join(" "),
    status: "ok",
    state: {
      feature: plan.name.slug,
      surfaces: plan.surfaces,
      backend: plan.backend,
      files: plan.files.map((file) => file.path)
    }
  });
  return 0;
}

async function addEventCommand(argv: string[], io: RunIo): Promise<number> {
  const [eventName, ...rest] = argv;
  const fix =
    "Run agentstack add event billing.subscription.updated --journey billing --surfaces web,convex --state plan:string.";
  if (!eventName || eventName.startsWith("--")) {
    throw new Error(["FAIL event.name.missing", "Event name is required.", `Fix: ${fix}`].join("\n"));
  }

  const options = parseOptions(rest);
  const journey = readRequiredStringOption(options.journey, "journey", fix);
  const surfacesValue = readRequiredStringOption(options.surfaces, "surfaces", fix);
  const stateValue = readRequiredStringOption(options.state, "state", fix);
  let plan: ReturnType<typeof planTelemetryEventFiles>;
  try {
    plan = planTelemetryEventFiles(eventName, {
      journey,
      surfaces: surfacesValue.split(",").map((surface) => surface.trim()).filter(Boolean),
      state: stateValue.split(",").map((field) => field.trim()).filter(Boolean)
    });
  } catch (error) {
    throw new Error(["FAIL event.invalid", (error as Error).message, `Fix: ${fix}`].join("\n"));
  }

  const existing = await findExistingFeatureFiles(io.cwd, plan.files);
  if (existing.length > 0) {
    throw new Error(
      [
        "FAIL event.file.exists",
        "Event generation refuses to overwrite existing files.",
        ...existing.map((path) => `Path: ${path}`),
        "Fix: Choose a new event name or update the existing event anchors intentionally."
      ].join("\n")
    );
  }

  for (const file of plan.files) {
    const path = join(io.cwd, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.content, "utf8");
  }
  const eventBarrelPath = await updateTelemetryEventBarrel(io.cwd, plan.name.slug);
  await registerGeneratedAnchors(io.cwd, [...plan.files.map((file) => file.path), eventBarrelPath]);

  io.write(`CREATED event ${plan.name.input}`);
  for (const file of plan.files) {
    io.write(`- ${file.path}`);
  }
  io.write(`- ${eventBarrelPath}`);

  await recordCommandEvent(io, {
    name: "agentstack.event.added",
    environment: "development",
    journey: "telemetry-generation",
    command: ["add", "event", plan.name.input].join(" "),
    status: "ok",
    state: {
      event: plan.name.input,
      journey: plan.journey,
      surfaces: plan.surfaces,
      state: plan.state.map((field) => ({ key: field.key, type: field.type })),
      files: [...plan.files.map((file) => file.path), eventBarrelPath]
    }
  });
  return 0;
}

async function updateTelemetryEventBarrel(cwd: string, eventSlug: string): Promise<string> {
  const barrelPath = "packages/telemetry/src/events/index.ts";
  const absolutePath = join(cwd, barrelPath);
  const exportLine = `export * from "./${eventSlug}.js";`;
  let existing = "";

  try {
    existing = await readFile(absolutePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const lines = existing
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const nextLines = lines.includes(exportLine) ? lines : [...lines, exportLine];

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${nextLines.join("\n")}\n`, "utf8");
  return barrelPath;
}

async function initCloudCommand(io: RunIo): Promise<number> {
  const context = await loadProjectContext(io.cwd);
  const adapter = new LocalCloudAdapter(io.cwd);

  for (const environment of ["development", "preview"] as const) {
    const plan = await adapter.sync(context.manifest, environment, { apply: true });
    io.write(`APPLIED ${plan.environment}`);
    plan.changes.forEach((change) => io.write(`- ${change}`));
  }

  return 0;
}

async function observeCommand(argv: string[], io: RunIo): Promise<number> {
  const [mode, ...rest] = argv;

  if (mode !== "query" && mode !== "timeline") {
    io.write("FAIL cli.unknown-command");
    return 1;
  }

  const options = parseOptions(rest);
  requireOptionValues(options, observeValueOptions, {
    event: "Run agentstack observe query --event billing.*.",
    env: "Run agentstack observe query --env preview.",
    surface: "Run agentstack observe query --surface web."
  });
  const store = new JsonlTelemetryStore(join(io.cwd, ".agentstack", "events.jsonl"));
  const query: TelemetryQuery = {
    environment: readTelemetryEnvironmentOption(options.env),
    surface: readTelemetrySurfaceOption(options.surface),
    event: readString(options.event),
    journey: readString(options.journey),
    traceId: readString(options.trace),
    correlationId: readString(options.correlation),
    journeyId: readString(options["journey-id"])
  };
  const events = mode === "timeline" ? await store.timeline(query) : await store.query(query);

  io.write(`PASS observe ${mode} ${events.length}`);
  for (const event of events) {
    io.write(`${event.timestamp} ${event.environment} ${event.surface} ${event.name}`);
    io.write(JSON.stringify(event.state));
  }

  await recordCommandEvent(io, {
    name: "agentstack.observe.completed",
    environment: query.environment ?? "development",
    journey: "observability",
    command: ["observe", ...argv].join(" "),
    status: "ok",
    state: { mode, events: events.length }
  });
  return 0;
}

async function recordCommandEvent(
  io: RunIo,
  input: {
    name: string;
    environment: TelemetryEnvironment;
    journey: string;
    command: string;
    status: string;
    state: Record<string, unknown>;
  }
): Promise<void> {
  const store = new JsonlTelemetryStore(join(io.cwd, ".agentstack", "events.jsonl"));
  await store.append(
    createWideEvent(input.name, {
      environment: input.environment,
      surface: "cli",
      schemaVersion: "wide.v2",
      component: "agentstack-cli",
      command: input.command,
      status: input.status,
      journey: input.journey,
      state: {
        status: input.status,
        ...input.state
      }
    })
  );
}

function parseOptions(argv: string[]): ParsedOptions {
  const options: ParsedOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

function readEnvironmentOption(
  value: string | boolean | undefined,
  options: { flag: string; fix: string }
): EnvironmentName {
  if (typeof value !== "string") {
    throw new Error(
      [
        "FAIL cli.option.missing",
        `--${options.flag} requires a value.`,
        `Expected one of: ${environmentValues.join(", ")}.`,
        `Fix: ${options.fix}`
      ].join("\n")
    );
  }

  if (isEnvironment(value)) {
    return value;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --${options.flag} value: ${value}. Expected one of: ${environmentValues.join(", ")}.`,
      `Fix: ${options.fix}`
    ].join("\n")
  );
}

function readSurfaceOption(
  value: string | boolean | undefined,
  options: { flag: string; fix: string }
): SurfaceName {
  if (typeof value !== "string") {
    throw new Error(
      [
        "FAIL cli.option.missing",
        `--${options.flag} requires a value.`,
        `Expected one of: ${surfaceValues.join(", ")}.`,
        `Fix: ${options.fix}`
      ].join("\n")
    );
  }

  if (isSurface(value)) {
    return value;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --${options.flag} value: ${value}. Expected one of: ${surfaceValues.join(", ")}.`,
      `Fix: ${options.fix}`
    ].join("\n")
  );
}

function readTelemetryEnvironmentOption(
  value: string | boolean | undefined
): TelemetryEnvironment | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throwMissingOption("env", "Run agentstack observe query --env preview.");
  }

  if (isEnvironment(value)) {
    return value;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --env value: ${value}. Expected one of: ${environmentValues.join(", ")}.`,
      "Fix: Run agentstack observe query --env preview."
    ].join("\n")
  );
}

function readTelemetrySurfaceOption(value: string | boolean | undefined): TelemetrySurface | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throwMissingOption("surface", "Run agentstack observe query --surface web.");
  }

  if (isTelemetrySurface(value)) {
    return value;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --surface value: ${value}. Expected one of: ${telemetrySurfaceValues.join(", ")}.`,
      "Fix: Run agentstack observe query --surface web."
    ].join("\n")
  );
}

function readRequiredStringOption(
  value: string | boolean | undefined,
  flag: string,
  fix: string
): string {
  if (typeof value === "string") {
    return value;
  }

  throwMissingOption(flag, fix);
}

async function findExistingFeatureFiles(
  cwd: string,
  files: Array<{ path: string }>
): Promise<string[]> {
  const checks = await Promise.all(
    files.map(async (file) => {
      try {
        await stat(join(cwd, file.path));
        return file.path;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return undefined;
        }
        throw error;
      }
    })
  );

  return checks.filter((path): path is string => Boolean(path));
}

async function registerGeneratedAnchors(cwd: string, paths: string[]): Promise<void> {
  const context = await loadProjectContext(cwd);
  const requiredAnchors = Array.from(
    new Set([...context.manifest.generated.requiredAnchors, ...paths])
  ).sort();
  await writeFile(
    join(cwd, "agentstack.config.json"),
    `${JSON.stringify(
      {
        ...context.manifest,
        generated: {
          ...context.manifest.generated,
          requiredAnchors
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function requireOptionValues(
  options: ParsedOptions,
  flags: readonly string[],
  fixes: Partial<Record<string, string>>
): void {
  for (const flag of flags) {
    if (options[flag] === true) {
      throwMissingOption(flag, fixes[flag] ?? `Run agentstack observe query --${flag} value.`);
    }
  }
}

function throwMissingOption(flag: string, fix: string): never {
  throw new Error(["FAIL cli.option.missing", `--${flag} requires a value.`, `Fix: ${fix}`].join("\n"));
}

function isEnvironment(value: string): value is EnvironmentName {
  return environmentValues.includes(value as EnvironmentName);
}

function isSurface(value: string): value is SurfaceName {
  return surfaceValues.includes(value as SurfaceName);
}

function isTelemetrySurface(value: string): value is TelemetrySurface {
  return telemetrySurfaceValues.includes(value as TelemetrySurface);
}

function readString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function setEnvValue(
  values: EnvValueState,
  environment: EnvironmentName,
  surface: SurfaceName,
  name: string,
  value: string
): EnvValueState {
  return {
    ...values,
    [environment]: {
      ...values[environment],
      [surface]: {
        ...values[environment]?.[surface],
        [name]: value
      }
    }
  };
}

async function saveLocalEnvValues(cwd: string, values: EnvValueState): Promise<void> {
  await mkdir(join(cwd, ".agentstack"), { recursive: true });
  await writeFile(
    join(cwd, ".agentstack", "env-values.json"),
    `${JSON.stringify(values, null, 2)}\n`,
    "utf8"
  );
}
