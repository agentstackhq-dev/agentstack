import { describe, expect, it } from "vitest";

import { createEasCommandPlan, createEasTarget, inspectEasPreviewReadOnly } from "./eas.js";

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

  it("executes only preview env-list for EAS inspect and redacts provider output", async () => {
    const executions: Array<{ command: string; args: string[] }> = [];
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute(command, args) {
          executions.push({ command, args });
          return {
            exitCode: 0,
            stdout: [
              "Name              Value             Environment",
              "SENTRY_AUTH_TOKEN  Encrypted         preview",
              "API_TOKEN         Encrypted         development"
            ].join("\n"),
            stderr: "",
            durationMs: 6
          };
        }
      },
      secretValues: ["secret-token"]
    });

    expect(executions).toEqual([
      { command: "pnpm", args: ["exec", "eas", "env:list", "--environment", "preview"] }
    ]);
    expect(results).toEqual([
      expect.objectContaining({
        service: "eas",
        environment: "preview",
        commandKind: "mobile.env.list",
        status: "success",
        liveIdentityFacts: {
          identityConfidence: "partial",
          facts: ["expected-env-names", "preview-environment", "env-list-read"]
        },
        outputRedacted: true
      })
    ]);
    expect(JSON.stringify(results)).not.toContain("secret-token");
  });

  it("parses EAS preview env-list partial facts from pipe-delimited table rows", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: [
              "+---------------------+-----------+-------------+",
              "| Name                | Value     | Environment |",
              "+---------------------+-----------+-------------+",
              "| EXPO_PUBLIC_APP_URL | Plaintext | preview     |",
              "+---------------------+-----------+-------------+"
            ].join("\n"),
            stderr: "",
            durationMs: 6
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toEqual({
      identityConfidence: "partial",
      facts: ["expected-env-names", "preview-environment", "env-list-read"]
    });
  });

  it("parses EAS preview env-list partial facts from single-space table rows", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: ["Name Value Environment", "API_TOKEN Encrypted preview"].join("\n"),
            stderr: "",
            durationMs: 6
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toEqual({
      identityConfidence: "partial",
      facts: ["expected-env-names", "preview-environment", "env-list-read"]
    });
  });

  it("does not infer EAS env-list facts from loose preview env prose", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "preview has EXPO_PUBLIC_APP_URL somewhere, app-secret, https://secret.example.test",
            stderr: "",
            durationMs: 1
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(results[0]?.stdoutSummary).not.toContain("EXPO_PUBLIC_APP_URL");
    expect(results[0]?.stdoutSummary).not.toContain("https://secret.example.test");
  });

  it("requires EAS expected env name and preview environment in the same parsed row", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: ["Name Environment", "EXPO_PUBLIC_APP_URL production", "UNRELATED_FLAG preview"].join("\n"),
            stderr: "",
            durationMs: 1
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
  });

  it("parses EAS preview env-list partial facts from comma-separated environment cells", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: [
              "Name              Value             Environments",
              "SENTRY_AUTH_TOKEN  Encrypted         development,preview"
            ].join("\n"),
            stderr: "",
            durationMs: 6
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toEqual({
      identityConfidence: "partial",
      facts: ["expected-env-names", "preview-environment", "env-list-read"]
    });
  });

  it("keeps EAS inspect ambiguous when loose env output mentions preview and an expected name", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "Environment: preview\nSENTRY_AUTH_TOKEN=secret-token",
            stderr: "",
            durationMs: 6
          };
        }
      },
      secretValues: ["secret-token"]
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("secret-token");
    expect(JSON.stringify(results)).not.toContain("preview-environment");
  });

  it("keeps EAS inspect ambiguous when expected env names lack preview proof", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: [
              "Name              Value             Environment",
              "SENTRY_AUTH_TOKEN  Encrypted         production"
            ].join("\n"),
            stderr: "",
            durationMs: 6
          };
        }
      },
      secretValues: ["secret-token"]
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("secret-token");
    expect(JSON.stringify(results)).not.toContain("preview-environment");
  });

  it("keeps EAS inspect ambiguous when preview appears only in prose or values", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: [
              "Preview environment variables are available at https://preview.example.test",
              "Name              Value                         Environment",
              "SENTRY_AUTH_TOKEN  https://preview.example.test production"
            ].join("\n"),
            stderr: "",
            durationMs: 6
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("preview-environment");
    expect(JSON.stringify(results)).not.toContain("https://preview.example.test");
  });

  it("keeps EAS inspect ambiguous when preview rows contain only unexpected env names", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: [
              "Name              Value             Environment",
              "UNEXPECTED_TOKEN  Encrypted         preview"
            ].join("\n"),
            stderr: "",
            durationMs: 6
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("preview-environment");
  });

  it("keeps EAS inspect ambiguous when env-list exits nonzero", async () => {
    const results = await inspectEasPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 1,
            stdout: [
              "Name              Value             Environment",
              "SENTRY_AUTH_TOKEN Encrypted         preview"
            ].join("\n"),
            stderr: "read failed",
            durationMs: 6
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("preview-environment");
  });

  it("rejects EAS production inspect without executing", async () => {
    const executions: string[] = [];

    await expect(
      inspectEasPreviewReadOnly({
        environment: "production",
        executor: {
          async execute(command) {
            executions.push(command);
            return { exitCode: 0, stdout: "", stderr: "", durationMs: 1 };
          }
        }
      })
    ).rejects.toThrow("EAS runtime inspect supports preview env-list only.");
    expect(executions).toEqual([]);
  });
});
