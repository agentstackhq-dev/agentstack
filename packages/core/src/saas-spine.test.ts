import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { getSaasSpineGeneratedAnchors, hasManagedSaasSpine } from "./saas-spine.js";

describe("managed SaaS spine", () => {
  it("requires generated anchors when Clerk and Convex are enabled", () => {
    const manifest = createDefaultManifest("acme-crm");

    expect(hasManagedSaasSpine(manifest)).toBe(true);
    expect(getSaasSpineGeneratedAnchors(manifest)).toEqual([
      "docs/agentstack/saas-spine.md",
      "packages/domain/src/saas-spine.ts",
      "convex/saasSpine.ts"
    ]);
  });

  it("does not require generated anchors when Clerk is disabled", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.clerk.enabled = false;

    expect(hasManagedSaasSpine(manifest)).toBe(false);
    expect(getSaasSpineGeneratedAnchors(manifest)).toEqual([]);
  });

  it("does not require generated anchors when the Convex surface is disabled", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.surfaces = ["web", "mobile"];

    expect(hasManagedSaasSpine(manifest)).toBe(false);
    expect(getSaasSpineGeneratedAnchors(manifest)).toEqual([]);
  });
});
