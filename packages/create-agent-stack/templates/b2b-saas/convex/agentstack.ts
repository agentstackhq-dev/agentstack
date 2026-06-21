import { createAppTelemetry, createRuntimeContext } from "../packages/agentstack-runtime/src/index.js";
import { appConfig } from "../packages/config/src/index.js";
import {
  getWorkspaceStatusChecklistProgress,
  getWorkspaceStatusSeed
} from "../packages/domain/src/index.js";
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
  journeyId: "journey_workspace_status_demo"
});

const convexWorkspaceStatus = getWorkspaceStatusSeed();
const convexWorkspaceStatusProgress = getWorkspaceStatusChecklistProgress(convexWorkspaceStatus);

export const convexWorkspaceStatusSpanAnchor = convexTelemetryForDemoActor.span("convex.workspace_status.seed", {
  workspaceId: convexWorkspaceStatus.workspaceId,
  completed: convexWorkspaceStatusProgress.completed,
  total: convexWorkspaceStatusProgress.total
});

export const convexWorkspaceStatusJourneyAnchor = convexTelemetryForDemoActor.journey(
  "workspace-status",
  "seeded",
  {
    workspaceId: convexWorkspaceStatus.workspaceId,
    phase: convexWorkspaceStatus.phase,
    requiredRemaining: convexWorkspaceStatusProgress.requiredRemaining
  }
);

export const convexAnchor = {
  surface: "convex",
  purpose: "Convex workspace status functions and schema modules live here.",
  workspaceStatusSeed: convexWorkspaceStatus,
  workspaceStatusProgress: convexWorkspaceStatusProgress,
  saasSpine: agentstackSaasSpine
};
