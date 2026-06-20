import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildEnvGraph,
  type AgentstackManifest,
  type Diagnostic,
  type EnvironmentName,
  type ServiceName
} from "@agentstack/core";
import type {
  AppliedPlan,
  ApplyOptions,
  CloudAdapter,
  InspectReport,
  InspectServiceResource,
  LifecycleSyncPlan,
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
};

export class LocalCloudAdapter implements CloudAdapter {
  constructor(private readonly projectRoot: string) {}

  async inspect(manifest: AgentstackManifest, environment: EnvironmentName): Promise<InspectReport> {
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

    return { environment, expected, linked, missing, stale };
  }

  plan(report: InspectReport): LifecycleSyncPlan {
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
        }))
      ]
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

    await this.writeState(state);

    return { ...plan, applied: true };
  }

  async validate(manifest: AgentstackManifest, environment: EnvironmentName): Promise<Diagnostic[]> {
    const report = await this.inspect(manifest, environment);

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

    return [...missingDiagnostics, ...staleDiagnostics];
  }

  async sync(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: SyncOptions
  ): Promise<SyncPlan> {
    const plan = this.plan(await this.inspect(manifest, environment));
    if (options.apply) {
      await this.apply(plan, { confirmProduction: true });
    }

    return { environment, changes: plan.changes.map(formatChange), applied: options.apply };
  }

  private get statePath(): string {
    return join(this.projectRoot, ".agentstack", "local-cloud.json");
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
  return `${change.action} ${change.environment}.${change.service}`;
}
