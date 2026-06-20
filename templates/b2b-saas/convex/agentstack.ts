import { createAppTelemetry, createRuntimeContext } from "../packages/agentstack-runtime/src/index.js";
import { appConfig } from "../packages/config/src/index.js";
import { billingSubscriptionUpdatedEvent } from "../packages/telemetry/src/index.js";

export const convexRuntime = createRuntimeContext({
  appSlug: appConfig.slug,
  environment: appConfig.defaultEnvironment,
  surface: "convex"
});

export const convexTelemetry = createAppTelemetry(convexRuntime);

export const convexBillingTelemetryAnchor = convexTelemetry.event(billingSubscriptionUpdatedEvent, {
  plan: "team",
  seatCount: 5
});

export const convexAnchor = {
  surface: "convex",
  purpose: "Add Convex functions, auth membership checks, and schema modules here."
};
