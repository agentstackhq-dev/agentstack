import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createVercelCommandPlan,
  createVercelTarget,
  executeVercelPreviewApply,
  inspectVercelReadOnly
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

  it("executes preview env list and provider-owned project JSON reads for Vercel inspect without mutation", async () => {
    const executions: Array<{ command: string; args: string[] }> = [];
    const results = await inspectVercelReadOnly({
      environment: "preview",
      executor: {
        async execute(command, args) {
          executions.push({ command, args });
          if (args.join(" ") === "exec vercel project ls --json") {
            return {
              exitCode: 0,
              stdout: JSON.stringify([{ id: "prj_raw_project_secret", name: "agentstack-preview", accountId: "team_raw_owner_secret" }]),
              stderr: "",
              durationMs: 11
            };
          }
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
      { command: "pnpm", args: ["exec", "vercel", "env", "ls", "preview"] },
      { command: "pnpm", args: ["exec", "vercel", "project", "ls", "--json"] }
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(
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
    );
    expect(results[1]).toEqual(
      expect.objectContaining({
        service: "vercel",
        environment: "preview",
        commandKind: "project.list",
        status: "success",
        identityCandidates: {
          kind: "provider-identity-candidates",
          evaluator: "provider-specific-identity-candidate-parser",
          labels: ["provider-owner-identity", "provider-resource-id", "stable-provider-identity"]
        },
        outputRedacted: true
      })
    );
    expect(results[0]?.stdoutSummary).toBe("<redacted provider stdout: 3 lines, 109 bytes>");
    expect(JSON.stringify(results)).not.toContain("provider-secret");
    expect(JSON.stringify(results)).not.toContain("https://preview.example.test");
    expect(JSON.stringify(results)).not.toContain("prj_raw_project_secret");
    expect(JSON.stringify(results)).not.toContain("team_raw_owner_secret");
    expect(JSON.stringify(executions)).not.toContain("deploy");
    expect(JSON.stringify(executions)).not.toContain("env add");
    expect(JSON.stringify(executions)).not.toContain("env rm");
  });

  it("attaches sanitized preview identity candidates from env-list proof and local project link", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-vercel-candidates-"));
    try {
      await mkdir(join(dir, ".vercel"), { recursive: true });
      await writeFile(
        join(dir, ".vercel", "project.json"),
        JSON.stringify({
          projectId: "prj_raw_project_secret",
          orgId: "org_raw_owner_secret"
        }),
        "utf8"
      );

      const results = await inspectVercelReadOnly({
        environment: "preview",
        cwd: dir,
        executor: {
          async execute() {
            return {
              exitCode: 0,
              stdout: [
                "Name Value Environment",
                "NEXT_PUBLIC_APP_URL https://preview-secret.example.test preview"
              ].join("\n"),
              stderr: "",
              durationMs: 9
            };
          }
        }
      });

      expect(results[0]?.identityCandidates).toEqual({
        kind: "provider-identity-candidates",
        evaluator: "provider-specific-identity-candidate-parser",
        labels: ["provider-environment-scope", "provider-project-link-proof"]
      });
      expect(results[0]?.exactIdentityProof).toBeUndefined();
      expect(results[1]?.exactIdentityProof).toBeUndefined();
      expect(JSON.stringify(results)).not.toContain("prj_raw_project_secret");
      expect(JSON.stringify(results)).not.toContain("org_raw_owner_secret");
      expect(JSON.stringify(results)).not.toContain("https://preview-secret.example.test");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("attaches exact sanitized Vercel preview identity only from single provider-owned project JSON matched to proof context", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-vercel-exact-"));
    try {
      await mkdir(join(dir, ".vercel"), { recursive: true });
      await writeFile(
        join(dir, ".vercel", "project.json"),
        JSON.stringify({ projectId: "prj_raw_project_secret", orgId: "team_raw_owner_secret" }),
        "utf8"
      );

      const results = await inspectVercelReadOnly({
        environment: "preview",
        cwd: dir,
        exactProofContext: {
          expectedResourceName: "agentstack-preview",
          ledgerExternalIdOrUrl: "prj_raw_project_secret",
          ledgerOwnerAccountOrProject: "team_raw_owner_secret"
        },
        executor: {
          async execute(_command, args) {
            if (args.join(" ") === "exec vercel project ls --json") {
              return {
                exitCode: 0,
                stdout: JSON.stringify([
                  {
                    id: "prj_raw_project_secret",
                    name: "agentstack-preview",
                    accountId: "team_raw_owner_secret"
                  }
                ]),
                stderr: "",
                durationMs: 1
              };
            }
            return {
              exitCode: 0,
              stdout: ["Name Environment", "NEXT_PUBLIC_APP_URL preview"].join("\n"),
              stderr: "",
              durationMs: 1
            };
          }
        }
      });

      expect(results[1]?.exactIdentityProof).toEqual({
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: [
          "ledger-comparable-identity",
          "ledger-external-id-match",
          "manifest-resource-name-match",
          "provider-environment-scope",
          "provider-owner-identity",
          "provider-project-link-proof",
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
          { label: "provider-project-link-proof", outcome: "matched" },
          { label: "provider-resource-id", outcome: "matched" },
          { label: "stable-provider-identity", outcome: "matched" }
        ]
      });
      expect(JSON.stringify(results)).not.toContain("prj_raw_project_secret");
      expect(JSON.stringify(results)).not.toContain("team_raw_owner_secret");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("attaches exact sanitized Vercel production identity only from production env scope and provider-owned project JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-vercel-production-exact-"));
    try {
      await mkdir(join(dir, ".vercel"), { recursive: true });
      await writeFile(
        join(dir, ".vercel", "project.json"),
        JSON.stringify({ projectId: "prj_raw_prod_project_secret", orgId: "team_raw_prod_owner_secret" }),
        "utf8"
      );

      const executions: Array<{ command: string; args: string[] }> = [];
      const results = await inspectVercelReadOnly({
        environment: "production",
        cwd: dir,
        exactProofContext: {
          expectedResourceName: "agentstack-prod",
          ledgerExternalIdOrUrl: "prj_raw_prod_project_secret",
          ledgerOwnerAccountOrProject: "team_raw_prod_owner_secret"
        },
        executor: {
          async execute(command, args) {
            executions.push({ command, args });
            return {
              exitCode: 0,
              stdout:
                args.join(" ") === "exec vercel project ls --json"
                  ? JSON.stringify([
                      {
                        id: "prj_raw_prod_project_secret",
                        name: "agentstack-prod",
                        accountId: "team_raw_prod_owner_secret"
                      }
                    ])
                  : ["Name Environment", "NEXT_PUBLIC_APP_URL production"].join("\n"),
              stderr: "",
              durationMs: 9
            };
          }
        }
      });

      expect(executions).toEqual([
        { command: "pnpm", args: ["exec", "vercel", "env", "ls", "production"] },
        { command: "pnpm", args: ["exec", "vercel", "project", "ls", "--json"] }
      ]);
      expect(results[0]?.liveIdentityFacts).toEqual({
        identityConfidence: "partial",
        facts: ["expected-env-names", "production-environment", "env-list-read"]
      });
      expect(results[1]?.exactIdentityProof).toEqual({
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: [
          "ledger-comparable-identity",
          "ledger-external-id-match",
          "manifest-resource-name-match",
          "provider-environment-scope",
          "provider-owner-identity",
          "provider-project-link-proof",
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
          { label: "provider-project-link-proof", outcome: "matched" },
          { label: "provider-resource-id", outcome: "matched" },
          { label: "stable-provider-identity", outcome: "matched" }
        ]
      });
      expect(JSON.stringify(results)).not.toContain("prj_raw_prod_project_secret");
      expect(JSON.stringify(results)).not.toContain("team_raw_prod_owner_secret");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps local Vercel project link alone from producing provider-owned exact identity proof", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-vercel-local-only-"));
    try {
      await mkdir(join(dir, ".vercel"), { recursive: true });
      await writeFile(
        join(dir, ".vercel", "project.json"),
        JSON.stringify({ projectId: "prj_raw_project_secret", orgId: "team_raw_owner_secret" }),
        "utf8"
      );

      const results = await inspectVercelReadOnly({
        environment: "preview",
        cwd: dir,
        exactProofContext: {
          expectedResourceName: "agentstack-preview",
          ledgerExternalIdOrUrl: "prj_raw_project_secret",
          ledgerOwnerAccountOrProject: "team_raw_owner_secret"
        },
        executor: {
          async execute(_command, args) {
            if (args.join(" ") === "exec vercel project ls --json") {
              return { exitCode: 0, stdout: "[]", stderr: "", durationMs: 1 };
            }
            return {
              exitCode: 0,
              stdout: ["Name Environment", "NEXT_PUBLIC_APP_URL preview"].join("\n"),
              stderr: "",
              durationMs: 1
            };
          }
        }
      });

      expect(results[0]?.identityCandidates?.labels).toEqual([
        "provider-environment-scope",
        "provider-project-link-proof"
      ]);
      expect(results[0]?.exactIdentityProof).toBeUndefined();
      expect(results[1]?.identityCandidates).toBeUndefined();
      expect(results[1]?.exactIdentityProof).toBeUndefined();
      expect(JSON.stringify(results)).not.toContain("stable-provider-identity");
      expect(JSON.stringify(results)).not.toContain("provider-resource-id");
      expect(JSON.stringify(results)).not.toContain("provider-owner-identity");
      expect(JSON.stringify(results)).not.toContain("prj_raw_project_secret");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps malformed, unsupported, missing, and multiple Vercel project JSON rows ambiguous", async () => {
    const outputs = [
      "{ invalid json",
      JSON.stringify({ projects: [{ id: "prj_raw_project_secret", name: "agentstack-preview", accountId: "team_raw_owner_secret" }] }),
      JSON.stringify([{ id: "prj_raw_project_secret", name: "", accountId: "team_raw_owner_secret" }]),
      JSON.stringify([
        { id: "prj_raw_project_secret", name: "agentstack-preview", accountId: "team_raw_owner_secret" },
        { id: "prj_other_secret", name: "agentstack-preview", accountId: "team_raw_owner_secret" }
      ])
    ];

    for (const stdout of outputs) {
      const results = await inspectVercelReadOnly({
        environment: "preview",
        exactProofContext: {
          expectedResourceName: "agentstack-preview",
          ledgerExternalIdOrUrl: "prj_raw_project_secret",
          ledgerOwnerAccountOrProject: "team_raw_owner_secret"
        },
        executor: {
          async execute(_command, args) {
            if (args.join(" ") === "exec vercel project ls --json") {
              return { exitCode: 0, stdout, stderr: "", durationMs: 1 };
            }
            return {
              exitCode: 0,
              stdout: ["Name Environment", "NEXT_PUBLIC_APP_URL preview"].join("\n"),
              stderr: "",
              durationMs: 1
            };
          }
        }
      });

      expect(results[1]?.identityCandidates).toBeUndefined();
      expect(results[1]?.exactIdentityProof).toBeUndefined();
      expect(JSON.stringify(results)).not.toContain("prj_raw_project_secret");
      expect(JSON.stringify(results)).not.toContain("team_raw_owner_secret");
    }
  });

  it("keeps Vercel inspect ambiguous when env-list output has no expected env proof", async () => {
    const results = await inspectVercelReadOnly({
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

  it("keeps exact Vercel proof ambiguous when env-list output lacks preview proof", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-vercel-env-scope-"));
    try {
      await mkdir(join(dir, ".vercel"), { recursive: true });
      await writeFile(
        join(dir, ".vercel", "project.json"),
        JSON.stringify({ projectId: "prj_raw_project_secret", orgId: "team_raw_owner_secret" }),
        "utf8"
      );

      const results = await inspectVercelReadOnly({
        environment: "preview",
        cwd: dir,
        exactProofContext: {
          expectedResourceName: "agentstack-preview",
          ledgerExternalIdOrUrl: "prj_raw_project_secret",
          ledgerOwnerAccountOrProject: "team_raw_owner_secret"
        },
        executor: {
          async execute(_command, args) {
            if (args.join(" ") === "exec vercel project ls --json") {
              return {
                exitCode: 0,
                stdout: JSON.stringify([
                  {
                    id: "prj_raw_project_secret",
                    name: "agentstack-preview",
                    accountId: "team_raw_owner_secret"
                  }
                ]),
                stderr: "",
                durationMs: 9
              };
            }
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
      expect(results[1]?.exactIdentityProof).toBeUndefined();
      expect(JSON.stringify(results)).not.toContain("preview-environment");
      expect(JSON.stringify(results)).not.toContain("prj_raw_project_secret");
      expect(JSON.stringify(results)).not.toContain("team_raw_owner_secret");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps Vercel inspect ambiguous when preview only appears inside a value", async () => {
    const results = await inspectVercelReadOnly({
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

  it("keeps Vercel inspect ambiguous when preview is a bare value token without an environment header", async () => {
    const results = await inspectVercelReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "NEXT_PUBLIC_APP_URL preview",
            stderr: "",
            durationMs: 9
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(JSON.stringify(results)).not.toContain("preview-environment");
  });

  it("does not infer Vercel env-list facts from loose preview env prose", async () => {
    const results = await inspectVercelReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: "preview has NEXT_PUBLIC_APP_URL somewhere, prj_secret, https://secret.example.test",
            stderr: "",
            durationMs: 1
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
    expect(results[0]?.stdoutSummary).not.toContain("NEXT_PUBLIC_APP_URL");
    expect(results[0]?.stdoutSummary).not.toContain("https://secret.example.test");
  });

  it("does not attach Vercel identity candidates for missing project links or loose env-list output", async () => {
    const missingLinkDir = await mkdtemp(join(tmpdir(), "agentstack-vercel-missing-link-"));
    const malformedLinkDir = await mkdtemp(join(tmpdir(), "agentstack-vercel-malformed-link-"));
    try {
      await mkdir(join(malformedLinkDir, ".vercel"), { recursive: true });
      await writeFile(join(malformedLinkDir, ".vercel", "project.json"), "{ invalid json", "utf8");

      const missingLinkResults = await inspectVercelReadOnly({
        environment: "preview",
        cwd: missingLinkDir,
        executor: {
          async execute() {
            return {
              exitCode: 0,
              stdout: ["Name Environment", "NEXT_PUBLIC_APP_URL preview"].join("\n"),
              stderr: "",
              durationMs: 1
            };
          }
        }
      });
      const malformedLinkResults = await inspectVercelReadOnly({
        environment: "preview",
        cwd: malformedLinkDir,
        executor: {
          async execute() {
            return {
              exitCode: 0,
              stdout: "preview has NEXT_PUBLIC_APP_URL somewhere",
              stderr: "",
              durationMs: 1
            };
          }
        }
      });

      expect(missingLinkResults[0]?.identityCandidates?.labels).toEqual(["provider-environment-scope"]);
      expect(JSON.stringify(missingLinkResults)).not.toContain("provider-project-link-proof");
      expect(malformedLinkResults[0]?.identityCandidates).toBeUndefined();
      expect(JSON.stringify(malformedLinkResults)).not.toContain("provider-environment-scope");
    } finally {
      await rm(missingLinkDir, { recursive: true, force: true });
      await rm(malformedLinkDir, { recursive: true, force: true });
    }
  });

  it("requires Vercel expected env name and preview environment in the same parsed row", async () => {
    const results = await inspectVercelReadOnly({
      environment: "preview",
      executor: {
        async execute() {
          return {
            exitCode: 0,
            stdout: ["Name Environment", "NEXT_PUBLIC_APP_URL production", "UNRELATED_FLAG preview"].join("\n"),
            stderr: "",
            durationMs: 1
          };
        }
      }
    });

    expect(results[0]?.liveIdentityFacts).toBeUndefined();
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
            stdout: "preview deployed with VERCEL_TOKEN=secret-token\nhttps://acme-crm-git-m1-example.vercel.app\n",
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
    expect(results[0]?.deploymentUrl).toBe("https://acme-crm-git-m1-example.vercel.app");
    expect(results[0]?.stdoutSummary).toBe("<redacted provider stdout: 3 lines, 91 bytes>");
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

  it("rejects development Vercel inspect without executing", async () => {
    const executions: string[] = [];

    await expect(
      inspectVercelReadOnly({
        environment: "development",
        executor: {
          async execute(command) {
            executions.push(command);
            return { exitCode: 0, stdout: "", stderr: "", durationMs: 1 };
          }
        }
      })
    ).rejects.toThrow("Vercel runtime inspect supports preview and production env-list reads only.");
    expect(executions).toEqual([]);
  });
});
