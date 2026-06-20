import { describe, expect, it } from "vitest";
import { createDefaultManifest, expectedAgentstackGuidanceVersion } from "./manifest.js";
import {
  getGuidanceGeneratedAnchors,
  validateGuidancePolicy
} from "./guidance.js";

describe("guidance policy", () => {
  it("declares the expected Agentstack guidance version", () => {
    expect(expectedAgentstackGuidanceVersion).toBe("2026-06-20");
  });

  it("keeps the default manifest guidance version aligned with the expected guidance version", () => {
    expect(createDefaultManifest("acme-crm").guidanceVersion).toBe(
      expectedAgentstackGuidanceVersion
    );
  });

  it("includes Agentstack guidance generated anchors", () => {
    expect(getGuidanceGeneratedAnchors(createDefaultManifest("acme-crm"))).toEqual(
      expect.arrayContaining([
        "skills/agentstack/SKILL.md",
        "skills/agentstack/references/workflows.md",
        "skills/agentstack/references/guardrails.md",
        "skills/agentstack/references/observability.md",
        "docs/agentstack/skills.md"
      ])
    );
  });

  it("warns when the manifest guidance version is stale", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.guidanceVersion = "2026-06-19";

    expect(validateGuidancePolicy(manifest)).toEqual([
      expect.objectContaining({
        severity: "warn",
        code: "guidance.version.stale",
        path: "guidanceVersion"
      })
    ]);
  });
});
