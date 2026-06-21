import { createAppTelemetry, createRuntimeContext } from "../../../packages/agentstack-runtime/src/index.js";
import { appConfig } from "../../../packages/config/src/index.js";
import {
  getWorkspaceStatusChecklistProgress,
  getWorkspaceStatusSeed
} from "../../../packages/domain/src/index.js";

export const webRuntime = createRuntimeContext({
  appSlug: appConfig.slug,
  environment: appConfig.defaultEnvironment,
  surface: "web"
});

export const webTelemetry = createAppTelemetry(webRuntime);

export const webTelemetryForDemoActor = webTelemetry.identify({
  actorId: "demo-user",
  orgId: "demo-org",
  journeyId: "journey_workspace_status_demo"
});

const webWorkspaceStatus = getWorkspaceStatusSeed();
const webWorkspaceStatusProgress = getWorkspaceStatusChecklistProgress(webWorkspaceStatus);

export const webWorkspaceStatusSpanAnchor = webTelemetryForDemoActor.span("web.workspace_status.render", {
  screen: "workspace-status",
  completed: webWorkspaceStatusProgress.completed,
  total: webWorkspaceStatusProgress.total
});

export const webWorkspaceStatusJourneyAnchor = webTelemetryForDemoActor.journey(
  "workspace-status",
  "rendered",
  {
    workspaceId: webWorkspaceStatus.workspaceId,
    phase: webWorkspaceStatus.phase,
    requiredRemaining: webWorkspaceStatusProgress.requiredRemaining
  }
);

export const webWorkspaceStatusAnchor = {
  status: webWorkspaceStatus,
  progress: webWorkspaceStatusProgress
};

export const webAnchor = "Vite React workspace status route renders the generated runnable vertical.";
