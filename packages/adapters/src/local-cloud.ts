import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildEnvGraph,
  type AgentstackManifest,
  type Diagnostic,
  type EnvironmentName,
  type ServiceName
} from "@agentstack/core";
import type { CloudAdapter, SyncOptions, SyncPlan } from "./types.js";

type LocalCloudServiceState = {
  service: ServiceName;
  environment: EnvironmentName;
  linked: boolean;
  env: Record<string, string>;
};

type LocalCloudState = {
  services: LocalCloudServiceState[];
};

export class LocalCloudAdapter implements CloudAdapter {
  constructor(private readonly projectRoot: string) {}

  async validate(manifest: AgentstackManifest, environment: EnvironmentName): Promise<Diagnostic[]> {
    const state = await this.readState();
    const required = buildEnvGraph(manifest).nodes.filter((node) => node.environment === environment);
    const requiredServices = new Set(required.map((node) => node.service));
    const stale = state.services.filter(
      (service) => service.environment === environment && service.linked && !requiredServices.has(service.service)
    );

    const missingDiagnostics = required.flatMap((node) => {
      const service = state.services.find(
        (candidate) => candidate.environment === environment && candidate.service === node.service
      );

      if (service?.linked) {
        return [];
      }

      return [
        {
          severity: "fail" as const,
          code: "cloud.service.missing",
          path: `${environment}.${node.service}`,
          message: `${node.service} is not linked in ${environment}.`,
          fix: `Run agentstack sync --env ${environment} --apply.`,
          blocks: ["validate --cloud"]
        }
      ];
    });

    const staleDiagnostics = stale.map((service) => ({
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
    const state = await this.readState();
    const required = buildEnvGraph(manifest).nodes.filter((node) => node.environment === environment);
    const requiredServices = new Set(required.map((node) => node.service));
    const changes: string[] = [];

    for (const node of required) {
      const index = state.services.findIndex(
        (candidate) => candidate.environment === environment && candidate.service === node.service
      );

      if (index === -1) {
        changes.push(`link ${environment}.${node.service}`);
        if (options.apply) {
          state.services.push({
            environment,
            service: node.service,
            linked: true,
            env: {}
          });
        }
      } else if (!state.services[index]?.linked) {
        changes.push(`link ${environment}.${node.service}`);
        if (options.apply) {
          state.services[index].linked = true;
        }
      }
    }

    const stale = state.services.filter(
      (service) => service.environment === environment && service.linked && !requiredServices.has(service.service)
    );

    for (const service of stale) {
      changes.push(`unlink ${environment}.${service.service}`);
    }

    if (options.apply) {
      if (stale.length > 0) {
        state.services = state.services.filter(
          (service) =>
            service.environment !== environment || !service.linked || requiredServices.has(service.service)
        );
      }
      await this.writeState(state);
    }

    return { environment, changes, applied: options.apply };
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
