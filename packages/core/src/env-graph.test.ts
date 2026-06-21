import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import {
  buildEnvGraph,
  buildProviderEnvResources,
  parseEnvValueState,
  validateCustomEnvValues
} from "./env-graph.js";

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

  it("includes expected env bindings by environment, surface, and name", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex"],
      environments: ["preview", "production"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live"
    };

    const graph = buildEnvGraph(manifest);

    expect(graph.bindings).toEqual([
      {
        environment: "preview",
        surface: "web",
        name: "STRIPE_MODE",
        required: true,
        secret: false,
        validate: "enum:sandbox,live"
      },
      {
        environment: "preview",
        surface: "convex",
        name: "STRIPE_MODE",
        required: true,
        secret: false,
        validate: "enum:sandbox,live"
      },
      {
        environment: "production",
        surface: "web",
        name: "STRIPE_MODE",
        required: true,
        secret: false,
        validate: "enum:sandbox,live"
      },
      {
        environment: "production",
        surface: "convex",
        name: "STRIPE_MODE",
        required: true,
        secret: false,
        validate: "enum:sandbox,live"
      }
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

  it("only creates service nodes for declared required environments", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.vercel.requiredEnvironments = ["preview", "production"];
    manifest.services.eas.requiredEnvironments = ["production"];
    manifest.services.clerk.mode = "external";

    const graph = buildEnvGraph(manifest);

    expect(graph.nodes.map((node) => `${node.environment}:${node.service}:${node.managed}`)).toEqual([
      "development:clerk:false",
      "development:convex:true",
      "preview:clerk:false",
      "preview:convex:true",
      "preview:vercel:true",
      "production:clerk:false",
      "production:convex:true",
      "production:vercel:true",
      "production:eas:true"
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

  it("validates enum custom env values", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live"
    };

    const diagnostics = validateCustomEnvValues(manifest, {
      preview: { convex: { STRIPE_MODE: "test" } }
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "env.custom.invalid-enum",
        path: "preview.convex.STRIPE_MODE"
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
        fix: "Run agentstack env set --env preview --surface convex --name OPENAI_API_KEY --value <value>.",
        blocks: ["validate", "validate --cloud"]
      }
    ]);
  });

  it("maps active custom env bindings to provider env resources with redacted local value hashes", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex"],
      environments: ["preview", "production"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live"
    };
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: true
    };

    const resources = buildProviderEnvResources(manifest, {
      preview: {
        web: { STRIPE_MODE: "sandbox" },
        convex: { STRIPE_MODE: "sandbox", OPENAI_API_KEY: "sk-local-openai" }
      },
      production: {
        web: { STRIPE_MODE: "live" },
        convex: { STRIPE_MODE: "live" }
      }
    });

    expect(resources.map((resource) => `${resource.environment}.${resource.service}.${resource.name}`)).toEqual([
      "preview.vercel.STRIPE_MODE",
      "preview.convex.STRIPE_MODE",
      "production.vercel.STRIPE_MODE",
      "production.convex.STRIPE_MODE",
      "preview.convex.OPENAI_API_KEY"
    ]);
    expect(resources).toEqual([
      expect.objectContaining({
        environment: "preview",
        surface: "web",
        service: "vercel",
        kind: "envVar",
        name: "STRIPE_MODE",
        required: true,
        secret: false,
        valueHash: expect.any(String)
      }),
      expect.objectContaining({
        environment: "preview",
        surface: "convex",
        service: "convex",
        kind: "envVar",
        name: "STRIPE_MODE",
        valueHash: expect.any(String)
      }),
      expect.objectContaining({
        environment: "production",
        surface: "web",
        service: "vercel",
        kind: "envVar",
        name: "STRIPE_MODE",
        valueHash: expect.any(String)
      }),
      expect.objectContaining({
        environment: "production",
        surface: "convex",
        service: "convex",
        kind: "envVar",
        name: "STRIPE_MODE",
        valueHash: expect.any(String)
      }),
      expect.objectContaining({
        environment: "preview",
        surface: "convex",
        service: "convex",
        kind: "envVar",
        name: "OPENAI_API_KEY",
        required: true,
        secret: true,
        valueHash: expect.any(String)
      })
    ]);
    expect(JSON.stringify(resources)).not.toContain("sandbox");
    expect(JSON.stringify(resources)).not.toContain("live");
    expect(JSON.stringify(resources)).not.toContain("sk-local-openai");
  });

  it("routes Clerk-owned env names to the Clerk provider instead of the surface provider", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.CLERK_SECRET_KEY = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: true
    };
    manifest.env.custom.CLERK_WEBHOOK_SIGNING_SECRET = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: true
    };
    manifest.env.custom.VITE_CLERK_PUBLISHABLE_KEY = {
      surfaces: ["web", "mobile"],
      environments: ["preview"],
      required: true,
      secret: false
    };
    manifest.env.custom.CLERK_PUBLISHABLE_KEY = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: false
    };

    const resources = buildProviderEnvResources(manifest, {
      preview: {
        web: {
          CLERK_SECRET_KEY: "sk_test_local",
          VITE_CLERK_PUBLISHABLE_KEY: "pk_test_local",
          CLERK_PUBLISHABLE_KEY: "pk_test_unprefixed"
        },
        convex: { CLERK_WEBHOOK_SIGNING_SECRET: "whsec_local" },
        mobile: { VITE_CLERK_PUBLISHABLE_KEY: "pk_test_mobile" }
      }
    });

    expect(resources.map((resource) => `${resource.service}.${resource.surface}.${resource.name}`)).toEqual([
      "clerk.web.CLERK_SECRET_KEY",
      "clerk.convex.CLERK_WEBHOOK_SIGNING_SECRET",
      "clerk.web.VITE_CLERK_PUBLISHABLE_KEY",
      "clerk.mobile.VITE_CLERK_PUBLISHABLE_KEY",
      "clerk.web.CLERK_PUBLISHABLE_KEY"
    ]);
    expect(JSON.stringify(resources)).not.toContain("sk_test_local");
    expect(JSON.stringify(resources)).not.toContain("whsec_local");
    expect(JSON.stringify(resources)).not.toContain("pk_test_local");
    expect(JSON.stringify(resources)).not.toContain("pk_test_unprefixed");
  });

  it("excludes provider env resources for disabled services and inactive scopes", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["web", "convex"];
    manifest.services.vercel.enabled = false;
    manifest.services.convex.requiredEnvironments = ["production"];
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex", "mobile"],
      environments: ["development", "preview", "production"],
      required: true,
      secret: false
    };

    const resources = buildProviderEnvResources(manifest, {
      preview: {
        web: { STRIPE_MODE: "sandbox" },
        convex: { STRIPE_MODE: "sandbox" },
        mobile: { STRIPE_MODE: "sandbox" }
      },
      production: {
        web: { STRIPE_MODE: "live" },
        convex: { STRIPE_MODE: "live" }
      }
    });

    expect(resources).toEqual([]);
  });

  it("does not require provider env resources for unset optional declarations", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.SENTRY_DSN = {
      surfaces: ["web"],
      environments: ["preview"],
      required: false,
      secret: true
    };

    expect(buildProviderEnvResources(manifest, {})).toEqual([]);
    expect(
      buildProviderEnvResources(manifest, {
        preview: { web: { SENTRY_DSN: "https://example.invalid/123" } }
      })
    ).toEqual([
      expect.objectContaining({
        environment: "preview",
        surface: "web",
        service: "vercel",
        name: "SENTRY_DSN",
        required: false,
        secret: true,
        valueHash: expect.any(String)
      })
    ]);
  });
});
