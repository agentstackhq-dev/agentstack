import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { getRequiredGeneratedAnchors, validateGeneratedAnchors, validateLocalProject } from "./validation.js";

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

  it("includes manifest-declared generated anchors in required anchors", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.generated.requiredAnchors = ["docs/agentstack/auth.md", "packages/config/src/index.ts"];

    expect(getRequiredGeneratedAnchors(manifest)).toEqual(
      expect.arrayContaining(["docs/agentstack/auth.md", "packages/config/src/index.ts"])
    );
  });

  it("includes managed SaaS spine generated anchors in required anchors", () => {
    expect(getRequiredGeneratedAnchors(createDefaultManifest("acme-crm"))).toEqual(
      expect.arrayContaining([
        "docs/agentstack/saas-spine.md",
        "packages/domain/src/saas-spine.ts",
        "convex/saasSpine.ts"
      ])
    );
  });

  it("includes Agentstack guidance generated anchors in required anchors", () => {
    expect(getRequiredGeneratedAnchors(createDefaultManifest("acme-crm"))).toEqual(
      expect.arrayContaining([
        "skills/agentstack/SKILL.md",
        "skills/agentstack/references/workflows.md",
        "skills/agentstack/references/guardrails.md",
        "skills/agentstack/references/observability.md",
        "docs/agentstack/skills.md"
      ])
    );
  });

  it("does not duplicate required anchors when the manifest also declares generated guidance files", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.generated.requiredAnchors = ["skills/agentstack/SKILL.md", "docs/agentstack/skills.md"];

    const anchors = getRequiredGeneratedAnchors(manifest);

    expect(anchors.filter((anchor) => anchor === "skills/agentstack/SKILL.md")).toHaveLength(1);
    expect(anchors.filter((anchor) => anchor === "docs/agentstack/skills.md")).toHaveLength(1);
  });

  it("includes stale guidance warnings without failing local validation", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.guidanceVersion = "2026-06-19";

    const result = validateLocalProject({ manifest, envValues: {} });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        severity: "warn",
        code: "guidance.version.stale",
        path: "guidanceVersion"
      })
    ]);
  });

  it("fails generated anchor validation for missing manifest-declared anchors", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.generated.requiredAnchors = ["docs/agentstack/auth.md"];

    const result = validateGeneratedAnchors({
      manifest,
      missingPaths: ["docs/agentstack/auth.md"]
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "template.anchor.missing",
        path: "docs/agentstack/auth.md"
      })
    ]);
  });
});
