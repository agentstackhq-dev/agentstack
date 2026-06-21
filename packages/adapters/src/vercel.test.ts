import { describe, expect, it } from "vitest";

import {
  createVercelCommandPlan,
  createVercelTarget,
  executeVercelPreviewApply
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
});
