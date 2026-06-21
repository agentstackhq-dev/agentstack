import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildEnvGraph,
  buildProviderEnvResources,
  createMobileBuildPlan,
  formatDiagnostic,
  type AgentstackManifest,
  type Diagnostic,
  type EnvValueState,
  type EnvironmentName,
  type ProviderEnvResource,
  type ServiceName
} from "@agentstack/core";
import type {
  AppliedPlan,
  ApplyOptions,
  CloudAdapter,
  DeployOptions,
  DeployPlan,
  DeployStep,
  InspectReport,
  InspectServiceResource,
  LifecycleSyncPlan,
  MobileBuildAdapterPlan,
  MobileBuildOptions,
  EnvResourceChange,
  SyncChange,
  SyncOptions,
  SyncPlan
} from "./types.js";

type LocalCloudServiceState = {
  service: ServiceName | string;
  environment: EnvironmentName;
  linked: boolean;
  env: Record<string, string>;
};

type LocalCloudState = {
  services: LocalCloudServiceState[];
  envResources?: LocalCloudEnvResourceState[];
};

type LocalCloudEnvResourceState = {
  environment: EnvironmentName;
  service: ServiceName | string;
  surface: ProviderEnvResource["surface"];
  kind: "envVar";
  name: string;
  required: boolean;
  secret: boolean;
  source: ProviderEnvResource["source"];
  valueHash?: string;
};

export class LocalCloudAdapter implements CloudAdapter {
  constructor(private readonly projectRoot: string) {}

  async inspect(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: { envValues?: EnvValueState } = {}
  ): Promise<InspectReport> {
    const state = await this.readState();
    const required = buildEnvGraph(manifest).nodes.filter((node) => node.environment === environment);
    const requiredServices = new Set<ServiceName | string>(required.map((node) => node.service));
    const expected = required.map<InspectServiceResource>((node) => ({
      environment,
      service: node.service,
      linked: true,
      env: {}
    }));
    const linked = expected.filter((resource) =>
      state.services.some(
        (candidate) =>
          candidate.environment === environment &&
          candidate.service === resource.service &&
          candidate.linked
      )
    );
    const missing = expected.filter(
      (resource) => !linked.some((candidate) => candidate.service === resource.service)
    );
    const stale = state.services.filter(
      (service) => service.environment === environment && service.linked && !requiredServices.has(service.service)
    );
    const hasEnvValues = options.envValues !== undefined;
    const expectedEnvResources = buildProviderEnvResources(manifest, options.envValues ?? {}).filter(
      (resource) => resource.environment === environment
    );
    const expectedEnvKeys = new Set(expectedEnvResources.map(envResourceKey));
    const stateEnvResources = (state.envResources ?? []).filter((resource) => resource.environment === environment);
    const syncedEnv = expectedEnvResources
      .filter((resource) =>
        stateEnvResources.some(
          (candidate) =>
            envResourceKey(candidate) === envResourceKey(resource) &&
            (resource.source === "provider-owned" || !hasEnvValues || candidate.valueHash === resource.valueHash)
        )
      )
      .map((resource) => ({ ...resource, synced: true }));
    const missingEnv = expectedEnvResources
      .filter((resource) => !stateEnvResources.some((candidate) => envResourceKey(candidate) === envResourceKey(resource)))
      .map((resource) => ({ ...resource, synced: false }));
    const driftedEnv = expectedEnvResources
      .filter((resource) =>
        hasEnvValues &&
        stateEnvResources.some(
          (candidate) =>
            envResourceKey(candidate) === envResourceKey(resource) &&
            resource.source === "local-value" &&
            candidate.valueHash !== resource.valueHash
        )
      )
      .map((resource) => ({ ...resource, synced: false }));
    const staleEnv = stateEnvResources
      .filter((resource) => !expectedEnvKeys.has(envResourceKey(resource)))
      .map((resource) => ({ ...resource, synced: true }));

    return {
      environment,
      expected,
      linked,
      missing,
      stale,
      expectedEnv: expectedEnvResources.map((resource) => ({
        ...resource,
        synced: syncedEnv.some((syncedResource) => envResourceKey(syncedResource) === envResourceKey(resource))
      })),
      syncedEnv,
      missingEnv,
      staleEnv,
      driftedEnv
    };
  }

  plan(report: InspectReport): LifecycleSyncPlan {
    const envResources = [...report.missingEnv, ...report.driftedEnv].filter(isLocalValueResourceWithHash);
    return {
      environment: report.environment,
      changes: [
        ...report.missing.map<SyncChange>((resource) => ({
          action: "link",
          environment: report.environment,
          service: resource.service
        })),
        ...report.stale.map<SyncChange>((resource) => ({
          action: "unlink",
          environment: report.environment,
          service: resource.service
        })),
        ...envResources.map<SyncChange>((resource) => ({
          action: "set-env",
          environment: report.environment,
          service: resource.service,
          surface: resource.surface,
          name: resource.name,
          secret: resource.secret,
          source: resource.source
        })),
        ...report.staleEnv.map<SyncChange>((resource) => ({
          action: "remove-env",
          environment: report.environment,
          service: resource.service,
          surface: resource.surface,
          name: resource.name,
          secret: resource.secret,
          source: resource.source
        }))
      ],
      ...(envResources.length > 0 ? { envResources } : {})
    };
  }

  async apply(plan: LifecycleSyncPlan, options: ApplyOptions = {}): Promise<AppliedPlan> {
    if (plan.environment === "production" && !options.confirmProduction) {
      throw new Error("Production local-cloud mutations require explicit confirmation.");
    }

    const state = await this.readState();

    for (const change of plan.changes) {
      const index = state.services.findIndex(
        (candidate) =>
          candidate.environment === change.environment && candidate.service === change.service
      );

      if (change.action === "link") {
        if (index === -1) {
          state.services.push({
            environment: change.environment,
            service: change.service,
            linked: true,
            env: {}
          });
        } else {
          state.services[index].linked = true;
        }
      }
    }

    const unlinkChanges = new Set(
      plan.changes
        .filter((change) => change.action === "unlink")
        .map((change) => `${change.environment}.${change.service}`)
    );
    if (unlinkChanges.size > 0) {
      state.services = state.services.filter(
        (service) => !service.linked || !unlinkChanges.has(`${service.environment}.${service.service}`)
      );
    }

    const setEnvChanges = plan.changes.filter(isSetEnvChange);
    if (setEnvChanges.length > 0) {
      state.envResources ??= [];
      for (const change of setEnvChanges) {
        const resource = plan.envResources?.find(
          (candidate) =>
            candidate.environment === change.environment &&
            candidate.service === change.service &&
            candidate.surface === change.surface &&
            candidate.name === change.name
        );
        if (!resource) {
          continue;
        }

        const index = state.envResources.findIndex(
          (candidate) => envResourceKey(candidate) === envResourceKey(resource)
        );
        const record = toLocalEnvResource(resource);
        if (index === -1) {
          state.envResources.push(record);
        } else {
          state.envResources[index] = record;
        }
      }
    }

    const removeEnvChanges = new Set(plan.changes.filter(isRemoveEnvChange).map(envChangeKey));
    if (removeEnvChanges.size > 0 && state.envResources) {
      state.envResources = state.envResources.filter(
        (resource) => !removeEnvChanges.has(envResourceKey(resource))
      );
    }

    await this.writeState(state);

    return { ...plan, applied: true };
  }

  async validate(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: { envValues?: EnvValueState } = {}
  ): Promise<Diagnostic[]> {
    const report = await this.inspect(manifest, environment, options);

    const missingDiagnostics = report.missing.map((service) => ({
      severity: "fail" as const,
      code: "cloud.service.missing",
      path: `${environment}.${service.service}`,
      message: `${service.service} is not linked in ${environment}.`,
      fix: `Run agentstack sync --env ${environment} --apply.`,
      blocks: ["validate --cloud"]
    }));

    const staleDiagnostics = report.stale.map((service) => ({
      severity: "fail" as const,
      code: "cloud.service.stale",
      path: `${environment}.${service.service}`,
      message: `${service.service} is linked in ${environment} but is not enabled in the manifest.`,
      fix: `Remove ${environment}.${service.service} from local cloud state or re-enable it, then run agentstack sync --env ${environment} --apply.`,
      blocks: ["validate --cloud"]
    }));

    const missingEnvDiagnostics = report.missingEnv.map((resource) => ({
      severity: "fail" as const,
      code: "cloud.env.missing",
      path: formatEnvDiagnosticPath(environment, resource),
      message: `${resource.name} is not synced to ${resource.service} in ${environment}.`,
      fix: `Run agentstack sync --env ${environment} --apply.`,
      blocks: ["validate --cloud"]
    }));
    const driftedEnvDiagnostics = report.driftedEnv.map((resource) => ({
      severity: "fail" as const,
      code: "cloud.env.drift",
      path: formatEnvDiagnosticPath(environment, resource),
      message: `${resource.name} is synced to ${resource.service} in ${environment} with a stale value hash.`,
      fix: `Run agentstack sync --env ${environment} --apply.`,
      blocks: ["validate --cloud"]
    }));
    const staleEnvDiagnostics = report.staleEnv.map((resource) => ({
      severity: "fail" as const,
      code: "cloud.env.stale",
      path: formatEnvDiagnosticPath(environment, resource),
      message: `${resource.name} is synced to ${resource.service} in ${environment} but is not expected by the manifest.`,
      fix: `Run agentstack sync --env ${environment} --apply.`,
      blocks: ["validate --cloud"]
    }));

    return [
      ...missingDiagnostics,
      ...staleDiagnostics,
      ...missingEnvDiagnostics,
      ...driftedEnvDiagnostics,
      ...staleEnvDiagnostics
    ];
  }

  async sync(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: SyncOptions
  ): Promise<SyncPlan> {
    const report = await this.inspect(manifest, environment, { envValues: options.envValues });
    const plan = this.plan(report);
    if (options.apply) {
      await this.apply(plan, { confirmProduction: true });
    }

    return { environment, changes: plan.changes.map(formatChange), applied: options.apply };
  }

  async deploy(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: DeployOptions
  ): Promise<DeployPlan> {
    const report = await this.inspect(manifest, environment, { envValues: options.envValues });
    const lifecyclePlan = this.plan(report);
    const status = options.apply ? "applied" : "planned";
    const syncSteps = lifecyclePlan.changes.map<DeployStep>((change) => ({
      action: "sync",
      environment: change.environment,
      service: change.service,
      status
    }));
    const releaseSteps = report.expected.map<DeployStep>((resource) => ({
      action: "release",
      environment,
      service: resource.service,
      status
    }));
    const plan: DeployPlan = {
      environment,
      steps: [...syncSteps, ...releaseSteps],
      applied: options.apply
    };

    if (!options.apply) {
      return plan;
    }

    await this.apply(lifecyclePlan, { confirmProduction: options.confirmProduction });
    const artifactPath = join(".agentstack", "deployments", `${environment}.json`);
    const appliedPlan: DeployPlan = { ...plan, artifactPath };
    await this.writeDeploymentArtifact(artifactPath, appliedPlan);

    return appliedPlan;
  }

  async mobileBuild(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: MobileBuildOptions
  ): Promise<MobileBuildAdapterPlan> {
    const result = createMobileBuildPlan(manifest, environment, options);
    if (!result.ok) {
      throw new Error(result.diagnostics.map(formatDiagnostic).join("\n"));
    }

    const plan: MobileBuildAdapterPlan = { ...result.value, service: "eas" };
    if (options.apply) {
      await this.writeMobileBuildArtifact(plan.artifactPath, plan);
    }

    return plan;
  }

  private get statePath(): string {
    return join(this.projectRoot, ".agentstack", "local-cloud.json");
  }

  private async writeDeploymentArtifact(relativePath: string, plan: DeployPlan): Promise<void> {
    const fullPath = join(this.projectRoot, relativePath);
    await mkdir(join(this.projectRoot, ".agentstack", "deployments"), { recursive: true });
    await writeFile(fullPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  }

  private async writeMobileBuildArtifact(relativePath: string, plan: MobileBuildAdapterPlan): Promise<void> {
    const fullPath = join(this.projectRoot, relativePath);
    await mkdir(join(this.projectRoot, ".agentstack", "builds"), { recursive: true });
    await writeFile(fullPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  }

  private async readState(): Promise<LocalCloudState> {
    try {
      return JSON.parse(await readFile(this.statePath, "utf8")) as LocalCloudState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { services: [] };
      }
      throw error;
    }
  }

  private async writeState(state: LocalCloudState): Promise<void> {
    await mkdir(join(this.projectRoot, ".agentstack"), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}

function formatChange(change: SyncChange): string {
  if (change.action === "set-env" || change.action === "remove-env") {
    return `${change.action} ${change.environment}.${change.service}.${change.surface}.${change.name}`;
  }

  return `${change.action} ${change.environment}.${change.service}`;
}

function envResourceKey(resource: {
  environment: EnvironmentName;
  service: ServiceName | string;
  surface: ProviderEnvResource["surface"];
  name: string;
}): string {
  return `${resource.environment}.${resource.service}.${resource.surface}.${resource.name}`;
}

function formatEnvDiagnosticPath(
  environment: EnvironmentName,
  resource: { service: ServiceName | string; surface: ProviderEnvResource["surface"]; name: string }
): string {
  return `${environment}.${resource.service}.${resource.surface}.env.${resource.name}`;
}

function envChangeKey(change: EnvResourceChange): string {
  return `${change.environment}.${change.service}.${change.surface}.${change.name}`;
}

function isSetEnvChange(change: SyncChange): change is EnvResourceChange & { action: "set-env" } {
  return change.action === "set-env";
}

function isRemoveEnvChange(change: SyncChange): change is EnvResourceChange & { action: "remove-env" } {
  return change.action === "remove-env";
}

function isLocalValueResourceWithHash<T extends { source?: string; valueHash?: string }>(
  resource: T
): resource is T & { source: "local-value"; valueHash: string } {
  return resource.source === "local-value" && resource.valueHash !== undefined;
}

function toLocalEnvResource(resource: LocalCloudEnvResourceState): LocalCloudEnvResourceState {
  return {
    environment: resource.environment,
    service: resource.service,
    surface: resource.surface,
    kind: resource.kind,
    name: resource.name,
    required: resource.required,
    secret: resource.secret,
    source: resource.source,
    ...(resource.valueHash ? { valueHash: resource.valueHash } : {})
  };
}
