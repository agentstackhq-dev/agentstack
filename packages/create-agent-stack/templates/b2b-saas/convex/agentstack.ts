import { createAppTelemetry, createRuntimeContext } from "../packages/agentstack-runtime/src/index.js";
import { appConfig } from "../packages/config/src/index.js";
import { billingSubscriptionUpdatedEvent } from "../packages/telemetry/src/index.js";
import { agentstackSaasSpine } from "./saasSpine.js";

export const convexRuntime = createRuntimeContext({
  appSlug: appConfig.slug,
  environment: appConfig.defaultEnvironment,
  surface: "convex"
});

export const convexTelemetry = createAppTelemetry(convexRuntime);

export const convexTelemetryForDemoActor = convexTelemetry.identify({
  actorId: "demo-admin",
  orgId: "demo-org",
  journeyId: "journey_billing_demo"
});

export const convexBillingTelemetryAnchor = convexTelemetryForDemoActor.event(billingSubscriptionUpdatedEvent, {
  plan: "team",
  seatCount: 5
});

export const convexBillingSpanAnchor = convexTelemetryForDemoActor.span("convex.billing.subscription.update", {
  plan: "team"
});

export const convexBillingJourneyAnchor = convexTelemetryForDemoActor.journey(
  "billing",
  "subscription-updated",
  { plan: "team", email: "billing@example.com" }
);

export const convexAnchor = {
  surface: "convex",
  purpose: "Add Convex functions, auth membership checks, and schema modules here.",
  saasSpine: agentstackSaasSpine
};
