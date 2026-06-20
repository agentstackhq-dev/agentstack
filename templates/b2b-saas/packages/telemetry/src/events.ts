export const appTelemetryEvents = [
  "authentication.session.started",
  "onboarding.step.completed",
  "billing.subscription.updated"
] as const;

export type AppTelemetryEvent = (typeof appTelemetryEvents)[number];
