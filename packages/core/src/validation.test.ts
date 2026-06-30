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
    manifest.generated.requiredAnchors = ["apps/web/src/acme-dashboard.tsx", "apps/convex/convex/acme.ts"];

    expect(getRequiredGeneratedAnchors(manifest)).toEqual(
      expect.arrayContaining(["apps/web/src/acme-dashboard.tsx", "apps/convex/convex/acme.ts"])
    );
  });

  it("requires only the lean generated app surface as source anchors", () => {
    expect(getRequiredGeneratedAnchors(createDefaultManifest("acme-crm"))).toEqual(
      expect.arrayContaining([
        "AGENTS.md",
        ".gitignore",
        "package.json",
        "agentstack.config.ts",
        "apps/web/package.json",
        "apps/mobile/package.json",
        "apps/convex/package.json",
        "apps/convex/tsconfig.json",
        "apps/convex/convex/schema.ts",
        "apps/convex/convex/auth.config.ts",
        "apps/convex/convex/workspaceStatus.ts",
        "apps/convex/convex/_generated/api.d.ts",
        "apps/convex/convex/_generated/api.js",
        "apps/convex/convex/_generated/dataModel.d.ts",
        "apps/convex/convex/_generated/server.d.ts",
        "apps/convex/convex/_generated/server.js"
      ])
    );

    expect(getRequiredGeneratedAnchors(createDefaultManifest("acme-crm"))).not.toEqual(
      expect.arrayContaining([
        "agentstack.config.json",
        "scripts/agentstack.mjs",
        "docs/agentstack/workflows.md",
        "skills/agentstack/SKILL.md",
        "convex/schema.ts",
        "packages/domain/src/index.ts"
      ])
    );
  });

  it("does not duplicate required anchors when the manifest also declares generated guidance files", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.generated.requiredAnchors = ["AGENTS.md", "apps/web/package.json"];

    const anchors = getRequiredGeneratedAnchors(manifest);

    expect(anchors.filter((anchor) => anchor === "AGENTS.md")).toHaveLength(1);
    expect(anchors.filter((anchor) => anchor === "apps/web/package.json")).toHaveLength(1);
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
    manifest.generated.requiredAnchors = ["apps/web/src/acme-dashboard.tsx"];

    const result = validateGeneratedAnchors({
      manifest,
      missingPaths: ["apps/web/src/acme-dashboard.tsx"]
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "template.anchor.missing",
        path: "apps/web/src/acme-dashboard.tsx"
      })
    ]);
  });

  it("fails generated anchor validation for missing lean app anchors", () => {
    const manifest = createDefaultManifest("acme-crm");

    const result = validateGeneratedAnchors({
      manifest,
      missingPaths: [
        "agentstack.config.ts",
        "apps/web/src/index.ts",
        "apps/mobile/App.tsx",
        "apps/mobile/src/index.ts",
        "apps/convex/convex/schema.ts"
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "template.anchor.missing",
        path: "agentstack.config.ts"
      }),
      expect.objectContaining({
        code: "template.anchor.missing",
        path: "apps/web/src/index.ts"
      }),
      expect.objectContaining({
        code: "template.anchor.missing",
        path: "apps/mobile/App.tsx"
      }),
      expect.objectContaining({
        code: "template.anchor.missing",
        path: "apps/mobile/src/index.ts"
      }),
      expect.objectContaining({
        code: "template.anchor.missing",
        path: "apps/convex/convex/schema.ts"
      })
    ]);
  });
});
