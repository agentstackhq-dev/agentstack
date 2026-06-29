import { fail, pass, type Diagnostic, type Result } from "./diagnostics.js";
import type { AgentstackManifest, EnvironmentName } from "./manifest.js";

export type MobileBuildProfileName = "development" | "preview" | "production";
export type MobileBuildDistribution = "internal" | "store";

export type MobileBuildPlan = {
  environment: EnvironmentName;
  profile: MobileBuildProfileName;
  distribution: MobileBuildDistribution;
  developmentClient: boolean;
  applied: boolean;
  artifactPath: string;
};

export type MobileBuildPlanOptions = {
  apply: boolean;
  confirmProduction?: boolean;
};

export function createMobileBuildPlan(
  manifest: AgentstackManifest,
  environment: EnvironmentName,
  options: MobileBuildPlanOptions
): Result<MobileBuildPlan> {
  const diagnostics = validateMobileBuildManifest(manifest, environment, options);
  if (diagnostics.length > 0) {
    return fail(diagnostics);
  }

  const profile = readProfile(environment);
  return pass({
    environment,
    profile,
    distribution: profile === "production" ? "store" : "internal",
    developmentClient: profile === "development",
    applied: options.apply,
    artifactPath: `.agentstack/builds/mobile-${environment}.json`
  });
}

export function validateMobileBuildManifest(
  manifest: AgentstackManifest,
  environment: EnvironmentName,
  options: MobileBuildPlanOptions
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!manifest.surfaces.includes("mobile")) {
    diagnostics.push({
      severity: "fail",
      code: "mobile.surface.disabled",
      path: "surfaces",
      message: "Mobile builds require the mobile surface to be enabled.",
      fix: "Add mobile to surfaces in agentstack.config.ts.",
      blocks: ["build mobile"]
    });
  }

  if (!manifest.services.eas.enabled || !manifest.services.eas.requiredEnvironments.includes(environment)) {
    diagnostics.push({
      severity: "fail",
      code: "mobile.eas.disabled",
      path: `${environment}.eas`,
      message: `EAS is not enabled for ${environment}.`,
      fix: "Enable services.eas for the selected environment in agentstack.config.ts.",
      blocks: ["build mobile"]
    });
  }

  if (environment === "production" && options.apply && !options.confirmProduction) {
    diagnostics.push({
      severity: "fail",
      code: "mobile.build.production-confirmation.required",
      path: "production.mobile",
      message: "Applying production mobile builds requires explicit confirmation.",
      fix: "Run agentstack build mobile --env production --apply --confirm-production.",
      blocks: ["build mobile"]
    });
  }

  return diagnostics;
}

function readProfile(environment: EnvironmentName): MobileBuildProfileName {
  return environment;
}
