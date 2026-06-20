import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { validateLocalProject } from "./validation.js";

describe("local validation", () => {
  it("passes a valid default manifest", () => {
    const result = validateLocalProject({
      manifest: createDefaultManifest("acme-crm"),
      envValues: {}
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("fails when telemetry redaction is disabled for a production-capable project", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.telemetry.redaction.forbidRawSecrets = false;

    const result = validateLocalProject({ manifest, envValues: {} });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "telemetry.redaction.disabled"
      })
    ]);
  });

  it("reports telemetry disabled and redaction disabled diagnostics together", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.telemetry.enabled = false;
    manifest.telemetry.redaction.forbidRawSecrets = false;

    const result = validateLocalProject({ manifest, envValues: {} });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        severity: "warn",
        code: "telemetry.disabled"
      }),
      expect.objectContaining({
        severity: "fail",
        code: "telemetry.redaction.disabled"
      })
    ]);
  });
});
