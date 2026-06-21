import { describe, expect, it } from "vitest";

import {
  classifyProviderFailure,
  createProviderExecutionResult,
  redactProviderText
} from "./provider-executor.js";

describe("provider executor artifacts", () => {
  it("redacts supplied secret values and common token-looking strings", () => {
    const text =
      "deployed with sk_live_1234567890abcdef and CONVEX_DEPLOY_KEY=convex-deploy-key-value";

    expect(
      redactProviderText(text, {
        secretValues: ["convex-deploy-key-value"]
      })
    ).toBe("deployed with [REDACTED] and CONVEX_DEPLOY_KEY=[REDACTED]");
  });

  it("classifies failed commands and preserves redacted diagnostics", () => {
    const result = createProviderExecutionResult({
      service: "convex",
      environment: "preview",
      commandKind: "env.set",
      command: {
        id: "preview.convex.env.set.convex.OPENAI_API_KEY",
        args: ["pnpm", "exec", "convex", "env", "set", "OPENAI_API_KEY"],
        secret: true
      },
      result: {
        exitCode: 1,
        stdout: "working",
        stderr: "Authentication failed for sk_test_1234567890abcdef",
        durationMs: 42
      },
      secretValues: ["raw-stdin-secret"],
      captureOutput: "redacted-text"
    });

    expect(result).toEqual(
      expect.objectContaining({
        service: "convex",
        environment: "preview",
        commandKind: "env.set",
        status: "failed",
        exitCode: 1,
        durationMs: 42,
        failureClass: "auth"
      })
    );
    expect(result.stderrSummary).toContain("Authentication failed");
    expect(result.stderrSummary).not.toContain("sk_test_");
    expect(JSON.stringify(result)).not.toContain("raw-stdin-secret");
  });

  it("stores provider output summaries without unknown provider-owned secret text", () => {
    const result = createProviderExecutionResult({
      service: "clerk",
      environment: "preview",
      commandKind: "auth.env.pull",
      command: {
        id: "preview.clerk.auth.env.pull",
        args: ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
        secret: false
      },
      result: {
        exitCode: 0,
        stdout: "CLERK_SECRET_KEY=provider-owned-secret-value\nSTRIPE_SECRET_KEY=sk_live_not_known_locally",
        stderr: "warning contains provider-owned-secret-value",
        durationMs: 13
      }
    });

    expect(result).toEqual(
      expect.objectContaining({
        stdoutSummary: "<redacted provider stdout: 2 lines, 88 bytes>",
        stderrSummary: "<redacted provider stderr: 1 line, 44 bytes>",
        stdoutLines: 2,
        stderrLines: 1,
        stdoutBytes: 88,
        stderrBytes: 44,
        outputRedacted: true
      })
    );
    expect(JSON.stringify(result)).not.toContain("provider-owned-secret-value");
    expect(JSON.stringify(result)).not.toContain("sk_live_not_known_locally");
  });

  it("classifies timeout failures", () => {
    expect(classifyProviderFailure({ exitCode: 124, stdout: "", stderr: "command timed out" })).toBe(
      "timeout"
    );
  });
});
