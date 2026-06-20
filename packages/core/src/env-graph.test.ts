import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { buildEnvGraph, parseEnvValueState, validateCustomEnvValues } from "./env-graph.js";

describe("environment graph", () => {
  it("creates service nodes for each environment", () => {
    const manifest = createDefaultManifest("acme-crm");
    const graph = buildEnvGraph(manifest);

    expect(graph.nodes.map((node) => `${node.environment}:${node.service}`)).toEqual([
      "development:clerk",
      "development:convex",
      "development:vercel",
      "development:eas",
      "preview:clerk",
      "preview:convex",
      "preview:vercel",
      "preview:eas",
      "production:clerk",
      "production:convex",
      "production:vercel",
      "production:eas"
    ]);
  });

  it("excludes disabled services", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.eas.enabled = false;
    manifest.services.vercel.enabled = false;

    const graph = buildEnvGraph(manifest);

    expect(graph.nodes.map((node) => `${node.environment}:${node.service}`)).toEqual([
      "development:clerk",
      "development:convex",
      "preview:clerk",
      "preview:convex",
      "production:clerk",
      "production:convex"
    ]);
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

  it("parses local env value state with string leaves", () => {
    const result = parseEnvValueState({
      preview: { convex: { OPENAI_API_KEY: "replace-me" } }
    });

    expect(result).toEqual({
      ok: true,
      value: { preview: { convex: { OPENAI_API_KEY: "replace-me" } } },
      diagnostics: []
    });
  });

  it("rejects local env value state with non-string leaves", () => {
    const result = parseEnvValueState({
      preview: { convex: { OPENAI_API_KEY: true } }
    });

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "env.values.invalid-shape",
          path: "preview.convex.OPENAI_API_KEY"
        })
      ]
    });
  });

  it("ignores required custom env scopes outside active manifest scopes", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["production"];
    manifest.surfaces = ["web"];
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["web", "convex"],
      environments: ["preview", "production"],
      required: true,
      secret: true
    };

    const diagnostics = validateCustomEnvValues(manifest, {
      production: { web: { OPENAI_API_KEY: "prod-key" } }
    });

    expect(diagnostics).toEqual([]);
  });

  it("reports required custom env values only for the active scoped surface and environment", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview", "production"];
    manifest.surfaces = ["web", "convex"];
    manifest.env.custom.STRIPE_SECRET_KEY = {
      surfaces: ["convex"],
      environments: ["production"],
      required: true,
      secret: true
    };

    const diagnostics = validateCustomEnvValues(manifest, {
      preview: { convex: {} },
      production: { web: {}, convex: {} }
    });

    expect(diagnostics.map((diagnostic) => diagnostic.path)).toEqual(["production.convex.STRIPE_SECRET_KEY"]);
  });

  it("does not report missing values for optional custom env declarations", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.SENTRY_DSN = {
      surfaces: ["web"],
      environments: ["production"],
      required: false,
      secret: true
    };

    const diagnostics = validateCustomEnvValues(manifest, {
      production: { web: {} }
    });

    expect(diagnostics).toEqual([]);
  });

  it("includes the full diagnostic shape for missing custom env values", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["convex"];
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: true
    };

    const diagnostics = validateCustomEnvValues(manifest, {
      preview: { convex: {} }
    });

    expect(diagnostics).toEqual([
      {
        severity: "fail",
        code: "env.custom.missing",
        path: "preview.convex.OPENAI_API_KEY",
        message: "OPENAI_API_KEY is required for convex in preview, but no value is present.",
        fix: "Add preview.convex.OPENAI_API_KEY to .agentstack/env-values.json.",
        blocks: ["validate", "validate --cloud"]
      }
    ]);
  });
});
