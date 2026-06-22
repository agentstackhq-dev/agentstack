import { createDefaultManifest } from "@agentstack/core";
import { describe, expect, it } from "vitest";

import {
  createConvexCommandPlan,
  createConvexTarget,
  executeConvexApply,
  inspectConvexReadOnly
} from "./convex.js";

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
          source: "env.missing",
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
          source: "env.missing",
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
          source: "env.stale",
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

  it("executes preview command plans through an artifact-safe executor", async () => {
    const manifest = createDefaultManifest("acme-crm");
    const calls: Array<{ command: string; args: string[]; stdin?: string }> = [];
    const results = await executeConvexApply({
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
          source: "env.missing",
          summary: "Set OPENAI_API_KEY for convex convex in preview.",
          secret: true,
          requiresConfirmation: false
        }
      ],
      includeDeploy: true,
      executor: {
        async execute(command, args, options) {
          calls.push({ command, args, stdin: options.stdin });
          return {
            exitCode: 0,
            stdout: `ok ${command} ${args.join(" ")} sk_live_1234567890abcdef`,
            stderr: "",
            durationMs: 7
          };
        }
      },
      stdinByCommandId: {
        "preview.convex.env.set.convex.OPENAI_API_KEY": "raw-secret-value"
      },
      secretValues: ["raw-secret-value"]
    });

    expect(calls.map((call) => [call.command, ...call.args])).toEqual([
      ["pnpm", "exec", "convex", "deploy", "--preview-name", "acme-crm-preview"],
      [
        "pnpm",
        "exec",
        "convex",
        "env",
        "--deployment",
        "<preview-deployment-name>",
        "set",
        "OPENAI_API_KEY"
      ]
    ]);
    expect(calls[1]?.stdin).toBe("raw-secret-value");
    expect(results.every((result) => result.status === "success")).toBe(true);
    expect(JSON.stringify(results)).not.toContain("raw-secret-value");
    expect(JSON.stringify(results)).not.toContain("sk_live_");
  });

  it("inspects Convex read-only diagnostics through the executor", async () => {
    const manifest = createDefaultManifest("acme-crm");
    const calls: Array<{ command: string; args: string[]; stdin?: string }> = [];
    const results = await inspectConvexReadOnly({
      manifest,
      environment: "preview",
      executor: {
        async execute(command, args, options) {
          calls.push({ command, args, stdin: options.stdin });
          return {
            exitCode: 0,
            stdout: "OPENAI_API_KEY=sk_live_1234567890abcdef",
            stderr: "",
            durationMs: 9
          };
        }
      },
      secretValues: ["sk_live_1234567890abcdef"]
    });

    expect(calls.map((call) => [call.command, ...call.args])).toEqual([
      ["pnpm", "exec", "convex", "env", "--deployment", "<preview-deployment-name>", "list"]
    ]);
    expect(calls[0]?.stdin).toBeUndefined();
    expect(results).toEqual([
      expect.objectContaining({
        service: "convex",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        stdoutSummary: "<redacted provider stdout: 1 line, 39 bytes>",
        stdoutLines: 1,
        stdoutBytes: 39,
        outputRedacted: true,
        liveIdentityFacts: {
          identityConfidence: "partial",
          facts: ["provider-env-read"]
        }
      })
    ]);
    expect(JSON.stringify(results)).not.toContain("sk_live_");
  });

  it("attaches only sanitized preview identity candidates from structured expected env-list rows", async () => {
    const manifest = createDefaultManifest("acme-crm");
    const results = await inspectConvexReadOnly({
      manifest,
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "Name               Value\nOPENAI_API_KEY     hidden-by-provider\nSTRIPE_MODE        test",
            stderr: "",
            durationMs: 9
          };
        }
      },
      secretValues: ["hidden-by-provider"]
    });

    expect(results[0]?.identityCandidates).toEqual({
      kind: "provider-identity-candidates",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: ["provider-environment-scope"]
    });
    expect(results[0]?.liveIdentityFacts).toEqual({
      identityConfidence: "partial",
      facts: ["env-list-read", "expected-env-names", "preview-environment", "provider-env-read"]
    });
    expect(results[0]?.exactIdentityProof).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("hidden-by-provider");
    expect(JSON.stringify(results)).not.toContain("acme-crm-preview");
    expect(JSON.stringify(results)).not.toContain("<preview-deployment-name>");
    expect(JSON.stringify(results)).not.toContain("https://");
  });

  it("does not attach Convex identity candidates for failed reads, prose, unexpected names, or malformed rows", async () => {
    const manifest = createDefaultManifest("acme-crm");
    const outputs = [
      { exitCode: 1, stdout: "OPENAI_API_KEY     hidden-by-provider" },
      { exitCode: 0, stdout: "OPENAI_API_KEY is configured for preview" },
      { exitCode: 0, stdout: "UNEXPECTED_KEY     hidden-by-provider" },
      { exitCode: 0, stdout: "OPENAI_API_KEY" }
    ];

    for (const output of outputs) {
      const results = await inspectConvexReadOnly({
        manifest,
        environment: "preview",
        executor: {
          async execute() {
            return {
              exitCode: output.exitCode,
              stdout: output.stdout,
              stderr: output.exitCode === 0 ? "" : "not found",
              durationMs: 9
            };
          }
        },
        secretValues: ["hidden-by-provider"]
      });

      expect(results[0]?.identityCandidates).toBeUndefined();
      expect(results[0]?.exactIdentityProof).toBeUndefined();
      expect(results[0]?.liveIdentityFacts?.facts ?? []).not.toEqual(
        expect.arrayContaining(["env-list-read", "expected-env-names", "preview-environment"])
      );
      expect(JSON.stringify(results)).not.toContain("hidden-by-provider");
    }
  });

  it("does not attach Convex identity candidates outside preview", async () => {
    const manifest = createDefaultManifest("acme-crm");
    const results = await inspectConvexReadOnly({
      manifest,
      environment: "production",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "Name               Value\nOPENAI_API_KEY     hidden-by-provider",
            stderr: "",
            durationMs: 9
          };
        }
      },
      secretValues: ["hidden-by-provider"]
    });

    expect(results[0]?.identityCandidates).toBeUndefined();
    expect(results[0]?.exactIdentityProof).toBeUndefined();
    expect(results[0]?.liveIdentityFacts?.facts ?? []).not.toEqual(
      expect.arrayContaining(["env-list-read", "expected-env-names", "preview-environment"])
    );
  });

  it("does not attach Convex live identity facts to failed env list reads", async () => {
    const manifest = createDefaultManifest("acme-crm");
    const results = await inspectConvexReadOnly({
      manifest,
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "not found",
            durationMs: 9
          };
        }
      }
    });

    expect(results[0]).toMatchObject({
      service: "convex",
      environment: "preview",
      commandKind: "env.list",
      status: "failed",
      failureClass: "not-found"
    });
    expect(results[0]?.liveIdentityFacts).toBeUndefined();
  });

  it("does not store unknown provider-owned secrets from Convex inspect output", async () => {
    const manifest = createDefaultManifest("acme-crm");
    const results = await inspectConvexReadOnly({
      manifest,
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "OPENAI_API_KEY=provider-owned-secret-value\nSTRIPE_SECRET_KEY=sk_live_not_known_locally",
            stderr: "",
            durationMs: 9
          };
        }
      }
    });

    expect(results[0]).toEqual(
      expect.objectContaining({
        service: "convex",
        environment: "preview",
        commandKind: "env.list",
        stdoutSummary: "<redacted provider stdout: 2 lines, 86 bytes>",
        outputRedacted: true
      })
    );
    expect(JSON.stringify(results)).not.toContain("provider-owned-secret-value");
    expect(JSON.stringify(results)).not.toContain("sk_live_not_known_locally");
  });

  it("rejects production apply without explicit confirmation", async () => {
    const manifest = createDefaultManifest("acme-crm");

    await expect(
      executeConvexApply({
        manifest,
        environment: "production",
        operations: [],
        includeDeploy: true,
        executor: {
          async execute() {
            return { exitCode: 0, stdout: "", stderr: "", durationMs: 1 };
          }
        }
      })
    ).rejects.toThrow("Convex production apply requires explicit confirmation.");
  });
});
