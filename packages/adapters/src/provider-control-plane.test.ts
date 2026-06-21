import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultManifest } from "@agentstack/core";
import { describe, expect, it } from "vitest";
import {
  buildProviderAdoptProposal,
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
