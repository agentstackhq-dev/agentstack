export type WorkspaceStatusPhase = "setup" | "active" | "attention";

export type WorkspaceStatusChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
};

export type WorkspaceStatus = {
  workspaceId: string;
  workspaceName: string;
  phase: WorkspaceStatusPhase;
  plan: "free" | "pro";
  memberCount: number;
  openTasks: number;
  lastUpdatedAt: string;
  checklist: WorkspaceStatusChecklistItem[];
};

export const workspaceStatusChecklistSeed = [
  { id: "profile", label: "Workspace profile", complete: true, required: true },
  { id: "team", label: "Invite team", complete: true, required: true },
  { id: "plan", label: "Confirm workspace plan", complete: false, required: false },
  { id: "mobile", label: "Open mobile companion", complete: false, required: false }
] as const satisfies readonly WorkspaceStatusChecklistItem[];

export const workspaceStatusSeed = {
  workspaceId: "demo-workspace",
  workspaceName: "__APP_NAME__",
  phase: "setup",
  plan: "pro",
  memberCount: 5,
  openTasks: 2,
  lastUpdatedAt: "2026-06-20T12:00:00.000Z",
  checklist: workspaceStatusChecklistSeed.map((item) => ({ ...item }))
} satisfies WorkspaceStatus;

export function getWorkspaceStatusSeed(): WorkspaceStatus {
  return {
    ...workspaceStatusSeed,
    checklist: workspaceStatusSeed.checklist.map((item) => ({ ...item }))
  };
}

export function getWorkspaceStatusChecklistProgress(status: WorkspaceStatus): {
  completed: number;
  total: number;
  requiredRemaining: number;
} {
  return {
    completed: status.checklist.filter((item) => item.complete).length,
    total: status.checklist.length,
    requiredRemaining: status.checklist.filter((item) => item.required && !item.complete).length
  };
}

export function getWorkspaceStatusSummary(status: WorkspaceStatus): string {
  const progress = getWorkspaceStatusChecklistProgress(status);
  return `${status.workspaceName} is ${progress.completed}/${progress.total} checklist items complete.`;
}
