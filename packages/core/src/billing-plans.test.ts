import { describe, expect, it } from "vitest";
import { parseBillingPlanName, planBillingPlanFiles } from "./billing-plans.js";

describe("billing plan planning", () => {
  it("parses billing plan names into slug, title, camel, and pascal case", () => {
    expect(parseBillingPlanName("Growth Pro")).toEqual({
      input: "Growth Pro",
      slug: "growth-pro",
      title: "Growth Pro",
      camel: "growthPro",
      pascal: "GrowthPro"
    });
  });

  it("plans full-stack billing anchors for a plan", () => {
    const plan = planBillingPlanFiles("Pro", {
      entitlements: ["seats.included", "feature.auditLog"],
      seats: 10
    });

    expect(plan.files.map((file) => file.path)).toEqual([
      "packages/domain/src/billing-plans/pro.ts",
      "convex/billing-plans/pro.ts",
      "apps/web/src/billing-plans/pro.ts",
      "apps/mobile/src/billing-plans/pro.ts",
      "packages/telemetry/src/billing-plans/pro.ts",
      "docs/agentstack/billing-plans/pro.md"
    ]);
    expect(plan.files[0]?.content).toContain("proBillingPlan");
    expect(plan.files[0]?.content).toContain("type ProBillingPlanEntitlement");
    expect(plan.files[1]?.content).toContain("billingSubscriptions");
    expect(plan.files[2]?.content).toContain('surface: "web"');
    expect(plan.files[3]?.content).toContain('surface: "mobile"');
    expect(plan.files[4]?.content).toContain("billing.plan.pro.entitlement.checked");
    expect(plan.files[5]?.content).toContain("# Pro Billing Plan");
  });

  it("defaults to seats.included and one included seat", () => {
    const plan = planBillingPlanFiles("Starter", {
      entitlements: [],
      seats: undefined
    });

    expect(plan.entitlements).toEqual(["seats.included"]);
    expect(plan.seats).toBe(1);
  });

  it("rejects invalid billing plan and entitlement input", () => {
    expect(() => parseBillingPlanName("!!!")).toThrow(
      "Billing plan name must contain at least one letter or number."
    );
    expect(() =>
      planBillingPlanFiles("Pro", {
        entitlements: ["Feature Audit"],
        seats: 1
      })
    ).toThrow('Invalid entitlement key "Feature Audit".');
    expect(() =>
      planBillingPlanFiles("Pro", {
        entitlements: ["seats.included"],
        seats: 0
      })
    ).toThrow("Included seats must be a positive integer.");
  });

  it("generates safe TypeScript identifiers and plan-local entitlement types", () => {
    const plan = planBillingPlanFiles("2026 Pro", {
      entitlements: ["feature.enterpriseSso"],
      seats: 12
    });
    const domainFile = plan.files.find((file) => file.path === "packages/domain/src/billing-plans/2026-pro.ts");

    expect(plan.name).toEqual({
      input: "2026 Pro",
      slug: "2026-pro",
      title: "2026 Pro",
      camel: "plan2026Pro",
      pascal: "Plan2026Pro"
    });
    expect(domainFile?.content).toContain("plan2026ProBillingPlan");
    expect(domainFile?.content).toContain("type Plan2026ProBillingPlanEntitlement");
    expect(domainFile?.content).toContain('"feature.enterpriseSso"');
    expect(domainFile?.content).not.toMatch(/(?:const|function|type) 2026/);
    expect(domainFile?.content).not.toContain("readonly AgentstackEntitlement[]");
  });
});
