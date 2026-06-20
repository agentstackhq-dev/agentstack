import type { AgentstackManifest, Diagnostic, EnvironmentName } from "@agentstack/core";

export type SyncOptions = {
  apply: boolean;
};

export type SyncPlan = {
  environment: EnvironmentName;
  changes: string[];
  applied: boolean;
};

export interface CloudAdapter {
  validate(manifest: AgentstackManifest, environment: EnvironmentName): Promise<Diagnostic[]>;
  sync(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: SyncOptions
  ): Promise<SyncPlan>;
}
