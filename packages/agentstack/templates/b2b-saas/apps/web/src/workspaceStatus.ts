export type WorkspaceStatusChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
};

export type WorkspaceStatus = {
  workspaceId: string;
  workspaceName: string;
  phase: "setup" | "active" | "attention";
  plan: "free" | "pro";
  memberCount: number;
  openTasks: number;
  checklist: WorkspaceStatusChecklistItem[];
};

export function getWorkspaceStatusSeed(): WorkspaceStatus {
  return {
    workspaceId: "demo-workspace",
    workspaceName: "__APP_NAME__",
    phase: "setup",
    plan: "pro",
    memberCount: 3,
    openTasks: 4,
    checklist: [
      { id: "auth", label: "Connect Clerk auth", complete: true, required: true },
      { id: "data", label: "Load protected Convex data", complete: true, required: true },
      { id: "deploy", label: "Deploy Vercel preview", complete: false, required: true }
    ]
  };
}

export function getWorkspaceStatusChecklistProgress(status: WorkspaceStatus) {
  const completed = status.checklist.filter((item) => item.complete).length;
  const requiredRemaining = status.checklist.filter((item) => item.required && !item.complete).length;

  return {
    completed,
    total: status.checklist.length,
    requiredRemaining
  };
}

export function getWorkspaceStatusSummary(status: WorkspaceStatus): string {
  const progress = getWorkspaceStatusChecklistProgress(status);
  return `${progress.completed} of ${progress.total} setup checks complete for ${status.workspaceName}.`;
}
