import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultManifest } from "@agentstack/core";
import { describe, expect, it } from "vitest";
import {
  buildProviderAdoptProposal,
  confirmLiveProviderInventoryIdentity,
  createLiveProviderInventory,
  createProviderInventory,
  linkLedgerBackedProviderResource,
  readProviderLinkState
} from "./provider-control-plane.js";
import { parseProviderLedger } from "./provider-ledger.js";

const ledgerHeader = [
  "## Ledger",
  "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
].join("\n");

describe("provider control plane", () => {
  it("labels manifest and local provider-link inventory as local-inventory without using local-cloud as external proof", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-provider-control-"));
    try {
      await mkdir(join(dir, ".agentstack"), { recursive: true });
      await writeFile(
        join(dir, ".agentstack", "local-cloud.json"),
        JSON.stringify({ services: [{ service: "convex", environment: "preview", linked: true, env: {} }] }),
        "utf8"
      );

      const inventory = await createProviderInventory({
        cwd: dir,
        manifest: createDefaultManifest("acme-crm"),
        service: "convex",
        environment: "preview",
        ledgerRows: []
      });

      expect(inventory.evidence).toBe("local-inventory");
      expect(inventory.rows).toContainEqual(
        expect.objectContaining({
          service: "convex",
          environment: "preview",
          resourceType: "deployment",
          name: "acme-crm-preview",
          evidence: "expected",
          localLink: "missing",
          ledgerStatus: "missing",
          externalIdSummary: "none"
        })
      );
      expect(JSON.stringify(inventory)).not.toContain("local-cloud");
      expect(JSON.stringify(inventory)).not.toContain("external-exists");
      expect(JSON.stringify(inventory)).not.toContain("live-read");
      expect(inventory.rows[0]).not.toHaveProperty("liveStatus");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("labels inventory as ledger-local-inventory when an allowed ledger row matches", async () => {
    const ledgerRows = parseProviderLedger(
      [
        ledgerHeader,
        "| row-secret-123 | convex | deployment | preview | team | acme-crm-preview | https://dashboard.convex.dev/d/acme | preview deployment | jc | 2026-06-21 | remove after tests | active | convex dashboard delete |  | evidence/provider.md | ok |"
      ].join("\n")
    );

    const inventory = await createProviderInventory({
      cwd: "/tmp/no-state",
      manifest: createDefaultManifest("acme-crm"),
      service: "convex",
      environment: "preview",
      ledgerRows
    });

    expect(inventory.evidence).toBe("ledger-local-inventory");
    expect(inventory.rows[0]).toMatchObject({ ledgerStatus: "active", externalIdSummary: "redacted" });
    expect(JSON.stringify(inventory)).not.toContain("row-secret-123");
    expect(JSON.stringify(inventory)).not.toContain("dashboard.convex.dev/d/acme");
  });

  it("treats invalid provider-link state as empty for inventory only", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-provider-inventory-invalid-state-"));
    try {
      await mkdir(join(dir, ".agentstack"), { recursive: true });
      await writeFile(join(dir, ".agentstack", "provider-links.json"), "{ invalid json", "utf8");

      const inventory = await createProviderInventory({
        cwd: dir,
        manifest: createDefaultManifest("acme-crm"),
        service: "convex",
        environment: "preview",
        ledgerRows: []
      });

      expect(inventory.rows[0]).toMatchObject({
        localLink: "missing",
        externalIdSummary: "none"
      });
      await expect(readProviderLinkState(dir)).rejects.toThrow(SyntaxError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("maps expected provider resources for each service and environment", async () => {
    const manifest = createDefaultManifest("acme-crm");

    await expect(
      createProviderInventory({ cwd: "/tmp/no-state", manifest, service: "convex", environment: "production", ledgerRows: [] })
    ).resolves.toMatchObject({ rows: [expect.objectContaining({ resourceType: "deployment", name: "prod" })] });
    await expect(
      createProviderInventory({ cwd: "/tmp/no-state", manifest, service: "vercel", environment: "preview", ledgerRows: [] })
    ).resolves.toMatchObject({ rows: [expect.objectContaining({ resourceType: "project", name: "acme-crm" })] });
    await expect(
      createProviderInventory({ cwd: "/tmp/no-state", manifest, service: "clerk", environment: "production", ledgerRows: [] })
    ).resolves.toMatchObject({ rows: [expect.objectContaining({ resourceType: "application", name: "acme-crm-production" })] });
    await expect(
      createProviderInventory({ cwd: "/tmp/no-state", manifest, service: "eas", environment: "preview", ledgerRows: [] })
    ).resolves.toMatchObject({ rows: [expect.objectContaining({ resourceType: "project", name: "acme-crm" })] });
  });

  it("projects successful live read results with command-level partial facts without leaking provider output", async () => {
    const inventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "convex",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "convex",
          environment: "preview",
          commandKind: "env.list",
          status: "success",
          exitCode: 0,
          durationMs: 12,
          stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
          stderrSummary: "",
          stdoutLines: 1,
          stderrLines: 0,
          stdoutBytes: 42,
          stderrBytes: 0,
          outputRedacted: true,
          providerResourceId: "raw-provider-id-should-not-leak",
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["provider-env-read"]
          }
        }
      ]
    });

    expect(inventory.evidence).toBe("live-read-inventory");
    expect(inventory.rows[0]).toMatchObject({
      liveStatus: "found",
      identityMatch: "ambiguous",
      identityScope: "partial",
      permissionSummary: "read-ok",
      driftSummary: "unknown",
      facts: ["provider-env-read"],
      missingProof: [
        "provider-specific-identity-parser",
        "stable-provider-identity",
        "ledger-comparable-identity",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-environment-scope"
      ],
      externalIdSummary: "none"
    });
    expect(inventory.liveReadSummary).toEqual({ commands: 1, results: 1, succeeded: 1, failed: 0 });
    expect(JSON.stringify(inventory)).not.toContain("raw-provider-id-should-not-leak");
  });

  it("maps sanitized partial live facts without exact identity claims", async () => {
    const inventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "vercel",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "vercel",
          environment: "preview",
          commandKind: "env.list",
          status: "success",
          exitCode: 0,
          durationMs: 12,
          stdoutSummary: "<redacted provider stdout: 3 lines, 120 bytes>",
          stderrSummary: "",
          stdoutLines: 3,
          stderrLines: 0,
          stdoutBytes: 120,
          stderrBytes: 0,
          outputRedacted: true,
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["expected-env-names", "preview-environment", "env-list-read"]
          }
        }
      ]
    });

      expect(inventory.rows[0]).toMatchObject({
        liveStatus: "found",
        identityMatch: "ambiguous",
        identityScope: "partial",
        permissionSummary: "read-ok",
        driftSummary: "unknown",
        facts: ["env-list-read", "expected-env-names", "preview-environment"],
        missingProof: [
          "provider-specific-identity-parser",
          "stable-provider-identity",
          "ledger-comparable-identity",
          "provider-owner-identity",
          "provider-resource-id",
          "provider-project-link-proof",
          "provider-environment-scope"
        ]
      });
    expect(JSON.stringify(inventory)).not.toContain("NEXT_PUBLIC_APP_URL");
    expect(JSON.stringify(inventory)).not.toContain("raw-provider-output");
  });

  it("does not promote unsupported exact live identity facts", async () => {
    const inventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "vercel",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "vercel",
          environment: "preview",
          commandKind: "env.list",
          status: "success",
          exitCode: 0,
          durationMs: 12,
          stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
          stderrSummary: "",
          stdoutLines: 1,
          stderrLines: 0,
          stdoutBytes: 42,
          stderrBytes: 0,
          outputRedacted: true,
          liveIdentityFacts: {
            identityConfidence: "exact",
            facts: ["expected-env-names", "preview-environment", "env-list-read"]
          }
        } as never
      ]
    });

      expect(inventory.rows[0]).toMatchObject({
        liveStatus: "unknown",
        identityMatch: "ambiguous",
        identityScope: "none",
        permissionSummary: "read-ok",
        driftSummary: "unknown",
        missingProof: [
          "provider-specific-identity-parser",
          "stable-provider-identity",
          "ledger-comparable-identity",
          "provider-owner-identity",
          "provider-resource-id",
          "provider-project-link-proof",
          "provider-environment-scope"
        ]
      });
    expect(JSON.stringify(inventory)).not.toContain("identityScope\":\"exact");
  });

  it("maps auth-failed live reads to auth-failed and read-failed without exposing raw diagnostics", async () => {
    const inventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "clerk",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "clerk",
          environment: "preview",
          commandKind: "env.pull",
          status: "failed",
          exitCode: 1,
          durationMs: 12,
          stdoutSummary: "",
          stderrSummary: "<redacted provider stderr: 1 line, 99 bytes>",
          stdoutLines: 0,
          stderrLines: 1,
          stdoutBytes: 0,
          stderrBytes: 99,
          outputRedacted: true,
          failureClass: "auth"
        }
      ]
    });

      expect(inventory.rows[0]).toMatchObject({
        liveStatus: "auth-failed",
        identityMatch: "ambiguous",
        identityScope: "none",
        permissionSummary: "read-failed",
        driftSummary: "unknown",
        missingProof: ["successful-live-read"]
      });
    expect(inventory.rows[0]?.facts).toBeUndefined();
    expect(inventory.liveReadSummary).toEqual({ commands: 1, results: 1, succeeded: 0, failed: 1 });
  });

  it("keeps mixed live read results on the failure path without partial facts", async () => {
    const inventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "clerk",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "clerk",
          environment: "preview",
          commandKind: "auth.diagnostics",
          status: "success",
          exitCode: 0,
          durationMs: 12,
          stdoutSummary: "<redacted provider stdout: 1 line, 2 bytes>",
          stderrSummary: "",
          stdoutLines: 1,
          stderrLines: 0,
          stdoutBytes: 2,
          stderrBytes: 0,
          outputRedacted: true,
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["diagnostics-read"]
          }
        },
        {
          service: "clerk",
          environment: "preview",
          commandKind: "auth.env.pull",
          status: "failed",
          exitCode: 1,
          durationMs: 12,
          stdoutSummary: "",
          stderrSummary: "<redacted provider stderr: 1 line, 99 bytes>",
          stdoutLines: 0,
          stderrLines: 1,
          stdoutBytes: 0,
          stderrBytes: 99,
          outputRedacted: true,
          failureClass: "auth"
        }
      ]
    });

    expect(inventory.rows[0]).toMatchObject({
      liveStatus: "auth-failed",
      identityMatch: "ambiguous",
      identityScope: "none",
      permissionSummary: "read-failed",
      driftSummary: "unknown",
      missingProof: ["successful-live-read"]
    });
    expect(inventory.rows[0]?.facts).toBeUndefined();
    expect(inventory.liveReadSummary).toEqual({ commands: 2, results: 2, succeeded: 1, failed: 1 });
  });

  it("refuses live confirmation for failed or ambiguous inventory without exact identity synthesis", async () => {
    const partialInventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "vercel",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "vercel",
          environment: "preview",
          commandKind: "env.list",
          status: "success",
          exitCode: 0,
          durationMs: 12,
          stdoutSummary: "<redacted provider stdout: 3 lines, 120 bytes>",
          stderrSummary: "",
          stdoutLines: 3,
          stderrLines: 0,
          stdoutBytes: 120,
          stderrBytes: 0,
          outputRedacted: true,
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["expected-env-names", "preview-environment", "env-list-read"]
          }
        }
      ]
    });
    const failedInventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "clerk",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "clerk",
          environment: "preview",
          commandKind: "env.pull",
          status: "failed",
          exitCode: 1,
          durationMs: 12,
          stdoutSummary: "",
          stderrSummary: "<redacted provider stderr: 1 line, 99 bytes>",
          stdoutLines: 0,
          stderrLines: 1,
          stdoutBytes: 0,
          stderrBytes: 99,
          outputRedacted: true,
          failureClass: "auth"
        }
      ]
    });

    expect(confirmLiveProviderInventoryIdentity(partialInventory)).toEqual({
      ok: false,
      reason: "identity-ambiguous"
    });
    expect(confirmLiveProviderInventoryIdentity(failedInventory)).toEqual({
      ok: false,
      reason: "live-read"
    });
    expect(JSON.stringify(partialInventory)).not.toContain("identityScope\":\"exact");
  });

  it("matches live inventory identity only when sanitized exact proof artifacts satisfy the shared contract", async () => {
    const inventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "vercel",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "vercel",
          environment: "preview",
          commandKind: "env.list",
          status: "success",
          exitCode: 0,
          durationMs: 12,
          stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
          stderrSummary: "",
          stdoutLines: 1,
          stderrLines: 0,
          stdoutBytes: 42,
          stderrBytes: 0,
          outputRedacted: true,
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
            ]
          },
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["env-list-read"]
          }
        }
      ]
    });

    expect(inventory.rows[0]).toMatchObject({
      liveStatus: "found",
      identityMatch: "matched",
      identityScope: "partial",
      permissionSummary: "read-ok",
      driftSummary: "unknown",
      facts: ["env-list-read"]
    });
    expect(inventory.rows[0]?.missingProof).toBeUndefined();
    expect(confirmLiveProviderInventoryIdentity(inventory)).toEqual({ ok: true });
    expect(JSON.stringify(inventory)).not.toContain("prj_");
    expect(JSON.stringify(inventory)).not.toContain("dashboard.");
  });

  it("uses identity candidates only to reduce missing proof guidance while keeping identity ambiguous", async () => {
    const inventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "clerk",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "clerk",
          environment: "preview",
          commandKind: "auth.apps.list",
          status: "success",
          exitCode: 0,
          durationMs: 12,
          stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
          stderrSummary: "",
          stdoutLines: 1,
          stderrLines: 0,
          stdoutBytes: 42,
          stderrBytes: 0,
          outputRedacted: true,
          identityCandidates: {
            kind: "provider-identity-candidates",
            evaluator: "provider-specific-identity-candidate-parser",
            labels: [
              "stable-provider-identity",
              "provider-owner-identity",
              "provider-resource-id",
              "provider-environment-scope"
            ]
          }
        }
      ]
    });

    expect(inventory.rows[0]).toMatchObject({
      liveStatus: "unknown",
      identityMatch: "ambiguous",
      identityScope: "none",
      permissionSummary: "read-ok",
      missingProof: [
        "provider-specific-identity-parser",
        "ledger-comparable-identity",
        "manifest-resource-name-match",
        "ledger-external-id-match"
      ]
    });
    expect(confirmLiveProviderInventoryIdentity(inventory)).toEqual({
      ok: false,
      reason: "identity-ambiguous"
    });
    expect(JSON.stringify(inventory)).not.toContain("exact");
  });

  it("keeps Vercel inventory ambiguous and confirmation refused when preview candidates are present", async () => {
    const inventory = await createLiveProviderInventory({
      localInventory: await createProviderInventory({
        cwd: "/tmp/no-state",
        manifest: createDefaultManifest("acme-crm"),
        service: "vercel",
        environment: "preview",
        ledgerRows: []
      }),
      readResults: [
        {
          service: "vercel",
          environment: "preview",
          commandKind: "env.list",
          status: "success",
          exitCode: 0,
          durationMs: 12,
          stdoutSummary: "<redacted provider stdout: 2 lines, 90 bytes>",
          stderrSummary: "",
          stdoutLines: 2,
          stderrLines: 0,
          stdoutBytes: 90,
          stderrBytes: 0,
          outputRedacted: true,
          identityCandidates: {
            kind: "provider-identity-candidates",
            evaluator: "provider-specific-identity-candidate-parser",
            labels: ["provider-environment-scope", "provider-project-link-proof"]
          },
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["expected-env-names", "preview-environment", "env-list-read"]
          }
        }
      ]
    });

    expect(inventory.rows[0]).toMatchObject({
      liveStatus: "found",
      identityMatch: "ambiguous",
      identityScope: "partial",
      permissionSummary: "read-ok",
      missingProof: [
        "provider-specific-identity-parser",
        "stable-provider-identity",
        "ledger-comparable-identity",
        "manifest-resource-name-match",
        "ledger-external-id-match",
        "provider-owner-identity",
        "provider-resource-id"
      ]
    });
    expect(confirmLiveProviderInventoryIdentity(inventory)).toEqual({
      ok: false,
      reason: "identity-ambiguous"
    });
    expect(JSON.stringify(inventory)).not.toContain("identityMatch\":\"matched");
    expect(JSON.stringify(inventory)).not.toContain("identityScope\":\"exact");
  });

  it("writes local provider link state only when the ledger row is planned or active", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-provider-link-"));
    try {
      const rows = parseProviderLedger(
        [
          ledgerHeader,
          "| row-convex-preview | convex | deployment | preview | team | acme-crm-preview | convex-preview | preview deployment | jc | 2026-06-21 | remove after tests | planned | convex dashboard delete |  | evidence/provider.md | ok |"
        ].join("\n")
      );

      const result = await linkLedgerBackedProviderResource({
        cwd: dir,
        service: "convex",
        environment: "preview",
        resourceType: "deployment",
        name: "acme-crm-preview",
        ledgerRows: rows
      });

      expect(result.ok).toBe(true);
      expect(result.evidence).toBe("ledger-local-inventory");
      const state = await readProviderLinkState(dir);
      expect(state.links).toContainEqual(
        expect.objectContaining({
          service: "convex",
          environment: "preview",
          resourceType: "deployment",
          name: "acme-crm-preview",
          ledgerStatus: "planned"
        })
      );
      expect(JSON.stringify(state)).not.toContain("row-convex-preview");
      expect(JSON.stringify(state)).not.toContain("convex-preview");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("blocks link for missing, incomplete, or blocked ledger rows without writing state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-provider-link-blocked-"));
    try {
      const incompleteRows = parseProviderLedger(
        [
          ledgerHeader,
          "| row-incomplete | vercel | project | preview |  | acme-crm | vercel-project | preview web app | jc | 2026-06-21 | remove after tests | planned |  |  |  | ok |",
          "| row-blocked | clerk | application | preview | team | acme-crm-preview | clerk-app | preview auth app | jc | 2026-06-21 | remove after tests | cleaned | clerk dashboard delete | 2026-06-22 | evidence/provider.md | ok |"
        ].join("\n")
      );

      for (const input of [
        { service: "vercel", resourceType: "project", name: "missing-resource", ledgerRows: parseProviderLedger(ledgerHeader) },
        { service: "vercel", resourceType: "project", name: "acme-crm", ledgerRows: incompleteRows },
        { service: "clerk", resourceType: "application", name: "acme-crm-preview", ledgerRows: incompleteRows }
      ] as const) {
        const result = await linkLedgerBackedProviderResource({
          cwd: dir,
          environment: "preview",
          ...input
        });

        expect(result.ok).toBe(false);
        expect(result).toHaveProperty("decision");
        if (!result.ok) {
          expect(result.decision.ok).toBe(false);
          expect(result.decision.reason).not.toBeUndefined();
        }
      }

      await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not leak exact external ids in local provider link state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-provider-link-redaction-"));
    try {
      const externalId = "external-secret-id-should-not-leak-12345";
      const rows = parseProviderLedger(
        [
          ledgerHeader,
          `| row-convex-preview | convex | deployment | preview | team | acme-crm-preview | ${externalId} | preview deployment | jc | 2026-06-21 | remove after tests | planned | convex dashboard delete |  | evidence/provider.md | ok |`
        ].join("\n")
      );

      await linkLedgerBackedProviderResource({
        cwd: dir,
        service: "convex",
        environment: "preview",
        resourceType: "deployment",
        name: "acme-crm-preview",
        ledgerRows: rows
      });

      const state = await readProviderLinkState(dir);
      expect(JSON.stringify(state)).not.toContain(externalId);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prints adopt proposals without writing root ledger truth or leaking raw external identifiers", () => {
    const proposal = buildProviderAdoptProposal({
      service: "clerk",
      environment: "production",
      resourceType: "application",
      name: "acme-crm-production",
      externalIdOrUrl: "sk_live_secret_123456789",
      ownerAccountOrProject: "cardinal",
      purpose: "production auth application",
      createdBy: "jc",
      createdAt: "2026-06-21",
      expectedCleanupTriggerOrDate: "project retirement",
      cleanupCommandOrProcedure: "delete through Clerk dashboard",
      evidenceLinkOrPath: "docs/evidence/clerk-production.md",
      notes: "adopted existing resource"
    });

    expect(proposal.mode).toBe("print-only");
    expect(proposal.lines.join("\n")).toContain("Provider ledger proposal");
    expect(proposal.lines.join("\n")).toContain("external id/url: redacted");
    expect(JSON.stringify(proposal)).not.toContain("sk_live_secret_123456789");
    expect(JSON.stringify(proposal)).not.toContain("local-cloud");
  });
});
