import { validateCustomEnvValues, type EnvValueState } from "./env-graph.js";
import type { Diagnostic, Result } from "./diagnostics.js";
import type { AgentstackManifest } from "./manifest.js";

export type LocalValidationInput = {
  manifest: AgentstackManifest;
  envValues: EnvValueState;
};

export type LocalValidationReport = {
  diagnostics: Diagnostic[];
};

export function validateLocalProject(input: LocalValidationInput): Result<LocalValidationReport> {
  const diagnostics: Diagnostic[] = [
    ...validateCustomEnvValues(input.manifest, input.envValues),
    ...validateTelemetryPolicy(input.manifest)
  ];

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return { ok: false, diagnostics };
  }

  return { ok: true, value: { diagnostics }, diagnostics };
}

function validateTelemetryPolicy(manifest: AgentstackManifest): Diagnostic[] {
  if (!manifest.telemetry.enabled) {
    return [
      {
        severity: "warn",
        code: "telemetry.disabled",
        message: "Telemetry is disabled, so journey inspection will not be available.",
        fix: "Set telemetry.enabled to true in agentstack.config.ts."
      }
    ];
  }

  if (!manifest.telemetry.redaction.forbidRawSecrets) {
    return [
      {
        severity: "fail",
        code: "telemetry.redaction.disabled",
        path: "telemetry.redaction.forbidRawSecrets",
        message: "Telemetry redaction must forbid raw secrets.",
        fix: "Set telemetry.redaction.forbidRawSecrets to true.",
        blocks: ["validate", "validate --cloud", "deploy"]
      }
    ];
  }

  return [];
}
