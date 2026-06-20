import { describe, expect, it } from "vitest";
import { createDefaultManifest, parseManifest } from "./manifest.js";

describe("manifest parsing", () => {
  it("accepts the default B2B SaaS manifest", () => {
    const manifest = createDefaultManifest("acme-crm");

    expect(manifest.app.slug).toBe("acme-crm");
    expect(manifest.environments).toEqual(["development", "preview", "production"]);
    expect(manifest.surfaces).toEqual(["web", "mobile", "convex"]);
    expect(manifest.telemetry.enabled).toBe(true);
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
