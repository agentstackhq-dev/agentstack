import { createAppTelemetry, createRuntimeContext } from "../../../packages/agentstack-runtime/src/index.js";
import { appConfig } from "../../../packages/config/src/index.js";
import {
  getWorkspaceStatusChecklistProgress,
  getWorkspaceStatusSeed
} from "../../../packages/domain/src/index.js";

export const mobileRuntime = createRuntimeContext({
  appSlug: appConfig.slug,
  environment: appConfig.defaultEnvironment,
  surface: "mobile"
});

export const mobileTelemetry = createAppTelemetry(mobileRuntime);

export const mobileTelemetryForDemoActor = mobileTelemetry.identify({
  actorId: "demo-user",
  orgId: "demo-org",
  journeyId: "journey_workspace_status_demo"
});

const mobileWorkspaceStatus = getWorkspaceStatusSeed();
const mobileWorkspaceStatusProgress = getWorkspaceStatusChecklistProgress(mobileWorkspaceStatus);

export const mobileWorkspaceStatusSpanAnchor = mobileTelemetryForDemoActor.span("mobile.workspace_status.render", {
  screen: "workspace-status",
  completed: mobileWorkspaceStatusProgress.completed,
  total: mobileWorkspaceStatusProgress.total
});

export const mobileWorkspaceStatusJourneyAnchor = mobileTelemetryForDemoActor.journey(
  "workspace-status",
  "rendered",
  {
    workspaceId: mobileWorkspaceStatus.workspaceId,
    phase: mobileWorkspaceStatus.phase,
    requiredRemaining: mobileWorkspaceStatusProgress.requiredRemaining
  }
);

export const mobileWorkspaceStatusAnchor = {
  status: mobileWorkspaceStatus,
  progress: mobileWorkspaceStatusProgress
};

export const mobileAnchor = "Expo workspace status component renders the generated runnable vertical.";
