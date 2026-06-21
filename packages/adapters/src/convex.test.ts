import { createDefaultManifest } from "@agentstack/core";
import { describe, expect, it } from "vitest";

import { createConvexCommandPlan, createConvexTarget } from "./convex.js";

describe("convex command planner", () => {
  it("plans preview target commands with preview deploy key requirements", () => {
    const manifest = createDefaultManifest("acme-crm");
    const target = createConvexTarget(manifest, "preview");

    expect(target).toEqual(
      expect.objectContaining({
        environment: "preview",
        previewName: "acme-crm-preview",
        deploymentSelector: "<preview-deployment-name>",
        requiredEnv: ["CONVEX_DEPLOY_KEY"],
        requiresConfirmation: false
      })
    );
    expect(target.deployCommand.args).toEqual([
      "pnpm",
      "exec",
      "convex",
      "deploy",
      "--preview-name",
      "acme-crm-preview"
    ]);
  });

  it("plans production target commands with confirmation", () => {
    const manifest = createDefaultManifest("acme-crm");
    const target = createConvexTarget(manifest, "production");

    expect(target.deploymentSelector).toBe("prod");
    expect(target.requiredEnv).toEqual(["CONVEX_DEPLOY_KEY"]);
    expect(target.requiresConfirmation).toBe(true);
    expect(target.envScopeArgs).toEqual(["--prod"]);
    expect(target.deployCommand.args).toEqual(["pnpm", "exec", "convex", "deploy"]);
  });

  it("plans backend deploy and redacted env commands for Convex operations", () => {
    const manifest = createDefaultManifest("acme-crm");
    const plan = createConvexCommandPlan({
      manifest,
      environment: "preview",
      operations: [
        {
          id: "preview.convex.env.set.convex.OPENAI_API_KEY",
          environment: "preview",
          service: "convex",
          kind: "env.set",
          scope: "convex",
          target: "env:OPENAI_API_KEY",
          summary: "Set OPENAI_API_KEY for convex convex in preview.",
          secret: true,
          requiresConfirmation: false
        },
        {
          id: "preview.vercel.env.set.web.PUBLIC_URL",
          environment: "preview",
          service: "vercel",
          kind: "env.set",
          scope: "web",
          target: "env:PUBLIC_URL",
          summary: "Set PUBLIC_URL for vercel web in preview.",
          secret: false,
          requiresConfirmation: false
        }
      ],
      includeDeploy: true
    });

    expect(plan.commands.map((command) => command.kind)).toEqual(["backend.deploy", "env.set"]);
    expect(plan.commands[0]?.args).toEqual([
      "pnpm",
      "exec",
      "convex",
      "deploy",
      "--preview-name",
      "acme-crm-preview"
    ]);
    expect(plan.commands[1]).toEqual(
      expect.objectContaining({
        id: "preview.convex.env.set.convex.OPENAI_API_KEY",
        kind: "env.set",
        valueSource: "stdin",
        stdinLabel: "<secret from .agentstack/env-values.json>"
      })
    );
    expect(plan.commands[1]?.args).toEqual([
      "pnpm",
      "exec",
      "convex",
      "env",
      "--deployment",
      "<preview-deployment-name>",
      "set",
      "OPENAI_API_KEY"
    ]);
    expect(JSON.stringify(plan)).not.toContain("sk-");
  });

  it("plans production env removal with canonical Convex env option ordering", () => {
    const manifest = createDefaultManifest("acme-crm");
    const plan = createConvexCommandPlan({
      manifest,
      environment: "production",
      operations: [
        {
          id: "production.convex.env.remove.convex.LEGACY_KEY",
          environment: "production",
          service: "convex",
          kind: "env.remove",
          scope: "convex",
          target: "env:LEGACY_KEY",
          summary: "Remove LEGACY_KEY for convex convex in production.",
          secret: true,
          requiresConfirmation: true
        }
      ],
      includeDeploy: false
    });

    expect(plan.commands).toEqual([
      expect.objectContaining({
        id: "production.convex.env.remove.convex.LEGACY_KEY",
        kind: "env.remove",
        requiresConfirmation: true,
        args: ["pnpm", "exec", "convex", "env", "--prod", "remove", "LEGACY_KEY"]
      })
    ]);
  });
});
