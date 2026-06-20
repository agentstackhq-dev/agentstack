import type { Diagnostic } from "./diagnostics.js";
import type { AgentstackManifest, EnvironmentName, ServiceName } from "./manifest.js";

export type ReleaseEnvironment = "preview" | "production";

export function normalizeReleaseEnvironment(value: string): ReleaseEnvironment | undefined {
  if (value === "prod") {
    return "production";
  }

  if (value === "preview" || value === "production") {
    return value;
  }

  return undefined;
}

export function validateReleasePolicy(
  manifest: AgentstackManifest,
  environment: EnvironmentName
): Diagnostic[] {
  if (environment === "development") {
    return [
      {
        severity: "fail",
        code: "release.environment.unsupported",
        path: "development",
        message: "Development is not a supported release environment.",
        fix: "Run agentstack validate --release prod.",
        blocks: ["validate --release", "deploy"]
      }
    ];
  }

  const diagnostics: Diagnostic[] = [];
  const requiredServices = getRequiredReleaseServices(manifest);

  for (const service of requiredServices) {
    const config = manifest.services[service];

    if (!config.enabled || !config.requiredEnvironments.includes(environment)) {
      diagnostics.push({
        severity: "fail",
        code: `release.service.${environment}-missing`,
        path: `${environment}.${service}`,
        message: `${service} must be enabled and required for ${environment} releases.`,
        fix: `Enable ${service} and include ${environment} in services.${service}.requiredEnvironments.`,
        blocks: ["validate --release", "deploy"]
      });
    }
  }

  if (!manifest.telemetry.environments[environment].required) {
    diagnostics.push({
      severity: "fail",
      code: `release.telemetry.${environment}-required`,
      path: `${environment}.telemetry.required`,
      message: `Telemetry must be required for ${environment} releases.`,
      fix: `Set telemetry.environments.${environment}.required to true.`,
      blocks: ["validate --release", "deploy"]
    });
  }

  if (!manifest.telemetry.redaction.forbidRawSecrets) {
    diagnostics.push({
      severity: "fail",
      code: "release.telemetry.redaction-disabled",
      path: "telemetry.redaction.forbidRawSecrets",
      message: "Release telemetry redaction must forbid raw secrets.",
      fix: "Set telemetry.redaction.forbidRawSecrets to true.",
      blocks: ["validate --release", "deploy"]
    });
  }

  return diagnostics;
}

function getRequiredReleaseServices(manifest: AgentstackManifest): ServiceName[] {
  const services: ServiceName[] = ["clerk", "convex"];

  if (manifest.surfaces.includes("web")) {
    services.push("vercel");
  }

  if (manifest.surfaces.includes("mobile")) {
    services.push("eas");
  }

  return services;
}
