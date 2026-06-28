export function removedBillingPlanGeneratorDiagnostic(): string[] {
  return [
    "FAIL billing-plan.removed",
    "The generated billing-plan anchor path was removed by the lean Agentstack contract.",
    "Fix: Configure billing.entitlements in agentstack.config.ts and run agentstack billing bootstrap --env preview --confirm-live-mutation."
  ];
}
