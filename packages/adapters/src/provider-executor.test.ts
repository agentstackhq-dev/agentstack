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

  it("stores only sanitized live identity fact labels", () => {
    const result = createProviderExecutionResult({
      service: "vercel",
      environment: "preview",
      commandKind: "env.list",
      command: {
        id: "preview.vercel.env.list",
        args: ["pnpm", "exec", "vercel", "env", "ls", "preview"],
        secret: false
      },
      result: {
        exitCode: 0,
        stdout: "NEXT_PUBLIC_APP_URL=https://preview-secret.example.test\nProject ID prj_secret",
        stderr: "",
        durationMs: 13
      },
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: [
          "expected-env-names",
          "preview-environment",
          "env-list-read",
          "diagnostics-read",
          "provider-env-read",
          "provider-config-read"
        ]
      }
    });

    expect(result.liveIdentityFacts).toEqual({
      identityConfidence: "partial",
      facts: [
        "expected-env-names",
        "preview-environment",
        "env-list-read",
        "diagnostics-read",
        "provider-env-read",
        "provider-config-read"
      ]
    });
    expect(JSON.stringify(result)).not.toContain("NEXT_PUBLIC_APP_URL");
    expect(JSON.stringify(result)).not.toContain("https://preview-secret.example.test");
    expect(JSON.stringify(result)).not.toContain("prj_secret");
  });

  it("drops unsupported exact live identity facts from malformed runtime input", () => {
    const result = createProviderExecutionResult({
      service: "vercel",
      environment: "preview",
      commandKind: "env.list",
      command: {
        id: "preview.vercel.env.list",
        args: ["pnpm", "exec", "vercel", "env", "ls", "preview"],
        secret: false
      },
      result: {
        exitCode: 0,
        stdout: "preview NEXT_PUBLIC_APP_URL=https://preview-secret.example.test",
        stderr: "",
        durationMs: 13
      },
      liveIdentityFacts: {
        identityConfidence: "exact",
        facts: ["expected-env-names", "preview-environment", "env-list-read"]
      } as never
    });

    expect(result.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("exact");
  });

  it("drops malformed live identity fact labels from runtime input", () => {
    const result = createProviderExecutionResult({
      service: "clerk",
      environment: "preview",
      commandKind: "auth.env.pull",
      command: {
        id: "preview.clerk.env.pull",
        args: ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
        secret: false
      },
      result: {
        exitCode: 0,
        stdout: "RAW_PROVIDER_ID=secret\nNEXT_PUBLIC_APP_URL=https://secret.example.test",
        stderr: "",
        durationMs: 13
      },
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: ["provider-env-read", "RAW_PROVIDER_ID=secret", "NEXT_PUBLIC_APP_URL"]
      } as never
    });

    expect(result.liveIdentityFacts).toEqual({
      identityConfidence: "partial",
      facts: ["provider-env-read"]
    });
    expect(JSON.stringify(result)).not.toContain("RAW_PROVIDER_ID=secret");
    expect(JSON.stringify(result)).not.toContain("NEXT_PUBLIC_APP_URL");
    expect(JSON.stringify(result)).not.toContain("https://secret.example.test");
  });

  it("drops live identity facts when no allowed fact labels remain", () => {
    const result = createProviderExecutionResult({
      service: "clerk",
      environment: "preview",
      commandKind: "auth.env.pull",
      command: {
        id: "preview.clerk.env.pull",
        args: ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
        secret: false
      },
      result: {
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        durationMs: 13
      },
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: ["RAW_PROVIDER_ID=secret", "NEXT_PUBLIC_APP_URL"]
      } as never
    });

    expect(result.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("RAW_PROVIDER_ID=secret");
    expect(JSON.stringify(result)).not.toContain("NEXT_PUBLIC_APP_URL");
  });

  it("drops live identity facts from failed command results at the executor boundary", () => {
    const result = createProviderExecutionResult({
      service: "clerk",
      environment: "preview",
      commandKind: "auth.diagnostics",
      command: {
        id: "preview.clerk.doctor",
        args: ["pnpm", "exec", "clerk", "doctor", "--mode", "agent"],
        secret: false
      },
      result: {
        exitCode: 1,
        stdout: "",
        stderr: "auth failed",
        durationMs: 13
      },
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: ["diagnostics-read"]
      }
    });

    expect(result.status).toBe("failed");
    expect(result.liveIdentityFacts).toBeUndefined();
  });

  it("stores sanitized exact identity proof artifacts separately from partial live facts", () => {
    const result = createProviderExecutionResult({
      service: "vercel",
      environment: "preview",
      commandKind: "env.list",
      command: { id: "vercel.env.list", args: ["exec", "vercel", "env", "ls", "preview"] },
      result: { exitCode: 0, stdout: "Project prj_raw_secret", stderr: "", durationMs: 12 },
      exactIdentityProof: {
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: [
          "provider-specific-identity-parser",
          "stable-provider-identity",
          "ledger-comparable-identity",
          "manifest-resource-name-match",
          "ledger-external-id-match",
          "provider-owner-identity",
          "provider-resource-id",
          "provider-environment-scope",
          "provider-project-link-proof"
        ],
        comparisons: [
          { label: "stable-provider-identity", outcome: "matched" },
          { label: "ledger-comparable-identity", outcome: "matched" },
          { label: "manifest-resource-name-match", outcome: "matched" },
          { label: "ledger-external-id-match", outcome: "matched" },
          { label: "provider-owner-identity", outcome: "matched" },
          { label: "provider-resource-id", outcome: "matched" },
          { label: "provider-environment-scope", outcome: "matched" },
          { label: "provider-project-link-proof", outcome: "matched" }
        ]
      },
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: ["env-list-read", "expected-env-names", "preview-environment"]
      }
    });

    expect(result.liveIdentityFacts?.identityConfidence).toBe("partial");
    expect(result.exactIdentityProof?.labels).toContain("provider-specific-identity-parser");
    expect(result.exactIdentityProof?.comparisons).toContainEqual({
      label: "ledger-comparable-identity",
      outcome: "matched"
    });
    expect(JSON.stringify(result)).not.toContain("prj_raw_secret");
  });

  it("drops exact identity proof artifacts from failed command results", () => {
    const result = createProviderExecutionResult({
      service: "vercel",
      environment: "preview",
      commandKind: "env.list",
      command: { id: "vercel.env.list", args: ["exec", "vercel", "env", "ls", "preview"] },
      result: { exitCode: 1, stdout: "Project prj_raw_secret", stderr: "auth failed", durationMs: 12 },
      exactIdentityProof: {
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: ["provider-specific-identity-parser", "stable-provider-identity"],
        comparisons: [{ label: "stable-provider-identity", outcome: "matched" }]
      }
    });

    expect(result.exactIdentityProof).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("prj_raw_secret");
  });

  it("drops malformed exact identity proof labels", () => {
    const result = createProviderExecutionResult({
      service: "clerk",
      environment: "preview",
      commandKind: "config.pull",
      command: { id: "clerk.config.pull", args: ["clerk", "config", "pull", "--mode", "agent"] },
      result: { exitCode: 0, stdout: "owner raw-org-name", stderr: "", durationMs: 12 },
      exactIdentityProof: {
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: [
          "provider-specific-identity-parser",
          "https://dashboard.clerk.com/raw-org",
          "RAW_PROVIDER_ID",
          "stable-provider-identity"
        ],
        comparisons: [
          { label: "stable-provider-identity", outcome: "matched" },
          { label: "https://dashboard.clerk.com/raw-org", outcome: "matched" },
          { label: "provider-resource-id", outcome: "prj_raw_secret" },
          { label: "provider-owner-identity", outcome: "mismatched" }
        ]
      } as never
    });

    expect(result.exactIdentityProof).toEqual({
      kind: "provider-exact-identity-proof",
      evaluator: "provider-specific-identity-parser",
      labels: ["provider-specific-identity-parser", "stable-provider-identity"],
      comparisons: [{ label: "stable-provider-identity", outcome: "matched" }]
    });
    expect(JSON.stringify(result)).not.toContain("raw-org-name");
    expect(JSON.stringify(result)).not.toContain("dashboard.clerk.com");
    expect(JSON.stringify(result)).not.toContain("RAW_PROVIDER_ID");
    expect(JSON.stringify(result)).not.toContain("prj_raw_secret");
    expect(JSON.stringify(result)).not.toContain("mismatched");
  });

  it("drops malformed exact identity proof comparison entries without throwing", () => {
    const result = createProviderExecutionResult({
      service: "vercel",
      environment: "preview",
      commandKind: "env.list",
      command: { id: "vercel.env.list", args: ["exec", "vercel", "env", "ls", "preview"] },
      result: {
        exitCode: 0,
        stdout: "Project prj_raw_secret raw-id",
        stderr: "",
        durationMs: 12
      },
      exactIdentityProof: {
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: ["provider-specific-identity-parser", "stable-provider-identity"],
        comparisons: [
          null,
          "raw-id",
          123,
          { label: "stable-provider-identity", outcome: "matched" },
          { label: "provider-resource-id", outcome: "prj_raw_secret" },
          { label: "https://dashboard.vercel.com/raw-project", outcome: "matched" },
          { raw: "raw-id", label: "ledger-comparable-identity" }
        ]
      } as never
    });

    expect(result.exactIdentityProof).toEqual({
      kind: "provider-exact-identity-proof",
      evaluator: "provider-specific-identity-parser",
      labels: ["provider-specific-identity-parser", "stable-provider-identity"],
      comparisons: [{ label: "stable-provider-identity", outcome: "matched" }]
    });
    expect(JSON.stringify(result)).not.toContain("raw-id");
    expect(JSON.stringify(result)).not.toContain("prj_raw_secret");
    expect(JSON.stringify(result)).not.toContain("dashboard.vercel.com");
  });

  it("stores sanitized provider identity candidate artifacts separately from exact proof", () => {
    const result = createProviderExecutionResult({
      service: "clerk",
      environment: "preview",
      commandKind: "auth.apps.list",
      command: { id: "clerk.apps-list-json", args: ["pnpm", "exec", "clerk", "apps", "list", "--json"] },
      result: { exitCode: 0, stdout: JSON.stringify([{ id: "app_raw", ownerId: "org_raw" }]), stderr: "", durationMs: 12 },
      identityCandidates: {
        kind: "provider-identity-candidates",
        evaluator: "provider-specific-identity-candidate-parser",
        labels: [
          "provider-resource-id",
          "stable-provider-identity",
          "provider-owner-identity",
          "provider-resource-id",
          "provider-environment-scope"
        ]
      }
    });

    expect(result.identityCandidates).toEqual({
      kind: "provider-identity-candidates",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: [
        "provider-environment-scope",
        "provider-owner-identity",
        "provider-resource-id",
        "stable-provider-identity"
      ]
    });
    expect(result.exactIdentityProof).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("app_raw");
    expect(JSON.stringify(result)).not.toContain("org_raw");
  });

  it("drops malformed and raw-looking provider identity candidate labels", () => {
    const result = createProviderExecutionResult({
      service: "clerk",
      environment: "preview",
      commandKind: "auth.apps.list",
      command: { id: "clerk.apps-list-json", args: ["pnpm", "exec", "clerk", "apps", "list", "--json"] },
      result: {
        exitCode: 0,
        stdout: "dashboard.clerk.com app_raw org_raw https://example.test sk_live_1234567890 prj_123",
        stderr: "",
        durationMs: 12
      },
      identityCandidates: {
        kind: "provider-identity-candidates",
        evaluator: "provider-specific-identity-candidate-parser",
        labels: [
          "stable-provider-identity",
          "dashboard.clerk.com",
          "app_raw",
          "org_raw",
          "https://example.test",
          "sk_live_1234567890",
          "prj_123"
        ]
      } as never
    });

    expect(result.identityCandidates).toEqual({
      kind: "provider-identity-candidates",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: ["stable-provider-identity"]
    });
    expect(JSON.stringify(result)).not.toContain("dashboard.clerk.com");
    expect(JSON.stringify(result)).not.toContain("app_raw");
    expect(JSON.stringify(result)).not.toContain("org_raw");
    expect(JSON.stringify(result)).not.toContain("https://example.test");
    expect(JSON.stringify(result)).not.toContain("sk_live");
    expect(JSON.stringify(result)).not.toContain("prj_");
  });

  it("drops provider identity candidate artifacts from failed command results", () => {
    const result = createProviderExecutionResult({
      service: "clerk",
      environment: "preview",
      commandKind: "auth.apps.list",
      command: { id: "clerk.apps-list-json", args: ["pnpm", "exec", "clerk", "apps", "list", "--json"] },
      result: { exitCode: 1, stdout: "app_raw", stderr: "auth failed", durationMs: 12 },
      identityCandidates: {
        kind: "provider-identity-candidates",
        evaluator: "provider-specific-identity-candidate-parser",
        labels: ["stable-provider-identity"]
      }
    });

    expect(result.identityCandidates).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("app_raw");
  });

  it("classifies timeout failures", () => {
    expect(classifyProviderFailure({ exitCode: 124, stdout: "", stderr: "command timed out" })).toBe(
      "timeout"
    );
  });
});
