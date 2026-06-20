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

    return required.flatMap((node) => {
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
  }

  async sync(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: SyncOptions
  ): Promise<SyncPlan> {
    const state = await this.readState();
    const required = buildEnvGraph(manifest).nodes.filter((node) => node.environment === environment);
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
      }
    }

    if (options.apply) {
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
