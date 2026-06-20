import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LocalCloudAdapter, type InspectEnvResource } from "@agentstack/adapters";
import {
  buildEnvGraph,
  createLifecycleSummary,
  expectedAgentstackGuidanceVersion,
  formatDiagnostic,
  getGuidanceGeneratedAnchors,
  getRequiredGeneratedAnchors,
  normalizeReleaseEnvironment,
  planTelemetryEventFiles,
  planBillingPlanFiles,
  planFeatureFiles,
  validateReleasePolicy,
  validateCustomEnvValues,
  validateGeneratedAnchors,
  validateLocalProject,
  validateThemeTokens,
  type EnvValueState,
  type AgentstackManifest,
  type Diagnostic,
  type EnvironmentName,
  type LifecycleCloudSummary,
  type LifecycleSummary,
  type ReleaseEnvironment,
  type SurfaceName
} from "@agentstack/core";
import {
  compareEventCountsByEnvironment,
  createWideEvent,
  groupErrorEvents,
  isErrorEvent,
  JsonlTelemetryStore,
  parseSinceWindow,
  wideEventsToOtlpLogsRequest,
  type TelemetryEnvironment,
  type TelemetryQuery,
  type TelemetrySurface,
  type WideEvent
} from "@agentstack/telemetry";
import { loadLocalEnvValues, loadProjectContext } from "./context.js";

export type RunIo = {
  cwd: string;
  write: (line: string) => void;
};

type ParsedOptions = Record<string, string | boolean>;

type EnvAwareInspectReport = Awaited<ReturnType<LocalCloudAdapter["inspect"]>> & {
  expectedEnv?: InspectEnvResource[];
  syncedEnv?: InspectEnvResource[];
  missingEnv?: InspectEnvResource[];
  staleEnv?: InspectEnvResource[];
  driftedEnv?: InspectEnvResource[];
};

type EnvAwareLocalCloudAdapter = LocalCloudAdapter & {
  inspect(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options?: { envValues?: EnvValueState }
  ): Promise<EnvAwareInspectReport>;
  validate(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options?: { envValues?: EnvValueState }
  ): Promise<Diagnostic[]>;
  sync(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: { apply: boolean; envValues?: EnvValueState }
  ): Promise<{ environment: EnvironmentName; changes: string[]; applied: boolean }>;
};

const environmentValues = ["development", "preview", "production"] as const;
const environmentOptionValues = ["development", "preview", "production", "prod"] as const;
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
  "journey-id",
  "component",
  "release",
  "release-id",
  "actor",
  "actor-id",
  "command",
  "error-class",
  "id",
  "since",
  "group-by",
  "format"
] as const;

export async function runAgentstack(argv: string[], io: RunIo): Promise<number> {
  try {
    const [command, subcommand, ...rest] = argv;

    if (command === "validate") {
      return await validateCommand(argv.slice(1), io);
    }

    if (command === "inspect") {
      return await inspectCommand(argv.slice(1), io);
    }

    if (command === "doctor") {
      return await doctorCommand(argv.slice(1), io);
    }

    if (command === "dev") {
      return await devCommand(argv.slice(1), io);
    }

    if (command === "sync") {
      return await syncCommand(argv.slice(1), io);
    }

    if (command === "deploy") {
      return await deployCommand(argv.slice(1), io);
    }

    if (command === "prod") {
      return await prodCommand([subcommand, ...rest].filter(Boolean), io);
    }

    if (command === "build" && subcommand === "mobile") {
      return await buildMobileCommand(rest, io);
    }

    if (command === "theme" && subcommand === "validate") {
      return await themeValidateCommand(io);
    }

    if (command === "skills" && subcommand === "inspect") {
      return await skillsInspectCommand(io);
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

    if (command === "add" && subcommand === "billing-plan") {
      return await addBillingPlanCommand(rest, io);
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
  if (options.release !== undefined) {
    const environment = readReleaseEnvironmentOption(options.release, {
      flag: "release",
      fix: "Run agentstack validate --release prod."
    });
    const result = await runReleaseValidationGate(io, argv, environment);
    result.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
    if (result.failed) {
      await recordCommandEvent(io, {
        name: "agentstack.validate.completed",
        environment,
        journey: "validation",
        command: ["validate", ...argv].join(" "),
        status: "fail",
        state: { diagnostics: result.diagnostics.length, release: true }
      });
      return 1;
    }

    io.write(`PASS validate --release ${environment}`);
    await recordCommandEvent(io, {
      name: "agentstack.validate.completed",
      environment,
      journey: "validation",
      command: ["validate", ...argv].join(" "),
      status: "ok",
      state: { diagnostics: result.diagnostics.length, release: true }
    });
    return 0;
  }

  const { context, diagnostics, envValues } = await runLocalValidationGate(io.cwd);
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
    const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
    const diagnostics = await adapter.validate(context.manifest, environment, { envValues });
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

async function inspectCommand(argv: string[], io: RunIo): Promise<number> {
  const environment = readLifecycleEnvironmentOption(parseOptions(argv).env, {
    flag: "env",
    fix: "Run agentstack inspect --env preview."
  });
  const { summary } = await loadLifecycleSummary(io.cwd, environment, { includeCloudDiagnostics: false });

  io.write(`PASS inspect ${summary.app.slug}`);
  writeLifecycleSummary(io, summary);
  await recordCommandEvent(io, {
    name: "agentstack.inspect.completed",
    environment,
    journey: "agent-command",
    command: ["inspect", ...argv].join(" "),
    status: summary.status === "fail" ? "fail" : "ok",
    state: {
      status: summary.status,
      generatedMissing: summary.generated.missing.length,
      cloudMissing: summary.cloud?.missingServices.length ?? 0
    }
  });
  return 0;
}

async function skillsInspectCommand(io: RunIo): Promise<number> {
  const validation = await runLocalValidationGate(io.cwd);
  const guidanceAnchors = getGuidanceGeneratedAnchors(validation.context.manifest);
  const missingGuidanceAnchors = guidanceAnchors.filter((anchor) =>
    validation.missingAnchors.includes(anchor)
  );
  const staleDiagnostics = validation.diagnostics.filter(
    (diagnostic) => diagnostic.code === "guidance.version.stale"
  );

  io.write(`${missingGuidanceAnchors.length > 0 ? "FAIL" : "PASS"} skills inspect`);
  io.write(`Guidance version: ${validation.context.manifest.guidanceVersion}`);
  io.write(`Expected guidance version: ${expectedAgentstackGuidanceVersion}`);
  io.write("No MCP dependency");
  staleDiagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  io.write("Guidance anchors:");
  for (const anchor of guidanceAnchors) {
    io.write(`- ${validation.missingAnchors.includes(anchor) ? "MISSING" : "PRESENT"} ${anchor}`);
  }

  await recordCommandEvent(io, {
    name: "agentstack.skills.inspect.completed",
    environment: "development",
    journey: "agent-guidance",
    command: "skills inspect",
    status: missingGuidanceAnchors.length > 0 ? "fail" : "ok",
    state: {
      anchors: guidanceAnchors.length,
      missing: missingGuidanceAnchors.length,
      stale: staleDiagnostics.length
    }
  });

  return missingGuidanceAnchors.length > 0 ? 1 : 0;
}

async function doctorCommand(argv: string[], io: RunIo): Promise<number> {
  const environment = readLifecycleEnvironmentOption(parseOptions(argv).env, {
    flag: "env",
    fix: "Run agentstack doctor --env preview."
  });
  const { summary, diagnostics } = await loadLifecycleSummary(io.cwd, environment, {
    includeCloudDiagnostics: true
  });
  const failed = diagnostics.some((diagnostic) => diagnostic.severity === "fail");

  io.write(`${failed ? "FAIL" : "PASS"} doctor ${environment}`);
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  writeNextCommands(io, summary.nextCommands);
  await recordCommandEvent(io, {
    name: "agentstack.doctor.completed",
    environment,
    journey: "validation",
    command: ["doctor", ...argv].join(" "),
    status: failed ? "fail" : "ok",
    state: {
      diagnostics: diagnostics.length,
      cloudMissing: summary.cloud?.missingServices.length ?? 0
    }
  });
  return failed ? 1 : 0;
}

async function devCommand(argv: string[], io: RunIo): Promise<number> {
  const environment = readDevEnvironmentOption(parseOptions(argv).env);
  const { summary, localDiagnostics, cloudDiagnostics } = await loadLifecycleSummary(io.cwd, environment, {
    includeCloudDiagnostics: true
  });
  const localFailed = localDiagnostics.some((diagnostic) => diagnostic.severity === "fail");

  if (localFailed) {
    io.write(`FAIL dev preflight ${environment}`);
    localDiagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  } else {
    io.write(`PASS dev preflight ${environment}`);
    if (cloudDiagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
      io.write(`WARN dev cloud ${environment}`);
      cloudDiagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
    }
    writeDevNextCommands(io, environment, summary.nextCommands);
  }

  await recordCommandEvent(io, {
    name: "agentstack.dev.preflight.completed",
    environment,
    journey: "agent-command",
    command: ["dev", ...argv].join(" "),
    status: localFailed ? "fail" : "ok",
    state: {
      localDiagnostics: localDiagnostics.length,
      cloudDiagnostics: cloudDiagnostics.length,
      cloudMissing: summary.cloud?.missingServices.length ?? 0
    }
  });
  return localFailed ? 1 : 0;
}

async function deployCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix: "Run agentstack deploy --env preview."
  });
  if (environment === "development") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "deploy.environment.unsupported",
        path: environment,
        message: "Deploy supports preview and production environments only.",
        fix: "Run agentstack deploy --env preview.",
        blocks: ["deploy"]
      })
    );
    return 1;
  }

  let context: Awaited<ReturnType<typeof loadProjectContext>>;
  let envValues: EnvValueState;
  if (environment === "production") {
    const result = await runReleaseValidationGate(io, argv, "production");
    result.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
    if (result.failed) {
      return 1;
    }
    io.write("PASS validate --release production");
    context = result.context;
    envValues = result.envValues;

    if (options.apply && !options["confirm-production"]) {
      io.write(
        formatDiagnostic({
          severity: "fail",
          code: "deploy.production-confirmation.required",
          path: "production",
          message: "Production deploy apply requires explicit confirmation.",
          fix: "Run agentstack deploy --env production --apply --confirm-production.",
          blocks: ["deploy"]
        })
      );
      return 1;
    }
  } else {
    const validation = await runLocalValidationGate(io.cwd);
    validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

    if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
      return 1;
    }
    context = validation.context;
    envValues = validation.envValues;
  }

  const deployPlan = await new LocalCloudAdapter(io.cwd).deploy(context.manifest, environment, {
    apply: Boolean(options.apply),
    confirmProduction: Boolean(options["confirm-production"]),
    envValues
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

async function prodCommand(argv: string[], io: RunIo): Promise<number> {
  const [subcommand, ...rest] = argv;

  if (subcommand === "prepare") {
    return await prodPrepareCommand(rest, io);
  }

  if (subcommand === "provision") {
    return await prodProvisionCommand(rest, io);
  }

  io.write("FAIL cli.unknown-command");
  return 1;
}

async function prodPrepareCommand(argv: string[], io: RunIo): Promise<number> {
  const result = await runProductionPrepareGate(io.cwd);
  io.write(`${result.failed ? "FAIL" : "PASS"} prod prepare production`);
  result.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  writeNextCommands(io, [
    "agentstack prod provision --apply",
    "agentstack validate --release prod",
    "agentstack deploy --env production"
  ]);

  await recordCommandEvent(io, {
    name: "agentstack.prod.prepare.completed",
    environment: "production",
    journey: "production-release",
    command: ["prod", "prepare", ...argv].join(" "),
    status: result.failed ? "fail" : "ok",
    state: { diagnostics: result.diagnostics.length }
  });
  return result.failed ? 1 : 0;
}

async function prodProvisionCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const context = await loadProjectContext(io.cwd);
  const envValues = await loadLocalEnvValues(io.cwd);
  if (writeCustomEnvSyncDiagnostics(io, context.manifest, envValues, ["production"])) {
    return 1;
  }
  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
  const plan = await adapter.sync(context.manifest, "production", {
    apply: Boolean(options.apply),
    envValues
  });

  io.write(`${plan.applied ? "APPLIED" : "PLAN"} prod provision production`);
  plan.changes.forEach((change) => io.write(`- ${change}`));
  await recordCommandEvent(io, {
    name: "agentstack.prod.provision.completed",
    environment: "production",
    journey: "production-release",
    command: ["prod", "provision", ...argv].join(" "),
    status: "ok",
    state: { applied: plan.applied, changes: plan.changes }
  });
  return 0;
}

async function buildMobileCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix: "Run agentstack build mobile --env preview."
  });
  const { context, diagnostics, envValues } = await runLocalValidationGate(io.cwd);
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
  const easDiagnostics = (await adapter.validate(context.manifest, environment, { envValues })).filter(
    (diagnostic) =>
      diagnostic.path === `${environment}.eas` ||
      diagnostic.path?.startsWith(`${environment}.eas.env.`)
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
  missingAnchors: string[];
  diagnostics: Diagnostic[];
  envValues: EnvValueState;
}> {
  const context = await loadProjectContext(cwd);
  const envValues = await loadLocalEnvValues(cwd);
  const localResult = validateLocalProject({ manifest: context.manifest, envValues });
  const missingAnchors = await findMissingGeneratedAnchors(context.cwd, context.manifest);
  const anchorResult = validateGeneratedAnchors({
    manifest: context.manifest,
    missingPaths: missingAnchors
  });
  const themeDiagnostics = await findThemeDiagnostics(context.cwd);
  const sourcePolicyDiagnostics = await findSourcePolicyDiagnostics(context.cwd);
  const diagnostics = [
    ...localResult.diagnostics,
    ...anchorResult.diagnostics,
    ...themeDiagnostics,
    ...sourcePolicyDiagnostics
  ];

  return {
    context,
    localResult,
    anchorResult,
    themeDiagnostics,
    sourcePolicyDiagnostics,
    missingAnchors,
    diagnostics,
    envValues
  };
}

async function runReleaseValidationGate(
  io: RunIo,
  _argv: string[],
  environment: ReleaseEnvironment
): Promise<{
  context: Awaited<ReturnType<typeof loadProjectContext>>;
  envValues: EnvValueState;
  diagnostics: Diagnostic[];
  failed: boolean;
}> {
  const localValidation = await runLocalValidationGate(io.cwd);
  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
  const releaseDiagnostics = validateReleasePolicy(localValidation.context.manifest, environment);
  const cloudDiagnostics = await adapter.validate(localValidation.context.manifest, environment, {
    envValues: localValidation.envValues
  });
  const diagnostics = [...localValidation.diagnostics, ...releaseDiagnostics, ...cloudDiagnostics];

  return {
    context: localValidation.context,
    envValues: localValidation.envValues,
    diagnostics,
    failed: diagnostics.some((diagnostic) => diagnostic.severity === "fail")
  };
}

async function runProductionPrepareGate(cwd: string): Promise<{
  context: Awaited<ReturnType<typeof loadProjectContext>>;
  diagnostics: Diagnostic[];
  failed: boolean;
}> {
  const localValidation = await runLocalValidationGate(cwd);
  const releaseDiagnostics = validateReleasePolicy(localValidation.context.manifest, "production");
  const diagnostics = [...localValidation.diagnostics, ...releaseDiagnostics];

  return {
    context: localValidation.context,
    diagnostics,
    failed: diagnostics.some((diagnostic) => diagnostic.severity === "fail")
  };
}

async function loadLifecycleSummary(
  cwd: string,
  environment: EnvironmentName,
  options: { includeCloudDiagnostics: boolean }
): Promise<{
  summary: LifecycleSummary;
  diagnostics: Diagnostic[];
  localDiagnostics: Diagnostic[];
  cloudDiagnostics: Diagnostic[];
}> {
  const validation = await runLocalValidationGate(cwd);
  const adapter = new LocalCloudAdapter(cwd) as EnvAwareLocalCloudAdapter;
  const cloudReport = await adapter.inspect(validation.context.manifest, environment, {
    envValues: validation.envValues
  });
  const cloudDiagnostics = options.includeCloudDiagnostics
    ? await adapter.validate(validation.context.manifest, environment, { envValues: validation.envValues })
    : [];
  const localDiagnostics = validation.diagnostics;
  const diagnostics = [...localDiagnostics, ...cloudDiagnostics];
  const requiredAnchors = getRequiredGeneratedAnchors(validation.context.manifest);
  const cloud: LifecycleCloudSummary = {
    environment,
    expectedServices: cloudReport.expected.map((resource) => resource.service),
    linkedServices: cloudReport.linked.map((resource) => resource.service),
    missingServices: cloudReport.missing.map((resource) => resource.service),
    staleServices: cloudReport.stale.map((resource) => resource.service),
    expectedEnv: formatProviderEnvResources(cloudReport.expectedEnv ?? []),
    syncedEnv: formatProviderEnvResources(cloudReport.syncedEnv ?? []),
    missingEnv: formatProviderEnvResources(cloudReport.missingEnv ?? []),
    staleEnv: formatProviderEnvResources(cloudReport.staleEnv ?? []),
    driftedEnv: formatProviderEnvResources(cloudReport.driftedEnv ?? [])
  };

  return {
    summary: createLifecycleSummary({
      manifest: validation.context.manifest,
      environment,
      requiredAnchors,
      missingAnchors: validation.missingAnchors,
      diagnostics,
      cloud
    }),
    diagnostics,
    localDiagnostics,
    cloudDiagnostics
  };
}

function writeLifecycleSummary(io: RunIo, summary: LifecycleSummary): void {
  io.write(`Environment: ${summary.environment}`);
  io.write(`App: ${summary.app.name}`);
  io.write(`Framework: ${summary.app.frameworkVersion}`);
  io.write(`Guidance: ${summary.app.guidanceVersion}`);
  io.write(`Environments: ${formatList(summary.environments)}`);
  io.write(`Surfaces: ${formatList(summary.surfaces)}`);
  io.write(`Services: ${formatList(summary.enabledServices)}`);
  io.write(
    `Generated anchors: ${summary.generated.required} required, ${summary.generated.missing.length} missing`
  );
  if (summary.generated.missing.length > 0) {
    io.write(`Generated missing: ${formatList(summary.generated.missing)}`);
  }
  if (summary.cloud) {
    io.write(`Cloud expected: ${formatList(summary.cloud.expectedServices)}`);
    io.write(`Cloud linked: ${formatList(summary.cloud.linkedServices)}`);
    io.write(`Cloud missing: ${formatList(summary.cloud.missingServices)}`);
    io.write(`Cloud stale: ${formatList(summary.cloud.staleServices)}`);
    io.write(
      `Cloud env expected: ${summary.cloud.expectedEnv.length} (${formatList(summary.cloud.expectedEnv)})`
    );
    io.write(`Cloud env synced: ${summary.cloud.syncedEnv.length} (${formatList(summary.cloud.syncedEnv)})`);
    io.write(`Cloud env missing: ${summary.cloud.missingEnv.length} (${formatList(summary.cloud.missingEnv)})`);
    io.write(`Cloud env stale: ${summary.cloud.staleEnv.length} (${formatList(summary.cloud.staleEnv)})`);
    io.write(`Cloud env drifted: ${summary.cloud.driftedEnv.length} (${formatList(summary.cloud.driftedEnv)})`);
  }
  writeNextCommands(io, summary.nextCommands);
}

function writeNextCommands(io: RunIo, commands: string[]): void {
  io.write("Next commands:");
  for (const command of commands) {
    io.write(`- ${command}`);
  }
}

function writeDevNextCommands(io: RunIo, environment: EnvironmentName, commands: string[]): void {
  const syncCommand =
    environment === "preview"
      ? "pnpm run sync:preview:apply"
      : `node scripts/agentstack.mjs sync --env ${environment} --apply`;
  const devCommands = new Set([
    "pnpm run validate",
    "pnpm run env:inspect",
    syncCommand,
    ...commands,
    "pnpm --filter @app/web dev",
    "pnpm --filter @app/mobile dev"
  ]);
  writeNextCommands(io, Array.from(devCommands));
}

function formatList(values: Array<string | number>): string {
  return values.length > 0 ? values.join(",") : "none";
}

function formatProviderEnvResources(resources: InspectEnvResource[]): string[] {
  return resources.map(formatProviderEnvResource);
}

function formatProviderEnvResource(resource: InspectEnvResource): string {
  return `${resource.environment}.${resource.service}.${resource.name}`;
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
  const envValues = await loadLocalEnvValues(io.cwd);
  if (writeCustomEnvSyncDiagnostics(io, context.manifest, envValues, [environment])) {
    return 1;
  }
  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
  const plan = await adapter.sync(context.manifest, environment, {
    apply: Boolean(options.apply),
    envValues
  });

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
  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
  const report = await adapter.inspect(context.manifest, environment, { envValues });
  const linked = new Set(report.linked.map((resource) => resource.service));
  const syncedEnv = new Set((report.syncedEnv ?? []).map(formatProviderEnvResource));

  io.write(`PASS env inspect ${environment}`);
  for (const resource of report.expected) {
    io.write(`- service ${resource.service} linked=${linked.has(resource.service) ? "yes" : "no"}`);
  }
  for (const binding of graph.bindings.filter((candidate) => candidate.environment === environment)) {
    io.write(
      `- env ${binding.surface}.${binding.name} required=${binding.required ? "yes" : "no"} secret=${binding.secret ? "yes" : "no"} present=${envValues[environment]?.[binding.surface]?.[binding.name] ? "yes" : "no"}`
    );
  }
  for (const resource of report.expectedEnv ?? []) {
    io.write(
      `- provider-env ${resource.service}.${resource.name} synced=${
        syncedEnv.has(formatProviderEnvResource(resource)) ? "yes" : "no"
      } secret=${resource.secret ? "yes" : "no"}`
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
      missingServices: report.missing.map((resource) => resource.service),
      expectedEnv: formatProviderEnvResources(report.expectedEnv ?? []),
      syncedEnv: formatProviderEnvResources(report.syncedEnv ?? [])
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

async function addBillingPlanCommand(argv: string[], io: RunIo): Promise<number> {
  const [planName, ...rest] = argv;
  const fix =
    "Run agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10.";
  if (!planName || planName.startsWith("--")) {
    throw new Error(["FAIL billing-plan.name.missing", "Billing plan name is required.", `Fix: ${fix}`].join("\n"));
  }

  const options = parseOptions(rest);
  if (options.entitlements === true) {
    throwMissingOption("entitlements", fix);
  }
  if (options.seats === true) {
    throwMissingOption("seats", fix);
  }

  let plan: ReturnType<typeof planBillingPlanFiles>;
  try {
    plan = planBillingPlanFiles(planName, {
      entitlements:
        typeof options.entitlements === "string"
          ? options.entitlements
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      seats: typeof options.seats === "string" ? Number(options.seats) : undefined
    });
  } catch (error) {
    throw new Error(["FAIL billing-plan.invalid", (error as Error).message, `Fix: ${fix}`].join("\n"));
  }

  const existing = await findExistingFeatureFiles(io.cwd, plan.files);
  if (existing.length > 0) {
    throw new Error(
      [
        "FAIL billing-plan.file.exists",
        "Billing-plan generation refuses to overwrite existing files.",
        ...existing.map((path) => `Path: ${path}`),
        "Fix: Choose a new billing plan name or update the existing billing-plan anchors intentionally."
      ].join("\n")
    );
  }

  for (const file of plan.files) {
    const path = join(io.cwd, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.content, "utf8");
  }
  const billingPlanBarrelPath = await updateBillingPlanBarrel(io.cwd, plan.name.slug);
  const generatedPaths = [...plan.files.map((file) => file.path), billingPlanBarrelPath];
  await registerGeneratedAnchors(io.cwd, generatedPaths);

  io.write(`CREATED billing-plan ${plan.name.slug}`);
  for (const path of generatedPaths) {
    io.write(`- ${path}`);
  }

  await recordCommandEvent(io, {
    name: "agentstack.billing-plan.added",
    environment: "development",
    journey: "billing",
    command: ["add", "billing-plan", ...argv].join(" "),
    status: "ok",
    state: {
      billingPlan: plan.name.slug,
      entitlements: plan.entitlements,
      includedSeats: plan.seats,
      files: generatedPaths
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

async function updateBillingPlanBarrel(cwd: string, planSlug: string): Promise<string> {
  const barrelPath = "packages/domain/src/billing-plans/index.ts";
  const absolutePath = join(cwd, barrelPath);
  const exportLine = `export * from "./${planSlug}.js";`;
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
  const envValues = await loadLocalEnvValues(io.cwd);
  if (writeCustomEnvSyncDiagnostics(io, context.manifest, envValues, ["development", "preview"])) {
    return 1;
  }
  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;

  for (const environment of ["development", "preview"] as const) {
    const plan = await adapter.sync(context.manifest, environment, { apply: true, envValues });
    io.write(`APPLIED ${plan.environment}`);
    plan.changes.forEach((change) => io.write(`- ${change}`));
  }

  return 0;
}

function writeCustomEnvSyncDiagnostics(
  io: RunIo,
  manifest: AgentstackManifest,
  envValues: EnvValueState,
  environments: readonly EnvironmentName[]
): boolean {
  const selected = new Set<EnvironmentName>(environments);
  const diagnostics = validateCustomEnvValues(manifest, envValues).filter(
    (diagnostic) =>
      diagnostic.code.startsWith("env.custom.") &&
      typeof diagnostic.path === "string" &&
      Array.from(selected).some((environment) => diagnostic.path?.startsWith(`${environment}.`))
  );

  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  return diagnostics.some((diagnostic) => diagnostic.severity === "fail");
}

async function observeCommand(argv: string[], io: RunIo): Promise<number> {
  const [mode, ...rest] = argv;

  if (!mode) {
    io.write("FAIL cli.unknown-command");
    return 1;
  }

  const options = parseOptions(rest);
  requireOptionValues(options, observeValueOptions, {
    event: "Run agentstack observe query --event billing.*.",
    env: "Run agentstack observe query --env preview.",
    surface: "Run agentstack observe query --surface web.",
    component: "Run agentstack observe query --component convex:billing.applySubscriptionUpdate.",
    release: "Run agentstack observe query --release rel_2026_06_20.",
    "release-id": "Run agentstack observe query --release-id rel_2026_06_20.",
    actor: "Run agentstack observe query --actor user_123.",
    "actor-id": "Run agentstack observe query --actor-id user_123.",
    command: "Run agentstack observe query --command validate.",
    "error-class": "Run agentstack observe errors --error-class WebhookSignatureError.",
    id: "Run agentstack observe trace --id trace_123 --env production.",
    since: "Run agentstack observe errors --env production --since 2h.",
    "group-by": "Run agentstack observe errors --env production --group-by component.",
    format: "Run agentstack observe export --env preview --format otlp-json."
  });
  const store = new JsonlTelemetryStore(join(io.cwd, ".agentstack", "events.jsonl"));
  const compareOptions = { ...options };
  delete compareOptions.env;
  const query = mode === "compare" ? buildObserveQuery(compareOptions) : buildObserveQuery(options);

  if (mode === "export") {
    const environment = readRequiredTelemetryEnvironmentOption(options.env);
    const format = readString(options.format) ?? "otlp-json";
    if (format !== "otlp-json") {
      throw new Error(
        [
          "FAIL observe.export.format.unsupported",
          `Unsupported observe export format: ${format}.`,
          "Fix: Run agentstack observe export --env preview --format otlp-json."
        ].join("\n")
      );
    }

    const events = await store.timeline({ environment });
    const request = wideEventsToOtlpLogsRequest(events, { serviceName: "agentstack-app" });
    const artifactPath = join(".agentstack", "exports", `telemetry-${environment}-otlp.json`);
    const absoluteArtifactPath = join(io.cwd, artifactPath);
    await mkdir(dirname(absoluteArtifactPath), { recursive: true });
    await writeFile(absoluteArtifactPath, `${JSON.stringify(request, null, 2)}\n`, "utf8");

    io.write(`EXPORTED observe otlp-json ${environment} ${events.length}`);
    io.write(artifactPath);
    await recordCommandEvent(io, {
      name: "agentstack.observe.export.completed",
      environment,
      journey: "observability",
      command: ["observe", ...argv].join(" "),
      status: "ok",
      state: { format, events: events.length, artifactPath }
    });
    return 0;
  }

  if (mode === "query" || mode === "timeline") {
    const events = mode === "timeline" ? await store.timeline(query) : await store.query(query);

    io.write(`PASS observe ${mode} ${events.length}`);
    writeObservedEvents(io, events, { includeState: true });
    await recordObserveCompleted(io, argv, query.environment, mode, events.length);
    return 0;
  }

  if (mode === "trace") {
    const id = readRequiredStringOption(
      options.id,
      "id",
      "Run agentstack observe trace --id trace_123 --env production."
    );
    const events = await store.timeline({
      ...query,
      traceId: id
    });
    io.write(`PASS observe trace ${events.length}`);
    writeObservedEvents(io, events, { includeState: true });
    await recordObserveCompleted(io, argv, query.environment, mode, events.length);
    return 0;
  }

  if (mode === "journey") {
    const id = readRequiredStringOption(
      options.id,
      "id",
      "Run agentstack observe journey --id journey_123 --include-state."
    );
    const events = await store.timeline({
      ...query,
      journeyId: id
    });
    io.write(`PASS observe journey ${events.length}`);
    writeObservedEvents(io, events, { includeState: Boolean(options["include-state"]) });
    await recordObserveCompleted(io, argv, query.environment, mode, events.length);
    return 0;
  }

  if (mode === "errors") {
    const environment = readTelemetryEnvironmentOption(options.env);
    const events = (await store.timeline({
      ...query,
      environment
    })).filter(isErrorEvent);
    io.write(`PASS observe errors ${events.length}`);
    if (readString(options["group-by"]) === "component") {
      for (const [component, count] of countErrorGroupsByComponent(events)) {
        io.write(`group component ${component} events=${count}`);
      }
    }
    writeObservedEvents(io, events, { includeState: true });
    await recordObserveCompleted(io, argv, environment, mode, events.length);
    return 0;
  }

  if (mode === "webhook") {
    const [provider] = rest;
    if (!provider || provider.startsWith("--")) {
      throw new Error(
        [
          "FAIL cli.option.missing",
          "Webhook provider is required.",
          "Fix: Run agentstack observe webhook clerk --env production --since 24h."
        ].join("\n")
      );
    }
    const environment = readTelemetryEnvironmentOption(options.env);
    const events = (await store.timeline({
      ...query,
      environment
    })).filter(
      (event) =>
        event.surface === provider ||
        event.name.startsWith(`webhook.${provider}.`) ||
        event.component === `${provider}:webhook` ||
        event.state.provider === provider
    );
    io.write(`PASS observe webhook ${provider} ${events.length}`);
    writeObservedEvents(io, events, { includeState: true });
    await recordObserveCompleted(io, argv, environment, mode, events.length);
    return 0;
  }

  if (mode === "component") {
    const [component] = rest;
    if (!component || component.startsWith("--")) {
      throw new Error(
        [
          "FAIL cli.option.missing",
          "Component id is required.",
          "Fix: Run agentstack observe component convex:billing.applySubscriptionUpdate --env production."
        ].join("\n")
      );
    }
    const environment = readTelemetryEnvironmentOption(options.env);
    const events = await store.timeline({
      ...query,
      environment,
      component
    });
    io.write(`PASS observe component ${component} ${events.length}`);
    writeObservedEvents(io, events, { includeState: true });
    await recordObserveCompleted(io, argv, environment, mode, events.length);
    return 0;
  }

  if (mode === "compare") {
    const environments = readCompareEnvironments(options.env);
    const journey = readRequiredStringOption(
      options.journey,
      "journey",
      "Run agentstack observe compare --env preview,production --journey onboarding."
    );
    const events = (await store.timeline({ ...query, journey })).filter(
      (event) => environments.includes(event.environment)
    );
    io.write(`PASS observe compare ${journey} ${events.length}`);
    const counts = compareEventCountsByEnvironment(events, {
      environments,
      journey,
      event: query.event
    });
    for (const { environment, count } of counts) {
      const environmentEvents = events.filter((event) => event.environment === environment);
      io.write(`${environment} events=${count} errors=${environmentEvents.filter(isErrorEvent).length}`);
    }
    await recordObserveCompleted(io, argv, environments[0], mode, events.length);
    return 0;
  }

  io.write("FAIL cli.unknown-command");
  return 1;
}

function buildObserveQuery(options: ParsedOptions): TelemetryQuery {
  return {
    environment: readTelemetryEnvironmentOption(options.env),
    surface: readTelemetrySurfaceOption(options.surface),
    event: readString(options.event),
    journey: readString(options.journey),
    traceId: readString(options.trace),
    correlationId: readString(options.correlation),
    journeyId: readString(options["journey-id"]),
    component: readString(options.component),
    releaseId: readString(options["release-id"]) ?? readString(options.release),
    actorId: readString(options["actor-id"]) ?? readString(options.actor),
    command: readString(options.command),
    since: readSinceOption(options.since),
    errorClass: readString(options["error-class"])
  };
}

function writeObservedEvents(
  io: RunIo,
  events: WideEvent[],
  options: { includeState: boolean }
): void {
  for (const event of events) {
    io.write(`${event.timestamp} ${event.environment} ${event.surface} ${event.name}`);
    if (options.includeState) {
      io.write(JSON.stringify(event.state));
    }
  }
}

function readSinceOption(value: string | boolean | undefined): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throwMissingOption("since", "Run agentstack observe errors --env production --since 2h.");
  }

  try {
    return parseSinceWindow(value);
  } catch {
    throw new Error(
      [
        "FAIL cli.option.invalid",
        `Invalid --since value: ${value}. Expected relative time like 2h or an ISO timestamp.`,
        "Fix: Run agentstack observe errors --env production --since 2h."
      ].join("\n")
    );
  }
}

function countErrorGroupsByComponent(events: WideEvent[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const group of groupErrorEvents(events)) {
    const component = group.component ?? "unknown";
    counts.set(component, (counts.get(component) ?? 0) + group.count);
  }
  return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function readCompareEnvironments(value: string | boolean | undefined): TelemetryEnvironment[] {
  const raw = readRequiredStringOption(
    value,
    "env",
    "Run agentstack observe compare --env preview,production --journey onboarding."
  );
  const environments = raw.split(",").map((environment) => environment.trim()).filter(Boolean);
  if (environments.length === 0) {
    throw new Error(
      [
        "FAIL cli.option.invalid",
        `Invalid --env value: ${raw}. Expected comma-separated environments.`,
        "Fix: Run agentstack observe compare --env preview,production --journey onboarding."
      ].join("\n")
    );
  }

  for (const environment of environments) {
    if (!isEnvironment(environment)) {
      throw new Error(
        [
          "FAIL cli.option.invalid",
          `Invalid --env value: ${environment}. Expected one of: ${environmentValues.join(", ")}.`,
          "Fix: Run agentstack observe compare --env preview,production --journey onboarding."
        ].join("\n")
      );
    }
  }
  return environments as TelemetryEnvironment[];
}

async function recordObserveCompleted(
  io: RunIo,
  argv: string[],
  environment: TelemetryEnvironment | undefined,
  mode: string,
  events: number
): Promise<void> {
  await recordCommandEvent(io, {
    name: "agentstack.observe.completed",
    environment: environment ?? "development",
    journey: "observability",
    command: ["observe", ...argv].join(" "),
    status: "ok",
    state: { mode, events }
  });
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
        `Expected one of: ${environmentOptionValues.join(", ")}.`,
        `Fix: ${options.fix}`
      ].join("\n")
    );
  }

  const environment = normalizeEnvironmentName(value);
  if (environment) {
    return environment;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --${options.flag} value: ${value}. Expected one of: ${environmentOptionValues.join(", ")}.`,
      `Fix: ${options.fix}`
    ].join("\n")
  );
}

function normalizeEnvironmentName(value: string): EnvironmentName | undefined {
  if (value === "prod") {
    return "production";
  }

  if (isEnvironment(value)) {
    return value;
  }

  return undefined;
}

function readLifecycleEnvironmentOption(
  value: string | boolean | undefined,
  options: { flag: string; fix: string }
): EnvironmentName {
  if (value === undefined) {
    return "preview";
  }

  return readEnvironmentOption(value, options);
}

function readReleaseEnvironmentOption(
  value: string | boolean | undefined,
  options: { flag: string; fix: string }
): ReleaseEnvironment {
  if (typeof value !== "string") {
    throw new Error(
      [
        "FAIL cli.option.missing",
        `--${options.flag} requires a value.`,
        "Expected one of: preview, prod, production.",
        `Fix: ${options.fix}`
      ].join("\n")
    );
  }

  const environment = normalizeReleaseEnvironment(value);
  if (environment) {
    return environment;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --${options.flag} value: ${value}. Expected one of: preview, prod, production.`,
      `Fix: ${options.fix}`
    ].join("\n")
  );
}

function readDevEnvironmentOption(value: string | boolean | undefined): EnvironmentName {
  const environment = readLifecycleEnvironmentOption(value, {
    flag: "env",
    fix: "Run agentstack dev --env preview."
  });

  if (environment === "development" || environment === "preview") {
    return environment;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      "Invalid --env value: production. Expected one of: development, preview.",
      "Fix: Run agentstack dev --env preview."
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

function readRequiredTelemetryEnvironmentOption(
  value: string | boolean | undefined
): TelemetryEnvironment {
  if (value === undefined) {
    throwMissingOption("env", "Run agentstack observe export --env preview --format otlp-json.");
  }

  return readTelemetryEnvironmentOption(value) as TelemetryEnvironment;
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
