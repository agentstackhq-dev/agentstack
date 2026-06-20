import { createAppTelemetry, createRuntimeContext } from "../../../packages/agentstack-runtime/src/index.js";
import { appConfig } from "../../../packages/config/src/index.js";
import { onboardingStepCompletedEvent } from "../../../packages/telemetry/src/index.js";

export const webRuntime = createRuntimeContext({
  appSlug: appConfig.slug,
  environment: appConfig.defaultEnvironment,
  surface: "web"
});

export const webTelemetry = createAppTelemetry(webRuntime);

export const webOnboardingTelemetryAnchor = webTelemetry.event(onboardingStepCompletedEvent, {
  step: "workspace-created",
  workspaceId: "demo-workspace"
});

export const webAnchor = "Add web product routes and components here.";
