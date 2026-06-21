import { describe, expect, it } from "vitest";

import {
  createVercelCommandPlan,
  createVercelTarget,
  executeVercelPreviewApply,
  inspectVercelPreviewReadOnly
} from "./vercel.js";

describe("vercel command planner", () => {
  it("plans preview and production deploy targets", () => {
    expect(createVercelTarget("preview")).toEqual(
      expect.objectContaining({
        environment: "preview",
        vercelEnvironment: "preview",
        requiredEnv: ["VERCEL_TOKEN"],
        requiresConfirmation: false,
        deployCommand: expect.objectContaining({
          args: ["pnpm", "exec", "vercel", "deploy", "--target=preview"]
        }),
        envListCommand: expect.objectContaining({
          kind: "env.list",
          args: ["pnpm", "exec", "vercel", "env", "ls", "preview"]
        })
      })
    );

    expect(createVercelTarget("production")).toEqual(
      expect.objectContaining({
        environment: "production",
        vercelEnvironment: "production",
        requiredEnv: ["VERCEL_TOKEN"],
        requiresConfirmation: true,
        deployCommand: expect.objectContaining({
          args: ["pnpm", "exec", "vercel", "--prod"]
        }),
        envListCommand: expect.objectContaining({
          kind: "env.list",
          args: ["pnpm", "exec", "vercel", "env", "ls", "production"]
        })
      })
    );
  });

  it("maps missing, drifted, and stale Vercel env operations to documented CLI commands", () => {
    const plan = createVercelCommandPlan({
      environment: "preview",
      operations: [
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
        },
        {
          id: "preview.vercel.env.set.web.API_TOKEN",
          environment: "preview",
          service: "vercel",
          kind: "env.set",
          scope: "web",
          target: "env:API_TOKEN",
          source: "env.drifted",
          summary: "Set API_TOKEN for vercel web in preview.",
          secret: true,
          requiresConfirmation: false
        },
        {
          id: "preview.vercel.env.remove.web.LEGACY_FLAG",
          environment: "preview",
          service: "vercel",
          kind: "env.remove",
          scope: "web",
          target: "env:LEGACY_FLAG",
          source: "env.stale",
          summary: "Remove LEGACY_FLAG for vercel web in preview.",
          secret: false,
          requiresConfirmation: false
        },
        {
          id: "preview.convex.env.set.convex.OPENAI_API_KEY",
          environment: "preview",
          service: "convex",
          kind: "env.set",
          scope: "convex",
          target: "env:OPENAI_API_KEY",
          source: "env.missing",
          summary: "Set OPENAI_API_KEY for convex convex in preview.",
          secret: true,
          requiresConfirmation: false
        }
      ],
      includeDeploy: true
    });

    expect(plan.commands.map((command) => command.kind)).toEqual([
      "web.deploy",
      "env.add",
      "env.update",
      "env.remove"
    ]);
    expect(plan.commands[1]).toEqual(
      expect.objectContaining({
        valueSource: "stdin",
        stdinLabel: "<value from .agentstack/env-values.json>",
        args: ["pnpm", "exec", "vercel", "env", "add", "PUBLIC_URL", "preview"]
      })
    );
    expect(plan.commands[2]).toEqual(
      expect.objectContaining({
        valueSource: "stdin",
        stdinLabel: "<secret from .agentstack/env-values.json>",
        args: ["pnpm", "exec", "vercel", "env", "update", "API_TOKEN", "preview", "--sensitive"]
      })
    );
    expect(plan.commands[3]?.args).toEqual([
      "pnpm",
      "exec",
      "vercel",
      "env",
      "rm",
      "LEGACY_FLAG",
      "preview"
    ]);
    expect(JSON.stringify(plan)).not.toContain("sk-");
  });

  it("executes only preview env list for Vercel inspect and redacts provider output", async () => {
    const executions: Array<{ command: string; args: string[] }> = [];
    const results = await inspectVercelPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute(command, args) {
          executions.push({ command, args });
          return {
            exitCode: 0,
            stdout: [
              "name value environments",
              "API_TOKEN Encrypted preview",
              "NEXT_PUBLIC_APP_URL https://redacted.example.test preview"
            ].join("\n"),
            stderr: "",
            durationMs: 9
          };
        }
      },
      secretValues: ["provider-secret"]
    });

    expect(executions).toEqual([
      { command: "pnpm", args: ["exec", "vercel", "env", "ls", "preview"] }
    ]);
    expect(results).toEqual([
      expect.objectContaining({
        service: "vercel",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        liveIdentityFacts: {
          identityConfidence: "partial",
          facts: ["expected-env-names", "preview-environment", "env-list-read"]
        },
        outputRedacted: true
      })
    ]);
    expect(results[0]?.stdoutSummary).toBe("<redacted provider stdout: 3 lines, 109 bytes>");
    expect(JSON.stringify(results)).not.toContain("provider-secret");
    expect(JSON.stringify(results)).not.toContain("https://preview.example.test");
  });

  it("keeps Vercel inspect ambiguous when env-list output has no expected env proof", async () => {
    const results = await inspectVercelPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "Linked project is ready",
            stderr: "",
            durationMs: 9
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
  });

  it("keeps Vercel inspect ambiguous when expected env names lack preview proof", async () => {
    const results = await inspectVercelPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "NEXT_PUBLIC_APP_URL https://example.test",
            stderr: "",
            durationMs: 9
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("preview-environment");
  });

  it("keeps Vercel inspect ambiguous when preview only appears inside a value", async () => {
    const results = await inspectVercelPreviewReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "NEXT_PUBLIC_APP_URL https://preview-secret.example.test",
            stderr: "",
            durationMs: 9
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("preview-environment");
  });

  it("executes only preview deploy for Vercel apply and redacts provider output", async () => {
    const executions: Array<{ command: string; args: string[] }> = [];
    const results = await executeVercelPreviewApply({
      environment: "preview",
      operations: [
        {
          id: "preview.vercel.env.set.web.API_TOKEN",
          environment: "preview",
          service: "vercel",
          kind: "env.set",
          scope: "web",
          target: "env:API_TOKEN",
          source: "env.missing",
          summary: "Set API_TOKEN for vercel web in preview.",
          secret: true,
          requiresConfirmation: false
        }
      ],
      executor: {
        async execute(command, args) {
          executions.push({ command, args });
          return {
            exitCode: 0,
            stdout: "preview deployed with VERCEL_TOKEN=secret-token",
            stderr: "",
            durationMs: 8
          };
        }
      }
    });

    expect(executions).toEqual([
      { command: "pnpm", args: ["exec", "vercel", "deploy", "--target=preview"] }
    ]);
    expect(results).toEqual([
      expect.objectContaining({
        service: "vercel",
        environment: "preview",
        commandKind: "web.deploy",
        status: "success",
        outputRedacted: true
      })
    ]);
    expect(results[0]?.stdoutSummary).toBe("<redacted provider stdout: 1 line, 47 bytes>");
    expect(JSON.stringify(results)).not.toContain("secret-token");
  });

  it("rejects Vercel production apply without executing", async () => {
    const executions: string[] = [];

    await expect(
      executeVercelPreviewApply({
        environment: "production",
        operations: [],
        executor: {
          async execute(command) {
            executions.push(command);
            return { exitCode: 0, stdout: "", stderr: "", durationMs: 1 };
          }
        }
      })
    ).rejects.toThrow("Vercel runtime apply supports preview deploy only.");
    expect(executions).toEqual([]);
  });

  it("rejects non-preview Vercel inspect without executing", async () => {
    const executions: string[] = [];

    await expect(
      inspectVercelPreviewReadOnly({
        environment: "production",
        executor: {
          async execute(command) {
            executions.push(command);
            return { exitCode: 0, stdout: "", stderr: "", durationMs: 1 };
          }
        }
      })
    ).rejects.toThrow("Vercel runtime inspect supports preview env-list only.");
    expect(executions).toEqual([]);
  });
});
