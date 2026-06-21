import { describe, expect, it } from "vitest";

import { createEasCommandPlan, createEasTarget } from "./eas.js";

describe("eas command planner", () => {
  it("plans preview mobile build targets with internal distribution", () => {
    const target = createEasTarget("preview");

    expect(target).toEqual(
      expect.objectContaining({
        environment: "preview",
        buildProfile: "preview",
        easEnvironment: "preview",
        platform: "all",
        distribution: "internal",
        requiredEnv: ["EXPO_TOKEN"],
        requiresConfirmation: false
      })
    );
    expect(target.projectInitCommand.args).toEqual([
      "pnpm",
      "exec",
      "eas",
      "project:init",
      "--non-interactive"
    ]);
    expect(target.buildCommand.args).toEqual([
      "pnpm",
      "exec",
      "eas",
      "build",
      "-p",
      "all",
      "-e",
      "preview",
      "--json",
      "--non-interactive"
    ]);
  });

  it("plans production mobile build targets with confirmation", () => {
    const target = createEasTarget("production");

    expect(target).toEqual(
      expect.objectContaining({
        environment: "production",
        buildProfile: "production",
        easEnvironment: "production",
        distribution: "store",
        requiredEnv: ["EXPO_TOKEN"],
        requiresConfirmation: true
      })
    );
    expect(target.buildCommand.requiresConfirmation).toBe(true);
  });

  it("maps EAS env operations to redacted env commands", () => {
    const plan = createEasCommandPlan({
      environment: "preview",
      operations: [
        {
          id: "preview.eas.env.set.mobile.EXPO_PUBLIC_API_URL",
          environment: "preview",
          service: "eas",
          kind: "env.set",
          scope: "mobile",
          target: "env:EXPO_PUBLIC_API_URL",
          source: "env.missing",
          summary: "Set EXPO_PUBLIC_API_URL for eas mobile in preview.",
          secret: false,
          requiresConfirmation: false
        },
        {
          id: "preview.eas.env.set.mobile.SENTRY_AUTH_TOKEN",
          environment: "preview",
          service: "eas",
          kind: "env.set",
          scope: "mobile",
          target: "env:SENTRY_AUTH_TOKEN",
          source: "env.drifted",
          summary: "Set SENTRY_AUTH_TOKEN for eas mobile in preview.",
          secret: true,
          requiresConfirmation: false
        },
        {
          id: "preview.eas.env.remove.mobile.LEGACY_FLAG",
          environment: "preview",
          service: "eas",
          kind: "env.remove",
          scope: "mobile",
          target: "env:LEGACY_FLAG",
          source: "env.stale",
          summary: "Remove LEGACY_FLAG for eas mobile in preview.",
          secret: false,
          requiresConfirmation: false
        }
      ],
      includeBuild: true
    });

    expect(plan.commands.map((command) => command.kind)).toEqual([
      "mobile.project.init",
      "mobile.env.list",
      "mobile.build",
      "env.create",
      "env.update",
      "env.delete"
    ]);
    expect(plan.commands[3]).toEqual(
      expect.objectContaining({
        kind: "env.create",
        args: [
          "pnpm",
          "exec",
          "eas",
          "env:create",
          "preview",
          "--name",
          "EXPO_PUBLIC_API_URL",
          "--value",
          "<value from .agentstack/env-values.json>",
          "--environment",
          "preview",
          "--visibility",
          "plaintext",
          "--non-interactive"
        ],
        valueSource: "argument",
        stdinLabel: "<value from .agentstack/env-values.json>"
      })
    );
    expect(plan.commands[4]).toEqual(
      expect.objectContaining({
        kind: "env.update",
        args: [
          "pnpm",
          "exec",
          "eas",
          "env:update",
          "preview",
          "--variable-name",
          "SENTRY_AUTH_TOKEN",
          "--variable-environment",
          "preview",
          "--value",
          "<secret from .agentstack/env-values.json>",
          "--visibility",
          "secret",
          "--non-interactive"
        ],
        valueSource: "argument",
        stdinLabel: "<secret from .agentstack/env-values.json>"
      })
    );
    expect(plan.commands[5]?.args).toEqual([
      "pnpm",
      "exec",
      "eas",
      "env:delete",
      "preview",
      "--variable-name",
      "LEGACY_FLAG",
      "--variable-environment",
      "preview",
      "--non-interactive"
    ]);
    expect(JSON.stringify(plan)).not.toContain("SENTRY_AUTH_TOKEN_VALUE");
  });
});
