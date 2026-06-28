import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { defaultThemeTokens, validateThemeTokens } from "./theme.js";
import { getRequiredGeneratedAnchors } from "./validation.js";

describe("validateThemeTokens", () => {
  it("accepts the default Agentstack theme token contract", () => {
    expect(validateThemeTokens(defaultThemeTokens)).toEqual([]);
  });

  it("reports missing required token paths with deploy-blocking diagnostics", () => {
    const tokens = structuredClone(defaultThemeTokens) as Record<string, unknown>;
    delete (tokens.colors as Record<string, unknown>).focusRing;

    const diagnostics = validateThemeTokens(tokens);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "theme.tokens.missing",
        path: "packages/theme/tokens.json:colors.focusRing",
        blocks: ["validate", "validate --cloud", "deploy"]
      })
    ]);
  });

  it("reports invalid token value types", () => {
    const tokens = structuredClone(defaultThemeTokens) as Record<string, unknown>;
    (tokens.spacing as Record<string, unknown>).md = "16px";

    const diagnostics = validateThemeTokens(tokens);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "theme.tokens.invalid",
        path: "packages/theme/tokens.json:spacing.md"
      })
    ]);
  });

  it("reports malformed token object shape", () => {
    const diagnostics = validateThemeTokens(null);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "theme.tokens.invalid",
        path: "packages/theme/tokens.json",
        blocks: ["validate", "validate --cloud", "deploy"]
      })
    ]);
  });
});

describe("theme generated anchors", () => {
  it("does not require copied generated theme package anchors", () => {
    expect(getRequiredGeneratedAnchors(createDefaultManifest("acme-crm"))).not.toEqual(
      expect.arrayContaining([
        "packages/theme/package.json",
        "packages/theme/tokens.json",
        "packages/theme/src/index.ts"
      ])
    );
  });
});
