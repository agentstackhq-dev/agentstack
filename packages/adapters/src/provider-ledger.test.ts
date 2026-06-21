import { describe, expect, it } from "vitest";
import { enforceProviderLedgerResource, parseProviderLedger } from "./provider-ledger.js";

const ledgerHeader = [
  "## Ledger",
  "",
  "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
].join("\n");

describe("provider resource ledger", () => {
  it("reports incomplete planned and active rows with specific missing fields", () => {
    const rows = parseProviderLedger(
      [
        ledgerHeader,
        "| convex-preview | convex | deployment | preview |  | acme-crm-preview |  |  |  |  |  | planned |  |  |  | |",
        "| vercel-preview | vercel | project | preview | Platform | acme-crm | https://vercel.com/acme | Preview web app | Agentstack | 2026-06-21 | Wave 0 complete | active |  |  |  | |",
        ""
      ].join("\n")
    );

    expect(
      enforceProviderLedgerResource(rows, {
        provider: "convex",
        environment: "preview",
        resourceType: "deployment",
        resourceName: "acme-crm-preview"
      })
    ).toEqual({
      ok: false,
      reason: "incomplete",
      path: "docs/provider-resource-ledger.md",
      row: rows[0],
      missingFields: [
        "owner account/project",
        "purpose",
        "created by",
        "created at",
        "expected cleanup trigger/date",
        "cleanup command/procedure",
        "evidence link/path"
      ]
    });
    expect(
      enforceProviderLedgerResource(rows, {
        provider: "vercel",
        environment: "preview",
        resourceType: "project",
        resourceName: "acme-crm"
      })
    ).toMatchObject({
      ok: false,
      reason: "incomplete",
      missingFields: ["cleanup command/procedure", "evidence link/path"]
    });
  });

  it("parses only the Ledger section and returns no rows for an empty ledger table", () => {
    const rows = parseProviderLedger(
      [
        "# Provider Resource Ledger",
        "",
        "## Status Taxonomy",
        "",
        "| Status | Meaning |",
        "| --- | --- |",
        "| planned | Approved for bounded provider mutation. |",
        "| active | Existing provider resource under management. |",
        "",
        "## Required Fields",
        "",
        "| Field | Required for |",
        "| --- | --- |",
        "| Owner | planned, active |",
        "| Purpose | planned, active |",
        "",
        ledgerHeader,
        ""
      ].join("\n")
    );

    expect(rows).toEqual([]);
  });

  it("does not synthesize aliases or generated ids beyond the exact ledger schema", () => {
    const rows = parseProviderLedger(
      [
        ledgerHeader,
        "|  | convex | deployment | preview | Platform | acme-crm-preview |  | Preview backend | Agentstack | 2026-06-21 | Wave 0 complete | planned | docs/runbooks/cleanup.md |  | docs/evidence/convex-preview.md | |",
        ""
      ].join("\n")
    );

    expect(rows[0]).toMatchObject({
      id: "",
      resourceName: "acme-crm-preview",
      ownerAccountOrProject: "Platform",
      status: "planned"
    });
  });

  it("throws provider.ledger.invalid for unknown status and wrong Ledger cell counts", () => {
    expect(() =>
      parseProviderLedger(
        [
          ledgerHeader,
          "| convex-preview | convex | deployment | preview | Platform | acme-crm-preview |  | Preview backend | Agentstack | 2026-06-21 | Wave 0 complete | experimental | pnpm exec convex deploy --preview-name acme-crm-preview |  | docs/evidence/convex-preview.md | |",
          ""
        ].join("\n")
      )
    ).toThrow("provider.ledger.invalid");

    expect(() =>
      parseProviderLedger(
        [
          ledgerHeader,
          "| convex-preview | convex | deployment | preview | Platform | acme-crm-preview |  | Preview backend | Agentstack |",
          ""
        ].join("\n")
      )
    ).toThrow("provider.ledger.invalid");
  });

  it("does not echo malformed row contents in invalid cell count diagnostics", () => {
    const secretLikeValue = "sk-test-this-value-must-not-leak-1234567890";
    const malformedRow = `| convex-preview | convex | deployment | preview | Platform | ${secretLikeValue} |`;

    expect(() =>
      parseProviderLedger(
        [
          ledgerHeader,
          malformedRow,
          ""
        ].join("\n")
      )
    ).toThrow(/provider\.ledger\.invalid/);

    try {
      parseProviderLedger([ledgerHeader, malformedRow, ""].join("\n"));
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(secretLikeValue);
      expect(message).not.toContain(malformedRow);
      return;
    }

    throw new Error("Expected parseProviderLedger to reject the malformed row.");
  });
});
