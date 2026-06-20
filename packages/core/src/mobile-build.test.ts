import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { createMobileBuildPlan } from "./mobile-build.js";
import { getRequiredGeneratedAnchors } from "./validation.js";

describe("createMobileBuildPlan", () => {
  it("normalizes the development build profile", () => {
    const result = createMobileBuildPlan(createDefaultManifest("acme-crm"), "development", {
      apply: false
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        environment: "development",
        profile: "development",
        distribution: "internal",
        developmentClient: true,
        applied: false,
        artifactPath: ".agentstack/builds/mobile-development.json"
      });
    }
  });

  it("normalizes the preview build profile", () => {
    const result = createMobileBuildPlan(createDefaultManifest("acme-crm"), "preview", { apply: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.profile).toBe("preview");
      expect(result.value.distribution).toBe("internal");
      expect(result.value.developmentClient).toBe(false);
      expect(result.value.applied).toBe(true);
    }
  });

  it("requires explicit production confirmation for production apply", () => {
    const result = createMobileBuildPlan(createDefaultManifest("acme-crm"), "production", {
      apply: true
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "mobile.build.production-confirmation.required",
        path: "production.mobile",
        blocks: ["build mobile"]
      })
    ]);
  });

  it("fails when mobile surface is disabled", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.surfaces = ["web", "convex"];

    const result = createMobileBuildPlan(manifest, "preview", { apply: false });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "mobile.surface.disabled" })]);
  });

  it("fails when EAS service is disabled for the environment", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.eas.requiredEnvironments = ["development"];

    const result = createMobileBuildPlan(manifest, "preview", { apply: false });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "mobile.eas.disabled" })]);
  });

  it("requires generated mobile build anchors when mobile is enabled", () => {
    expect(getRequiredGeneratedAnchors(createDefaultManifest("acme-crm"))).toEqual(
      expect.arrayContaining([
        "apps/mobile/app.config.ts",
        "apps/mobile/eas.json",
        "docs/agentstack/mobile.md"
      ])
    );
  });
});
