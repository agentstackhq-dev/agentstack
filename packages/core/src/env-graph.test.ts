import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { buildEnvGraph, validateCustomEnvValues } from "./env-graph.js";

describe("environment graph", () => {
  it("creates service nodes for each environment", () => {
    const manifest = createDefaultManifest("acme-crm");
    const graph = buildEnvGraph(manifest);

    expect(graph.nodes.map((node) => `${node.environment}:${node.service}`)).toContain("preview:clerk");
    expect(graph.nodes.map((node) => `${node.environment}:${node.service}`)).toContain("production:eas");
  });

  it("validates scoped custom env values", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["convex"],
      environments: ["development", "preview", "production"],
      required: true,
      secret: true
    };

    const diagnostics = validateCustomEnvValues(manifest, {
      development: { convex: { OPENAI_API_KEY: "dev-key" } },
      preview: { convex: {} },
      production: { convex: { OPENAI_API_KEY: "prod-key" } }
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "env.custom.missing",
        path: "preview.convex.OPENAI_API_KEY"
      })
    ]);
  });
});
