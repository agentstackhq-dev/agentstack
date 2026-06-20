import type { AgentstackManifest, Diagnostic, EnvironmentName, ServiceName } from "@agentstack/core";

export type SyncOptions = {
  apply: boolean;
};

export type DeployOptions = {
  apply: boolean;
};

export type InspectServiceResource = {
  environment: EnvironmentName;
  service: ServiceName | string;
  linked: boolean;
  env: Record<string, string>;
};

export type InspectReport = {
  environment: EnvironmentName;
  expected: InspectServiceResource[];
  linked: InspectServiceResource[];
  missing: InspectServiceResource[];
  stale: InspectServiceResource[];
};

export type SyncChange = {
  action: "link" | "unlink";
  environment: EnvironmentName;
  service: ServiceName | string;
};

export type LifecycleSyncPlan = {
  environment: EnvironmentName;
  changes: SyncChange[];
};

export type DeployStep = {
  action: "sync" | "release";
  environment: EnvironmentName;
  service: ServiceName | string;
  status: "planned" | "applied";
};

export type DeployPlan = {
  environment: EnvironmentName;
  steps: DeployStep[];
  applied: boolean;
  artifactPath?: string;
};

export type ApplyOptions = {
  confirmProduction?: boolean;
};

export type AppliedPlan = LifecycleSyncPlan & {
  applied: true;
};

export type SyncPlan = {
  environment: EnvironmentName;
  changes: string[];
  applied: boolean;
};

export interface CloudAdapter {
  inspect(manifest: AgentstackManifest, environment: EnvironmentName): Promise<InspectReport>;
  plan(report: InspectReport): LifecycleSyncPlan;
  apply(plan: LifecycleSyncPlan, options?: ApplyOptions): Promise<AppliedPlan>;
  validate(manifest: AgentstackManifest, environment: EnvironmentName): Promise<Diagnostic[]>;
  sync(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: SyncOptions
  ): Promise<SyncPlan>;
  deploy(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: DeployOptions
  ): Promise<DeployPlan>;
}
