import { createAppTelemetry, createRuntimeContext } from "../../../packages/agentstack-runtime/src/index.js";
import { appConfig } from "../../../packages/config/src/index.js";
import { authenticationSessionStartedEvent } from "../../../packages/telemetry/src/index.js";

export const mobileRuntime = createRuntimeContext({
  appSlug: appConfig.slug,
  environment: appConfig.defaultEnvironment,
  surface: "mobile"
});

export const mobileTelemetry = createAppTelemetry(mobileRuntime);

export const mobileAuthenticationTelemetryAnchor = mobileTelemetry.event(authenticationSessionStartedEvent, {
  method: "passkey",
  workspaceId: "demo-workspace"
});

export const mobileAnchor = "Add Expo screens and native integrations here.";
