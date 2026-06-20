import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import {
  createLifecycleSummary,
  recommendLifecycleCommands,
  type LifecycleCloudSummary
} from "./lifecycle.js";

describe("lifecycle summaries", () => {
  it("summarizes manifest, anchors, and healthy cloud state", () => {
    const manifest = createDefaultManifest("acme-crm");
    const cloud: LifecycleCloudSummary = {
      environment: "preview",
      expectedServices: ["clerk", "convex"],
      linkedServices: ["clerk", "convex"],
      missingServices: [],
      staleServices: [],
      expectedEnv: [],
      syncedEnv: [],
      missingEnv: [],
      staleEnv: [],
      driftedEnv: []
    };

    const summary = createLifecycleSummary({
      manifest,
      environment: "preview",
      requiredAnchors: ["AGENTS.md", "package.json"],
      missingAnchors: [],
      diagnostics: [],
      cloud
    });

    expect(summary.status).toBe("pass");
    expect(summary.app.slug).toBe("acme-crm");
    expect(summary.generated.missing).toEqual([]);
    expect(summary.cloud?.linkedServices).toEqual(["clerk", "convex"]);
  });

  it("fails when validation diagnostics include failures", () => {
    const manifest = createDefaultManifest("acme-crm");
    const summary = createLifecycleSummary({
      manifest,
      environment: "preview",
      requiredAnchors: ["AGENTS.md"],
      missingAnchors: ["AGENTS.md"],
      diagnostics: [
        {
          severity: "fail",
          code: "template.anchor.missing",
          path: "AGENTS.md",
          message: "Required generated file is missing: AGENTS.md.",
          fix: "Restore the generated anchor.",
          blocks: ["validate"]
        }
      ]
    });

    expect(summary.status).toBe("fail");
    expect(summary.generated.missing).toEqual(["AGENTS.md"]);
  });

  it("warns when local cloud links are missing", () => {
    const manifest = createDefaultManifest("acme-crm");
    const summary = createLifecycleSummary({
      manifest,
      environment: "preview",
      requiredAnchors: ["AGENTS.md"],
      missingAnchors: [],
      diagnostics: [],
      cloud: {
        environment: "preview",
        expectedServices: ["clerk", "convex"],
        linkedServices: ["clerk"],
        missingServices: ["convex"],
        staleServices: [],
        expectedEnv: [],
        syncedEnv: [],
        missingEnv: [],
        staleEnv: [],
        driftedEnv: []
      }
    });

    expect(summary.status).toBe("warn");
    expect(summary.cloud?.missingServices).toEqual(["convex"]);
    expect(summary.nextCommands).toEqual([
      "agentstack sync --env preview --apply",
      "agentstack validate --cloud --env preview"
    ]);
  });

  it("recommends repair commands from diagnostics before generic next steps", () => {
    expect(
      recommendLifecycleCommands({
        environment: "preview",
        diagnostics: [
          {
            severity: "fail",
            code: "cloud.service.missing",
            message: "convex is not linked in preview.",
            fix: "Run agentstack sync --env preview --apply.",
            blocks: ["validate --cloud"]
          }
        ],
        cloudMissing: ["convex"]
      })
    ).toEqual(["agentstack sync --env preview --apply", "agentstack validate --cloud --env preview"]);
  });
});
