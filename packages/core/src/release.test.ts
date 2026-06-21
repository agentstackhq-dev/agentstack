import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { normalizeReleaseEnvironment, validateReleasePolicy } from "./release.js";

describe("release policy", () => {
  it("normalizes canonical release environments only", () => {
    expect(normalizeReleaseEnvironment("prod")).toBeUndefined();
    expect(normalizeReleaseEnvironment("production")).toBe("production");
    expect(normalizeReleaseEnvironment("preview")).toBe("preview");
    expect(normalizeReleaseEnvironment("development")).toBeUndefined();
  });

  it("passes production policy for the default manifest", () => {
    expect(validateReleasePolicy(createDefaultManifest("acme-crm"), "production")).toEqual([]);
  });

  it("rejects development releases", () => {
    expect(validateReleasePolicy(createDefaultManifest("acme-crm"), "development")).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "release.environment.unsupported",
        path: "development",
        fix: "Run agentstack validate --release production."
      })
    ]);
  });

  it("fails production when telemetry policy is not required and redaction allows raw secrets", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.telemetry.environments.production.required = false;
    manifest.telemetry.redaction.forbidRawSecrets = false;

    expect(validateReleasePolicy(manifest, "production")).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "release.telemetry.production-required",
        path: "production.telemetry.required"
      }),
      expect.objectContaining({
        severity: "fail",
        code: "release.telemetry.redaction-disabled",
        path: "telemetry.redaction.forbidRawSecrets"
      })
    ]);
  });

  it("fails production when required services are disabled or missing production", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.clerk.enabled = false;
    manifest.services.convex.requiredEnvironments = ["development", "preview"];
    manifest.services.vercel.enabled = false;
    manifest.services.eas.requiredEnvironments = ["development", "preview"];

    expect(validateReleasePolicy(manifest, "production")).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "release.service.production-missing",
        path: "production.clerk"
      }),
      expect.objectContaining({
        severity: "fail",
        code: "release.service.production-missing",
        path: "production.convex"
      }),
      expect.objectContaining({
        severity: "fail",
        code: "release.service.production-missing",
        path: "production.vercel"
      }),
      expect.objectContaining({
        severity: "fail",
        code: "release.service.production-missing",
        path: "production.eas"
      })
    ]);
  });

  it("uses environment-specific service diagnostics for preview release validation", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.vercel.requiredEnvironments = ["production"];

    expect(validateReleasePolicy(manifest, "preview")).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "release.service.preview-missing",
        path: "preview.vercel"
      })
    ]);
  });
});
