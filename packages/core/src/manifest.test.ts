import { describe, expect, it } from "vitest";
import { createDefaultManifest, parseManifest } from "./manifest.js";

describe("manifest parsing", () => {
  it("accepts the default B2B SaaS manifest", () => {
    const manifest = createDefaultManifest("acme-crm");

    expect(manifest.frameworkVersion).toBe("0.0.0");
    expect(manifest.guidanceVersion).toBe("2026-06-20");
    expect(manifest.app.slug).toBe("acme-crm");
    expect(manifest.environments).toEqual(["development", "preview", "production"]);
    expect(manifest.surfaces).toEqual(["web", "mobile", "convex"]);
    expect(manifest.services.clerk).toEqual({
      enabled: true,
      provider: "clerk",
      mode: "managed",
      requiredEnvironments: ["development", "preview", "production"]
    });
    expect(manifest.telemetry.enabled).toBe(true);
    expect(manifest.telemetry.environments.production).toEqual({
      required: true,
      level: "journey"
    });
    expect(manifest.generated.requiredAnchors).toEqual([]);
  });

  it("parses the default B2B SaaS manifest", () => {
    const result = parseManifest(createDefaultManifest("acme-crm"));

    expect(result.ok).toBe(true);
  });

  it("returns diagnostics for invalid manifests", () => {
    const result = parseManifest({
      app: { name: "", slug: "Bad Slug" },
      environments: ["development"],
      surfaces: ["web"],
      services: {},
      telemetry: { enabled: true, exporter: "otlp" }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("manifest.invalid");
    }
  });

  it("parses service provider config, telemetry environment policy, and generated anchors", () => {
    const result = parseManifest({
      ...createDefaultManifest("acme-crm"),
      frameworkVersion: "1.2.3",
      guidanceVersion: "2026-06-20",
      services: {
        clerk: {
          enabled: true,
          provider: "clerk",
          mode: "external",
          requiredEnvironments: ["preview", "production"]
        },
        convex: {
          enabled: true,
          provider: "convex",
          mode: "managed",
          requiredEnvironments: ["development", "preview", "production"]
        },
        vercel: {
          enabled: true,
          provider: "vercel",
          mode: "managed",
          requiredEnvironments: ["preview", "production"]
        },
        eas: {
          enabled: false,
          provider: "eas",
          mode: "manual",
          requiredEnvironments: []
        }
      },
      telemetry: {
        enabled: true,
        exporter: "local",
        environments: {
          development: { required: false, level: "debug" },
          preview: { required: true, level: "journey" },
          production: { required: true, level: "audit" }
        },
        redaction: {
          defaultPolicy: "strict",
          forbidRawSecrets: true
        }
      },
      generated: {
        requiredAnchors: ["docs/agentstack/auth.md", "packages/config/src/index.ts"]
      }
    });

    expect(result.ok).toBe(true);
  });

  it("accepts custom env provider targets and defaults source to local-value", () => {
    const result = parseManifest({
      ...createDefaultManifest("acme-crm"),
      env: {
        custom: {
          STRIPE_MODE: {
            surfaces: ["web", "convex"],
            environments: ["preview", "production"],
            required: true,
            secret: false,
            providerTargets: [
              {
                service: "vercel",
                surfaces: ["web"],
                environments: ["preview", "production"]
              },
              {
                service: "convex",
                surfaces: ["convex"],
                environments: ["preview", "production"],
                source: "provider-owned"
              }
            ]
          }
        }
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.env.custom.STRIPE_MODE.providerTargets).toEqual([
        {
          service: "vercel",
          surfaces: ["web"],
          environments: ["preview", "production"],
          source: "local-value"
        },
        {
          service: "convex",
          surfaces: ["convex"],
          environments: ["preview", "production"],
          source: "provider-owned"
        }
      ]);
    }
  });

  it("rejects custom env declarations without provider targets", () => {
    const result = parseManifest({
      ...createDefaultManifest("acme-crm"),
      env: {
        custom: {
          STRIPE_MODE: {
            surfaces: ["web"],
            environments: ["preview"],
            required: true,
            secret: false
          }
        }
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: "manifest.invalid",
          path: "env.custom.STRIPE_MODE.providerTargets",
          message: "Required"
        })
      ]);
    }
  });

  it("rejects provider targets outside the declaration scope", () => {
    const result = parseManifest({
      ...createDefaultManifest("acme-crm"),
      env: {
        custom: {
          STRIPE_MODE: {
            surfaces: ["web"],
            environments: ["preview"],
            required: true,
            secret: false,
            providerTargets: [
              {
                service: "vercel",
                surfaces: ["web", "convex"],
                environments: ["preview", "production"]
              }
            ]
          }
        }
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: "manifest.invalid",
          path: "env.custom.STRIPE_MODE.providerTargets.0.surfaces.1"
        }),
        expect.objectContaining({
          code: "manifest.invalid",
          path: "env.custom.STRIPE_MODE.providerTargets.0.environments.1"
        })
      ]);
    }
  });

  it("rejects provider targets for disabled services and inactive service environments", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.vercel.enabled = false;
    manifest.services.convex.requiredEnvironments = ["production"];

    const result = parseManifest({
      ...manifest,
      env: {
        custom: {
          STRIPE_MODE: {
            surfaces: ["web", "convex"],
            environments: ["preview"],
            required: true,
            secret: false,
            providerTargets: [
              {
                service: "vercel",
                surfaces: ["web"],
                environments: ["preview"]
              },
              {
                service: "convex",
                surfaces: ["convex"],
                environments: ["preview"]
              }
            ]
          }
        }
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: "manifest.invalid",
          path: "env.custom.STRIPE_MODE.providerTargets.0.service"
        }),
        expect.objectContaining({
          code: "manifest.invalid",
          path: "env.custom.STRIPE_MODE.providerTargets.1.environments.0"
        })
      ]);
    }
  });

  it("rejects unknown top-level keys", () => {
    const result = parseManifest({
      ...createDefaultManifest("acme-crm"),
      typo: true
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("manifest.invalid");
    }
  });

  it("throws when creating a default manifest with an invalid slug", () => {
    expect(() => createDefaultManifest("")).toThrow();
  });
});
