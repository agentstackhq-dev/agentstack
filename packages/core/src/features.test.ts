import { describe, expect, it } from "vitest";
import { parseFeatureName, planFeatureFiles } from "./features.js";

describe("feature planning", () => {
  it("parses feature names into slug, title, and camel case", () => {
    expect(parseFeatureName("Customer Invoices")).toEqual({
      input: "Customer Invoices",
      slug: "customer-invoices",
      title: "Customer Invoices",
      camel: "customerInvoices"
    });

    expect(parseFeatureName("invoice_approvals")).toEqual({
      input: "invoice_approvals",
      slug: "invoice-approvals",
      title: "Invoice Approvals",
      camel: "invoiceApprovals"
    });
  });

  it("refuses invalid feature names with clear errors", () => {
    expect(() => parseFeatureName("")).toThrow("Feature name is required.");
    expect(() => parseFeatureName("!!!")).toThrow(
      "Feature name must contain at least one letter or number."
    );
    expect(() => parseFeatureName("admin/root")).toThrow(
      "Feature name can only contain letters, numbers, spaces, underscores, and hyphens."
    );
  });

  it("validates supported surfaces and backend for this slice", () => {
    expect(() =>
      planFeatureFiles("invoices", {
        surfaces: ["web", "desktop"],
        backend: "convex"
      })
    ).toThrow("Unsupported feature surface \"desktop\". Supported surfaces: web, mobile.");

    expect(() =>
      planFeatureFiles("invoices", {
        surfaces: ["web"],
        backend: "postgres"
      })
    ).toThrow("Unsupported feature backend \"postgres\". Supported backend: convex.");
  });

  it("plans deterministic files for selected surfaces and convex backend", () => {
    const plan = planFeatureFiles("Invoices", {
      surfaces: ["mobile", "web"],
      backend: "convex"
    });

    expect(plan.name).toEqual({
      input: "Invoices",
      slug: "invoices",
      title: "Invoices",
      camel: "invoices"
    });
    expect(plan.files.map((file) => file.path)).toEqual([
      "packages/domain/src/features/invoices.ts",
      "convex/features/invoices.ts",
      "apps/web/src/features/invoices.ts",
      "apps/mobile/src/features/invoices.ts",
      "packages/telemetry/src/features/invoices.ts",
      "docs/agentstack/features/invoices.md"
    ]);
  });

  it("omits unselected surface files while keeping shared anchors", () => {
    const plan = planFeatureFiles("Shipment Notes", {
      surfaces: ["web"],
      backend: "convex"
    });

    expect(plan.files.map((file) => file.path)).toEqual([
      "packages/domain/src/features/shipment-notes.ts",
      "convex/features/shipment-notes.ts",
      "apps/web/src/features/shipment-notes.ts",
      "packages/telemetry/src/features/shipment-notes.ts",
      "docs/agentstack/features/shipment-notes.md"
    ]);
  });

  it("generates TypeScript and documentation content using relative imports", () => {
    const plan = planFeatureFiles("Customer Invoices", {
      surfaces: ["web", "mobile"],
      backend: "convex"
    });

    const files = Object.fromEntries(plan.files.map((file) => [file.path, file.content]));

    expect(files["convex/features/customer-invoices.ts"]).toContain(
      "from \"../../packages/domain/src/features/customer-invoices.js\";"
    );
    expect(files["apps/web/src/features/customer-invoices.ts"]).toContain(
      "from \"../../../../packages/domain/src/features/customer-invoices.js\";"
    );
    expect(files["apps/mobile/src/features/customer-invoices.ts"]).toContain(
      "from \"../../../../packages/domain/src/features/customer-invoices.js\";"
    );
    expect(files["packages/telemetry/src/features/customer-invoices.ts"]).toContain(
      "export const customerInvoicesTelemetry"
    );
    expect(files["docs/agentstack/features/customer-invoices.md"]).toContain(
      "# Customer Invoices Feature"
    );
  });
});
