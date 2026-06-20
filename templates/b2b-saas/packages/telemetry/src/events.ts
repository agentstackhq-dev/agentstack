export type AppTelemetrySurface = "web" | "mobile" | "convex";

export type AppTelemetryStateType = "string" | "number" | "boolean" | "json";

export type AppTelemetryDefinition<
  TName extends string = string,
  TState extends Record<string, AppTelemetryStateType> = Record<string, AppTelemetryStateType>
> = {
  readonly name: TName;
  readonly journey: string;
  readonly surfaces: readonly AppTelemetrySurface[];
  readonly schemaVersion: "app.event.v1";
  readonly state: TState;
};

export const authenticationSessionStartedEvent = {
  name: "authentication.session.started",
  journey: "authentication",
  surfaces: ["web", "mobile", "convex"],
  schemaVersion: "app.event.v1",
  state: {
    method: "string",
    workspaceId: "string"
  }
} as const satisfies AppTelemetryDefinition;

export const onboardingStepCompletedEvent = {
  name: "onboarding.step.completed",
  journey: "onboarding",
  surfaces: ["web", "mobile"],
  schemaVersion: "app.event.v1",
  state: {
    step: "string",
    workspaceId: "string"
  }
} as const satisfies AppTelemetryDefinition;

export const billingSubscriptionUpdatedEvent = {
  name: "billing.subscription.updated",
  journey: "billing",
  surfaces: ["web", "convex"],
  schemaVersion: "app.event.v1",
  state: {
    plan: "string",
    seatCount: "number"
  }
} as const satisfies AppTelemetryDefinition;

export const appTelemetryEvents = [
  authenticationSessionStartedEvent,
  onboardingStepCompletedEvent,
  billingSubscriptionUpdatedEvent
] as const;

export type AppTelemetryEvent = (typeof appTelemetryEvents)[number];
export type AppTelemetryEventName = AppTelemetryEvent["name"];
