import { describe, expect, it } from "vitest";
import { removedBillingPlanGeneratorDiagnostic } from "./billing-plans.js";

describe("billing plan planning", () => {
  it("explains that generated billing plan anchors were removed", () => {
    expect(removedBillingPlanGeneratorDiagnostic()).toEqual([
      "FAIL billing-plan.removed",
      "The generated billing-plan anchor path was removed by the lean Agentstack contract.",
      "Fix: Configure billing.entitlements in agentstack.config.ts and run agentstack billing bootstrap --env preview --confirm-live-mutation."
    ]);
  });
});
