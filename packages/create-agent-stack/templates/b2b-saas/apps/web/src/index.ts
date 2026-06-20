import { createAppTelemetry, createRuntimeContext } from "../../../packages/agentstack-runtime/src/index.js";
import { appConfig } from "../../../packages/config/src/index.js";
import { onboardingStepCompletedEvent } from "../../../packages/telemetry/src/index.js";

export const webRuntime = createRuntimeContext({
  appSlug: appConfig.slug,
  environment: appConfig.defaultEnvironment,
  surface: "web"
});

export const webTelemetry = createAppTelemetry(webRuntime);

export const webTelemetryForDemoActor = webTelemetry.identify({
  actorId: "demo-user",
  orgId: "demo-org",
  journeyId: "journey_onboarding_demo"
});

export const webOnboardingTelemetryAnchor = webTelemetryForDemoActor.event(onboardingStepCompletedEvent, {
  step: "workspace-created",
  workspaceId: "demo-workspace"
});

export const webOnboardingSpanAnchor = webTelemetryForDemoActor.span("web.onboarding.render", {
  screen: "onboarding"
});

export const webOnboardingJourneyAnchor = webTelemetryForDemoActor.journey(
  "onboarding",
  "workspace-created",
  { workspaceId: "demo-workspace", email: "founder@example.com" }
);

export const webAnchor = "Add web product routes and components here.";
