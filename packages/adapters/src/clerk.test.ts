import { describe, expect, it } from "vitest";

import { createClerkCommandPlan, createClerkTarget } from "./clerk.js";

describe("clerk command planner", () => {
  it("plans preview setup with agent-safe Clerk CLI commands", () => {
    const target = createClerkTarget("preview");

    expect(target).toEqual(
      expect.objectContaining({
        environment: "preview",
        clerkEnvironment: "development",
        applicationSelector: "<clerk-development-application>",
        requiredEnv: [],
        requiresConfirmation: false
      })
    );
    expect(target.bootstrapCommand.args).toEqual(["pnpm", "exec", "clerk", "init", "-y"]);
    expect(target.diagnosticsCommand.args).toEqual([
      "pnpm",
      "exec",
      "clerk",
      "doctor",
      "--mode",
      "agent"
    ]);
  });

  it("plans production setup with production status and confirmation", () => {
    const target = createClerkTarget("production");

    expect(target).toEqual(
      expect.objectContaining({
        environment: "production",
        clerkEnvironment: "production",
        applicationSelector: "<clerk-production-application>",
        requiredEnv: ["CLERK_SECRET_KEY"],
        requiresConfirmation: true
      })
    );
    expect(target.productionStatusCommand?.args).toEqual([
      "pnpm",
      "exec",
      "clerk",
      "deploy",
      "--mode",
      "agent"
    ]);
  });

  it("maps Clerk env operations to redacted env pull and config inspection commands", () => {
    const plan = createClerkCommandPlan({
      environment: "preview",
      operations: [
        {
          id: "preview.clerk.env.set.web.CLERK_SECRET_KEY",
          environment: "preview",
          service: "clerk",
          kind: "env.set",
          scope: "web",
          target: "env:CLERK_SECRET_KEY",
          source: "env.missing",
          summary: "Set CLERK_SECRET_KEY for clerk web in preview.",
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
          source: "env.missing",
          summary: "Set PUBLIC_URL for vercel web in preview.",
          secret: false,
          requiresConfirmation: false
        }
      ],
      includeBootstrap: true
    });

    expect(plan.commands.map((command) => command.kind)).toEqual([
      "auth.bootstrap",
      "auth.diagnostics",
      "auth.env.pull",
      "auth.config.pull",
      "env.pull"
    ]);
    expect(plan.commands.at(-1)).toEqual(
      expect.objectContaining({
        id: "preview.clerk.env.set.web.CLERK_SECRET_KEY",
        kind: "env.pull",
        args: ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
        secret: true,
        valueSource: "clerk-dashboard"
      })
    );
    expect(JSON.stringify(plan)).not.toContain("sk_");
  });

  it("maps stale Clerk env operations to provider-owned review commands", () => {
    const plan = createClerkCommandPlan({
      environment: "production",
      operations: [
        {
          id: "production.clerk.env.remove.web.LEGACY_CLERK_KEY",
          environment: "production",
          service: "clerk",
          kind: "env.remove",
          scope: "web",
          target: "env:LEGACY_CLERK_KEY",
          source: "env.stale",
          summary: "Remove LEGACY_CLERK_KEY for clerk web in production.",
          secret: true,
          requiresConfirmation: true
        }
      ],
      includeBootstrap: false
    });

    expect(plan.commands).toEqual([
      expect.objectContaining({
        id: "production.clerk.env.remove.web.LEGACY_CLERK_KEY",
        kind: "env.review",
        args: ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
        valueSource: "clerk-dashboard",
        stdinLabel: "<review in Clerk Dashboard / clerk env pull>",
        secret: true,
        requiresConfirmation: true
      })
    ]);
  });
});
