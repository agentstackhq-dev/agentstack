import type {
  AgentstackManifest,
  Diagnostic,
  EnvValueState,
  EnvironmentName,
  MobileBuildPlan,
  ProviderEnvResource,
  ProviderEnvSource,
  ServiceName,
  SurfaceName
} from "@agentstackhq/core";

export type SyncOptions = {
  apply: boolean;
  envValues?: EnvValueState;
};

export type DeployOptions = {
  apply: boolean;
  confirmProduction?: boolean;
  envValues?: EnvValueState;
};

export type MobileBuildOptions = {
  apply: boolean;
  confirmProduction?: boolean;
};

export type InspectServiceResource = {
  environment: EnvironmentName;
  service: ServiceName | string;
  linked: boolean;
  env: Record<string, string>;
};

export type InspectEnvResource = Omit<ProviderEnvResource, "service"> & {
  service: ServiceName | string;
  synced: boolean;
};

export type InspectReport = {
  environment: EnvironmentName;
  expected: InspectServiceResource[];
  linked: InspectServiceResource[];
  missing: InspectServiceResource[];
  stale: InspectServiceResource[];
  expectedEnv: InspectEnvResource[];
  syncedEnv: InspectEnvResource[];
  missingEnv: InspectEnvResource[];
  staleEnv: InspectEnvResource[];
  driftedEnv: InspectEnvResource[];
};

export type ServiceChange = {
  action: "link" | "unlink";
  environment: EnvironmentName;
  service: ServiceName | string;
};

export type EnvResourceChange = {
  action: "set-env" | "remove-env";
  environment: EnvironmentName;
  service: ServiceName | string;
  surface: SurfaceName;
  name: string;
  secret: boolean;
  source: ProviderEnvSource;
};

export type SyncChange = ServiceChange | EnvResourceChange;

export type LifecycleSyncPlan = {
  environment: EnvironmentName;
  changes: SyncChange[];
  envResources?: InspectEnvResource[];
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

export type MobileBuildAdapterPlan = MobileBuildPlan & {
  service: "eas";
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
  inspect(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options?: { envValues?: EnvValueState }
  ): Promise<InspectReport>;
  plan(report: InspectReport): LifecycleSyncPlan;
  apply(plan: LifecycleSyncPlan, options?: ApplyOptions): Promise<AppliedPlan>;
  validate(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options?: { envValues?: EnvValueState }
  ): Promise<Diagnostic[]>;
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
  mobileBuild(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: MobileBuildOptions
  ): Promise<MobileBuildAdapterPlan>;
}
