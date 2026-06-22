import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, extname, join } from "node:path";
import {
  createClerkCommandPlan,
  createConvexCommandPlan,
  createEasCommandPlan,
  createVercelCommandPlan,
  createProviderOperationPlan,
  buildProviderAdoptProposal,
  confirmLiveProviderInventoryIdentity,
  createLiveProviderInventory,
  createProviderInventory,
  createProviderLifecyclePlan,
  executeConvexApply,
  executeVercelPreviewApply,
  evaluateProviderDriftProof,
  evaluateProviderExactIdentityProof,
  evaluateProviderIdentityCandidateProof,
  evaluateProviderLiveCoherenceProof,
  getProviderProofContract,
  getEnabledProviderAdapterDefinitions,
  inspectEasReadOnly,
  inspectClerkReadOnly,
  inspectConvexReadOnly,
  inspectVercelReadOnly,
  LocalCloudAdapter,
  enforceProviderLedgerResource,
  linkLedgerBackedProviderResource,
  parseProviderLedger,
  providerLedgerPath,
  redactProviderText,
  type InspectEnvResource,
  type ProviderAdapterDefinition,
  type ProviderCommandExecutor,
  type ProviderControlPlaneService,
  type ProviderExecutionResult,
  type ProviderDriftProofResult,
  type ProviderLiveCoherenceProofResult,
  type ProviderInventory,
  type ProviderIdentityCandidateProofResult,
  type ProviderIdentityProofMissingLabel,
  type ProviderInventorySource,
  type ProviderInventoryRow,
  type ProviderLifecyclePlan,
  type ProviderLedgerDecision,
  type ProviderLedgerExpectedMatch,
  type ProviderProofContract,
  type ProviderExactIdentityDecision,
  type ClerkExactProofContext,
  type EasExactProofContext,
  type VercelExactProofContext,
  type ProviderOperation
} from "@agentstack/adapters";
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
  validateGuidancePolicy,
  validateLocalProject,
  validateThemeTokens,
  type EnvValueState,
  type AgentstackManifest,
  type Diagnostic,
  type EnvironmentName,
  type LifecycleCloudSummary,
  type LifecycleProviderAdapterSummary,
  type LifecycleProviderOperationSummary,
  type LifecycleSummary,
  type ReleaseEnvironment,
  type SurfaceName
} from "@agentstack/core";
import {
  buildTelemetryCompareInspection,
  buildTelemetryErrorInspection,
  buildTelemetryJourneyInspection,
  buildTelemetryTimelineInspection,
  createWideEvent,
  groupErrorEvents,
  isErrorEvent,
  JsonlTelemetryStore,
  parseSinceWindow,
  wideEventsToOtlpLogsRequest,
  type TelemetryInspection,
  type TelemetryTimelineEntry,
  type TelemetryEnvironment,
  type TelemetryQuery,
  type TelemetrySurface,
  type WideEvent
} from "@agentstack/telemetry";
import { loadLocalEnvValues, loadProjectContext } from "./context.js";

export type RunIo = {
  cwd: string;
  write: (line: string) => void;
  providerExecutor?: ProviderCommandExecutor;
  commandRunner?: LocalCommandRunner;
};

export type LocalCommandSpec = {
  id: string;
  command: string;
  args: string[];
};

export type LocalCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type LocalCommandRunner = (command: LocalCommandSpec) => Promise<LocalCommandResult>;

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
const environmentOptionValues = ["development", "preview", "production"] as const;
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

const localQualityCommands: LocalCommandSpec[] = [
  { id: "format", command: "pnpm", args: ["format:check"] },
  { id: "generated", command: "pnpm", args: ["generated:check"] },
  { id: "lint", command: "pnpm", args: ["lint"] },
  { id: "typecheck", command: "pnpm", args: ["typecheck"] },
  { id: "build", command: "pnpm", args: ["build"] },
  { id: "test", command: "pnpm", args: ["test"] }
];

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

    if (command === "format") {
      return await formatCommand(argv.slice(1), io);
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

    if (command === "provider" && subcommand === "plan") {
      return await providerPlanCommand(rest, io);
    }

    if (command === "provider" && subcommand === "reconcile") {
      return await providerReconcileCommand(rest, io);
    }

    if (command === "provider" && subcommand === "inspect") {
      return await providerInspectCommand(rest, io);
    }

    if (command === "provider" && subcommand === "apply") {
      return await providerApplyCommand(rest, io);
    }

    if (command === "provider" && subcommand === "inventory") {
      return await providerInventoryCommand(rest, io);
    }

    if (command === "provider" && subcommand === "proof") {
      return await providerProofCommand(rest, io);
    }

    if (command === "provider" && subcommand === "link") {
      return await providerLinkCommand(rest, io);
    }

    if (command === "provider" && subcommand === "adopt") {
      return await providerAdoptCommand(rest, io);
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

    if (command === "generated" && subcommand === "validate") {
      return await generatedValidateCommand(io);
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
        fix: "Run agentstack validate --release production."
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

  const liveEnvironment =
    options.live === undefined
      ? undefined
      : readValidateLiveOptions(options.live, options.env, "Run agentstack validate --live --env preview.");

  const { context, diagnostics, envValues } = await runLocalValidationGate(io.cwd);
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    if (options.quality || options.live) {
      return 1;
    }
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

  if (options.quality) {
    io.write("Evidence: local-structure");
    io.write("Scope: local filesystem structure only; no package commands");
    io.write("Evidence: local-quality");
    io.write(
      "Scope: local filesystem and package commands only; no local-cloud writes; no provider executor; no live provider reads"
    );
    const qualityResult = await runQualityValidation(io);
    if (!qualityResult.ok) {
      io.write("FAIL validate --quality");
      writeFailedQualityCommand(io, qualityResult.failure);
      return 1;
    }
    io.write("PASS validate --quality");
    return 0;
  }

  if (liveEnvironment) {
    return await liveValidationCommand(io, { context, envValues }, liveEnvironment);
  }

  if (options.cloud) {
    io.write("Evidence: local-rehearsal");
    io.write("Scope: local-cloud state only; no live provider reads");
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

  io.write("Evidence: local-structure");
  io.write("Scope: local filesystem structure only; no package commands");
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

async function formatCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  if (options.check !== true) {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "format.mode.required",
        message: "Format currently supports check mode only.",
        fix: "Run agentstack format --check.",
        blocks: ["format"]
      })
    );
    return 1;
  }

  const diagnostics = await findFormatDiagnostics(io.cwd);
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (diagnostics.length > 0) {
    io.write("FAIL format --check");
    return 1;
  }

  io.write("PASS format --check");
  return 0;
}

async function inspectCommand(argv: string[], io: RunIo): Promise<number> {
  const environment = readLifecycleEnvironmentOption(parseOptions(argv).env, {
    flag: "env",
    fix: "Run agentstack inspect --env preview."
  });
  const { summary } = await loadLifecycleSummary(io.cwd, environment, { includeCloudDiagnostics: false });

  io.write(`${summary.status.toUpperCase()} inspect ${summary.app.slug}`);
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
  io.write("Evidence: local-rehearsal");
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

async function providerPlanCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix = "Run agentstack provider plan --service clerk --env preview.";
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix
  });
  const allServices = options.all === true;

  if (allServices && options.service !== undefined) {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.plan.all.service-ambiguous",
        path: "provider plan --all --service",
        message: "Use either --all or --service, not both.",
        fix: "Run agentstack provider plan --env preview --all.",
        blocks: ["provider plan"]
      })
    );
    return 1;
  }

  if (allServices && environment === "development") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.plan.all.env-unsupported",
        path: environment,
        message: "Aggregate provider planning supports preview and production environments only.",
        fix: "Run agentstack provider plan --env preview --all or agentstack provider plan --env production --all.",
        blocks: ["provider plan"]
      })
    );
    return 1;
  }

  if (allServices) {
    if (environment !== "preview" && environment !== "production") {
      return 1;
    }
    return await providerPlanAllCommand(argv, io, environment);
  }

  const service = readRequiredStringOption(options.service, "service", fix);

  if (service !== "clerk" && service !== "convex" && service !== "vercel" && service !== "eas") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.service.unsupported",
        path: String(options.service ?? "missing"),
        message: "Clerk, Convex, Vercel, and EAS provider command planners are available in this slice.",
        fix,
        blocks: ["provider plan"]
      })
    );
    await recordCommandEvent(io, {
      name: "agentstack.provider.plan.completed",
      environment,
      journey: "provider-plan",
      command: ["provider", "plan", ...argv].join(" "),
      status: "fail",
      state: { service, reason: "unsupported-service" }
    });
    return 1;
  }

  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    await recordCommandEvent(io, {
      name: "agentstack.provider.plan.completed",
      environment,
      journey: "provider-plan",
      command: ["provider", "plan", ...argv].join(" "),
      status: "fail",
      state: { service, diagnostics: validation.diagnostics.length }
    });
    return 1;
  }

  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
  const cloudReport = await adapter.inspect(validation.context.manifest, environment, {
    envValues: validation.envValues
  });
  const providerOperationPlan = createProviderOperationPlan(cloudReport);
  const ledgerRows = await readProviderLedgerRowsIfPresent(io.cwd);
  const operations = providerOperationPlan.operations.filter((operation) => operation.service === service);
  const lifecycle =
    environment === "preview" || environment === "production"
      ? createProviderLifecyclePlan({
          manifest: validation.context.manifest,
          service,
          environment,
          ledgerRows,
          pendingOperationCount: providerLifecyclePendingOperationCount(operations)
        })
      : undefined;
  const plan = createProviderPlanForService(
    service,
    environment,
    validation.context.manifest,
    providerOperationPlan.operations
  );

  io.write(`PLAN provider ${plan.service} ${environment}`);
  io.write("Evidence: provider-command-plan");
  io.write("Provider execution: none");
  if (lifecycle) {
    writeProviderLifecyclePlan(io, lifecycle);
  }
  io.write(`Target: ${formatProviderPlanTarget(plan.target)}`);
  io.write(`Required env: ${formatList(plan.target.requiredEnv)}`);
  io.write(`Requires confirmation: ${plan.target.requiresConfirmation ? "yes" : "no"}`);
  if (plan.target.warnings.length > 0) {
    io.write("Warnings:");
    plan.target.warnings.forEach((warning) => io.write(`- ${warning}`));
  }
  io.write("Commands:");
  plan.commands.forEach((command) => writeProviderCommandPlanLine(io, command));

  await recordCommandEvent(io, {
    name: "agentstack.provider.plan.completed",
    environment,
    journey: "provider-plan",
    command: ["provider", "plan", ...argv].join(" "),
    status: "ok",
    state: {
      service: plan.service,
      target: formatProviderPlanTarget(plan.target),
      requiredEnv: plan.target.requiredEnv,
      warnings: plan.target.warnings.length,
      commands: plan.commands.map((command) => ({
        kind: command.kind,
        valueSource: command.valueSource,
        secret: command.secret,
        requiresConfirmation: command.requiresConfirmation
      }))
    }
  });
  return 0;
}

async function providerPlanAllCommand(
  argv: string[],
  io: RunIo,
  environment: "preview" | "production"
): Promise<number> {
  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
  const cloudReport = await adapter.inspect(validation.context.manifest, environment, {
    envValues: validation.envValues
  });
  const providerOperationPlan = createProviderOperationPlan(cloudReport);
  const ledgerRows = await readProviderLedgerRowsIfPresent(io.cwd);
  const enabledServices = validation.context.serviceOrder
    .filter(isProviderControlPlaneService)
    .filter((service) => validation.context.manifest.services[service].enabled);
  const plans = enabledServices.map((service) => {
    const operations = providerOperationPlan.operations.filter((operation) => operation.service === service);
    return {
      service,
      operations,
      lifecycle: createProviderLifecyclePlan({
        manifest: validation.context.manifest,
        service,
        environment,
        ledgerRows,
        pendingOperationCount: providerLifecyclePendingOperationCount(operations)
      }),
      plan: createProviderPlanForService(service, environment, validation.context.manifest, providerOperationPlan.operations)
    };
  });

  io.write(`PLAN provider ${environment} all`);
  io.write("Evidence: provider-command-plan");
  io.write("Provider execution: none");
  io.write("Mutation: none");
  io.write("Readiness: not-claimed");
  for (const { service, operations, lifecycle, plan } of plans) {
    io.write(`Service: ${service}`);
    writeProviderLifecyclePlan(io, lifecycle);
    io.write(`Target: ${formatProviderPlanTarget(plan.target)}`);
    io.write(`Operations: ${operations.length}`);
    io.write(`Commands: ${plan.commands.length}`);
    plan.commands.forEach((command) => writeProviderCommandPlanLine(io, command));
  }

  return 0;
}

async function providerReconcileCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix =
    "Run agentstack provider reconcile --env preview --plan or agentstack provider reconcile --env production --plan.";
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix
  });
  const source = readProviderInventorySourceOption(options.source, options.live, fix);

  if (options.plan !== true) {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.reconcile.plan.required",
        path: "provider reconcile",
        message: "Provider reconcile is plan-only in this slice.",
        fix,
        blocks: ["provider reconcile"]
      })
    );
    return 1;
  }

  if (environment === "development") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.reconcile.env-unsupported",
        path: environment,
        message: "Provider reconciliation planning supports preview and production environments only.",
        fix,
        blocks: ["provider reconcile"]
      })
    );
    return 1;
  }

  if (options.service !== undefined) {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.reconcile.service-unsupported",
        path: "provider reconcile --service",
        message: "Aggregate provider reconciliation planning does not accept --service.",
        fix,
        blocks: ["provider reconcile"]
      })
    );
    return 1;
  }

  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  const enabledServices = validation.context.serviceOrder
    .filter(isProviderControlPlaneService)
    .filter((service) => validation.context.manifest.services[service].enabled);

  if (source === "live") {
    return await providerReconcileLiveCommand(io, environment, validation, enabledServices);
  }

  const plans = enabledServices.map((service) => ({
    service,
    plan: createProviderPlanForService(service, environment, validation.context.manifest, [])
  }));

  io.write(`PLAN provider reconcile ${environment}`);
  io.write("Evidence: provider-reconciliation-plan");
  io.write("Provider execution: none");
  io.write("Mutation: none");
  io.write("Readiness: not-claimed");
  io.write("Current source: local-validation-and-ledger-only");
  io.write("Live state: not-read");
  io.write("Local-cloud state: not-read");
  for (const { service, plan } of plans) {
    io.write(`Service: ${service}`);
    io.write("Desired: enabled");
    io.write("Current: unknown");
    io.write("Identity: ambiguous");
    io.write("Drift: unproven");
    const ledgerMatch = providerApplyLedgerMatch(service, environment, validation.context.manifest);
    const ledgerStatus =
      ledgerMatch === undefined
        ? "not-required-for-plan"
        : formatProviderPlanLedgerStatus(await enforceProviderLedgerResource(io.cwd, ledgerMatch));
    io.write(`Ledger: ${ledgerStatus}`);
    io.write("Operations: not-evaluated");
    io.write(`Commands: ${plan.commands.length}`);
    io.write(`Next: provider plan --service ${service} --env ${environment}`);
  }

  return 0;
}

async function providerReconcileLiveCommand(
  io: RunIo,
  environment: "preview" | "production",
  validation: Awaited<ReturnType<typeof runLocalValidationGate>>,
  enabledServices: ProviderControlPlaneService[]
): Promise<number> {
  const ledgerRows = await readProviderLedgerRowsIfPresent(io.cwd);
  const executor = resolveProviderExecutor(io);
  const summaries: Array<{
    service: ProviderControlPlaneService;
    inventory: ProviderInventory;
    readResults: ProviderExecutionResult[];
    plan: ReturnType<typeof createProviderPlanForService>;
    failed: boolean;
  }> = [];

  for (const service of enabledServices) {
    const localInventory = await createProviderInventory({
      cwd: io.cwd,
      manifest: validation.context.manifest,
      service,
      environment,
      ledgerRows
    });
    const secretValues =
      service === "convex"
        ? collectSecretValues(validation.envValues, environment, "convex")
        : collectEnvironmentSecretValues(validation.envValues, environment);
    const readResults = await readLiveProviderInventory({
      service,
      environment,
      manifest: validation.context.manifest,
      executor,
      cwd: io.cwd,
      secretValues,
      clerkExactProofContext: buildLiveValidationClerkExactProofContext({
        service,
        environment,
        manifest: validation.context.manifest,
        ledgerRows
      }),
      vercelExactProofContext: buildLiveValidationVercelExactProofContext({
        service,
        environment,
        manifest: validation.context.manifest,
        ledgerRows
      }),
      easExactProofContext: buildLiveValidationEasExactProofContext({
        service,
        environment,
        manifest: validation.context.manifest,
        ledgerRows
      })
    });
    const inventory = await createLiveProviderInventory({ localInventory, readResults });
    summaries.push({
      service,
      inventory,
      readResults,
      plan: createProviderPlanForService(service, environment, validation.context.manifest, []),
      failed: readResults.some((result) => result.status === "failed")
    });
  }

  const failed = summaries.some((summary) => summary.failed);
  io.write(`${failed ? "FAIL" : "PLAN"} provider reconcile ${environment}`);
  io.write("Evidence: live-reconciliation-plan");
  io.write("Provider execution: read-only");
  io.write("Mutation: none");
  io.write("Readiness: not-claimed");
  io.write("Current source: live-read-inventory");
  io.write("Live state: read");
  io.write("Local-cloud state: not-read");
  if (failed) {
    io.write("Reason: live-read-failed");
  }
  for (const { service, inventory, readResults, plan } of summaries) {
    const row = inventory.rows[0];
    io.write(`Service: ${service}`);
    io.write(`Desired: enabled`);
    io.write(`Current: ${row?.liveStatus ?? "unknown"}`);
    io.write(`Identity: ${row?.identityMatch ?? "ambiguous"}`);
    io.write(`Identity scope: ${row?.identityScope ?? "none"}`);
    io.write(`Drift: ${row?.driftSummary ?? "unknown"}`);
    io.write(`Permission: ${row?.permissionSummary ?? "not-checked"}`);
    io.write(`Ledger: ${row?.ledgerStatus ?? "missing"}`);
    io.write(`Operations: not-evaluated`);
    io.write(`Read commands: ${inventory.liveReadSummary?.commands ?? 0}`);
    io.write(`Live results: ${inventory.liveReadSummary?.results ?? 0}`);
    io.write(`Commands: ${plan.commands.length}`);
    writeLiveValidationProviderProofSummary(io, service, environment, readResults);
    if (row) {
      io.write(
        `Next: provider proof --service ${service} --env ${environment} --resource-type ${row.resourceType} --name ${row.name}`
      );
    }
  }

  return failed ? 1 : 0;
}

function isProviderControlPlaneService(service: string): service is ProviderControlPlaneService {
  return service === "clerk" || service === "convex" || service === "vercel" || service === "eas";
}

function createProviderPlanForService(
  service: ProviderControlPlaneService,
  environment: EnvironmentName,
  manifest: AgentstackManifest,
  operations: ProviderOperation[]
) {
  return service === "clerk"
    ? createClerkCommandPlan({
        environment,
        operations,
        includeBootstrap: true
      })
    : service === "convex"
      ? createConvexCommandPlan({
          manifest,
          environment,
          operations,
          includeDeploy: true
        })
      : service === "vercel"
        ? createVercelCommandPlan({
            environment,
            operations,
            includeDeploy: true
          })
        : createEasCommandPlan({
            environment,
            operations,
            includeBuild: true
        });
}

function providerLifecyclePendingOperationCount(operations: ProviderOperation[]): number {
  return operations.filter((operation) => operation.kind === "env.set" || operation.kind === "env.remove").length;
}

function writeProviderLifecyclePlan(io: RunIo, lifecycle: ProviderLifecyclePlan): void {
  io.write(`Resource: ${lifecycle.resourceType} ${lifecycle.name}`);
  io.write(`Ledger: ${formatProviderLifecycleLedgerStatus(lifecycle)}`);
  io.write(`Lifecycle: ${lifecycle.lifecycle}`);
  io.write(`Lifecycle reason: ${formatProviderLifecycleReason(lifecycle.reason)}`);
}

function formatProviderLifecycleLedgerStatus(lifecycle: ProviderLifecyclePlan): string {
  if (lifecycle.lifecycle === "blocked" && lifecycle.ledgerStatus !== "invalid") {
    return `blocked ${lifecycle.ledgerStatus}`;
  }

  return lifecycle.ledgerStatus;
}

function formatProviderLifecycleReason(reason: ProviderLifecyclePlan["reason"]): string {
  if (reason === "ledger-missing") {
    return "ledger-missing";
  }
  if (reason === "ledger-planned") {
    return "ledger-planned";
  }
  if (reason === "active-with-local-operations") {
    return "active-with-local-env-operations";
  }
  if (reason === "active-without-local-operations") {
    return "active-without-local-env-operations";
  }
  return "ledger-blocked";
}

export function providerApplyLedgerMatch(
  service: string,
  environment: EnvironmentName,
  manifest: AgentstackManifest
): ProviderLedgerExpectedMatch | undefined {
  if (environment !== "preview" && environment !== "production") {
    return undefined;
  }

  if (service === "convex") {
    return {
      provider: "convex",
      environment,
      resourceType: "deployment",
      resourceName: environment === "production" ? "prod" : `${manifest.app.slug}-preview`
    };
  }

  if (service === "vercel" && environment === "preview") {
    return {
      provider: "vercel",
      environment,
      resourceType: "project",
      resourceName: manifest.app.slug
    };
  }

  return undefined;
}

function formatProviderPlanLedgerStatus(decision: ProviderLedgerDecision): string {
  if (decision.ok) {
    return decision.row.status;
  }

  if (decision.reason === "missing") {
    return "missing";
  }

  if (decision.reason === "invalid") {
    return "invalid";
  }

  if (decision.reason === "incomplete") {
    return "invalid";
  }

  return `blocked ${decision.row.status}`;
}

function formatProviderPlanTarget(target: {
  applicationSelector?: string;
  deploymentSelector?: string;
  vercelEnvironment?: string;
  easEnvironment?: string;
}): string {
  return (
    target.applicationSelector ??
    target.deploymentSelector ??
    target.vercelEnvironment ??
    target.easEnvironment ??
    "unknown"
  );
}

function formatProviderCommandTargetLabel(kind: string, args: string[], id: string): string {
  if ((kind === "env.set" || kind === "env.remove") && args[3] === "env") {
    return args.at(-1) ?? kind;
  }

  if ((kind === "env.add" || kind === "env.update" || kind === "env.remove") && args[3] === "env") {
    return args[5] ?? kind;
  }

  if ((kind === "env.create" || kind === "env.update" || kind === "env.delete") && args[3]?.startsWith("env:")) {
    return flagValue(args, kind === "env.create" ? "--name" : "--variable-name") ?? kind;
  }

  if (kind === "env.pull" || kind === "env.review") {
    return id.split(".").at(-1) ?? kind;
  }

  return kind;
}

function writeProviderCommandPlanLine(
  io: RunIo,
  command: ReturnType<typeof createProviderPlanForService>["commands"][number]
): void {
  const targetLabel = formatProviderCommandTargetLabel(command.kind, command.args, command.id);
  const confirmationLabel = command.requiresConfirmation ? " [requires-confirmation]" : "";
  const valuePrefix = command.stdinLabel ? ` ${targetLabel}: ${command.stdinLabel} |` : "";
  io.write(`- ${command.kind}${confirmationLabel}${valuePrefix} ${command.args.join(" ")}`);
}

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function providerInspectCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix = "Run agentstack provider inspect --service clerk --env preview.";
  const service = readRequiredStringOption(options.service, "service", fix);
  const environment = readProviderRuntimeEnvironmentOption(options.env, fix);

  if (service !== "clerk" && service !== "convex" && service !== "vercel" && service !== "eas") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.service.unsupported",
        path: service,
        message:
          "Only Clerk, Convex, Vercel preview/production, and EAS preview/production provider inspect are available in this slice.",
        fix,
        blocks: ["provider inspect"]
      })
    );
    await recordCommandEvent(io, {
      name: "agentstack.provider.inspect.completed",
      environment,
      journey: "provider-inspect",
      command: ["provider", "inspect", ...argv].join(" "),
      status: "fail",
      state: { service, reason: "unsupported-service" }
    });
    return 1;
  }

  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    await recordCommandEvent(io, {
      name: "agentstack.provider.inspect.completed",
      environment,
      journey: "provider-inspect",
      command: ["provider", "inspect", ...argv].join(" "),
      status: "fail",
      state: { service, diagnostics: validation.diagnostics.length }
    });
    return 1;
  }

  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
  const cloudReport = await adapter.inspect(validation.context.manifest, environment, {
    envValues: validation.envValues
  });
  const providerOperationPlan = createProviderOperationPlan(cloudReport);
  const secretValues =
    service === "convex"
      ? collectSecretValues(validation.envValues, environment, "convex")
      : collectEnvironmentSecretValues(validation.envValues, environment);
  let results: ProviderExecutionResult[] = [];
  const plan =
    service === "clerk"
      ? createClerkCommandPlan({
          environment,
          operations: providerOperationPlan.operations,
          includeBootstrap: false
        })
      : service === "convex"
        ? createConvexCommandPlan({
            manifest: validation.context.manifest,
            environment,
            operations: providerOperationPlan.operations,
            includeDeploy: false
          })
        : service === "vercel"
          ? createVercelCommandPlan({
              environment,
              operations: providerOperationPlan.operations,
              includeDeploy: false
            })
          : createEasCommandPlan({
              environment,
              operations: providerOperationPlan.operations,
              includeBuild: true
            });

  if (service === "clerk") {
    results = await inspectClerkReadOnly({
      environment,
      executor: resolveProviderExecutor(io),
      cwd: io.cwd,
      secretValues
    });
  }

  if (service === "convex") {
    results = await inspectConvexReadOnly({
      manifest: validation.context.manifest,
      environment,
      executor: resolveProviderExecutor(io),
      cwd: io.cwd,
      secretValues
    });
  }

  if (service === "eas") {
    try {
      results = await inspectEasReadOnly({
        environment,
        executor: resolveProviderExecutor(io),
        cwd: io.cwd,
        secretValues
      });
    } catch (error) {
      io.write(
        formatDiagnostic({
          severity: "fail",
          code: "provider.inspect.unsupported",
          path: `${service}.${environment}`,
          message: error instanceof Error ? error.message : String(error),
          fix: "Run agentstack provider inspect --service eas --env preview.",
          blocks: ["provider inspect"]
        })
      );
      await recordCommandEvent(io, {
        name: "agentstack.provider.inspect.completed",
        environment,
        journey: "provider-inspect",
        command: ["provider", "inspect", ...argv].join(" "),
        status: "fail",
        state: { service, reason: "unsupported-environment" }
      });
      return 1;
    }
  }

  if (service === "vercel") {
    try {
      results = await inspectVercelReadOnly({
        environment,
        executor: resolveProviderExecutor(io),
        cwd: io.cwd,
        secretValues
      });
    } catch (error) {
      io.write(
        formatDiagnostic({
          severity: "fail",
          code: "provider.inspect.execution",
          path: `${service}.${environment}`,
          message: redactProviderText(error instanceof Error ? error.message : String(error), {
            secretValues
          }),
          fix: `Run agentstack provider inspect --service vercel --env ${environment}.`,
          blocks: ["provider inspect"]
        })
      );
      await recordCommandEvent(io, {
        name: "agentstack.provider.inspect.completed",
        environment,
        journey: "provider-inspect",
        command: ["provider", "inspect", ...argv].join(" "),
        status: "fail",
        state: { service, reason: "provider-execution-failed" }
      });
      return 1;
    }
  }

  const failed = results.some((result) => result.status === "failed");
  const pending = providerOperationPlan.operations.some((operation) => operation.service === service);
  const commandCount = service === "clerk" || service === "vercel" || service === "eas" ? results.length : plan.commands.length;
  io.write(`${failed || pending ? "WARN" : "PASS"} provider inspect ${service} ${environment}`);
  io.write("Evidence: live-read");
  io.write("Mutation: none");
  io.write(`Target: ${formatProviderPlanTarget(plan.target)}`);
  io.write(`Required env: ${formatList(plan.target.requiredEnv)}`);
  io.write(`Operations: ${providerOperationPlan.operations.filter((operation) => operation.service === service).length}`);
  io.write(`Commands: ${commandCount}`);
  io.write(`Results: ${results.length}`);
  writeProviderExecutionDiagnostics(io, results);

  await recordCommandEvent(io, {
    name: "agentstack.provider.inspect.completed",
    environment,
    journey: "provider-inspect",
    command: ["provider", "inspect", ...argv].join(" "),
    status: failed ? "fail" : pending ? "warn" : "ok",
    state: {
      service,
      operations: providerOperationPlan.operations.filter((operation) => operation.service === service).length,
      commands: commandCount,
      results: results.length
    }
  });
  return failed ? 1 : 0;
}

async function providerApplyCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix = "Run agentstack provider apply --service convex --env preview.";
  const service = readRequiredStringOption(options.service, "service", fix);
  const environment = readProviderRuntimeEnvironmentOption(options.env, fix);

  if (service === "clerk") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.apply.unsupported",
        path: service,
        message: "Clerk apply is not available in this slice; Clerk commands are inspect-only.",
        fix: "Run agentstack provider inspect --service clerk --env preview.",
        blocks: ["provider apply"]
      })
    );
    await recordCommandEvent(io, {
      name: "agentstack.provider.apply.completed",
      environment,
      journey: "provider-apply",
      command: ["provider", "apply", ...argv].join(" "),
      status: "fail",
      state: { service, reason: "unsupported-service" }
    });
    return 1;
  }

  if (service === "eas") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.apply.unsupported",
        path: service,
        message: "EAS apply is not available in this slice; EAS runtime execution is inspect-only.",
        fix: "Run agentstack provider inspect --service eas --env preview.",
        blocks: ["provider apply"]
      })
    );
    await recordCommandEvent(io, {
      name: "agentstack.provider.apply.completed",
      environment,
      journey: "provider-apply",
      command: ["provider", "apply", ...argv].join(" "),
      status: "fail",
      state: { service, reason: "unsupported-service" }
    });
    return 1;
  }

  if (service !== "convex" && service !== "vercel") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.service.unsupported",
        path: service,
        message: "Only Convex and Vercel preview provider apply are available in this slice.",
        fix,
        blocks: ["provider apply"]
      })
    );
    await recordCommandEvent(io, {
      name: "agentstack.provider.apply.completed",
      environment,
      journey: "provider-apply",
      command: ["provider", "apply", ...argv].join(" "),
      status: "fail",
      state: { service, reason: "unsupported-service" }
    });
    return 1;
  }

  if (service === "vercel" && environment !== "preview") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.apply.unsupported",
        path: `${service}.${environment}`,
        message:
          "Vercel runtime apply supports preview deploy only. Production apply and env mutation execution are not available in this slice.",
        fix: "Run agentstack provider apply --service vercel --env preview.",
        blocks: ["provider apply"]
      })
    );
    await recordCommandEvent(io, {
      name: "agentstack.provider.apply.completed",
      environment,
      journey: "provider-apply",
      command: ["provider", "apply", ...argv].join(" "),
      status: "fail",
      state: { service, reason: "unsupported-environment" }
    });
    return 1;
  }

  if (environment === "production" && options["confirm-production"] !== true) {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.production.confirmation-required",
        path: "production.convex",
        message: "Convex production apply requires --confirm-production.",
        fix: "Run agentstack provider apply --service convex --env production --confirm-production.",
        blocks: ["provider apply"]
      })
    );
    await recordCommandEvent(io, {
      name: "agentstack.provider.apply.completed",
      environment,
      journey: "provider-apply",
      command: ["provider", "apply", ...argv].join(" "),
      status: "fail",
      state: { service, reason: "confirmation-required" }
    });
    return 1;
  }

  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    await recordCommandEvent(io, {
      name: "agentstack.provider.apply.completed",
      environment,
      journey: "provider-apply",
      command: ["provider", "apply", ...argv].join(" "),
      status: "fail",
      state: { service, diagnostics: validation.diagnostics.length }
    });
    return 1;
  }

  const ledgerMatch = providerApplyLedgerMatch(service, environment, validation.context.manifest);
  if (ledgerMatch === undefined) {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "provider.apply.unsupported",
        path: `${service}.${environment}`,
        message: "This provider apply target is not ledger-gated for live mutation in this slice.",
        fix,
        blocks: ["provider apply"]
      })
    );
    await recordCommandEvent(io, {
      name: "agentstack.provider.apply.completed",
      environment,
      journey: "provider-apply",
      command: ["provider", "apply", ...argv].join(" "),
      status: "fail",
      state: { service, reason: "unsupported-ledger-target" }
    });
    return 1;
  }

  const ledgerDecision = await enforceProviderLedgerResource(io.cwd, ledgerMatch);
  if (!ledgerDecision.ok) {
    io.write(providerLedgerDiagnostic(ledgerDecision));
    await recordCommandEvent(io, {
      name: "agentstack.provider.apply.completed",
      environment,
      journey: "provider-apply",
      command: ["provider", "apply", ...argv].join(" "),
      status: "fail",
      state: { service, reason: `ledger-${ledgerDecision.reason}` }
    });
    return 1;
  }

  const adapter = new LocalCloudAdapter(io.cwd) as EnvAwareLocalCloudAdapter;
  const cloudReport = await adapter.inspect(validation.context.manifest, environment, {
    envValues: validation.envValues
  });
  const providerOperationPlan = createProviderOperationPlan(cloudReport);
  const operations = providerOperationPlan.operations.filter((operation) => operation.service === service);
  const secretValues =
    service === "convex"
      ? collectSecretValues(validation.envValues, environment, "convex")
      : collectEnvironmentSecretValues(validation.envValues, environment);
  const executor = resolveProviderExecutor(io);
  const plan =
    service === "convex"
      ? createConvexCommandPlan({
          manifest: validation.context.manifest,
          environment,
          operations,
          includeDeploy: true
        })
      : createVercelCommandPlan({
          environment,
          operations,
          includeDeploy: true
        });
  const results =
    service === "convex"
      ? await executeConvexApply({
          manifest: validation.context.manifest,
          environment,
          operations,
          includeDeploy: true,
          executor,
          cwd: io.cwd,
          confirmProduction: options["confirm-production"] === true,
          stdinByCommandId: buildConvexStdinByCommandId(operations, validation.envValues, environment),
          secretValues
        })
      : await executeVercelPreviewApply({
          environment,
          operations,
          includeDeploy: true,
          executor,
          cwd: io.cwd,
          secretValues
        });
  const failed = results.some((result) => result.status === "failed");
  const label = results.length > 0 ? "APPLIED" : "PASS";
  const commandCount = service === "vercel" ? results.length : plan.commands.length;

  io.write(`${label} provider ${service} ${environment}`);
  io.write(`Target: ${formatProviderPlanTarget(plan.target)}`);
  io.write(`Required env: ${formatList(plan.target.requiredEnv)}`);
  io.write(`Operations: ${operations.length}`);
  io.write(`Commands: ${commandCount}`);
  io.write(`Results: ${results.length}`);
  io.write("Evidence: live-mutation");
  io.write("Mutation scope: bounded provider executor");
  writeProviderExecutionDiagnostics(io, results);

  await recordCommandEvent(io, {
    name: "agentstack.provider.apply.completed",
    environment,
    journey: "provider-apply",
    command: ["provider", "apply", ...argv].join(" "),
    status: failed ? "fail" : "ok",
    state: {
      service,
      operations: operations.length,
      commands: commandCount,
      results: results.length
    }
  });
  return failed ? 1 : 0;
}

async function providerInventoryCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix = "Run agentstack provider inventory --service convex --env preview.";
  const service = readProviderControlPlaneServiceOption(options.service, fix);
  const environment = readProviderRuntimeEnvironmentOption(options.env, fix);
  const source = readProviderInventorySourceOption(options.source, options.live, fix);

  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  let ledgerRows: ReturnType<typeof parseProviderLedger> = [];
  try {
    ledgerRows = await readProviderLedgerRowsIfPresent(io.cwd);
  } catch (error) {
    io.write(
      providerInventoryLedgerDiagnostic({
        ok: false,
        reason: "invalid",
        path: providerLedgerPath,
        message: redactProviderText(error instanceof Error ? error.message : String(error))
      })
    );
    return 1;
  }

  let inventory = await createProviderInventory({
    cwd: io.cwd,
    manifest: validation.context.manifest,
    service,
    environment,
    ledgerRows
  });
  let liveResults: ProviderExecutionResult[] = [];

  if (source === "live") {
    const secretValues =
      service === "convex"
        ? collectSecretValues(validation.envValues, environment, "convex")
        : collectEnvironmentSecretValues(validation.envValues, environment);
    try {
      liveResults = await readLiveProviderInventory({
        service,
        environment,
        manifest: validation.context.manifest,
        executor: resolveProviderExecutor(io),
        cwd: io.cwd,
        secretValues,
        clerkExactProofContext: buildLiveValidationClerkExactProofContext({
          service,
          environment,
          manifest: validation.context.manifest,
          ledgerRows
        }),
        vercelExactProofContext: buildLiveValidationVercelExactProofContext({
          service,
          environment,
          manifest: validation.context.manifest,
          ledgerRows
        }),
        easExactProofContext: buildLiveValidationEasExactProofContext({
          service,
          environment,
          manifest: validation.context.manifest,
          ledgerRows
        })
      });
    } catch (error) {
      io.write(
        formatDiagnostic({
          severity: "fail",
          code: "provider.inventory.execution",
          path: `${service}.${environment}`,
          message: redactProviderText(error instanceof Error ? error.message : String(error), { secretValues }),
          fix,
          blocks: ["provider inventory"]
        })
      );
      return 1;
    }
    inventory = await createLiveProviderInventory({ localInventory: inventory, readResults: liveResults });
  }

  const hasFailedLiveRead = (inventory.liveReadSummary?.failed ?? 0) > 0;
  io.write(`${hasFailedLiveRead ? "FAIL" : "PASS"} provider inventory ${service} ${environment}`);
  io.write(`Evidence: ${inventory.evidence}`);
  io.write("Mutation: none");
  if (inventory.liveReadSummary) {
    io.write(`Commands: ${inventory.liveReadSummary.commands}`);
    io.write(`Results: ${inventory.liveReadSummary.results}`);
    io.write(`Succeeded: ${inventory.liveReadSummary.succeeded}`);
    io.write(`Failed: ${inventory.liveReadSummary.failed}`);
  }
  inventory.rows.forEach((row) => io.write(formatProviderInventoryRow(row)));
  if (source === "live") {
    writeProviderInventoryIdentitySummary(io, service, liveResults);
  }
  return hasFailedLiveRead ? 1 : 0;
}

async function providerProofCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix =
    "Run agentstack provider proof --service convex --env preview --resource-type deployment --name acme-crm-preview.";
  const service = readProviderControlPlaneServiceOption(options.service, fix);
  const environment = readProviderRuntimeEnvironmentOption(options.env, fix);
  const resourceType = readRequiredStringOption(options["resource-type"], "resource-type", fix);
  const name = readRequiredStringOption(options.name, "name", fix);

  const contract = getProviderProofContract(service);
  const unavailableLiveCoherence = evaluateProviderLiveCoherenceProof(
    service,
    evaluateProviderExactIdentityProof(service, []),
    { proof: "unavailable" }
  );

  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  if (!providerProofResourceShapeSupported(service, resourceType)) {
    writeProviderProofReport(io, {
      service,
      environment,
      contract,
      providerExecution: "none",
      ledger: "invalid",
      localLink: "not-read",
      liveResource: "unsupported",
      identityProof: "unavailable",
      identityScope: "none",
      identityCandidates: "unavailable",
      identityEvaluator: "unavailable",
      liveCoherence: unavailableLiveCoherence,
      reason: "proof-unsupported"
    });
    return 1;
  }

  const manifestResource = expectedProviderProofResource(validation.context.manifest, service, environment);
  if (resourceType !== manifestResource.resourceType || name !== manifestResource.name) {
    writeProviderProofReport(io, {
      service,
      environment,
      contract,
      providerExecution: "none",
      ledger: "invalid",
      localLink: "not-read",
      liveResource: "unsupported",
      identityProof: "unavailable",
      identityScope: "none",
      identityCandidates: "unavailable",
      identityEvaluator: "unavailable",
      liveCoherence: unavailableLiveCoherence,
      reason: "proof-unsupported"
    });
    return 1;
  }

  const expectedMatch = {
    provider: service,
    environment,
    resourceType,
    resourceName: name
  };

  const ledgerDecision = await enforceProviderLedgerResource(io.cwd, expectedMatch);
  if (!ledgerDecision.ok) {
    writeProviderProofReport(io, {
      service,
      environment,
      contract,
      providerExecution: "none",
      ledger: providerProofLedgerStatus(ledgerDecision),
      localLink: "not-read",
      liveResource: "not-read",
      identityProof: "unavailable",
      identityScope: "none",
      identityCandidates: "unavailable",
      identityEvaluator: "unavailable",
      liveCoherence: unavailableLiveCoherence,
      reason: ledgerDecision.reason === "missing" ? "ledger-missing" : "ledger-invalid"
    });
    return 1;
  }

  const ledgerRows = await readProviderLedgerRowsIfPresent(io.cwd);
  const localInventory = await createProviderInventory({
    cwd: io.cwd,
    manifest: validation.context.manifest,
    service,
    environment,
    ledgerRows
  });
  const localLink = localInventory.rows[0]?.localLink ?? "missing";
  const secretValues =
    service === "convex"
      ? collectSecretValues(validation.envValues, environment, "convex")
      : collectEnvironmentSecretValues(validation.envValues, environment);

  let inventory = localInventory;
  let liveReadFailed = false;
  let liveResults: ProviderExecutionResult[] = [];
  try {
    liveResults = await readLiveProviderInventory({
      service,
      environment,
      manifest: validation.context.manifest,
      executor: resolveProviderExecutor(io),
      cwd: io.cwd,
      secretValues,
      clerkExactProofContext:
        service === "clerk"
          ? {
              expectedResourceName: name,
              ledgerExternalIdOrUrl: ledgerDecision.row.externalIdOrUrl,
              ledgerOwnerAccountOrProject: ledgerDecision.row.ownerAccountOrProject
            }
          : undefined,
      vercelExactProofContext:
        service === "vercel"
          ? {
              expectedResourceName: name,
              ledgerExternalIdOrUrl: ledgerDecision.row.externalIdOrUrl,
              ledgerOwnerAccountOrProject: ledgerDecision.row.ownerAccountOrProject
            }
          : undefined,
      easExactProofContext:
        service === "eas"
          ? {
              expectedResourceName: name,
              ledgerExternalIdOrUrl: ledgerDecision.row.externalIdOrUrl,
              ledgerOwnerAccountOrProject: ledgerDecision.row.ownerAccountOrProject
            }
          : undefined
    });
    inventory = await createLiveProviderInventory({ localInventory, readResults: liveResults });
    liveReadFailed = (inventory.liveReadSummary?.failed ?? 0) > 0;
  } catch {
    liveReadFailed = true;
  }

  const row = inventory.rows[0];
  const driftProof = liveReadFailed ? undefined : evaluateProviderDriftProof(service, liveResults);
  const exactIdentityDecision = liveReadFailed
    ? evaluateProviderExactIdentityProof(service, [])
    : evaluateProviderExactIdentityProof(service, liveResults);
  const candidateIdentityDecision = liveReadFailed
    ? evaluateProviderIdentityCandidateProof(service, [])
    : evaluateProviderIdentityCandidateProof(service, liveResults);
  const exactIdentityReportFields = formatProviderExactIdentityReportFields(exactIdentityDecision);
  const candidateIdentityReportFields = formatProviderCandidateIdentityReportFields(candidateIdentityDecision);
  const liveCoherence = evaluateProviderLiveCoherenceProof(
    service,
    exactIdentityDecision,
    driftProof ?? { proof: "unavailable" }
  );
  writeProviderProofReport(io, {
    service,
    environment,
    contract,
    providerExecution: "read-only",
    ledger: providerProofAllowedLedgerStatus(ledgerDecision.row.status),
    localLink,
    liveResource: liveReadFailed ? "failed" : "read",
    identityProof: liveReadFailed
      ? "unavailable"
      : exactIdentityDecision?.proof === "exact"
        ? "exact"
        : "ambiguous",
    identityScope: liveReadFailed
      ? "none"
      : exactIdentityDecision.proof === "exact"
        ? "exact"
        : row?.identityScope === "partial"
          ? "partial"
          : "none",
    identityCandidates: exactIdentityReportFields.identityCandidates,
    identityEvaluator: exactIdentityReportFields.identityEvaluator,
    candidateIdentityEvidence: candidateIdentityReportFields.candidateIdentityEvidence,
    candidateIdentityEvaluator: candidateIdentityReportFields.candidateIdentityEvaluator,
    identityProofMissing: row?.missingProof,
    driftProof,
    liveCoherence,
    reason: liveReadFailed
      ? "live-read-failed"
      : exactIdentityDecision?.proof !== "exact"
        ? "identity-ambiguous"
        : "drift-unproven"
  });
  return 1;
}

async function liveValidationCommand(
  io: RunIo,
  validation: {
    context: Awaited<ReturnType<typeof loadProjectContext>>;
    envValues: EnvValueState;
  },
  environment: "preview" | "production"
): Promise<number> {
  io.write("Evidence: live-validation");
  io.write("Scope: bounded read-only provider inventory; no local-cloud writes; no provider mutations");
  io.write("Mutation: none");

  const services = getEnabledProviderAdapterDefinitions(validation.context.manifest).map(
    (definition) => definition.service
  );
  let ledgerRows: ReturnType<typeof parseProviderLedger> = [];
  try {
    ledgerRows = await readProviderLedgerRowsIfPresent(io.cwd);
  } catch (error) {
    io.write(
      providerInventoryLedgerDiagnostic({
        ok: false,
        reason: "invalid",
        path: providerLedgerPath,
        message: redactProviderText(error instanceof Error ? error.message : String(error))
      })
    );
    io.write("FAIL validate --live");
    io.write("Readiness: refused");
    io.write("Reason: live-read-failed");
    return 1;
  }

  let hasFailedLiveRead = false;
  const inventories: ProviderInventory[] = [];

  for (const service of services) {
    const secretValues =
      service === "convex"
        ? collectSecretValues(validation.envValues, environment, "convex")
        : collectEnvironmentSecretValues(validation.envValues, environment);
    let inventory = await createProviderInventory({
      cwd: io.cwd,
      manifest: validation.context.manifest,
      service,
      environment,
      ledgerRows
    });

    try {
      const liveResults = await readLiveProviderInventory({
        service,
        environment,
        manifest: validation.context.manifest,
        executor: resolveProviderExecutor(io),
        cwd: io.cwd,
        secretValues,
        clerkExactProofContext: buildLiveValidationClerkExactProofContext({
          service,
          environment,
          manifest: validation.context.manifest,
          ledgerRows
        }),
        vercelExactProofContext: buildLiveValidationVercelExactProofContext({
          service,
          environment,
          manifest: validation.context.manifest,
          ledgerRows
        }),
        easExactProofContext: buildLiveValidationEasExactProofContext({
          service,
          environment,
          manifest: validation.context.manifest,
          ledgerRows
        })
      });
      inventory = await createLiveProviderInventory({ localInventory: inventory, readResults: liveResults });
      writeLiveValidationProviderProofSummary(io, service, environment, liveResults);
    } catch (error) {
      io.write(
        formatDiagnostic({
          severity: "fail",
          code: "provider.live-validation.execution",
          path: `${service}.${environment}`,
          message: redactProviderText(error instanceof Error ? error.message : String(error), { secretValues }),
          fix: "Run agentstack validate --live --env preview.",
          blocks: ["validate --live"]
        })
      );
      hasFailedLiveRead = true;
    }

    inventories.push(inventory);
    if ((inventory.liveReadSummary?.failed ?? 0) > 0) {
      hasFailedLiveRead = true;
    }
    writeLiveValidationInventory(io, inventory);
  }

  io.write("FAIL validate --live");
  io.write("Readiness: refused");
  if (hasFailedLiveRead) {
    io.write("Reason: live-read-failed");
  } else {
    io.write("Reason: proof-incomplete");
  }
  io.write(
    "Provider proof readiness is refused because exact drift/live coherence is not proven for every enabled provider; partial or exact identity evidence is diagnostic only and does not authorize link, adopt, mutation, or production readiness."
  );
  writeLiveValidationIdentityProofRequirements(io, inventories);
  return 1;
}

function buildLiveValidationClerkExactProofContext(input: {
  service: ProviderControlPlaneService;
  environment: "preview" | "production";
  manifest: AgentstackManifest;
  ledgerRows: ReturnType<typeof parseProviderLedger>;
}): ClerkExactProofContext | undefined {
  if (input.service !== "clerk") {
    return undefined;
  }

  const manifestResource = expectedProviderProofResource(input.manifest, input.service, input.environment);
  const ledgerDecision = enforceProviderLedgerResource(input.ledgerRows, {
    provider: input.service,
    environment: input.environment,
    resourceType: manifestResource.resourceType,
    resourceName: manifestResource.name
  });

  if (!ledgerDecision.ok) {
    return undefined;
  }

  return {
    expectedResourceName: manifestResource.name,
    ledgerExternalIdOrUrl: ledgerDecision.row.externalIdOrUrl,
    ledgerOwnerAccountOrProject: ledgerDecision.row.ownerAccountOrProject
  };
}

function buildLiveValidationVercelExactProofContext(input: {
  service: ProviderControlPlaneService;
  environment: "preview" | "production";
  manifest: AgentstackManifest;
  ledgerRows: ReturnType<typeof parseProviderLedger>;
}): VercelExactProofContext | undefined {
  if (input.service !== "vercel") {
    return undefined;
  }

  const manifestResource = expectedProviderProofResource(input.manifest, input.service, input.environment);
  const ledgerDecision = enforceProviderLedgerResource(input.ledgerRows, {
    provider: input.service,
    environment: input.environment,
    resourceType: manifestResource.resourceType,
    resourceName: manifestResource.name
  });

  if (!ledgerDecision.ok) {
    return undefined;
  }

  return {
    expectedResourceName: manifestResource.name,
    ledgerExternalIdOrUrl: ledgerDecision.row.externalIdOrUrl,
    ledgerOwnerAccountOrProject: ledgerDecision.row.ownerAccountOrProject
  };
}

function buildLiveValidationEasExactProofContext(input: {
  service: ProviderControlPlaneService;
  environment: "preview" | "production";
  manifest: AgentstackManifest;
  ledgerRows: ReturnType<typeof parseProviderLedger>;
}): EasExactProofContext | undefined {
  if (input.service !== "eas") {
    return undefined;
  }

  const manifestResource = expectedProviderProofResource(input.manifest, input.service, input.environment);
  const ledgerDecision = enforceProviderLedgerResource(input.ledgerRows, {
    provider: input.service,
    environment: input.environment,
    resourceType: manifestResource.resourceType,
    resourceName: manifestResource.name
  });

  if (!ledgerDecision.ok) {
    return undefined;
  }

  return {
    expectedResourceName: manifestResource.name,
    ledgerExternalIdOrUrl: ledgerDecision.row.externalIdOrUrl,
    ledgerOwnerAccountOrProject: ledgerDecision.row.ownerAccountOrProject
  };
}

function buildProviderAdoptExactProofContext(input: {
  service: ProviderControlPlaneService;
  environment: "preview" | "production";
  manifest: AgentstackManifest;
  resourceType: string | undefined;
  name: string | undefined;
  externalIdOrUrl: string | undefined;
  ownerAccountOrProject: string | undefined;
}): {
  clerkExactProofContext?: ClerkExactProofContext;
  easExactProofContext?: EasExactProofContext;
  vercelExactProofContext?: VercelExactProofContext;
} {
  if (
    input.resourceType === undefined ||
    input.name === undefined ||
    input.externalIdOrUrl === undefined ||
    input.ownerAccountOrProject === undefined
  ) {
    return {};
  }

  const manifestResource = expectedProviderProofResource(input.manifest, input.service, input.environment);
  if (input.resourceType !== manifestResource.resourceType || input.name !== manifestResource.name) {
    return {};
  }

  if (input.service === "clerk" && input.resourceType === "application") {
    return {
      clerkExactProofContext: {
        expectedResourceName: input.name,
        ledgerExternalIdOrUrl: input.externalIdOrUrl,
        ledgerOwnerAccountOrProject: input.ownerAccountOrProject
      }
    };
  }

  if (input.service === "vercel" && input.resourceType === "project") {
    return {
      vercelExactProofContext: {
        expectedResourceName: input.name,
        ledgerExternalIdOrUrl: input.externalIdOrUrl,
        ledgerOwnerAccountOrProject: input.ownerAccountOrProject
      }
    };
  }

  if (input.service === "eas" && input.resourceType === "project") {
    return {
      easExactProofContext: {
        expectedResourceName: input.name,
        ledgerExternalIdOrUrl: input.externalIdOrUrl,
        ledgerOwnerAccountOrProject: input.ownerAccountOrProject
      }
    };
  }

  return {};
}

function writeLiveValidationProviderProofSummary(
  io: RunIo,
  service: ProviderControlPlaneService,
  environment: "preview" | "production",
  liveResults: ProviderExecutionResult[]
): void {
  const exactIdentityDecision = evaluateProviderExactIdentityProof(service, liveResults);
  const exactIdentityReportFields = formatProviderExactIdentityReportFields(exactIdentityDecision);
  const candidateIdentityDecision = evaluateProviderIdentityCandidateProof(service, liveResults);
  const candidateIdentityReportFields = formatProviderCandidateIdentityReportFields(candidateIdentityDecision);
  const driftProof = evaluateProviderDriftProof(service, liveResults);
  const liveCoherence = evaluateProviderLiveCoherenceProof(service, exactIdentityDecision, driftProof);

  io.write(`Provider proof: ${service} ${environment}`);
  io.write(`Identity proof: ${exactIdentityDecision.proof}`);
  io.write(`Exact identity evidence: ${exactIdentityReportFields.identityCandidates}`);
  io.write(`Exact identity evaluator: ${exactIdentityReportFields.identityEvaluator}`);
  if (exactIdentityDecision.proof !== "exact" && candidateIdentityDecision.labels.length > 0) {
    io.write(`Candidate identity evidence: ${candidateIdentityReportFields.candidateIdentityEvidence}`);
    io.write(`Candidate identity evaluator: ${candidateIdentityReportFields.candidateIdentityEvaluator}`);
    io.write(`Identity proof missing: ${normalizeProviderIdentityProofLabels(candidateIdentityDecision.missing).join(",")}`);
  }
  if (driftProof.proof === "partial") {
    io.write("Drift proof: partial");
    io.write(`Drift evaluator: ${driftProof.evaluator}`);
  } else {
    io.write("Drift proof: unproven");
  }
  writeProviderLiveCoherenceSummary(io, liveCoherence);
}

function writeLiveValidationInventory(io: RunIo, inventory: ProviderInventory): void {
  io.write(`Evidence: ${inventory.evidence}`);
  if (inventory.liveReadSummary) {
    io.write(`Commands: ${inventory.liveReadSummary.commands}`);
    io.write(`Results: ${inventory.liveReadSummary.results}`);
    io.write(`Succeeded: ${inventory.liveReadSummary.succeeded}`);
    io.write(`Failed: ${inventory.liveReadSummary.failed}`);
  }
  inventory.rows.forEach((row) => io.write(formatProviderInventoryRow(row)));
}

function writeLiveValidationIdentityProofRequirements(io: RunIo, inventories: ProviderInventory[]): void {
  const labels = normalizeProviderIdentityProofLabels(
    inventories.flatMap((inventory) => inventory.rows.flatMap((row) => row.missingProof ?? []))
  );
  if (labels.length > 0) {
    io.write(`Identity proof requirements: ${labels.join(",")}`);
  }
}

async function providerLinkCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix =
    "Run agentstack provider link --service convex --env preview --resource-type deployment --name acme-crm-preview.";
  const service = readProviderControlPlaneServiceOption(options.service, fix);
  const environment = readProviderRuntimeEnvironmentOption(options.env, fix);
  const source = readProviderSourceOption(options.source, options.live, fix, "provider.link");
  const resourceType = readRequiredStringOption(options["resource-type"], "resource-type", fix);
  const name = readRequiredStringOption(options.name, "name", fix);

  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  let ledgerRows: ReturnType<typeof parseProviderLedger> = [];
  try {
    ledgerRows = await readProviderLedgerRowsIfPresent(io.cwd);
  } catch (error) {
    io.write(
      providerLinkLedgerDiagnostic({
        ok: false,
        reason: "invalid",
        path: providerLedgerPath,
        message: redactProviderText(error instanceof Error ? error.message : String(error))
      })
    );
    return 1;
  }

  if (source === "live") {
    const decision = enforceProviderLedgerResource(ledgerRows, {
      provider: service,
      environment,
      resourceType,
      resourceName: name
    });
    if (!decision.ok) {
      io.write(providerLinkLedgerDiagnostic(decision));
      return 1;
    }

    const confirmationRead = await readLiveInventoryForConfirmation({
      io,
      validation,
      ledgerRows,
      service,
      environment,
      failureCode: "provider.link.live-read",
      fix,
      blocks: ["provider link"]
    });
    if (confirmationRead === undefined) {
      return 1;
    }

    const { inventory, liveResults } = confirmationRead;
    const confirmation = confirmLiveProviderInventoryIdentity(inventory);
    if (!confirmation.ok) {
      io.write(`FAIL provider.link.${confirmation.reason}`);
      writeProviderConfirmationInventory(io, inventory);
      writeProviderIdentityProofRequirements(io, inventory);
      return 1;
    }

    const exactIdentityDecision = evaluateProviderExactIdentityProof(service, liveResults);
    const driftProof = evaluateProviderDriftProof(service, liveResults);
    const liveCoherence = evaluateProviderLiveCoherenceProof(service, exactIdentityDecision, driftProof);
    io.write(`FAIL provider.link.live-coherence-${liveCoherence.proof}`);
    writeProviderConfirmationInventory(io, inventory);
    writeProviderLiveCoherenceSummary(io, liveCoherence);
    return 1;
  }

  const result = await linkLedgerBackedProviderResource({
    cwd: io.cwd,
    service,
    environment,
    resourceType,
    name,
    ledgerRows
  });

  if (!result.ok) {
    io.write(providerLinkLedgerDiagnostic(result.decision));
    return 1;
  }

  io.write(`LINKED provider ${service} ${environment}`);
  io.write("Evidence: ledger-local-inventory");
  io.write("Local mutation: .agentstack/provider-links.json");
  io.write("Provider mutation: none");
  io.write("Ledger mutation: none");
  return 0;
}

async function providerAdoptCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix =
    "Run agentstack provider adopt --service clerk --env production --resource-type application --name acme-crm --external-id <id> --owner <owner> --purpose <purpose> --created-by <name> --created-at <date> --cleanup <procedure> --cleanup-trigger <trigger> --evidence <path>.";
  const service = readProviderControlPlaneServiceOption(options.service, fix);
  const environment = readProviderRuntimeEnvironmentOption(options.env, fix);
  const source = readProviderSourceOption(options.source, options.live, fix, "provider.adopt");
  const adoptResourceType = readOptionalStringOption(options["resource-type"]);
  const adoptName = readOptionalStringOption(options.name);
  const adoptExternalIdOrUrl = readOptionalStringOption(options["external-id"]);
  const adoptOwnerAccountOrProject = readOptionalStringOption(options.owner);

  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  if (source === "live") {
    const adoptExactProofContext = buildProviderAdoptExactProofContext({
      service,
      environment,
      manifest: validation.context.manifest,
      resourceType: adoptResourceType,
      name: adoptName,
      externalIdOrUrl: adoptExternalIdOrUrl,
      ownerAccountOrProject: adoptOwnerAccountOrProject
    });
    const confirmationRead = await readLiveInventoryForConfirmation({
      io,
      validation,
      ledgerRows: [],
      service,
      environment,
      failureCode: "provider.adopt.live-read",
      fix,
      blocks: ["provider adopt"],
      ...adoptExactProofContext
    });
    if (confirmationRead === undefined) {
      return 1;
    }

    const { inventory, liveResults } = confirmationRead;
    const confirmation = confirmLiveProviderInventoryIdentity(inventory);
    if (!confirmation.ok) {
      io.write(`FAIL provider.adopt.${confirmation.reason}`);
      writeProviderConfirmationInventory(io, inventory);
      writeProviderIdentityProofRequirements(io, inventory);
      return 1;
    }

    const exactIdentityDecision = evaluateProviderExactIdentityProof(service, liveResults);
    const driftProof = evaluateProviderDriftProof(service, liveResults);
    const liveCoherence = evaluateProviderLiveCoherenceProof(service, exactIdentityDecision, driftProof);
    io.write(`FAIL provider.adopt.live-coherence-${liveCoherence.proof}`);
    writeProviderConfirmationInventory(io, inventory);
    writeProviderLiveCoherenceSummary(io, liveCoherence);
    return 1;
  }

  const resourceType = readRequiredStringOption(options["resource-type"], "resource-type", fix);
  const name = readRequiredStringOption(options.name, "name", fix);
  const externalIdOrUrl = readRequiredStringOption(options["external-id"], "external-id", fix);
  const ownerAccountOrProject = readRequiredStringOption(options.owner, "owner", fix);
  const purpose = readRequiredStringOption(options.purpose, "purpose", fix);
  const createdBy = readRequiredStringOption(options["created-by"], "created-by", fix);
  const createdAt = readRequiredStringOption(options["created-at"], "created-at", fix);
  const cleanupCommandOrProcedure = readRequiredStringOption(options.cleanup, "cleanup", fix);
  const expectedCleanupTriggerOrDate = readRequiredStringOption(options["cleanup-trigger"], "cleanup-trigger", fix);
  const evidenceLinkOrPath = readRequiredStringOption(options.evidence, "evidence", fix);
  const notes = typeof options.notes === "string" ? options.notes : "";

  const proposal = buildProviderAdoptProposal({
    service,
    environment,
    resourceType,
    name,
    externalIdOrUrl,
    ownerAccountOrProject,
    purpose,
    createdBy,
    createdAt,
    expectedCleanupTriggerOrDate,
    cleanupCommandOrProcedure,
    evidenceLinkOrPath,
    notes
  });

  io.write(`PROPOSED provider adopt ${service} ${environment}`);
  io.write("Evidence: local-inventory");
  io.write("Local mutation: none");
  io.write("Provider mutation: none");
  io.write("Ledger mutation: none");
  proposal.lines.forEach((line) => io.write(line));
  return 0;
}

async function readLiveInventoryForConfirmation(input: {
  io: RunIo;
  validation: Awaited<ReturnType<typeof runLocalValidationGate>>;
  ledgerRows: ReturnType<typeof parseProviderLedger>;
  service: ProviderControlPlaneService;
  environment: "preview" | "production";
  failureCode: "provider.link.live-read" | "provider.adopt.live-read";
  fix: string;
  blocks: string[];
  clerkExactProofContext?: ClerkExactProofContext;
  easExactProofContext?: EasExactProofContext;
  vercelExactProofContext?: VercelExactProofContext;
}): Promise<{ inventory: ProviderInventory; liveResults: ProviderExecutionResult[] } | undefined> {
  let inventory = await createProviderInventory({
    cwd: input.io.cwd,
    manifest: input.validation.context.manifest,
    service: input.service,
    environment: input.environment,
    ledgerRows: input.ledgerRows
  });
  const secretValues =
    input.service === "convex"
      ? collectSecretValues(input.validation.envValues, input.environment, "convex")
      : collectEnvironmentSecretValues(input.validation.envValues, input.environment);

  let liveResults: ProviderExecutionResult[];
  try {
    liveResults = await readLiveProviderInventory({
      service: input.service,
      environment: input.environment,
      manifest: input.validation.context.manifest,
      executor: resolveProviderExecutor(input.io),
      cwd: input.io.cwd,
      secretValues,
      clerkExactProofContext:
        input.clerkExactProofContext ??
        buildLiveValidationClerkExactProofContext({
          service: input.service,
          environment: input.environment,
          manifest: input.validation.context.manifest,
          ledgerRows: input.ledgerRows
        }),
      vercelExactProofContext:
        input.vercelExactProofContext ??
        buildLiveValidationVercelExactProofContext({
          service: input.service,
          environment: input.environment,
          manifest: input.validation.context.manifest,
          ledgerRows: input.ledgerRows
        }),
      easExactProofContext:
        input.easExactProofContext ??
        buildLiveValidationEasExactProofContext({
          service: input.service,
          environment: input.environment,
          manifest: input.validation.context.manifest,
          ledgerRows: input.ledgerRows
        })
    });
  } catch (error) {
    input.io.write(
      formatDiagnostic({
        severity: "fail",
        code: input.failureCode,
        path: `${input.service}.${input.environment}`,
        message: redactProviderText(error instanceof Error ? error.message : String(error), { secretValues }),
        fix: input.fix,
        blocks: input.blocks
      })
    );
    return undefined;
  }

  inventory = await createLiveProviderInventory({ localInventory: inventory, readResults: liveResults });
  return { inventory, liveResults };
}

function writeProviderConfirmationInventory(io: RunIo, inventory: ProviderInventory): void {
  io.write(`Evidence: ${inventory.evidence}`);
  io.write("Local mutation: none");
  io.write("Provider mutation: none");
  io.write("Ledger mutation: none");
  if (inventory.liveReadSummary) {
    io.write(`Commands: ${inventory.liveReadSummary.commands}`);
    io.write(`Results: ${inventory.liveReadSummary.results}`);
    io.write(`Succeeded: ${inventory.liveReadSummary.succeeded}`);
    io.write(`Failed: ${inventory.liveReadSummary.failed}`);
  }
  inventory.rows.forEach((row) => io.write(formatProviderInventoryRow(row)));
}

function writeProviderIdentityProofRequirements(io: RunIo, inventory: ProviderInventory): void {
  const labels = [
    ...new Set(inventory.rows.flatMap((row) => row.missingProof ?? []))
  ].sort();
  if (labels.length > 0) {
    io.write(`Identity proof requirements: ${labels.join(",")}`);
  }
}

type ProviderLedgerDiagnosticCommand = "provider apply" | "provider inventory" | "provider link";

type ProviderProofReport = {
  service: ProviderControlPlaneService;
  environment: "preview" | "production";
  contract: ProviderProofContract;
  providerExecution: "none" | "read-only";
  ledger: "planned" | "active" | "missing" | "invalid" | `blocked ${string}`;
  localLink: "linked" | "missing" | "not-read";
  liveResource: "read" | "not-read" | "failed" | "unsupported";
  identityProof: ProviderExactIdentityDecision["proof"];
  identityScope: "exact" | "partial" | "none";
  identityCandidates?: "available" | "unavailable";
  identityEvaluator?: ProviderExactIdentityDecision["evaluator"];
  candidateIdentityEvidence?: "available" | "unavailable";
  candidateIdentityEvaluator?: ProviderIdentityCandidateProofResult["evaluator"];
  identityProofMissing?: ProviderIdentityProofMissingLabel[];
  driftProof?: ProviderDriftProofResult;
  liveCoherence?: ProviderLiveCoherenceProofResult;
  reason:
    | "identity-ambiguous"
    | "identity-proof-unavailable"
    | "drift-unproven"
    | "live-read-failed"
    | "proof-unsupported"
    | "ledger-missing"
    | "ledger-invalid"
    | "local-validation-failed";
};

export function formatProviderExactIdentityReportFields(decision: ProviderExactIdentityDecision): {
  identityCandidates: "available" | "unavailable";
  identityEvaluator: ProviderExactIdentityDecision["evaluator"];
} {
  return {
    identityCandidates: decision.labels.length > 0 ? "available" : "unavailable",
    identityEvaluator: decision.labels.length > 0 ? decision.evaluator : "unavailable"
  };
}

function formatProviderCandidateIdentityReportFields(decision: ProviderIdentityCandidateProofResult): {
  candidateIdentityEvidence: "available" | "unavailable";
  candidateIdentityEvaluator: ProviderIdentityCandidateProofResult["evaluator"];
} {
  return {
    candidateIdentityEvidence: decision.labels.length > 0 ? "available" : "unavailable",
    candidateIdentityEvaluator: decision.labels.length > 0 ? decision.evaluator : "unavailable"
  };
}

function writeProviderProofReport(io: RunIo, report: ProviderProofReport): void {
  io.write(`FAIL provider proof ${report.service} ${report.environment}`);
  io.write("Evidence: live-proof-check");
  io.write("Scope: bounded read-only provider proof check; no provider mutations; no local-cloud reads");
  io.write(`Provider execution: ${report.providerExecution}`);
  io.write("Mutation: none");
  io.write("Local mutation: none");
  io.write("Provider mutation: none");
  io.write("Ledger mutation: none");
  io.write("Local-cloud state: not-read");
  io.write(`Ledger: ${report.ledger}`);
  io.write(`Local link: ${report.localLink}`);
  io.write(`Live resource: ${report.liveResource}`);
  io.write(`Identity proof: ${report.identityProof}`);
  io.write(`Identity scope: ${report.identityScope}`);
  if (report.identityCandidates) {
    io.write(`Exact identity evidence: ${report.identityCandidates}`);
  }
  if (report.identityEvaluator) {
    io.write(`Exact identity evaluator: ${report.identityEvaluator}`);
  }
  if (report.candidateIdentityEvidence) {
    io.write(`Candidate identity evidence: ${report.candidateIdentityEvidence}`);
  }
  if (report.candidateIdentityEvaluator) {
    io.write(`Candidate identity evaluator: ${report.candidateIdentityEvaluator}`);
  }
  if (report.identityProofMissing && report.identityProofMissing.length > 0) {
    io.write(`Identity proof missing: ${normalizeProviderIdentityProofLabels(report.identityProofMissing).join(",")}`);
  }
  if (report.driftProof?.proof === "partial") {
    io.write("Drift proof: partial");
    io.write(`Drift evaluator: ${report.driftProof.evaluator}`);
  } else {
    io.write("Drift proof: unproven");
  }
  if (report.liveCoherence) {
    writeProviderLiveCoherenceSummary(io, report.liveCoherence);
  }
  io.write("Readiness: refused");
  io.write(`Reason: ${report.reason}`);
  io.write(`Identity proof requirements: ${report.contract.identityProofRequirements.join(",")}`);
  io.write(`Drift proof requirements: ${report.contract.driftProofRequirements.join(",")}`);
}

function writeProviderInventoryIdentitySummary(
  io: RunIo,
  service: ProviderControlPlaneService,
  liveResults: ProviderExecutionResult[]
): void {
  const exactDecision = evaluateProviderExactIdentityProof(service, liveResults);
  if (exactDecision.proof === "exact") {
    const fields = formatProviderExactIdentityReportFields(exactDecision);
    io.write(`Exact identity evidence: ${fields.identityCandidates}`);
    io.write(`Exact identity evaluator: ${fields.identityEvaluator}`);
    return;
  }

  const decision = evaluateProviderIdentityCandidateProof(service, liveResults);
  if (decision.labels.length === 0) {
    return;
  }

  const fields = formatProviderCandidateIdentityReportFields(decision);
  io.write(`Candidate identity evidence: ${fields.candidateIdentityEvidence}`);
  io.write(`Candidate identity evaluator: ${fields.candidateIdentityEvaluator}`);
  const missing = normalizeProviderIdentityProofLabels(decision.missing);
  if (missing.length > 0) {
    io.write(`Identity proof missing: ${missing.join(",")}`);
  }
}

function writeProviderLiveCoherenceSummary(io: RunIo, liveCoherence: ProviderLiveCoherenceProofResult): void {
  io.write(`Live coherence: ${liveCoherence.proof}`);
  io.write(`Live coherence evaluator: ${liveCoherence.evaluator}`);
  if (liveCoherence.blockers.length > 0) {
    io.write(`Live coherence blockers: ${liveCoherence.blockers.join(",")}`);
  }
}

function providerProofLedgerStatus(
  decision: Exclude<ProviderLedgerDecision, { ok: true }>
): ProviderProofReport["ledger"] {
  if (decision.reason === "missing") {
    return "missing";
  }
  if (decision.reason === "status-blocked") {
    return `blocked ${decision.row.status}`;
  }
  return "invalid";
}

function providerProofAllowedLedgerStatus(status: string): Extract<ProviderProofReport["ledger"], "planned" | "active"> {
  return status === "active" ? "active" : "planned";
}

function expectedProviderProofResource(
  manifest: AgentstackManifest,
  service: ProviderControlPlaneService,
  environment: "preview" | "production"
): { resourceType: string; name: string } {
  if (service === "clerk") {
    return { resourceType: "application", name: `${manifest.app.slug}-${environment}` };
  }

  if (service === "convex") {
    return { resourceType: "deployment", name: environment === "production" ? "prod" : `${manifest.app.slug}-preview` };
  }

  return { resourceType: "project", name: manifest.app.slug };
}

function providerProofResourceShapeSupported(
  service: ProviderControlPlaneService,
  resourceType: string
): boolean {
  if (service === "clerk") {
    return resourceType === "application";
  }
  if (service === "convex") {
    return resourceType === "deployment";
  }
  return resourceType === "project";
}

export function providerLedgerDiagnostic(
  decision: Exclude<ProviderLedgerDecision, { ok: true }>,
  command: ProviderLedgerDiagnosticCommand = "provider apply"
): string {
  if (decision.reason === "missing") {
    return formatDiagnostic({
      severity: "fail",
      code: "provider.ledger.missing",
      path: decision.path,
      message: `No provider ledger row matches ${formatExpectedLedgerMatch(decision.expected)}.`,
      fix: `Add a planned or active row to docs/provider-resource-ledger.md before running ${command}.`,
      blocks: [command]
    });
  }

  if (decision.reason === "invalid") {
    return formatDiagnostic({
      severity: "fail",
      code: "provider.ledger.invalid",
      path: decision.path,
      message: decision.message,
      fix: "Fix the Ledger section table shape and statuses in docs/provider-resource-ledger.md.",
      blocks: [command]
    });
  }

  if (decision.reason === "incomplete") {
    return formatDiagnostic({
      severity: "fail",
      code: "provider.ledger.incomplete",
      path: decision.path,
      message: `Provider ledger row for ${formatExpectedLedgerMatch(decision.row)} is missing required fields: ${decision.missingFields.join(", ")}.`,
      fix: `Complete the planned or active ledger row before running ${command}.`,
      blocks: [command]
    });
  }

  return formatDiagnostic({
    severity: "fail",
    code: "provider.ledger.status-blocked",
    path: decision.path,
    message: `Provider ledger row for ${formatExpectedLedgerMatch(decision.row)} has blocked status. Status: ${decision.row.status}.`,
    fix: "Move the ledger row to planned or active only when the resource is approved for mutation.",
    blocks: [command]
  });
}

export function providerLinkLedgerDiagnostic(decision: Exclude<ProviderLedgerDecision, { ok: true }>): string {
  return providerLedgerDiagnostic(decision, "provider link");
}

export function providerInventoryLedgerDiagnostic(decision: Exclude<ProviderLedgerDecision, { ok: true }>): string {
  return providerLedgerDiagnostic(decision, "provider inventory");
}

function formatExpectedLedgerMatch(expected: ProviderLedgerExpectedMatch): string {
  return `${expected.provider} ${expected.environment} ${expected.resourceType} ${expected.resourceName}`;
}

export function formatProviderInventoryRow(row: ProviderInventoryRow): string {
  const fields = [
    "Resource:",
    row.service,
    row.environment,
    row.resourceType,
    row.name,
    `ledger=${row.ledgerStatus}`,
    `local-link=${row.localLink}`,
    `external-id=${row.externalIdSummary}`,
    `evidence=${row.evidence}`
  ];
  if (row.liveStatus || row.identityMatch || row.permissionSummary || row.driftSummary) {
    fields.push(
      `live=${row.liveStatus ?? "not-checked"}`,
      `identity=${row.identityMatch ?? "not-checked"}`,
      `identity-scope=${row.identityScope ?? "not-checked"}`,
      `permission=${row.permissionSummary ?? "not-checked"}`,
      `drift=${row.driftSummary ?? "not-checked"}`
    );
    if (row.facts && row.facts.length > 0) {
      fields.push(`facts=${row.facts.join(",")}`);
    }
    if (row.missingProof && row.missingProof.length > 0) {
      fields.push(`missing=${normalizeProviderIdentityProofLabels(row.missingProof).join(",")}`);
    }
  }
  return fields.join(" ");
}

function normalizeProviderIdentityProofLabels(labels: string[]): string[] {
  return [...new Set(labels)].sort();
}

async function readProviderLedgerRowsIfPresent(cwd: string): Promise<ReturnType<typeof parseProviderLedger>> {
  let text: string;
  try {
    text = await readFile(join(cwd, providerLedgerPath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return parseProviderLedger(text);
}

function readProviderRuntimeEnvironmentOption(
  value: string | boolean | undefined,
  fix: string
): "preview" | "production" {
  const environment = readEnvironmentOption(value, { flag: "env", fix });
  if (environment === "preview" || environment === "production") {
    return environment;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      "Invalid --env value: development. Expected one of: preview, production.",
      `Fix: ${fix}`
    ].join("\n")
  );
}

function readValidateLiveOptions(
  live: string | boolean,
  environment: string | boolean | undefined,
  fix: string
): "preview" | "production" {
  if (live !== true) {
    throw new Error(
      [
        "FAIL validate.live.validation",
        "Invalid --live value. Use --live without a value.",
        `Fix: ${fix}`
      ].join("\n")
    );
  }

  return readProviderRuntimeEnvironmentOption(environment, fix);
}

function readProviderControlPlaneServiceOption(
  value: string | boolean | undefined,
  fix: string
): ProviderControlPlaneService {
  const service = readRequiredStringOption(value, "service", fix);
  if (service === "clerk" || service === "convex" || service === "vercel" || service === "eas") {
    return service;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --service value: ${service}. Expected one of: clerk, convex, vercel, eas.`,
      `Fix: ${fix}`
    ].join("\n")
  );
}

function readProviderInventorySourceOption(
  value: string | boolean | undefined,
  live: string | boolean | undefined,
  fix: string
): ProviderInventorySource {
  if (live === true) {
    return "live";
  }
  if (live !== undefined && live !== false) {
    throw new Error(
      [
        "FAIL provider.inventory.validation",
        "Invalid --live value. Use --live without a value.",
        `Fix: ${fix}`
      ].join("\n")
    );
  }
  if (value === undefined || value === false) {
    return "local";
  }
  const source = readRequiredStringOption(value, "source", fix);
  if (source === "local" || source === "live") {
    return source;
  }
  throw new Error(
    [
      "FAIL provider.inventory.validation",
      `Unsupported provider inventory source: ${source}. Expected one of: local, live.`,
      `Fix: ${fix}`
    ].join("\n")
  );
}

function readProviderSourceOption(
  value: string | boolean | undefined,
  live: string | boolean | undefined,
  fix: string,
  codePrefix: "provider.link" | "provider.adopt"
): ProviderInventorySource {
  if (live !== undefined) {
    throw new Error(
      [
        `FAIL ${codePrefix}.validation`,
        "Unsupported --live option. Use --source live for this command.",
        `Fix: ${fix}`
      ].join("\n")
    );
  }
  if (value === undefined || value === false) {
    return "local";
  }
  const source = readRequiredStringOption(value, "source", fix);
  if (source === "local" || source === "live") {
    return source;
  }
  throw new Error(
    [
      `FAIL ${codePrefix}.validation`,
      `Unsupported provider source: ${source}. Expected one of: local, live.`,
      `Fix: ${fix}`
    ].join("\n")
  );
}

async function readLiveProviderInventory(input: {
  service: ProviderControlPlaneService;
  environment: "preview" | "production";
  manifest: AgentstackManifest;
  executor: ProviderCommandExecutor;
  cwd: string;
  secretValues: string[];
  clerkExactProofContext?: ClerkExactProofContext;
  easExactProofContext?: EasExactProofContext;
  vercelExactProofContext?: VercelExactProofContext;
}): Promise<ProviderExecutionResult[]> {
  if (input.service === "clerk") {
    return inspectClerkReadOnly({
      environment: input.environment,
      executor: input.executor,
      cwd: input.cwd,
      secretValues: input.secretValues,
      exactProofContext: input.clerkExactProofContext
    });
  }

  if (input.service === "convex") {
    return inspectConvexReadOnly({
      manifest: input.manifest,
      environment: input.environment,
      executor: input.executor,
      cwd: input.cwd,
      secretValues: input.secretValues
    });
  }

  if (input.service === "vercel") {
    return inspectVercelReadOnly({
      environment: input.environment,
      executor: input.executor,
      cwd: input.cwd,
      secretValues: input.secretValues,
      exactProofContext: input.vercelExactProofContext
    });
  }

  return inspectEasReadOnly({
    environment: input.environment,
    executor: input.executor,
    cwd: input.cwd,
    secretValues: input.secretValues,
    exactProofContext: input.easExactProofContext
  });
}

function writeProviderExecutionDiagnostics(io: RunIo, results: ProviderExecutionResult[]): void {
  if (results.length === 0) {
    io.write("Diagnostics: none");
    return;
  }

  io.write("Diagnostics:");
  for (const result of results) {
    const stdout = result.stdoutSummary ? ` stdout=${result.stdoutSummary}` : "";
    const stderr = result.stderrSummary ? ` stderr=${result.stderrSummary}` : "";
    const failure = result.failureClass ? ` failure=${result.failureClass}` : "";
    io.write(`- ${result.commandKind} ${result.status} exit=${result.exitCode}${failure}${stdout}${stderr}`);
  }
}

function collectSecretValues(
  envValues: EnvValueState,
  environment: EnvironmentName,
  service: SurfaceName
): string[] {
  return Object.values(envValues[environment]?.[service] ?? {}).filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
}

function collectEnvironmentSecretValues(
  envValues: EnvValueState,
  environment: EnvironmentName
): string[] {
  return surfaceValues.flatMap((surface) => collectSecretValues(envValues, environment, surface));
}

function buildConvexStdinByCommandId(
  operations: ProviderOperation[],
  envValues: EnvValueState,
  environment: EnvironmentName
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const operation of operations) {
    if (operation.kind !== "env.set" || operation.service !== "convex") {
      continue;
    }
    const name = operation.target.startsWith("env:") ? operation.target.slice("env:".length) : undefined;
    const value =
      name && isSurface(operation.scope) ? envValues[environment]?.[operation.scope]?.[name] : undefined;
    if (typeof value === "string") {
      values[operation.id] = value;
    }
  }
  return values;
}

function resolveProviderExecutor(io: RunIo): ProviderCommandExecutor {
  return io.providerExecutor ?? createChildProcessProviderExecutor();
}

function createChildProcessProviderExecutor(): ProviderCommandExecutor {
  return {
    execute(command, args, options) {
      return new Promise((resolve) => {
        const startedAt = Date.now();
        const child = spawn(command, args, {
          cwd: options.cwd,
          env: { ...process.env, ...options.env },
          stdio: ["pipe", "pipe", "pipe"]
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        const timeout =
          options.timeoutMs === undefined
            ? undefined
            : setTimeout(() => {
                if (!settled) {
                  child.kill("SIGTERM");
                  settled = true;
                  resolve({
                    exitCode: 124,
                    stdout,
                    stderr: `${stderr}\nProvider command timed out.`.trim(),
                    durationMs: Date.now() - startedAt
                  });
                }
              }, options.timeoutMs);

        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
          stdout += redactProviderText(String(chunk));
        });
        child.stderr.on("data", (chunk) => {
          stderr += redactProviderText(String(chunk));
        });
        child.on("error", (error) => {
          if (settled) {
            return;
          }
          settled = true;
          if (timeout) {
            clearTimeout(timeout);
          }
          resolve({
            exitCode: 1,
            stdout,
            stderr: error.message,
            durationMs: Date.now() - startedAt
          });
        });
        child.on("close", (exitCode) => {
          if (settled) {
            return;
          }
          settled = true;
          if (timeout) {
            clearTimeout(timeout);
          }
          resolve({
            exitCode: exitCode ?? 1,
            stdout,
            stderr,
            durationMs: Date.now() - startedAt
          });
        });
        if (options.stdin !== undefined) {
          child.stdin.end(options.stdin);
        } else {
          child.stdin.end();
        }
      });
    }
  };
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
    "agentstack validate --release production",
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
  io.write("Evidence: local-rehearsal");
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
      diagnostic.path?.startsWith(`${environment}.eas.`)
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
  io.write("Evidence: local-rehearsal");
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

type QualityValidationResult =
  | { ok: true }
  | {
      ok: false;
      failure: {
        spec: LocalCommandSpec;
        result: LocalCommandResult;
      };
    };

async function runQualityValidation(io: RunIo): Promise<QualityValidationResult> {
  const runner = io.commandRunner ?? createChildProcessCommandRunner(io.cwd);
  for (const spec of localQualityCommands) {
    const result = await runner(spec);
    if (result.exitCode !== 0) {
      return { ok: false, failure: { spec, result } };
    }
  }
  return { ok: true };
}

function writeFailedQualityCommand(
  io: RunIo,
  failure: Extract<QualityValidationResult, { ok: false }>["failure"]
): void {
  io.write(`Command: ${failure.spec.id}`);
  io.write(`Executable: ${[failure.spec.command, ...failure.spec.args].join(" ")}`);
  io.write(`Exit code: ${failure.result.exitCode}`);
  const stdout = redactAndTrimCommandOutput(failure.result.stdout);
  const stderr = redactAndTrimCommandOutput(failure.result.stderr);
  if (stdout.length > 0) {
    io.write(`Stdout tail: ${stdout}`);
  }
  if (stderr.length > 0) {
    io.write(`Stderr tail: ${stderr}`);
  }
}

function createChildProcessCommandRunner(cwd: string): LocalCommandRunner {
  return async (spec) =>
    await new Promise((resolve) => {
      const child = spawn(spec.command, spec.args, {
        cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        resolve({ exitCode: 127, stdout, stderr: `${stderr}\n${error.message}` });
      });
      child.on("close", (code) => {
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });
    });
}

function redactAndTrimCommandOutput(value: string): string {
  const redacted = redactProviderText(value)
    .replace(/\b(?:sk|pk|rk|tok)_(?:(?:live|test|proj|local)_?)?[A-Za-z0-9_-]{6,}\b/g, "[REDACTED]")
    .replace(/\b[A-Z0-9_]*(?:TOKEN|SECRET|KEY)[A-Z0-9_]*=[^\s]+/gi, "[REDACTED]");
  const tail = redacted.length > 480 ? redacted.slice(-480) : redacted;
  return tail.trim();
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
  const providerOperationPlan = createProviderOperationPlan(cloudReport);
  const localDiagnostics = validation.diagnostics;
  const diagnostics = [...localDiagnostics, ...cloudDiagnostics];
  const requiredAnchors = getRequiredGeneratedAnchors(validation.context.manifest);
  const cloud: LifecycleCloudSummary = {
    environment,
    providerAdapters: getEnabledProviderAdapterDefinitions(validation.context.manifest).map(
      toLifecycleProviderAdapterSummary
    ),
    providerOperations: providerOperationPlan.operations.map(toLifecycleProviderOperationSummary),
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
    io.write(`Provider adapters: ${formatList(formatProviderAdapters(summary.cloud.providerAdapters))}`);
    io.write(`Provider operations: ${formatList(formatProviderOperations(summary.cloud.providerOperations))}`);
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
      ? "pnpm run preview:apply"
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
  return `${resource.environment}.${resource.service}.${resource.surface}.${resource.name}`;
}

function toLifecycleProviderAdapterSummary(
  definition: ProviderAdapterDefinition
): LifecycleProviderAdapterSummary {
  return {
    service: definition.service,
    displayName: definition.displayName,
    capabilities: [...definition.capabilities],
    realAdapterStatus: definition.realAdapterStatus
  };
}

function toLifecycleProviderOperationSummary(
  operation: ProviderOperation
): LifecycleProviderOperationSummary {
  return {
    id: operation.id,
    environment: operation.environment,
    service: operation.service,
    kind: operation.kind,
    scope: operation.scope,
    target: operation.target,
    source: operation.source,
    summary: operation.summary,
    secret: operation.secret,
    requiresConfirmation: operation.requiresConfirmation
  };
}

function formatProviderAdapters(adapters: LifecycleProviderAdapterSummary[]): string[] {
  return adapters.map((adapter) => `${adapter.service}:${adapter.realAdapterStatus}`);
}

function formatProviderOperations(operations: LifecycleProviderOperationSummary[]): string[] {
  return operations.map((operation) => operation.id);
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

async function generatedValidateCommand(io: RunIo): Promise<number> {
  const context = await loadProjectContext(io.cwd);
  const missingAnchors = await findMissingGeneratedAnchors(context.cwd, context.manifest);
  const anchorResult = validateGeneratedAnchors({
    manifest: context.manifest,
    missingPaths: missingAnchors
  });
  const guidanceDiagnostics = validateGuidancePolicy(context.manifest);
  const diagnostics = [...anchorResult.diagnostics, ...guidanceDiagnostics];
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  io.write("Evidence: generated-boundary");
  io.write(
    "Scope: generated anchors and guidance only; no local-cloud writes; no provider executor; no live provider reads"
  );
  io.write(`Required generated anchors: ${getRequiredGeneratedAnchors(context.manifest).length}`);
  io.write(`Missing generated anchors: ${missingAnchors.length}`);
  io.write(`Guidance anchors: ${getGuidanceGeneratedAnchors(context.manifest).length}`);
  io.write(`Expected guidance version: ${expectedAgentstackGuidanceVersion}`);

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    io.write("FAIL generated validate");
    return 1;
  }

  io.write("PASS generated validate");
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

const formatCheckedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);

async function findFormatDiagnostics(cwd: string): Promise<Diagnostic[]> {
  const files = (await listProjectFiles(cwd)).filter(isFormatCheckedFile);
  const diagnostics: Diagnostic[] = [];

  for (const file of files) {
    const content = await readFile(join(cwd, file), "utf8");
    const trailingWhitespaceLine = firstTrailingWhitespaceLine(content);
    if (trailingWhitespaceLine !== undefined) {
      diagnostics.push({
        severity: "fail",
        code: "format.trailing-whitespace",
        path: `${file}:${trailingWhitespaceLine}`,
        message: `Trailing whitespace found in ${file}.`,
        fix: "Remove trailing spaces or tabs.",
        blocks: ["format", "validate --quality"]
      });
      continue;
    }

    if (content.length > 0 && !content.endsWith("\n")) {
      diagnostics.push({
        severity: "fail",
        code: "format.final-newline.missing",
        path: file,
        message: `Missing final newline in ${file}.`,
        fix: "End the file with a newline.",
        blocks: ["format", "validate --quality"]
      });
    }
  }

  return diagnostics;
}

function isFormatCheckedFile(file: string): boolean {
  return formatCheckedExtensions.has(extname(file));
}

function firstTrailingWhitespaceLine(content: string): number | undefined {
  const lines = content.split(/\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.replace(/\r$/, "") ?? "";
    if (/[ \t]+$/.test(line)) {
      return index + 1;
    }
  }
  return undefined;
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
  io.write("Evidence: local-rehearsal");
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
      `- provider-env ${resource.service}.${resource.surface}.${resource.name} synced=${
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

    if (mode === "timeline") {
      const inspection = buildTelemetryTimelineInspection(events, { includeState: false });
      io.write(`PASS observe timeline ${inspection.summary.eventCount}`);
      writeTelemetryInspection(io, inspection, { includeState: false });
      await recordObserveCompleted(io, argv, query.environment, mode, events.length);
      return 0;
    }

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
    const format = readString(options.format);
    const inspection = buildTelemetryJourneyInspection(events, id, {
      includeState: format === "json" || Boolean(options["include-state"])
    });
    if (format === "json") {
      io.write(JSON.stringify(inspection, null, 2));
      await recordObserveCompleted(io, argv, query.environment, mode, events.length);
      return 0;
    }

    io.write(`PASS observe journey ${inspection.summary.eventCount}`);
    writeTelemetryInspection(io, inspection, { includeState: Boolean(options["include-state"]) });
    await recordObserveCompleted(io, argv, query.environment, mode, events.length);
    return 0;
  }

  if (mode === "errors") {
    const environment = readTelemetryEnvironmentOption(options.env);
    const events = (await store.timeline({
      ...query,
      environment
    })).filter(isErrorEvent);
    const inspection = buildTelemetryErrorInspection(events, { includeState: true });
    if (readString(options.format) === "json") {
      io.write(JSON.stringify(inspection, null, 2));
      await recordObserveCompleted(io, argv, environment, mode, events.length);
      return 0;
    }

    io.write(`PASS observe errors ${inspection.summary.eventCount}`);
    if (readString(options["group-by"]) === "component") {
      writeErrorGroupsByComponent(io, events);
    }
    writeTelemetryInspection(io, inspection, { includeState: true });
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
    const inspection = buildTelemetryCompareInspection(events, environments, { includeState: false });
    io.write(`PASS observe compare ${journey} ${inspection.summary.eventCount}`);
    writeTelemetryInspection(io, inspection, { includeState: false, includeCompare: true });
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

function writeTelemetryInspection(
  io: RunIo,
  inspection: TelemetryInspection,
  options: { includeState: boolean; includeCompare?: boolean }
): void {
  const summary = inspection.summary;
  io.write(
    `Summary: events=${summary.eventCount} errors=${summary.errorCount} environments=${formatList(
      summary.environments
    )} surfaces=${formatList(summary.surfaces)} journeys=${formatList(summary.journeys)}`
  );
  if (summary.firstTimestamp || summary.lastTimestamp) {
    io.write(`Window: first=${summary.firstTimestamp ?? "none"} last=${summary.lastTimestamp ?? "none"}`);
  }

  io.write("Timeline:");
  if (inspection.timeline.length === 0) {
    io.write("- none");
  } else {
    inspection.timeline.forEach((entry) => writeTelemetryTimelineEntry(io, entry, options));
  }

  io.write("Risks:");
  if (inspection.risks.length === 0) {
    io.write("- none");
  } else {
    for (const risk of inspection.risks) {
      const context = [
        risk.eventName ? `event=${risk.eventName}` : undefined,
        risk.timestamp ? `timestamp=${risk.timestamp}` : undefined
      ]
        .filter(Boolean)
        .join(" ");
      io.write(`- ${risk.severity} ${risk.code}: ${risk.message}${context ? ` ${context}` : ""}`);
    }
  }

  io.write("Pivots:");
  io.write(`- traces=${formatList(inspection.pivots.traceIds)}`);
  io.write(`- correlations=${formatList(inspection.pivots.correlationIds)}`);
  io.write(`- journeys=${formatList(inspection.pivots.journeyIds)}`);
  io.write(`- components=${formatList(inspection.pivots.components)}`);
  io.write(`- releases=${formatList(inspection.pivots.releases)}`);

  if (options.includeCompare && inspection.compare) {
    io.write("Compare:");
    for (const environment of inspection.compare) {
      io.write(
        `- ${environment.environment} events=${environment.eventCount} errors=${environment.errorCount} eventDelta=${formatSignedNumber(
          environment.eventDelta
        )} errorDelta=${formatSignedNumber(environment.errorDelta)}`
      );
    }
  }

  io.write("Next queries:");
  if (inspection.nextQueries.length === 0) {
    io.write("- none");
  } else {
    inspection.nextQueries.forEach((query) => io.write(`- ${query}`));
  }
}

function writeTelemetryTimelineEntry(
  io: RunIo,
  entry: TelemetryTimelineEntry,
  options: { includeState: boolean }
): void {
  const attributes = [
    entry.status ? `status=${entry.status}` : undefined,
    entry.component ? `component=${entry.component}` : undefined,
    entry.traceId ? `trace=${entry.traceId}` : undefined,
    entry.correlationId ? `correlation=${entry.correlationId}` : undefined,
    entry.journeyId ? `journeyId=${entry.journeyId}` : undefined,
    entry.releaseId ? `release=${entry.releaseId}` : undefined,
    entry.isError ? "error=yes" : "error=no"
  ]
    .filter(Boolean)
    .join(" ");
  const suffix = attributes ? ` ${attributes}` : "";
  io.write(`- ${entry.timestamp} ${entry.environment} ${entry.surface} ${entry.name}${suffix}`);
  if (options.includeState && entry.state) {
    io.write(`  state=${JSON.stringify(entry.state)}`);
  }
}

function writeErrorGroupsByComponent(io: RunIo, events: WideEvent[]): void {
  io.write("Component pivots:");
  const groups = countErrorGroupsByComponent(events);
  if (groups.length === 0) {
    io.write("- none");
    return;
  }

  for (const [component, count] of groups) {
    io.write(`- component=${component} errors=${count}`);
  }
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
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

  if (isEnvironment(value)) {
    return value;
  }

  throw new Error(
    [
      "FAIL cli.option.invalid",
      `Invalid --${options.flag} value: ${value}. Expected one of: ${environmentOptionValues.join(", ")}.`,
      `Fix: ${options.fix}`
    ].join("\n")
  );
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
        "Expected one of: preview, production.",
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
      `Invalid --${options.flag} value: ${value}. Expected one of: preview, production.`,
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

function readOptionalStringOption(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
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
