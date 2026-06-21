import { validateCustomEnvValues, type EnvValueState } from "./env-graph.js";
import type { Diagnostic, Result } from "./diagnostics.js";
import { getGuidanceGeneratedAnchors, validateGuidancePolicy } from "./guidance.js";
import type { AgentstackManifest } from "./manifest.js";
import { getSaasSpineGeneratedAnchors } from "./saas-spine.js";

export type LocalValidationInput = {
  manifest: AgentstackManifest;
  envValues: EnvValueState;
};

export type LocalValidationReport = {
  diagnostics: Diagnostic[];
};

export type GeneratedAnchorValidationInput = {
  manifest: AgentstackManifest;
  missingPaths: string[];
};

export function validateLocalProject(input: LocalValidationInput): Result<LocalValidationReport> {
  const diagnostics: Diagnostic[] = [
    ...validateCustomEnvValues(input.manifest, input.envValues),
    ...validateTelemetryPolicy(input.manifest),
    ...validateGuidancePolicy(input.manifest)
  ];

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return { ok: false, diagnostics };
  }

  return { ok: true, value: { diagnostics }, diagnostics };
}

export function getRequiredGeneratedAnchors(manifest: AgentstackManifest): string[] {
  const anchors = [
    "AGENTS.md",
    "package.json",
    "pnpm-workspace.yaml",
    "agentstack.config.json",
    "docs/agentstack/workflows.md",
    "docs/agentstack/validation.md",
    "docs/agentstack/observability.md",
    "docs/agentstack/environments.md",
    "docs/agentstack/generated-boundaries.md",
    "docs/agentstack/release.md",
    "docs/agentstack/theming.md",
    "scripts/agentstack.mjs",
    "packages/domain/src/index.ts",
    "packages/theme/package.json",
    "packages/theme/tokens.json",
    "packages/theme/src/index.ts"
  ];

  anchors.push(...manifest.generated.requiredAnchors);
  anchors.push(...getSaasSpineGeneratedAnchors(manifest));
  anchors.push(...getGuidanceGeneratedAnchors(manifest));

  if (manifest.surfaces.includes("web")) {
    anchors.push("apps/web/package.json");
    anchors.push("apps/web/src/index.ts");
  }

  if (manifest.surfaces.includes("mobile")) {
    anchors.push("apps/mobile/package.json");
    anchors.push("apps/mobile/App.tsx");
    anchors.push("apps/mobile/src/index.ts");
    anchors.push("apps/mobile/app.config.ts");
    anchors.push("apps/mobile/eas.json");
    anchors.push("docs/agentstack/mobile.md");
  }

  if (manifest.surfaces.includes("convex")) {
    anchors.push("convex/schema.ts");
    anchors.push("convex/agentstack.ts");
  }

  if (manifest.telemetry.enabled) {
    anchors.push("packages/telemetry/src/events.ts");
  }

  return Array.from(new Set(anchors));
}

export function validateGeneratedAnchors(
  input: GeneratedAnchorValidationInput
): Result<LocalValidationReport> {
  const required = new Set(getRequiredGeneratedAnchors(input.manifest));
  const diagnostics: Diagnostic[] = input.missingPaths
    .filter((path) => required.has(path))
    .map(createMissingGeneratedAnchorDiagnostic);

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  return { ok: true, value: { diagnostics }, diagnostics };
}

export function createMissingGeneratedAnchorDiagnostic(path: string): Diagnostic {
  return {
    severity: "fail",
    code: "template.anchor.missing",
    path,
    message: `Required generated file is missing: ${path}.`,
    fix: "Restore the generated anchor or rerun agentstack init for this project.",
    blocks: ["validate", "validate --cloud", "deploy"]
  };
}

function validateTelemetryPolicy(manifest: AgentstackManifest): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!manifest.telemetry.enabled) {
    diagnostics.push({
      severity: "warn",
      code: "telemetry.disabled",
      message: "Telemetry is disabled, so journey inspection will not be available.",
      fix: "Set telemetry.enabled to true in agentstack.config.json."
    });
  }

  if (!manifest.telemetry.redaction.forbidRawSecrets) {
    diagnostics.push({
      severity: "fail",
      code: "telemetry.redaction.disabled",
      path: "telemetry.redaction.forbidRawSecrets",
      message: "Telemetry redaction must forbid raw secrets.",
      fix: "Set telemetry.redaction.forbidRawSecrets to true.",
      blocks: ["validate", "validate --cloud", "deploy"]
    });
  }

  return diagnostics;
}
