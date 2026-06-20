import { createAppTelemetry, createRuntimeContext } from "../../../packages/agentstack-runtime/src/index.js";
import { appConfig } from "../../../packages/config/src/index.js";
import { authenticationSessionStartedEvent } from "../../../packages/telemetry/src/index.js";

export const mobileRuntime = createRuntimeContext({
  appSlug: appConfig.slug,
  environment: appConfig.defaultEnvironment,
  surface: "mobile"
});

export const mobileTelemetry = createAppTelemetry(mobileRuntime);

export const mobileTelemetryForDemoActor = mobileTelemetry.identify({
  actorId: "demo-user",
  orgId: "demo-org",
  journeyId: "journey_authentication_demo"
});

export const mobileAuthenticationTelemetryAnchor = mobileTelemetryForDemoActor.event(authenticationSessionStartedEvent, {
  method: "passkey",
  workspaceId: "demo-workspace"
});

export const mobileAuthenticationSpanAnchor = mobileTelemetryForDemoActor.span("mobile.authentication.start", {
  screen: "sign-in",
  sessionToken: "demo-session-token"
});

export const mobileAuthenticationJourneyAnchor = mobileTelemetryForDemoActor.journey(
  "authentication",
  "session-started",
  { method: "passkey", phone: "+15555550123" }
);

export const mobileAnchor = "Add Expo screens and native integrations here.";
