import { describe, expect, it } from "vitest";

import { createClerkCommandPlan, createClerkTarget, inspectClerkReadOnly } from "./clerk.js";

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
      "auth.apps.list",
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

  it("executes only read-only Clerk inspect commands and redacts diagnostics", async () => {
    const calls: string[][] = [];
    const results = await inspectClerkReadOnly({
      environment: "production",
      executor: {
        async execute(command, args) {
          calls.push([command, ...args]);
          return {
            exitCode: 0,
            stdout: `CLERK_SECRET_KEY=sk_test_1234567890abcdef ${command}`,
            stderr: "",
            durationMs: 5
          };
        }
      },
      secretValues: ["explicit-secret-value"]
    });

    expect(calls).toEqual([
      ["pnpm", "exec", "clerk", "doctor", "--mode", "agent"],
      ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
      ["pnpm", "exec", "clerk", "config", "pull", "--mode", "agent"],
      ["pnpm", "exec", "clerk", "apps", "list", "--json"]
    ]);
    expect(results.map((result) => result.commandKind)).toEqual([
      "auth.diagnostics",
      "auth.env.pull",
      "auth.config.pull",
      "auth.apps.list"
    ]);
    expect(results.map((result) => result.liveIdentityFacts)).toEqual([
      { identityConfidence: "partial", facts: ["diagnostics-read"] },
      { identityConfidence: "partial", facts: ["provider-env-read"] },
      { identityConfidence: "partial", facts: ["provider-config-read"] },
      undefined
    ]);
    expect(calls.map((call) => call.join(" "))).not.toContain("pnpm exec clerk init -y");
    expect(calls.map((call) => call.join(" "))).not.toContain(
      "pnpm exec clerk deploy --mode agent"
    );
    expect(JSON.stringify(results)).not.toContain("sk_test_");
    expect(JSON.stringify(results)).not.toContain("explicit-secret-value");
  });

  it("does not store unknown provider-owned secrets from Clerk inspect output", async () => {
    const results = await inspectClerkReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "CLERK_SECRET_KEY=provider-owned-secret-value\nSTRIPE_SECRET_KEY=sk_live_not_known_locally",
            stderr: "",
            durationMs: 5
          };
        }
      }
    });

    expect(results).toHaveLength(4);
    expect(results[1]).toEqual(
      expect.objectContaining({
        service: "clerk",
        environment: "preview",
        commandKind: "auth.env.pull",
        stdoutSummary: "<redacted provider stdout: 2 lines, 88 bytes>",
        outputRedacted: true
      })
    );
    expect(JSON.stringify(results)).not.toContain("provider-owned-secret-value");
    expect(JSON.stringify(results)).not.toContain("sk_live_not_known_locally");
  });

  it("does not attach Clerk live identity facts to failed inspect commands", async () => {
    let callIndex = 0;
    const results = await inspectClerkReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          callIndex += 1;
          return {
            exitCode: callIndex === 2 ? 1 : 0,
            stdout: callIndex === 2 ? "" : "ok",
            stderr: callIndex === 2 ? "auth failed" : "",
            durationMs: 5
          };
        }
      }
    });

    expect(results.map((result) => result.commandKind)).toEqual([
      "auth.diagnostics",
      "auth.env.pull",
      "auth.config.pull",
      "auth.apps.list"
    ]);
    expect(results.map((result) => result.liveIdentityFacts)).toEqual([
      { identityConfidence: "partial", facts: ["diagnostics-read"] },
      undefined,
      { identityConfidence: "partial", facts: ["provider-config-read"] },
      undefined
    ]);
    expect(results[1]).toMatchObject({
      status: "failed",
      failureClass: "auth"
    });
  });

  it("attaches sanitized identity candidate labels for a matching Clerk apps list fixture", async () => {
    const rawFixture = {
      data: [
        {
          id: "app_raw_123",
          resourceId: "app_raw_123",
          ownerId: "org_raw_123",
          environment: "development"
        }
      ]
    };
    const results = await inspectClerkReadOnly({
      environment: "preview",
      executor: {
        async execute(_command, args) {
          return {
            exitCode: 0,
            stdout: args.join(" ") === "exec clerk apps list --json" ? JSON.stringify(rawFixture) : "ok",
            stderr: "",
            durationMs: 5
          };
        }
      }
    });

    expect(results.at(-1)?.identityCandidates).toEqual({
      kind: "provider-identity-candidates",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: [
        "provider-environment-scope",
        "provider-owner-identity",
        "provider-resource-id",
        "stable-provider-identity"
      ]
    });
    expect(results.at(-1)?.exactIdentityProof).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("app_raw_123");
    expect(JSON.stringify(results)).not.toContain("org_raw_123");
  });

  it("does not treat a Clerk app id as provider-resource-id candidate evidence", async () => {
    const rawFixture = {
      data: [
        {
          id: "app_raw_123",
          ownerId: "org_raw_123",
          environment: "development"
        }
      ]
    };
    const results = await inspectClerkReadOnly({
      environment: "preview",
      executor: {
        async execute(_command, args) {
          return {
            exitCode: 0,
            stdout: args.join(" ") === "exec clerk apps list --json" ? JSON.stringify(rawFixture) : "ok",
            stderr: "",
            durationMs: 5
          };
        }
      }
    });

    expect(results.at(-1)?.identityCandidates).toEqual({
      kind: "provider-identity-candidates",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: ["provider-environment-scope", "provider-owner-identity", "stable-provider-identity"]
    });
    expect(results.at(-1)?.exactIdentityProof).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("app_raw_123");
    expect(JSON.stringify(results)).not.toContain("org_raw_123");
  });

  it("does not attach Clerk identity candidates for malformed, incomplete, mismatched, or failed apps list output", async () => {
    const fixtures = [
      "{ malformed",
      JSON.stringify([]),
      JSON.stringify([{ id: "app_raw_123", environment: "development" }]),
      JSON.stringify([{ id: "app_raw_123", ownerId: "org_raw_123", environment: "development" }])
    ];

    for (const stdout of fixtures) {
      const results = await inspectClerkReadOnly({
        environment: "preview",
        executor: {
          async execute(_command, args) {
            return {
              exitCode: 0,
              stdout: args.join(" ") === "exec clerk apps list --json" ? stdout : "ok",
              stderr: "",
              durationMs: 5
            };
          }
        }
      });

      expect(results.at(-1)?.identityCandidates).toBeUndefined();
      expect(JSON.stringify(results)).not.toContain("app_raw_123");
      expect(JSON.stringify(results)).not.toContain("org_raw_123");
    }

    const failedResults = await inspectClerkReadOnly({
      environment: "preview",
      executor: {
        async execute(_command, args) {
          const isAppsList = args.join(" ") === "exec clerk apps list --json";
          return {
            exitCode: isAppsList ? 1 : 0,
            stdout: isAppsList
              ? JSON.stringify([{ id: "app_raw_123", ownerId: "org_raw_123", environment: "development" }])
              : "ok",
            stderr: isAppsList ? "auth failed" : "",
            durationMs: 5
          };
        }
      }
    });

    expect(failedResults.at(-1)?.identityCandidates).toBeUndefined();
    expect(failedResults.at(-1)?.status).toBe("failed");
    expect(JSON.stringify(failedResults)).not.toContain("app_raw_123");
    expect(JSON.stringify(failedResults)).not.toContain("org_raw_123");
  });

  it("attaches sanitized exact identity proof for one Clerk app matching exact context", async () => {
    const rawFixture = {
      data: [
        {
          id: "app_raw_123",
          resourceId: "res_raw_456",
          ownerId: "org_raw_789",
          environment: "development",
          name: "acme-crm-preview-auth"
        }
      ]
    };
    const results = await inspectClerkReadOnly({
      environment: "preview",
      exactProofContext: {
        expectedResourceName: "acme-crm-preview-auth",
        ledgerExternalIdOrUrl: " res_raw_456 ",
        ledgerOwnerAccountOrProject: " org_raw_789 "
      },
      executor: {
        async execute(_command, args) {
          return {
            exitCode: 0,
            stdout: args.join(" ") === "exec clerk apps list --json" ? JSON.stringify(rawFixture) : "ok",
            stderr: "",
            durationMs: 5
          };
        }
      }
    });

    expect(results.at(-1)?.exactIdentityProof).toEqual({
      kind: "provider-exact-identity-proof",
      evaluator: "provider-specific-identity-parser",
      labels: [
        "ledger-comparable-identity",
        "ledger-external-id-match",
        "manifest-resource-name-match",
        "provider-environment-scope",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-specific-identity-parser",
        "stable-provider-identity"
      ],
      comparisons: [
        { label: "ledger-comparable-identity", outcome: "matched" },
        { label: "ledger-external-id-match", outcome: "matched" },
        { label: "manifest-resource-name-match", outcome: "matched" },
        { label: "provider-environment-scope", outcome: "matched" },
        { label: "provider-owner-identity", outcome: "matched" },
        { label: "provider-resource-id", outcome: "matched" },
        { label: "stable-provider-identity", outcome: "matched" }
      ]
    });
    expect(results.at(-1)?.liveIdentityFacts).toEqual({
      identityConfidence: "partial",
      facts: ["apps-list-read", "expected-resource-shape", "preview-environment"]
    });
    const serialized = JSON.stringify(results);
    expect(serialized).not.toContain("app_raw_123");
    expect(serialized).not.toContain("res_raw_456");
    expect(serialized).not.toContain("org_raw_789");
  });

  it("does not attach Clerk exact proof for top-level apps list arrays", async () => {
    const rawFixture = [
      {
        id: "app_raw_123",
        resourceId: "res_raw_456",
        ownerId: "org_raw_789",
        environment: "development",
        name: "acme-crm-preview-auth"
      }
    ];
    const results = await inspectClerkReadOnly({
      environment: "preview",
      exactProofContext: {
        expectedResourceName: "acme-crm-preview-auth",
        ledgerExternalIdOrUrl: "res_raw_456",
        ledgerOwnerAccountOrProject: "org_raw_789"
      },
      executor: {
        async execute(_command, args) {
          return {
            exitCode: 0,
            stdout: args.join(" ") === "exec clerk apps list --json" ? JSON.stringify(rawFixture) : "ok",
            stderr: "",
            durationMs: 5
          };
        }
      }
    });

    expect(results.at(-1)?.identityCandidates).toBeUndefined();
    expect(results.at(-1)?.exactIdentityProof).toBeUndefined();
    const serialized = JSON.stringify(results);
    expect(serialized).not.toContain("app_raw_123");
    expect(serialized).not.toContain("res_raw_456");
    expect(serialized).not.toContain("org_raw_789");
  });

  it("does not attach Clerk exact proof for production even with matching exact context", async () => {
    const rawFixture = {
      data: [
        {
          id: "app_raw_123",
          resourceId: "res_raw_456",
          ownerId: "org_raw_789",
          environment: "production",
          name: "acme-crm-production-auth"
        }
      ]
    };
    const results = await inspectClerkReadOnly({
      environment: "production",
      exactProofContext: {
        expectedResourceName: "acme-crm-production-auth",
        ledgerExternalIdOrUrl: "res_raw_456",
        ledgerOwnerAccountOrProject: "org_raw_789"
      },
      executor: {
        async execute(_command, args) {
          return {
            exitCode: 0,
            stdout: args.join(" ") === "exec clerk apps list --json" ? JSON.stringify(rawFixture) : "ok",
            stderr: "",
            durationMs: 5
          };
        }
      }
    });

    expect(results.at(-1)?.exactIdentityProof).toBeUndefined();
    const serialized = JSON.stringify(results);
    expect(serialized).not.toContain("res_raw_456");
    expect(serialized).not.toContain("org_raw_789");
    expect(serialized).not.toContain("app_raw_123");
  });

  it("does not attach Clerk exact proof for malformed exact apps list shapes", async () => {
    const malformedOutputs = [
      "{ malformed",
      JSON.stringify({ data: { id: "app_raw_123" } }),
      JSON.stringify({ data: [null] }),
      JSON.stringify({
        data: [
          {
            id: 123,
            resourceId: "res_raw_456",
            ownerId: "org_raw_789",
            environment: "development",
            name: "acme-crm-preview-auth"
          }
        ]
      }),
      JSON.stringify({
        data: [
          {
            id: "app_raw_123",
            resourceId: 456,
            ownerId: "org_raw_789",
            environment: "development",
            name: "acme-crm-preview-auth"
          }
        ]
      }),
      JSON.stringify({
        data: [
          {
            id: "app_raw_123",
            resourceId: "res_raw_456",
            ownerId: 789,
            environment: "development",
            name: "acme-crm-preview-auth"
          }
        ]
      }),
      JSON.stringify({
        data: [
          {
            id: "app_raw_123",
            resourceId: "res_raw_456",
            ownerId: "org_raw_789",
            environment: null,
            name: "acme-crm-preview-auth"
          }
        ]
      }),
      JSON.stringify({
        data: [
          {
            id: "app_raw_123",
            resourceId: "res_raw_456",
            ownerId: "org_raw_789",
            environment: "development",
            name: false
          }
        ]
      })
    ];

    for (const stdout of malformedOutputs) {
      const results = await inspectClerkReadOnly({
        environment: "preview",
        exactProofContext: {
          expectedResourceName: "acme-crm-preview-auth",
          ledgerExternalIdOrUrl: "res_raw_456",
          ledgerOwnerAccountOrProject: "org_raw_789"
        },
        executor: {
          async execute(_command, args) {
            return {
              exitCode: 0,
              stdout: args.join(" ") === "exec clerk apps list --json" ? stdout : "ok",
              stderr: "",
              durationMs: 5
            };
          }
        }
      });

      expect(results.at(-1)?.exactIdentityProof).toBeUndefined();
      const serialized = JSON.stringify(results);
      expect(serialized).not.toContain("res_raw_456");
      expect(serialized).not.toContain("org_raw_789");
      expect(serialized).not.toContain("app_raw_123");
    }
  });

  it("does not attach Clerk exact proof when exact context fields are empty", async () => {
    const rawFixture = {
      data: [
        {
          id: "app_raw_123",
          resourceId: "res_raw_456",
          ownerId: "org_raw_789",
          environment: "development",
          name: "acme-crm-preview-auth"
        }
      ]
    };
    const emptyContexts = [
      {
        expectedResourceName: "",
        ledgerExternalIdOrUrl: "res_raw_456",
        ledgerOwnerAccountOrProject: "org_raw_789"
      },
      {
        expectedResourceName: "acme-crm-preview-auth",
        ledgerExternalIdOrUrl: " ",
        ledgerOwnerAccountOrProject: "org_raw_789"
      },
      {
        expectedResourceName: "acme-crm-preview-auth",
        ledgerExternalIdOrUrl: "res_raw_456",
        ledgerOwnerAccountOrProject: "\t"
      }
    ];

    for (const exactProofContext of emptyContexts) {
      const results = await inspectClerkReadOnly({
        environment: "preview",
        exactProofContext,
        executor: {
          async execute(_command, args) {
            return {
              exitCode: 0,
              stdout: args.join(" ") === "exec clerk apps list --json" ? JSON.stringify(rawFixture) : "ok",
              stderr: "",
              durationMs: 5
            };
          }
        }
      });

      expect(results.at(-1)?.exactIdentityProof).toBeUndefined();
    }
  });

  it("does not attach Clerk exact proof without a single exact context match", async () => {
    const baseApp = {
      id: "app_raw_123",
      resourceId: "res_raw_456",
      ownerId: "org_raw_789",
      environment: "development",
      name: "acme-crm-preview-auth"
    };
    const cases = [
      { context: undefined, apps: [baseApp] },
      {
        context: {
          expectedResourceName: "acme-crm-preview-auth",
          ledgerExternalIdOrUrl: "res_raw_456",
          ledgerOwnerAccountOrProject: "org_raw_789"
        },
        apps: [baseApp, { ...baseApp, id: "app_raw_duplicate" }]
      },
      {
        context: {
          expectedResourceName: "acme-crm-preview-auth",
          ledgerExternalIdOrUrl: "res_raw_456",
          ledgerOwnerAccountOrProject: "org_other"
        },
        apps: [baseApp]
      },
      {
        context: {
          expectedResourceName: "acme-crm-preview-auth",
          ledgerExternalIdOrUrl: "res_raw_456",
          ledgerOwnerAccountOrProject: "org_raw_789"
        },
        apps: [{ ...baseApp, environment: "production" }]
      },
      {
        context: {
          expectedResourceName: "acme-crm-preview-auth",
          ledgerExternalIdOrUrl: "res_raw_456",
          ledgerOwnerAccountOrProject: "org_raw_789"
        },
        apps: [{ id: "app_raw_123", ownerId: "org_raw_789", environment: "development", name: "acme-crm-preview-auth" }]
      },
      {
        context: {
          expectedResourceName: "acme-crm-preview-auth",
          ledgerExternalIdOrUrl: "res_raw_456",
          ledgerOwnerAccountOrProject: "org_raw_789"
        },
        apps: [{ ...baseApp, name: "other-app" }]
      }
    ];

    for (const testCase of cases) {
      const results = await inspectClerkReadOnly({
        environment: "preview",
        exactProofContext: testCase.context,
        executor: {
          async execute(_command, args) {
            return {
              exitCode: 0,
              stdout: args.join(" ") === "exec clerk apps list --json" ? JSON.stringify({ data: testCase.apps }) : "ok",
              stderr: "",
              durationMs: 5
            };
          }
        }
      });

      expect(results.at(-1)?.exactIdentityProof).toBeUndefined();
      expect(JSON.stringify(results)).not.toContain("res_raw_456");
      expect(JSON.stringify(results)).not.toContain("org_raw_789");
    }
  });
});
